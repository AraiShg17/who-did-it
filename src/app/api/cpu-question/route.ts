import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildCpuPrompt, decideCpuSolve, sanitizeAiAnalysis, sanitizeCpuDecision } from "@/lib/game/cpu";
import clueData from "@/data/clues.json";
import { getOpenAiApiKey } from "@/lib/server/openai-key";
import type { PlayerId, Question, TurnLog } from "@/lib/game/types";

type RequestBody = {
  cpuId: PlayerId;
  hand: Question;
  clueData: {
    suspects: string[];
    weapons: string[];
    locations: string[];
  };
  logs: TurnLog[];
};

const createFallbackBody = (): RequestBody => ({
  cpuId: "cpu1",
  hand: {
    suspect: clueData.suspects[0] ?? "",
    weapon: clueData.weapons[0] ?? "",
    location: clueData.locations[0] ?? "",
  },
  clueData,
  logs: [],
});

const isRequestBody = (value: unknown): value is RequestBody => {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<RequestBody>;
  return Boolean(
    body.cpuId &&
      body.hand &&
      body.clueData &&
      Array.isArray(body.clueData.suspects) &&
      Array.isArray(body.clueData.weapons) &&
      Array.isArray(body.clueData.locations) &&
      Array.isArray(body.logs),
  );
};

const parseJson = (
  text: string,
): (Partial<Question> & {
  action?: string;
  confidence?: number;
  suspectCandidates?: string[];
  weaponCandidates?: string[];
  locationCandidates?: string[];
}) | undefined => {
  const trimmed = text.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    return undefined;
  }

  try {
    return JSON.parse(match[0]) as Partial<Question> & {
      action?: string;
      confidence?: number;
      suspectCandidates?: string[];
      weaponCandidates?: string[];
      locationCandidates?: string[];
    };
  } catch {
    return undefined;
  }
};

export async function POST(req: Request) {
  let body: RequestBody = createFallbackBody();
  try {
    const parsed = (await req.json()) as unknown;
    if (isRequestBody(parsed)) {
      body = parsed;
    }
  } catch {
    // Keep fallback body when request has empty/invalid JSON.
  }

  const prompt = buildCpuPrompt(body);

  try {
    const apiKey = await getOpenAiApiKey();
    if (!apiKey) {
      return NextResponse.json({
        mode: "question",
        question: prompt.fallback,
        source: "fallback",
        reason: "OpenAI API key is not configured",
      });
    }

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const parsed = parseJson(content);
    const analysis = sanitizeAiAnalysis(parsed, body.clueData);
    const solveDecision = decideCpuSolve({
      ...body,
      aiConfidence: analysis?.confidence,
      aiCandidates: analysis?.candidates,
    });
    const decision = sanitizeCpuDecision(parsed, prompt.fallback, body.clueData);
    if (solveDecision.shouldSolve) {
      const guess = decision.action === "solve" ? decision.guess : solveDecision.guess;
      return NextResponse.json({
        mode: "solve",
        guess,
        analysis,
        source: "openai",
      });
    }

    return NextResponse.json({
      mode: "question",
      question: decision.action === "question" ? decision.question : decision.guess,
      analysis,
      source: "openai",
    });
  } catch (error) {
    console.error("cpu-question route error", error);
    return NextResponse.json({
      mode: "question",
      question: prompt.fallback,
      source: "fallback",
      reason: "OpenAI request failed",
    });
  }
}
