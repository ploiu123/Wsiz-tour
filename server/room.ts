// Pokój gry online: miejsca graczy (gospodarz, gracze online, boty), silnik gry i decyzje.
// Serwer jest jedynym miejscem, gdzie działa silnik w trybie online: decyduje o rzutach, pieniądzach i czasie,
// a przeglądarki tylko odtwarzają zdarzenia i odsyłają decyzje swoich graczy.
import { randomBytes, randomInt } from 'node:crypto';
import { GameEngine } from '../src/core/engine.ts';
import type { Decision, GameEvent, PlayerSetup, PublicState, QuestionBank } from '../src/core/types.ts';
import type { BotLevel } from '../src/data/economy.ts';
import { PAWN_COLORS } from '../src/data/players.ts';

export type SeatKind = 'host' | 'online' | 'local' | 'bot';   // local = drugi gracz przy komputerze gospodarza
export interface SeatConfig { kind: SeatKind; level?: BotLevel; pawnIdx: number; colorIdx: number }
export interface RoomConfig { seats: SeatConfig[]; teams: boolean; semester: number; timer: number }
interface Seat extends SeatConfig { name: string; token: string | null; socketId: string | null; left: boolean }

export interface LobbySeat { kind: SeatKind; name: string; filled: boolean; connected: boolean; pawnIdx: number; colorIdx: number; level?: BotLevel }
export interface LobbyState { code: string; seats: LobbySeat[]; teams: boolean; semester: number; timer: number; started: boolean; canStart: boolean }

// Ile bot „myśli” i ile czekamy na gracza (ms)
const THINK: Record<Decision['kind'], () => number> = {
  roll: () => 700, choose: () => 700 + Math.random() * 600, answer: () => 1300 + Math.random() * 1500, ack: () => 2400,
};
const WAIT_FOR_SCREENS = 8000;     // najdłużej czekamy, aż przeglądarki pokażą decyzję bota
const WAIT_FOR_PLAYER = 120_000;   // gracz nie reaguje (np. odszedł od komputera): decyduje za niego bot
const WAIT_FOR_RETURN = 20_000;    // gracz rozłączony: tyle czekamy na jego powrót, potem decyduje bot
const ANSWER_GRACE = 3000;         // zapas na opóźnienie sieci przy odpowiedzi na pytanie
const LEVELS: BotLevel[] = ['łatwy', 'średni', 'trudny'];

export const newToken = (): string => randomBytes(18).toString('base64url');
export const newCode = (): string => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');

// Pole „cards” innych graczy jest ukryte: widać tylko, ile ich jest i czy to ułatwienia, czy utrudnienia
export function redact<T extends { snap: PublicState }>(msg: T, visible: number[]): T {
  return {
    ...msg,
    snap: {
      ...msg.snap,
      players: msg.snap.players.map(p => (visible.includes(p.idx) ? p : {
        ...p, cards: p.cards.map(c => ({ id: -1, kind: c.kind, name: 'Karta', icon: 'hidden', text: '' })),
      })),
    },
  };
}

export class Room {
  readonly code: string;
  readonly config: RoomConfig;
  readonly seats: Seat[];
  engine: GameEngine | null = null;
  timeLeft = 0;
  lastSnap: PublicState | null = null;
  lastSeq = 0;
  closed = false;
  idleSince = 0;   // od kiedy w pokoju nikogo nie ma (0 = ktoś jest)
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private clock: ReturnType<typeof setInterval> | null = null;
  private acks = new Set<string>();
  private decisionTimer: ReturnType<typeof setTimeout> | null = null;
  private answerClock = -1;   // decyzja, dla której minutnik pytania już ruszył (odświeżenie strony go nie cofa)
  private send: (socketId: string, type: string, payload: unknown) => void;
  private readonly pace: number;

  // pace: mnożnik czasu namysłu botów (testy grają szybciej)
  constructor(code: string, config: RoomConfig, send: (socketId: string, type: string, payload: unknown) => void, pace = 1) {
    this.code = code;
    this.config = config;
    this.send = send;
    this.pace = pace;
    this.seats = config.seats.map((s, i) => ({ ...s, name: s.kind === 'bot' ? `Bot ${i + 1}` : s.kind === 'local' ? `Gracz ${i + 1}` : '', token: null, socketId: null, left: false }));
  }

