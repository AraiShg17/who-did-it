"use client";

import Image from "next/image";
import { Noto_Sans_JP } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { applyTurn, createInitialGame, evaluateGuess, resolveQuestion } from "@/lib/game/engine";
import { decideCpuSolve } from "@/lib/game/cpu";
import characters from "@/data/characters.json";
import type { GameState, PlayerId, Question, TurnLog } from "@/lib/game/types";
import type { CpuAiAnalysis } from "@/lib/game/cpu";

const EMPTY_QUESTION: Question = {
  suspect: "",
  weapon: "",
  location: "",
};

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "700"],
});

type UiPhase = "idle" | "preTurn" | "playerSelect" | "playerAnswer" | "dialogue";
type SpeakerId = PlayerId | "narrator";

type DialogueLine = {
  speakerId: SpeakerId;
  speakerName: string;
  text: string;
};

type InterruptCpuDecision = {
  winnerId: PlayerId;
  guess: Question;
};

type CpuApiResponse =
  | {
      mode: "question";
      question: Question;
      analysis?: CpuAiAnalysis;
    }
  | {
      mode: "solve";
      guess: Question;
      analysis?: CpuAiAnalysis;
    };

type CharacterData = {
  nameJa: string;
  nameEn: string;
  position: string;
  personality: string;
  trait: string;
  portrait: string;
  answerLines: {
    hasAny: string;
    hasNone: string;
  };
  selfAnswerLines: {
    hasAny: string;
    hasNone: string;
  };
  questionLine: string;
  waitingLine: string;
  interruptLine: string;
};

type CharactersMap = {
  player: CharacterData;
  cpu1: CharacterData;
  cpu2: CharacterData;
  cpu3: CharacterData;
  cpu4: CharacterData;
};

const characterData = characters as CharactersMap;

const CHARACTER_META: Record<
  PlayerId,
  {
    displayName: string;
    portrait: string;
  }
> = {
  player: {
    displayName: characterData.player.nameJa,
    portrait: "",
  },
  cpu1: {
    displayName: characterData.cpu1.nameJa,
    portrait: characterData.cpu1.portrait,
  },
  cpu2: {
    displayName: characterData.cpu2.nameJa,
    portrait: characterData.cpu2.portrait,
  },
  cpu3: {
    displayName: characterData.cpu3.nameJa,
    portrait: characterData.cpu3.portrait,
  },
  cpu4: {
    displayName: characterData.cpu4.nameJa,
    portrait: characterData.cpu4.portrait,
  },
};

const isCompleteQuestion = (question: Question) =>
  question.suspect.length > 0 && question.weapon.length > 0 && question.location.length > 0;

const fillTemplate = (template: string, question: Question) =>
  template
    .replace("{suspect}", question.suspect)
    .replace("{weapon}", question.weapon)
    .replace("{location}", question.location);

const buildCpuLine = (
  participantId: PlayerId,
  hasAny: boolean,
  question: Question,
  isSelfQuestion: boolean,
) => {
  const lines = isSelfQuestion
    ? characterData[participantId].selfAnswerLines
    : characterData[participantId].answerLines;
  const template = hasAny ? lines.hasAny : lines.hasNone;
  return fillTemplate(template, question);
};

const buildQuestionLine = (speakerId: PlayerId, question: Question) =>
  fillTemplate(characterData[speakerId].questionLine, question);

const buildInterruptDecision = (
  game: GameState,
  aiAnalyses: Partial<Record<PlayerId, CpuAiAnalysis>>,
): InterruptCpuDecision | null => {
  for (const participant of game.participants) {
    if (participant.id === "player") continue;
    const decision = decideCpuSolve({
      cpuId: participant.id,
      hand: participant.hand,
      clueData: game.clueData,
      logs: game.logs,
      aiConfidence: aiAnalyses[participant.id]?.confidence,
      aiCandidates: aiAnalyses[participant.id]?.candidates,
    });
    if (decision.shouldSolve) {
      return {
        winnerId: participant.id,
        guess: decision.guess,
      };
    }
  }
  return null;
};

