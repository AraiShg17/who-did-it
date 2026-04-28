import clueData from "@/data/clues.json";
import {
  type GameState,
  type Participant,
  type PlayerId,
  type Question,
  type Solution,
  type TurnLog,
} from "@/lib/game/types";

const PLAYER_IDS: PlayerId[] = ["player", "cpu1", "cpu2", "cpu3", "cpu4"];

const PLAYER_NAMES: Record<PlayerId, string> = {
  player: "プレイヤー",
  cpu1: "CPU1",
  cpu2: "CPU2",
  cpu3: "CPU3",
  cpu4: "CPU4",
};

const shuffle = <T,>(list: T[]): T[] => {
  const copied = [...list];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
};

const pickOne = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export const createInitialGame = (): GameState => {
  const solution: Solution = {
    suspect: pickOne(clueData.suspects),
    weapon: pickOne(clueData.weapons),
    location: pickOne(clueData.locations),
  };

  const suspectPool = shuffle(clueData.suspects.filter((item) => item !== solution.suspect));
  const weaponPool = shuffle(clueData.weapons.filter((item) => item !== solution.weapon));
  const locationPool = shuffle(
    clueData.locations.filter((item) => item !== solution.location),
  );

  const participants: Participant[] = PLAYER_IDS.map((id, index) => ({
    id,
    name: PLAYER_NAMES[id],
    isCpu: id !== "player",
    hand: {
      suspect: suspectPool[index],
      weapon: weaponPool[index],
      location: locationPool[index],
    },
  }));

  return {
    clueData,
    solution,
    revealed: false,
    participants,
    turnIndex: 0,
    turnCount: 1,
    logs: [],
  };
};

export const resolveQuestion = (game: GameState, askerId: PlayerId, question: Question): TurnLog => {
  const answers = game.participants.map((participant) => {
    const hasAny =
      participant.hand.suspect === question.suspect ||
      participant.hand.weapon === question.weapon ||
      participant.hand.location === question.location;

    return {
      participantId: participant.id,
      participantName: participant.name,
      hasAny,
    };
  });

  const asker = game.participants.find((participant) => participant.id === askerId);
  return {
    turn: game.turnCount,
    askerId,
    askerName: asker?.name ?? askerId,
    question,
    answers,
  };
};

export const applyTurn = (game: GameState, log: TurnLog): GameState => {
  const nextTurnIndex = (game.turnIndex + 1) % game.participants.length;
  return {
    ...game,
    logs: [...game.logs, log],
    turnIndex: nextTurnIndex,
    turnCount: game.turnCount + (nextTurnIndex === 0 ? 1 : 0),
  };
};

export const evaluateGuess = (game: GameState, guess: Question) => {
  const correct =
    game.solution.suspect === guess.suspect &&
    game.solution.weapon === guess.weapon &&
    game.solution.location === guess.location;

  return {
    correct,
    guess,
  };
};