  // Sprawdza ustawienia od gospodarza (dane z sieci traktujemy jak niezaufane)
  static validate(raw: unknown): RoomConfig | null {
    const c = raw as Partial<RoomConfig> | null;
    if (!c || !Array.isArray(c.seats) || c.seats.length < 2 || c.seats.length > 4) return null;
    const seats: SeatConfig[] = [];
    const colors = new Set<number>();
    for (const s of c.seats) {
      if (!s || !['host', 'online', 'local', 'bot'].includes(s.kind)) return null;
      const pawnIdx = Number(s.pawnIdx), colorIdx = Number(s.colorIdx);
      if (!Number.isInteger(pawnIdx) || pawnIdx < 0 || pawnIdx > 3 || !Number.isInteger(colorIdx) || colorIdx < 0 || colorIdx >= PAWN_COLORS.length || colors.has(colorIdx)) return null;
      colors.add(colorIdx);
      seats.push({ kind: s.kind, pawnIdx, colorIdx, ...(s.kind === 'bot' ? { level: LEVELS.includes(s.level as BotLevel) ? s.level : 'średni' } : {}) });
    }
    if (seats.filter(s => s.kind === 'host').length !== 1) return null;
    const semester = Number(c.semester), timer = Number(c.timer);
    if (!Number.isInteger(semester) || semester < 1 || semester > 8 || !Number.isInteger(timer) || timer < 0 || timer > 180) return null;
    return { seats, teams: !!c.teams && seats.length === 4, semester, timer };
  }

  seatOf(token: string | undefined): number {
    return token ? this.seats.findIndex(s => s.token === token) : -1;
  }
  // Miejsca, o których decyduje dana przeglądarka: swoje, a gospodarz także graczy przy swoim komputerze
  controlled(seat: number): number[] {
    if (seat < 0) return [];
    return this.seats.flatMap((s, i) => (i === seat || (s.kind === 'local' && this.seats[seat].kind === 'host') ? [i] : []));
  }
  private controls(token: string, player: number): boolean {
    return this.controlled(this.seatOf(token)).includes(player);
  }

  // Zajmuje miejsce: gospodarz dostaje swoje, gracz online pierwsze wolne. Zwraca token do powrotu po rozłączeniu.
  claim(kind: 'host' | 'online', name: string, socketId: string, pawnIdx?: number): { seat: number; token: string } | null {
    if (this.engine) return null;
    const seat = this.seats.findIndex(s => s.kind === kind && !s.token);
    if (seat < 0) return null;
    const s = this.seats[seat];
    s.name = name;
    s.token = newToken();
    s.socketId = socketId;
    if (kind === 'online' && Number.isInteger(pawnIdx) && pawnIdx! >= 0 && pawnIdx! <= 3) s.pawnIdx = pawnIdx!;
    return { seat, token: s.token };
  }

  lobby(): LobbyState {
    const { teams, semester, timer } = this.config;
    return {
      code: this.code, teams, semester, timer, started: !!this.engine,
      seats: this.seats.map(s => {
        const always = s.kind === 'bot' || s.kind === 'local';
        return { kind: s.kind, name: s.name || 'Czeka na gracza…', filled: always || !!s.token, connected: always || !!s.socketId, pawnIdx: s.pawnIdx, colorIdx: s.colorIdx, level: s.level };
      }),
      canStart: !this.engine && this.seats.every(s => s.kind === 'bot' || s.kind === 'local' || !!s.token),
    };
  }

  // Przeglądarki w pokoju: [socket, miejsce gracza]
  private viewers(): [string, number][] {
    return this.seats.flatMap((s, i) => (s.socketId ? [[s.socketId, i] as [string, number]] : []));
  }
  broadcastLobby(): void { for (const [sid] of this.viewers()) this.send(sid, 'lobby', this.lobby()); }

