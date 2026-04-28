export type Category = "suspect" | "weapon" | "location";

export type Solution = {
  suspect: string;
  weapon: string;
  location: string;
};

export type Hand = Solution;

export type PlayerId = "player" | "cpu1" | "cpu2" | "cpu3" | "cpu4";

export type Participant = {
  id: PlayerId;
  name: string;
  isCpu: boolean;
  hand: Hand;
};

export type Question = {
  suspect: string;
  weapon: string;
  location: string;
};

export type AnswerRecord = {
  participantId: PlayerId;
  participantName: string;
  hasAny: boolean;
};

export type TurnLog = {
  turn: number;
  askerId: PlayerId;
  askerName: string;
  question: Question;
  answers: AnswerRecord[];
};

export type ClueData = {
  suspects: string[];
  weapons: string[];
  locations: string[];
};

export type GameState = {
  clueData: ClueData;
  solution: Solution;
  revealed: boolean;
  endResult?: {
    winnerId: PlayerId;
    winnerName: string;
    guess: Question;
    correct: boolean;
  };
  participants: Participant[];
  turnIndex: number;
  turnCount: number;
  logs: TurnLog[];
};
