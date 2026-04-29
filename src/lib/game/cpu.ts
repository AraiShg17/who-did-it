import type { PlayerId, Question, TurnLog } from "@/lib/game/types";

type CpuQuestionContext = {
  cpuId: PlayerId;
  hand: Question;
  clueData: {
    suspects: string[];
    weapons: string[];
    locations: string[];
  };
  logs: TurnLog[];
  aiConfidence?: number;
  aiCandidates?: CpuCandidateSet;
};

export type CpuCandidateSet = {
  suspects: string[];
  weapons: string[];
  locations: string[];
};

export type CpuAiAnalysis = {
  confidence: number;
  candidates: CpuCandidateSet;
};

export type CpuDecision =
  | {
      action: "question";
      question: Question;
    }
  | {
      action: "solve";
      guess: Question;
    };

const pickRandom = <T>(list: T[]) =>
  list[Math.floor(Math.random() * list.length)];
const rollPercent = (percent: number) =>
  Math.random() * 100 < Math.max(0, Math.min(100, percent));

const clueKey = (category: "suspect" | "weapon" | "location", value: string) =>
  `${category}:${value}`;

const buildKnownHasByClue = (context: CpuQuestionContext) => {
  const participantIds = new Set<PlayerId>();
  for (const log of context.logs) {
    for (const answer of log.answers) participantIds.add(answer.participantId);
  }
  participantIds.add("player");
  participantIds.add("cpu1");
  participantIds.add("cpu2");
  participantIds.add("cpu3");
  participantIds.add("cpu4");

  const knownNotHave = new Map<PlayerId, Set<string>>();
  for (const participantId of participantIds) {
    knownNotHave.set(participantId, new Set<string>());
  }

  for (const log of context.logs) {
    const asked = [
      clueKey("suspect", log.question.suspect),
      clueKey("weapon", log.question.weapon),
      clueKey("location", log.question.location),
    ];
    for (const answer of log.answers) {
      if (!answer.hasAny) {
        const set = knownNotHave.get(answer.participantId);
        if (!set) continue;
        for (const key of asked) set.add(key);
      }
    }
  }

  const knownHas = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const log of context.logs) {
      const asked = [
        clueKey("suspect", log.question.suspect),
        clueKey("weapon", log.question.weapon),
        clueKey("location", log.question.location),
      ];
      for (const answer of log.answers) {
        if (!answer.hasAny) continue;
        const denied = knownNotHave.get(answer.participantId);
        if (!denied) continue;
        const possible = asked.filter((key) => !denied.has(key));
        if (possible.length === 1 && !knownHas.has(possible[0])) {
          knownHas.add(possible[0]);
          changed = true;
        }
      }
    }
  }

  return knownHas;
};

const collectCandidates = (context: CpuQuestionContext): CpuCandidateSet => {
  const suspects = new Set(context.clueData.suspects);
  const weapons = new Set(context.clueData.weapons);
  const locations = new Set(context.clueData.locations);
  const knownHas = buildKnownHasByClue(context);

  suspects.delete(context.hand.suspect);
  weapons.delete(context.hand.weapon);
  locations.delete(context.hand.location);

  for (const key of knownHas) {
    if (key.startsWith("suspect:"))
      suspects.delete(key.replace("suspect:", ""));
    if (key.startsWith("weapon:")) weapons.delete(key.replace("weapon:", ""));
    if (key.startsWith("location:"))
      locations.delete(key.replace("location:", ""));
  }

  return {
    suspects: [...suspects],
    weapons: [...weapons],
    locations: [...locations],
  };
};

const buildCandidateSetFromLogs = (
  cpuId: PlayerId,
  clueData: CpuQuestionContext["clueData"],
  hand: Question,
  logs: TurnLog[],
): CpuCandidateSet => {
  return collectCandidates({
    cpuId,
    hand,
    clueData,
    logs,
  });
};

const computeConfidence = (
  candidates: CpuCandidateSet,
  clueData: CpuQuestionContext["clueData"],
) => {
  const suspectConfidence =
    1 -
    Math.max(candidates.suspects.length - 1, 0) /
      Math.max(clueData.suspects.length - 1, 1);
  const weaponConfidence =
    1 -
    Math.max(candidates.weapons.length - 1, 0) /
      Math.max(clueData.weapons.length - 1, 1);
  const locationConfidence =
    1 -
    Math.max(candidates.locations.length - 1, 0) /
      Math.max(clueData.locations.length - 1, 1);

  return (suspectConfidence + weaponConfidence + locationConfidence) / 3;
};

const isNinetyPercentReady = (candidates: CpuCandidateSet) => {
  const counts = [
    candidates.suspects.length,
    candidates.weapons.length,
    candidates.locations.length,
  ];
  const fixedCount = counts.filter((count) => count === 1).length;
  const maxCount = Math.max(...counts);
  return fixedCount >= 2 && maxCount <= 2;
};