export default function Home() {
  const [game, setGame] = useState<GameState | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [questionDraft, setQuestionDraft] = useState<Question>(EMPTY_QUESTION);
  const [guessDraft, setGuessDraft] = useState<Question>(EMPTY_QUESTION);
  const [cpuThinking, setCpuThinking] = useState(false);
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [dialogueQueue, setDialogueQueue] = useState<DialogueLine[]>([]);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [pendingLog, setPendingLog] = useState<TurnLog | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [interruptDecision, setInterruptDecision] = useState<InterruptCpuDecision | null>(null);
  const [answerReturnPhase, setAnswerReturnPhase] = useState<UiPhase>("preTurn");
  const [cpuAiAnalyses, setCpuAiAnalyses] = useState<Partial<Record<PlayerId, CpuAiAnalysis>>>({});

  const currentParticipant = useMemo(() => {
    if (!game) return null;
    return game.participants[game.turnIndex];
  }, [game]);

  const player = useMemo(
    () => game?.participants.find((participant) => participant.id === "player"),
    [game],
  );
  const currentTurnName = currentParticipant
    ? currentParticipant.id === "player"
      ? "プレイヤー"
      : CHARACTER_META[currentParticipant.id].displayName
    : "-";
  const isFinished = Boolean(game?.endResult) || Boolean(game?.revealed);
  const currentLine = dialogueQueue[dialogueIndex];
  const activeSpeaker =
    currentLine && currentLine.speakerId !== "narrator" ? currentLine.speakerId : undefined;
  const focusedSpeaker = currentParticipant?.id && currentParticipant.id !== "player" ? currentParticipant.id : null;
  const participantOrder = game?.participants ?? [];
  const waitingMessage = currentParticipant ? characterData[currentParticipant.id].waitingLine : "次の進行を待っています。";
  const interruptSpeaker = interruptDecision ? interruptDecision.winnerId : null;

  const openAnswerModal = () => {
    if (!game || isFinished) return;
    setAnswerReturnPhase(phase === "playerAnswer" ? "preTurn" : phase);
    setPhase("playerAnswer");
  };

  const startGame = () => {
    const initial = createInitialGame();
    setGame(initial);
    setPhase("playerSelect");
    setDialogueQueue([]);
    setDialogueIndex(0);
    setPendingLog(null);
    setShowHistory(false);
    setInterruptDecision(null);
    setCpuAiAnalyses({});
    setQuestionDraft({
      suspect: initial.clueData.suspects[0] ?? "",
      weapon: initial.clueData.weapons[0] ?? "",
      location: initial.clueData.locations[0] ?? "",
    });
    setGuessDraft({
      suspect: initial.clueData.suspects[0] ?? "",
      weapon: initial.clueData.weapons[0] ?? "",
      location: initial.clueData.locations[0] ?? "",
    });
  };

  const beginQuestionSequence = useCallback(
    (askerId: PlayerId, question: Question) => {
      if (!game || isFinished) return;
      const log = resolveQuestion(game, askerId, question);
      const askerName = askerId === "player" ? "プレイヤー" : CHARACTER_META[askerId].displayName;

      const lines: DialogueLine[] = [
        {
          speakerId: askerId,
          speakerName: askerName,
          text: buildQuestionLine(askerId, question),
        },
      ];

      for (const participant of game.participants) {
        const answer = log.answers.find((item) => item.participantId === participant.id);
        if (!answer) {
          continue;
        }
        lines.push({
          speakerId: participant.id,
          speakerName: CHARACTER_META[participant.id].displayName,
          text: buildCpuLine(participant.id, answer.hasAny, question, participant.id === askerId),
        });
      }

      setPendingLog(log);
      setDialogueQueue(lines);
      setDialogueIndex(0);
      setPhase("dialogue");
    },
    [game, isFinished],
  );

  const askByPlayer = () => {
    if (!game || isFinished || !isCompleteQuestion(questionDraft) || currentParticipant?.id !== "player") return;
    beginQuestionSequence("player", questionDraft);
  };

  const endGameWithGuess = useCallback((winnerId: PlayerId, guess: Question) => {
    setGame((prev) => {
      if (!prev) return prev;
      const result = evaluateGuess(prev, guess);
      return {
        ...prev,
        endResult: {
          winnerId,
          winnerName: CHARACTER_META[winnerId].displayName,
          guess,
          correct: result.correct,
        },
      };
    });
    setPhase("idle");
    setDialogueQueue([]);
    setDialogueIndex(0);
    setPendingLog(null);
    setInterruptDecision(null);
  }, []);

  const submitGuess = () => {
    const canDeclareNow = phase === "playerAnswer";
    if (!game || isFinished || !isCompleteQuestion(guessDraft) || !canDeclareNow) return;
    endGameWithGuess("player", guessDraft);
  };

  const giveUp = () => {
    const canDeclareNow = phase === "playerAnswer";
    if (!canDeclareNow) return;
    setGame((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        revealed: true,
      };
    });
    setPhase("idle");
    setDialogueQueue([]);
    setDialogueIndex(0);
    setPendingLog(null);
    setInterruptDecision(null);
  };

  useEffect(() => {
    const runCpuTurn = async (cpuId: PlayerId, hand: Question, currentGame: GameState) => {
      setCpuThinking(true);
      try {
        const response = await fetch("/api/cpu-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cpuId,
            hand,
            clueData: currentGame.clueData,
            logs: currentGame.logs,
          }),
        });

        const data = (await response.json()) as CpuApiResponse;
        const fallbackQuestion: Question = {
          suspect: currentGame.clueData.suspects[0] ?? "",
          weapon: currentGame.clueData.weapons[0] ?? "",
          location: currentGame.clueData.locations[0] ?? "",
        };
        if (data.mode === "solve") {
          setCpuAiAnalyses((prev) => ({ ...prev, [cpuId]: data.analysis }));
          endGameWithGuess(cpuId, data.guess);
          return;
        }
        setCpuAiAnalyses((prev) => ({ ...prev, [cpuId]: data.analysis }));
        const question = data.question ?? fallbackQuestion;
        beginQuestionSequence(cpuId, question);
      } catch {
        const suspect = currentGame.clueData.suspects[Math.floor(Math.random() * currentGame.clueData.suspects.length)];
        const weapon = currentGame.clueData.weapons[Math.floor(Math.random() * currentGame.clueData.weapons.length)];
        const location =
          currentGame.clueData.locations[Math.floor(Math.random() * currentGame.clueData.locations.length)];
        beginQuestionSequence(cpuId, { suspect, weapon, location });
      } finally {
        setCpuThinking(false);
      }
    };

    if (!game || isFinished || phase !== "idle" || !currentParticipant || currentParticipant.id === "player" || cpuThinking) return;
    void runCpuTurn(currentParticipant.id, currentParticipant.hand, game);
  }, [game, currentParticipant, cpuThinking, isFinished, phase, beginQuestionSequence, endGameWithGuess]);

  const advanceDialogue = () => {
    if (showHistory) return;
    if (phase !== "dialogue") return;
    if (dialogueIndex < dialogueQueue.length - 1) {
      setDialogueIndex((prev) => prev + 1);
      return;
    }

    if (pendingLog && game) {
      const nextGame = applyTurn(game, pendingLog);
      const nextInterruptDecision = buildInterruptDecision(nextGame, cpuAiAnalyses);
      const nextParticipant = nextGame.participants[nextGame.turnIndex];
      setGame(nextGame);
      setInterruptDecision(nextInterruptDecision);
      setPhase(
        nextInterruptDecision ? "preTurn" : nextParticipant?.id === "player" ? "playerSelect" : "idle",
      );
    } else {
      setPhase("idle");
    }
    setPendingLog(null);
    setDialogueQueue([]);
    setDialogueIndex(0);
  };

  const handleStageClick = () => {
    if (showHistory) return;
    if (phase === "preTurn" && interruptDecision) {
      endGameWithGuess(interruptDecision.winnerId, interruptDecision.guess);
      return;
    }
    advanceDialogue();
  };

  return (
    <main className={styles.novelRoot}>
      <div className={styles.stage} onClick={handleStageClick}>
        {showRules && (
          <div
            className={styles.rulesOverlay}
            onClick={(event) => {
              event.stopPropagation();
              setShowRules(false);
            }}
          >
            <section
              className={styles.rulesModal}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <div className={styles.historyHeader}>
                <p className={styles.historyTitle}>ルール説明</p>
                <button className={styles.historyCloseButton} onClick={() => setShowRules(false)}>
                  閉じる
                </button>
              </div>
              <p>目的: 場に伏せられた「人物・凶器・犯行現場」を当てること。</p>
              <p>準備: 各参加者に「人物・凶器・犯行現場」のカードが1枚ずつ配られます。</p>
              <p>ターン進行:</p>
              <p>1. 手番プレイヤーは「人物・凶器・犯行現場」を1つずつ指定して質問する。</p>
              <p>2. 他プレイヤーは、指定3枚のうち1枚以上を持っていれば「持っている」、0枚なら「持っていない」と答える。</p>
              <p>3. どのカードを持っているかは公開されない。ログから候補を絞る。</p>
              <p>終了条件: 誰かが最終解答を宣言した時点で終了（正解なら勝利、不正解でもその場で終了）。</p>
            </section>
          </div>
        )}

        {!game && (
          <div className={styles.startPanel}>
            <h1>犯人当て推理ゲーム</h1>
            <div className={styles.startActions}>
              <button className={`${styles.primaryButton} ${notoSansJp.className}`} onClick={startGame}>
                ゲーム開始
              </button>
              <button className={`${styles.secondaryButton} ${notoSansJp.className}`} onClick={() => setShowRules(true)}>
                ルール
              </button>
            </div>
          </div>
        )}

        {game && (
          <>
            <header className={styles.hud}>
              <p>現在ターン: {currentTurnName}</p>
              <p>ラウンド: {game.turnCount}</p>
              {cpuThinking && <p>CPUが質問を考えています...</p>}
            </header>

            <section className={styles.portraitArea}>
              <div
                className={`${styles.mainPortraitWrap} ${
                  focusedSpeaker ? styles.mainPortraitVisible : styles.mainPortraitHidden
                }`}
              >
                <Image
                  src={CHARACTER_META[focusedSpeaker ?? "cpu1"].portrait}
                  alt={focusedSpeaker ? CHARACTER_META[focusedSpeaker].displayName : ""}
                  width={320}
                  height={640}
                  className={`${styles.portrait} ${styles.portraitActive}`}
                />
              </div>
              <div className={styles.wipeGroup}>
                {(["cpu1", "cpu2", "cpu3", "cpu4"] as PlayerId[]).map((cpuId) => (
                  <div
                    key={cpuId}
                    aria-label={CHARACTER_META[cpuId].displayName}
                    title={CHARACTER_META[cpuId].displayName}
                    className={`${styles.wipePortrait} ${
                      focusedSpeaker === cpuId ? styles.wipePortraitHidden : ""
                    } ${activeSpeaker === cpuId ? styles.wipePortraitActive : ""}`}
                    style={{ backgroundImage: `url(${CHARACTER_META[cpuId].portrait})` }}
                  />
                ))}
              </div>
            </section>

            {phase === "playerSelect" && (
              <section className={styles.selectionModal}>
                <h2>質問内容を選択してください</h2>
                <div className={styles.grid3}>
                  <label className={styles.field}>
                    <span>人物</span>
                    <select
                      value={questionDraft.suspect}
                      onChange={(event) => setQuestionDraft((prev) => ({ ...prev, suspect: event.target.value }))}
                    >
                      {game.clueData.suspects.map((suspect) => (
                        <option key={suspect} value={suspect}>
                          {suspect}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>凶器</span>
                    <select
                      value={questionDraft.weapon}
                      onChange={(event) => setQuestionDraft((prev) => ({ ...prev, weapon: event.target.value }))}
                    >
                      {game.clueData.weapons.map((weapon) => (
                        <option key={weapon} value={weapon}>
                          {weapon}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>犯行場所</span>
                    <select
                      value={questionDraft.location}
                      onChange={(event) => setQuestionDraft((prev) => ({ ...prev, location: event.target.value }))}
                    >
                      {game.clueData.locations.map((location) => (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button className={styles.primaryButton} onClick={askByPlayer} disabled={isFinished}>
                  決定
                </button>
              </section>
            )}

            <section className={styles.dialogueBox}>
              <div className={styles.dialogueTopBar}>
                <button
                  className={styles.logToggleButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    openAnswerModal();
                  }}
                  disabled={isFinished}
                >
                  回答
                </button>
                <button
                  className={styles.logToggleButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowHistory((prev) => !prev);
                  }}
                >
                  {showHistory ? "ログを閉じる" : "ログを見る"}
                </button>
              </div>
              <p className={styles.speakerName}>
                {currentLine?.speakerName ??
                  (phase === "preTurn" && interruptSpeaker
                    ? CHARACTER_META[interruptSpeaker].displayName
                    : currentParticipant
                      ? CHARACTER_META[currentParticipant.id].displayName
                      : "システム")}
              </p>
              <p className={styles.dialogueText}>
                {currentLine?.text ??
                  (phase === "playerSelect"
                    ? "質問内容を選んで「決定」を押してください。"
                    : phase === "playerAnswer"
                      ? "最終解答を入力して「解答する」を押してください。"
                    : phase === "preTurn"
                      ? interruptSpeaker
                        ? characterData[interruptSpeaker].interruptLine
                        : "進行中..."
                    : waitingMessage)}
              </p>
            </section>

            {showHistory && (
              <div
                className={styles.historyOverlay}
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <div className={styles.historyPanel}>
                  <div className={styles.historyHeader}>
                    <p className={styles.historyTitle}>これまでのログ</p>
                    <button
                      className={styles.historyCloseButton}
                      onClick={() => {
                        setShowHistory(false);
                      }}
                    >
                      ログを閉じる
                    </button>
                  </div>
                  {game.logs.length === 0 && <p className={styles.historyEmpty}>まだログはありません。</p>}
                  {game.logs.length > 0 && (
                    <div className={styles.logTableWrap}>
                      <table className={styles.logTable}>
                        <thead>
                          <tr>
                            <th>質問内容</th>
                            {participantOrder.map((participant) => (
                              <th
                                key={participant.id}
                                className={participant.id === "player" ? styles.playerLogColumn : ""}
                              >
                                {CHARACTER_META[participant.id].displayName}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {game.logs.map((log, index) => (
                            <tr key={`${log.turn}-${index}`}>
                              <td>
                                <p className={styles.logTurnLabel}>
                                  Turn {index + 1} / {CHARACTER_META[log.askerId].displayName}
                                </p>
                                <p className={styles.logQuestionText}>
                                  <span
                                    className={
                                      log.question.suspect === player?.hand.suspect ? styles.questionHit : ""
                                    }
                                  >
                                    {log.question.suspect}
                                  </span>
                                  {" ・ "}
                                  <span
                                    className={
                                      log.question.weapon === player?.hand.weapon ? styles.questionHit : ""
                                    }
                                  >
                                    {log.question.weapon}
                                  </span>
                                  {" ・ "}
                                  <span
                                    className={
                                      log.question.location === player?.hand.location ? styles.questionHit : ""
                                    }
                                  >
                                    {log.question.location}
                                  </span>
                                </p>
                              </td>
                              {participantOrder.map((participant) => {
                                const answer = log.answers.find(
                                  (item) => item.participantId === participant.id,
                                );
                                return (
                                  <td
                                    key={`${log.turn}-${participant.id}`}
                                    className={`${styles.logMarkCell} ${
                                      participant.id === "player" ? styles.playerLogColumn : ""
                                    }`}
                                  >
                                    {answer?.hasAny ? "○" : "×"}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {phase === "playerAnswer" && !isFinished && (
              <div
                className={styles.answerOverlay}
                onClick={() => {
                  setPhase(answerReturnPhase);
                }}
              >
                <section
                  className={styles.answerModal}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <div className={styles.historyHeader}>
                    <p className={styles.historyTitle}>最終解答</p>
                    <button
                      className={styles.historyCloseButton}
                      onClick={() => {
                        setPhase(answerReturnPhase);
                      }}
                    >
                      閉じる
                    </button>
                  </div>
                  <div className={styles.grid3}>
                    <label className={styles.field}>
                      <span>人物</span>
                      <select
                        value={guessDraft.suspect}
                        onChange={(event) => setGuessDraft((prev) => ({ ...prev, suspect: event.target.value }))}
                        disabled={isFinished}
                      >
                        {game.clueData.suspects.map((suspect) => (
                          <option key={suspect} value={suspect}>
                            {suspect}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>凶器</span>
                      <select
                        value={guessDraft.weapon}
                        onChange={(event) => setGuessDraft((prev) => ({ ...prev, weapon: event.target.value }))}
                        disabled={isFinished}
                      >
                        {game.clueData.weapons.map((weapon) => (
                          <option key={weapon} value={weapon}>
                            {weapon}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>犯行場所</span>
                      <select
                        value={guessDraft.location}
                        onChange={(event) => setGuessDraft((prev) => ({ ...prev, location: event.target.value }))}
                        disabled={isFinished}
                      >
                        {game.clueData.locations.map((location) => (
                          <option key={location} value={location}>
                            {location}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={styles.primaryButton}
                      onClick={submitGuess}
                      disabled={isFinished || phase !== "playerAnswer"}
                    >
                      解答する
                    </button>
                    <button
                      className={styles.secondaryButton}
                      onClick={giveUp}
                      disabled={isFinished || phase !== "playerAnswer"}
                    >
                      ギブアップ
                    </button>
                  </div>
                </section>
              </div>
            )}

            <section className={styles.bottomPanel}>
              <div className={styles.handBar}>
                <span>自分の手持ち</span>
                <span>人物: {player?.hand.suspect}</span>
                <span>凶器: {player?.hand.weapon}</span>
                <span>犯行現場: {player?.hand.location}</span>
              </div>
              {isFinished && (
                <div className={`${styles.card} ${styles.resultCard}`}>
                  <h3>答え合わせ</h3>
                  {game.endResult && (
                    <>
                      <p className={game.endResult.correct ? styles.success : styles.fail}>
                        {game.endResult.winnerName}の解答:
                        {game.endResult.correct ? " 正解！" : " 不正解"}
                      </p>
                      <div className={styles.answerBox}>
                        <p>解答（人物）: {game.endResult.guess.suspect}</p>
                        <p>解答（凶器）: {game.endResult.guess.weapon}</p>
                        <p>解答（犯行現場）: {game.endResult.guess.location}</p>
                      </div>
                    </>
                  )}
                  {game.revealed && <p className={styles.fail}>ギブアップでゲーム終了</p>}
                  <div className={styles.answerBox}>
                    <p>正解（人物）: {game.solution.suspect}</p>
                    <p>正解（凶器）: {game.solution.weapon}</p>
                    <p>正解（犯行現場）: {game.solution.location}</p>
                  </div>
                  <div className={styles.resultMembers}>
                    {game.participants.map((participant) => (
                      <div key={participant.id} className={styles.resultMemberRow}>
                        <p>{CHARACTER_META[participant.id].displayName}</p>
                        <p>
                          人物: {participant.hand.suspect} / 凶器: {participant.hand.weapon} / 犯行現場:{" "}
                          {participant.hand.location}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button className={styles.primaryButton} onClick={startGame}>
                    最初から
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
