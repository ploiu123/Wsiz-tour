// Typy rdzenia gry. Stan jest zwykłym obiektem JSON: da się go zapisać, wysłać przez sieć i odtworzyć.
import type { ActionCard } from '../data/cards.ts';
import type { BotLevel } from '../data/economy.ts';

export type PlayerKind = 'me' | 'bot' | 'local' | 'remote';
export type DeckKind = 'sem' | 'dziekanat';
export type CardKind = 'bonus' | 'penalty';

export interface Question {
  q: string;
  a: string[];
  ok: number;          // indeks dobrej odpowiedzi (0–3); nigdy nie trafia do przeglądarki gracza w trybie online
  sem?: number;
  przedmiot?: string;
}
export interface QuestionBank { sem: Question[]; dziekanat: Question[] }

export interface Card extends ActionCard {
  id: number;
  kind: CardKind;
  exit?: number;       // karta „Wyjście z dziekanatu”: numer wzoru (0–3)
}

export interface Score { q: number; ok: number }
export type Deferred = { type: 'buy'; cell: number } | { type: 'build'; cell: number; n: number };

export interface PlayerState {
  idx: number;
  slot: number;        // miejsce w menu = róg planszy
  kind: PlayerKind;
  level: BotLevel;
  name: string;
  pawnIdx: number;
  colorIdx: number;
  hex: string;
  team: number;
  cash: number;
  pos: number;
  out: boolean;
  jail: number;        // ile kolejek zostało w dziekanacie
  noCard: boolean;     // w tym pobycie w dziekanacie nie wolno użyć karty wyjścia
  skip: number;        // ile kolejek gracz traci
  insured: number;     // ile tur działa ubezpieczenie
  cards: Card[];
  pending: Deferred | null;
  lap: Score;          // odpowiedzi w tym okrążeniu (premia na START)
  total: Score;
}

export interface OwnState { owner: number; level: number; shield: number; off: number }

export interface QuestionDeck { list: number[]; order: number[]; tail: number[]; rounds: number }

export interface GameResult {
  reason: 'time' | 'bankruptcy' | 'specials' | 'monopolies' | 'manual';
  winners: number[];
  rows: { player: number; wealth: number; acc: number | null }[];
  prymus: number | null;
  teams: boolean;
}

export interface GameState {
  players: PlayerState[];
  turn: number;
  own: Record<number, OwnState>;
  pool: number;
  over: boolean;
  teams: boolean;
  semester: number;
  timeUp: boolean;
  decks: Record<DeckKind, QuestionDeck>;
  cards: Card[];                                  // wszystkie karty (id = indeks)
  cardDecks: Record<CardKind, number[]>;          // id kart w stosach
  rng: [number, number, number, number];
  result: GameResult | null;
}

// Stan widoczny dla graczy: bez kolejności talii, bez generatora liczb losowych
export type PublicState = Omit<GameState, 'decks' | 'cardDecks' | 'rng' | 'cards'> & { deckLeft: Record<CardKind, number> };

export interface PlayerSetup {
  slot: number;
  kind: PlayerKind;
  level?: BotLevel;
  name: string;
  pawnIdx: number;
  colorIdx: number;
  hex: string;
}
export interface GameSetup {
  players: PlayerSetup[];
  teams: boolean;
  semester: number;     // 1–7, 8 = wszystkie semestry
  seed: number;
  timeLimitMin?: number;
  online?: boolean;
}

// ---------------------------------------------------------------------------
// Decyzje: silnik czeka na nie, a gracz (albo bot, albo serwer) je podejmuje
// ---------------------------------------------------------------------------
export interface Option {
  label: string;
  value: string | number | boolean;
  primary?: boolean;
  disabled?: boolean;
  cell?: number;        // opcja jest polem planszy (interfejs pokazuje właściciela i budynek)
  cost?: number;        // koszt opcji (budowa), z którego korzysta bot
}
export interface PublicQuestion { q: string; a: string[]; sem?: number; przedmiot?: string; dziekanat: boolean }

export type DecisionBody =
  | { kind: 'roll'; player: number }
  | { kind: 'choose'; player: number; title: string; text: string; options: Option[]; two?: boolean }
  | { kind: 'answer'; player: number; question: PublicQuestion; gone: number[]; context: string; seconds: number }
  | { kind: 'ack'; player: number; card: Card };
export type Decision = DecisionBody & { id: number };

// ---------------------------------------------------------------------------
// Zdarzenia: wszystko, co się stało; przeglądarka odtwarza je po kolei z animacjami
// ---------------------------------------------------------------------------
export type MoneyEnd = number | 'pool' | 'bank' | { cell: number };
export type EventBody =
  | { type: 'notice'; title: string; sub?: string; color?: string; ms?: number }
  | { type: 'status'; text: string }
  | { type: 'turn'; player: number }
  | { type: 'dice'; player: number; a: number; b: number }
  | { type: 'step'; player: number; from: number; to: number }
  | { type: 'landed'; player: number; cell: number }
  | { type: 'jail'; player: number; title: string; sub: string }
  | { type: 'money'; from: MoneyEnd; to: MoneyEnd; amount: number }
  | { type: 'poolTaken'; player: number; amount: number }
  | { type: 'bought'; player: number; cell: number; monopoly: boolean }
  | { type: 'level'; cell: number; level: number }
  | { type: 'owner'; cell: number }
  | { type: 'marks'; cell: number }
  | { type: 'hotel'; cell: number }
  | { type: 'cardDrawn'; player: number; kind: CardKind }
  | { type: 'shuffle'; deck: DeckKind }
  | { type: 'answered'; player: number; picked: number | null; correct: boolean }
  | { type: 'decision'; decision: Decision }
  | { type: 'decided'; id: number; player: number; value: unknown }
  | { type: 'bankrupt'; player: number }
  | { type: 'over'; result: GameResult };
export type GameEvent = EventBody & { seq: number; snap: PublicState };