const isCpu2Ready = (candidates: CpuCandidateSet) => {
  const counts = [
    candidates.suspects.length,
    candidates.weapons.length,
    candidates.locations.length,
  ];
  const fixedCount = counts.filter((count) => count === 1).length;
  const maxCount = Math.max(...counts);
  return fixedCount >= 2 && maxCount <= 3;
};

const isReadyByCpuRule = (cpuId: PlayerId, candidates: CpuCandidateSet) => {
  if (
    candidates.suspects.length === 1 &&
    candidates.weapons.length === 1 &&
    candidates.locations.length === 1
  ) {
    return true;
  }
  if (cpuId === "cpu2") {
    return isCpu2Ready(candidates);
  }
  if (cpuId === "cpu3" || cpuId === "cpu4") {
    return isNinetyPercentReady(candidates);
  }
  return false;
};

const getTurnsSinceSolveWindow = (context: CpuQuestionContext) => {
  const ownTurns = context.logs.filter((log) => log.askerId === context.cpuId);
  let firstReadyOwnTurn = -1;

  for (let idx = 0; idx <= ownTurns.length; idx += 1) {
    const snapshotLogs = context.logs.slice(
      0,
      idx === ownTurns.length
        ? context.logs.length
        : context.logs.indexOf(ownTurns[idx]),
    );
    const snapshotCandidates = buildCandidateSetFromLogs(
      context.cpuId,
      context.clueData,
      context.hand,
      snapshotLogs,
    );
    if (isReadyByCpuRule(context.cpuId, snapshotCandidates)) {
      firstReadyOwnTurn = idx;
      break;
    }
  }

  if (firstReadyOwnTurn < 0) return 0;
  return Math.max(ownTurns.length - firstReadyOwnTurn, 0);
};

const buildBestGuess = (
  candidates: CpuCandidateSet,
  clueData: CpuQuestionContext["clueData"],
): Question => ({
  suspect: candidates.suspects[0] ?? clueData.suspects[0] ?? "",
  weapon: candidates.weapons[0] ?? clueData.weapons[0] ?? "",
  location: candidates.locations[0] ?? clueData.locations[0] ?? "",
});

const findAllNoneQuestion = (logs: TurnLog[]): Question | undefined => {
  for (let idx = logs.length - 1; idx >= 0; idx -= 1) {
    const log = logs[idx];
    const allNone =
      log.answers.length > 0 && log.answers.every((answer) => !answer.hasAny);
    if (allNone) return log.question;
  }
  return undefined;
};

export const decideCpuSolve = (context: CpuQuestionContext) => {
  const allNoneQuestion = findAllNoneQuestion(context.logs);
  if (allNoneQuestion) {
    return {
      shouldSolve: true,
      guess: allNoneQuestion,
      confidence: 1,
    };
  }

  const localCandidates = collectCandidates(context);
  const candidates = context.aiCandidates
    ? {
        suspects: localCandidates.suspects.filter((item) =>
          context.aiCandidates?.suspects.includes(item),
        ),
        weapons: localCandidates.weapons.filter((item) =>
          context.aiCandidates?.weapons.includes(item),
        ),
        locations: localCandidates.locations.filter((item) =>
          context.aiCandidates?.locations.includes(item),
        ),
      }
    : localCandidates;
  const safeCandidates: CpuCandidateSet = {
    suspects:
      candidates.suspects.length > 0
        ? candidates.suspects
        : localCandidates.suspects,
    weapons:
      candidates.weapons.length > 0
        ? candidates.weapons
        : localCandidates.weapons,
    locations:
      candidates.locations.length > 0
        ? candidates.locations
        : localCandidates.locations,
  };
  const baseConfidence = computeConfidence(safeCandidates, context.clueData);
  const ninetyReady = isNinetyPercentReady(safeCandidates);
  const cpu2Ready = isCpu2Ready(safeCandidates);
  const fullySolved =
    safeCandidates.suspects.length === 1 &&
    safeCandidates.weapons.length === 1 &&
    safeCandidates.locations.length === 1;
  const confidence =
    safeCandidates.suspects.length === 1 &&
    safeCandidates.weapons.length === 1 &&
    safeCandidates.locations.length === 1
      ? 1
      : ninetyReady
        ? 0.9
        : baseConfidence;
  const bestGuess = buildBestGuess(safeCandidates, context.clueData);
  const aiConfidence = Math.max(0, Math.min(1, context.aiConfidence ?? 1));
  const hasSingleResolvedCategory =
    safeCandidates.suspects.length === 1 ||
    safeCandidates.weapons.length === 1 ||
    safeCandidates.locations.length === 1;

  if (fullySolved) {
    return {
      shouldSolve: true,
      guess: bestGuess,
      confidence: 1,
    };
  }

  if (context.cpuId === "cpu1") {
    return {
      shouldSolve: false,
      guess: bestGuess,
      confidence,
    };
  }

  if (
    context.cpuId === "cpu3" &&
    hasSingleResolvedCategory &&
    confidence < 0.9
  ) {
    if (aiConfidence < 0.6) {
      return {
        shouldSolve: false,
        guess: bestGuess,
        confidence,
      };
    }
    return {
      shouldSolve: rollPercent(1),
      guess: bestGuess,
      confidence,
    };
  }

  if (context.cpuId === "cpu2" && !cpu2Ready) {
    return {
      shouldSolve: false,
      guess: bestGuess,
      confidence,
    };
  }

  if (context.cpuId !== "cpu2" && !ninetyReady) {
    return {
      shouldSolve: false,
      guess: bestGuess,
      confidence,
    };
  }

  if (aiConfidence < 0.9) {
    return {
      shouldSolve: false,
      guess: bestGuess,
      confidence,
    };
  }

  const turnsSinceHighConfidence = getTurnsSinceSolveWindow(context);

  if (context.cpuId === "cpu4") {
    if (!ninetyReady) {
      return {
        shouldSolve: false,
        guess: bestGuess,
        confidence,
      };
    }

    const solveChance = Math.min(15 + turnsSinceHighConfidence * 15, 100);
    return {
      shouldSolve: rollPercent(solveChance),
      guess: bestGuess,
      confidence,
    };
  }

  const solveChance = Math.min(10 + turnsSinceHighConfidence * 10, 100);

  return {
    shouldSolve: rollPercent(solveChance),
    guess: bestGuess,
    confidence,
  };
};