  start(bank: QuestionBank): boolean {
    if (this.engine || !this.lobby().canStart) return false;
    const players: PlayerSetup[] = this.seats.map((s, i) => ({
      slot: i, kind: s.kind === 'bot' ? 'bot' : 'remote', level: s.level, name: s.name, pawnIdx: s.pawnIdx, colorIdx: s.colorIdx, hex: PAWN_COLORS[s.colorIdx].hex,
    }));
    const engine = new GameEngine({ players, teams: this.config.teams, semester: this.config.semester, seed: randomInt(2 ** 31), timeLimitMin: this.config.timer, online: true }, bank);
    this.engine = engine;
    this.lastSnap = engine.publicState();
    engine.on(ev => this.onEvent(ev));
    for (const [sid, seat] of this.viewers()) this.send(sid, 'start', this.startMsg(seat));
    if (this.config.timer) {
      this.timeLeft = this.config.timer * 60_000;
      this.clock = setInterval(() => {
        if (engine.state.over) return;
        this.timeLeft = Math.max(0, this.timeLeft - 1000);
        for (const [sid] of this.viewers()) this.send(sid, 'clock', this.timeLeft);
        if (!this.timeLeft) engine.timeUp();
      }, 1000);
    }
    // krótka chwila, żeby przeglądarki zbudowały planszę, zanim przyjdą pierwsze zdarzenia
    this.later(() => { engine.run().catch(e => console.error(e)); }, 300);
    return true;
  }

  startMsg(seat: number) {
    const mine = this.controlled(seat);
    return redact({ snap: this.lastSnap!, seq: this.lastSeq, you: seat, mine, pending: this.engine?.pending ?? null, timeLeft: this.timeLeft, teams: this.config.teams, semester: this.config.semester }, mine);
  }

  private onEvent(ev: GameEvent): void {
    this.lastSnap = ev.snap;
    this.lastSeq = ev.seq;
    for (const [sid, seat] of this.viewers()) this.send(sid, 'event', redact(ev, this.controlled(seat)));
    if (ev.type === 'decision') this.arm(ev.decision);
    if (ev.type === 'over') this.finish();
  }

  // Przeglądarka, która decyduje za gracza (gracz przy komputerze gospodarza: przeglądarka gospodarza)
  private ownerSeat(player: number): Seat {
    return this.seats[player].kind === 'local' ? this.seats.find(s => s.kind === 'host')! : this.seats[player];
  }
  // Za gracza gra bot: zwykły bot albo człowiek, który wyszedł z gry
  private botPlays(player: number): boolean {
    return this.engine!.state.players[player].kind === 'bot' || this.ownerSeat(player).left;
  }

  // Nowa decyzja: bot decyduje, gdy przeglądarki ją pokażą; gracz ma limit czasu (potem decyduje za niego bot)
  private arm(d: Decision): void {
    this.acks.clear();
    if (this.decisionTimer) clearTimeout(this.decisionTimer);
    const engine = this.engine!;
    const act = (value: () => unknown) => { if (engine.pending?.id === d.id) engine.submit(d.id, value()); };
    if (this.botPlays(d.player)) {
      this.decisionTimer = setTimeout(() => this.later(() => act(() => engine.botDecide()), this.think(d)), WAIT_FOR_SCREENS * this.pace);
    } else {
      const wait = this.ownerSeat(d.player).socketId ? WAIT_FOR_PLAYER : WAIT_FOR_RETURN;
      this.decisionTimer = setTimeout(() => act(() => (d.kind === 'answer' ? null : engine.botDecide())), wait * this.pace);
    }
  }

  // Przeglądarka pokazała decyzję
  ready(token: string, id: number): void {
    const seat = this.seatOf(token), engine = this.engine;
    const d = engine?.pending;
    if (seat < 0 || !engine || !d || d.id !== id) return;
    this.acks.add(token);
    const act = (value: () => unknown) => { if (engine.pending?.id === d.id) engine.submit(d.id, value()); };
    if (this.botPlays(d.player)) {
      const waiting = this.seats.filter(s => s.socketId && s.token && !this.acks.has(s.token));
      if (!waiting.length) {
        if (this.decisionTimer) clearTimeout(this.decisionTimer);
        this.decisionTimer = null;
        this.later(() => act(() => engine.botDecide()), this.think(d));
      }
    } else if (d.kind === 'answer' && this.controls(token, d.player) && this.answerClock !== d.id) {
      // minutnik pytania liczy się od chwili, gdy gracz zobaczył pytanie
      this.answerClock = d.id;
      if (this.decisionTimer) clearTimeout(this.decisionTimer);
      this.decisionTimer = setTimeout(() => act(() => null), d.seconds * 1000 + ANSWER_GRACE);
    }
  }

  // Decyzja gracza: tylko gracz, którego dotyczy decyzja
  submit(token: string, id: number, value: unknown): boolean {
    const seat = this.seatOf(token), engine = this.engine;
    if (seat < 0 || !engine || engine.pending?.id !== id || !this.controls(token, engine.pending.player)) return false;
    return engine.submit(id, value);
  }

  endNow(token: string): boolean {
    if (this.seats[this.seatOf(token)]?.kind !== 'host' || !this.engine) return false;
    this.engine.endNow();
    return true;
  }

  // Powrót gracza (nowe połączenie z tym samym tokenem)
  connect(token: string, socketId: string): number {
    const seat = this.seatOf(token);
    if (seat < 0) return seat;
    const s = this.seats[seat];
    s.socketId = socketId;
    s.left = false;
    // czekał na niego krótszy limit: znowu ma pełny czas na decyzję (minutnik pytania liczy się dalej)
    const d = this.engine?.pending;
    if (d && !this.engine!.state.over && d.kind !== 'answer' && this.ownerSeat(d.player) === s) this.arm(d);
    return seat;
  }
  disconnect(socketId: string): void {
    const seat = this.seats.findIndex(s => s.socketId === socketId);
    if (seat < 0) return;
    this.seats[seat].socketId = null;
    if (!this.engine) { this.broadcastLobby(); return; }
    // gracz zniknął w trakcie swojej decyzji: krótszy czas na powrót (minutnik pytania i tak już biegnie)
    const d = this.engine.pending;
    if (d && !this.engine.state.over && this.ownerSeat(d.player) === this.seats[seat] && this.answerClock !== d.id) this.arm(d);
  }
  // Gracz wyszedł z gry na dobre: przed startem zwalnia miejsce, w trakcie gry gra za niego bot
  leave(socketId: string): void {
    const seat = this.seats.findIndex(s => s.socketId === socketId);
    if (seat < 0) return;
    const s = this.seats[seat];
    if (!this.engine) {
      if (s.kind === 'host') {   // gospodarz zamknął party przed startem
        for (const [sid] of this.viewers()) if (sid !== socketId) this.send(sid, 'closed', 'Gospodarz zamknął party.');
        s.socketId = null;
        this.close();
        return;
      }
      Object.assign(s, { name: '', token: null, socketId: null });
      this.broadcastLobby();
      return;
    }
    s.socketId = null;
    if (this.engine.state.over || s.left) return;
    s.left = true;
    const who = this.seats.flatMap((x, i) => (this.ownerSeat(i) === s ? [x.name] : [])).join(' i ');
    for (const [sid] of this.viewers()) this.send(sid, 'note', `${who} ${who.includes(' i ') ? 'wyszli' : 'wychodzi'} z gry. Dalej gra bot.`);
    const d = this.engine.pending;
    if (d && this.ownerSeat(d.player) === s) this.arm(d);
  }
  get empty(): boolean { return this.seats.every(s => !s.socketId); }

  private finish(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = null;
  }
  close(): void {
    this.closed = true;
    this.finish();
    if (this.decisionTimer) clearTimeout(this.decisionTimer);
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.engine?.quit();
  }
  private think(d: Decision): number { return THINK[d.kind]() * this.pace; }
  private later(fn: () => void, ms: number): void {
    const t = setTimeout(() => { this.timers.delete(t); if (!this.closed) fn(); }, ms);
    this.timers.add(t);
  }
}