export const buildCpuPrompt = (context: CpuQuestionContext) => {
  const candidates = collectCandidates(context);
  return {
    system:
      'あなたは推理ゲームのCPUです。JSONのみを返してください。形式は {"action":"question","suspect":"...","weapon":"...","location":"...","confidence":0.0,"suspectCandidates":["..."],"weaponCandidates":["..."],"locationCandidates":["..."]} または {"action":"solve","suspect":"...","weapon":"...","location":"...","confidence":0.0,"suspectCandidates":["..."],"weaponCandidates":["..."],"locationCandidates":["..."]} のみです。',
    user: JSON.stringify(
      {
        instruction:
          "通常は次の質問として、人物（職業）・凶器・犯行現場を1つずつ選んでください。確信度を0〜1でconfidenceに入れてください。加えて3カテゴリそれぞれの候補配列(suspectCandidates, weaponCandidates, locationCandidates)を返してください。もし3カテゴリすべてで確信できるなら action=solve で解答宣言してください。候補外を使わず、JSONだけを返してください。",
        hand: context.hand,
        candidates,
        logs: context.logs,
      },
      null,
      2,
    ),
    fallback: {
      suspect: pickRandom(
        candidates.suspects.length > 0
          ? candidates.suspects
          : context.clueData.suspects,
      ),
      weapon: pickRandom(
        candidates.weapons.length > 0
          ? candidates.weapons
          : context.clueData.weapons,
      ),
      location: pickRandom(
        candidates.locations.length > 0
          ? candidates.locations
          : context.clueData.locations,
      ),
    },
  };
};

const sanitizeQuestion = (
  raw: Partial<Question> | undefined,
  fallback: Question,
  clueData: CpuQuestionContext["clueData"],
): Question => {
  const suspect =
    raw?.suspect && clueData.suspects.includes(raw.suspect)
      ? raw.suspect
      : fallback.suspect;
  const weapon =
    raw?.weapon && clueData.weapons.includes(raw.weapon)
      ? raw.weapon
      : fallback.weapon;
  const location =
    raw?.location && clueData.locations.includes(raw.location)
      ? raw.location
      : fallback.location;

  return { suspect, weapon, location };
};

export const sanitizeCpuDecision = (
  raw: (Partial<Question> & { action?: string }) | undefined,
  fallback: Question,
  clueData: CpuQuestionContext["clueData"],
): CpuDecision => {
  const normalized = sanitizeQuestion(raw, fallback, clueData);
  if (raw?.action === "solve") {
    return {
      action: "solve",
      guess: normalized,
    };
  }

  return {
    action: "question",
    question: normalized,
  };
};

export const sanitizeAiAnalysis = (
  raw:
    | (Partial<Question> & {
        confidence?: number;
        suspectCandidates?: string[];
        weaponCandidates?: string[];
        locationCandidates?: string[];
      })
    | undefined,
  clueData: CpuQuestionContext["clueData"],
): CpuAiAnalysis | undefined => {
  if (!raw) return undefined;
  const confidence =
    typeof raw.confidence === "number"
      ? Math.max(0, Math.min(1, raw.confidence))
      : undefined;
  if (confidence === undefined) return undefined;

  const suspects =
    raw.suspectCandidates?.filter((item) => clueData.suspects.includes(item)) ??
    [];
  const weapons =
    raw.weaponCandidates?.filter((item) => clueData.weapons.includes(item)) ??
    [];
  const locations =
    raw.locationCandidates?.filter((item) =>
      clueData.locations.includes(item),
    ) ?? [];

  return {
    confidence,
    candidates: {
      suspects: suspects.length > 0 ? suspects : clueData.suspects,
      weapons: weapons.length > 0 ? weapons : clueData.weapons,
      locations: locations.length > 0 ? locations : clueData.locations,
    },
  };
};
