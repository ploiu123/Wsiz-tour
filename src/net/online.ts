// Gra online w przeglądarce: połączenie z serwerem gry (Socket.IO) i sterownik gry z tym samym
// interfejsem co LocalDriver. Silnik działa na serwerze, a przeglądarka tylko odtwarza zdarzenia
// i odsyła decyzje graczy siedzących przy tym komputerze.
import { io, type Socket } from 'socket.io-client';
import type { Decision, GameEvent, PublicState } from '../core/types.ts';

export type SeatKind = 'host' | 'online' | 'local' | 'bot';
export interface SeatConfig { kind: SeatKind; level?: string; pawnIdx: number; colorIdx: number }
export interface RoomConfig { seats: SeatConfig[]; teams: boolean; semester: number; timer: number }
export interface LobbySeat { kind: SeatKind; name: string; filled: boolean; connected: boolean; pawnIdx: number; colorIdx: number; level?: string }
export interface LobbyState { code: string; seats: LobbySeat[]; teams: boolean; semester: number; timer: number; started: boolean; canStart: boolean }
export interface StartMsg { snap: PublicState; seq: number; you: number; mine: number[]; pending: Decision | null; timeLeft: number; teams: boolean; semester: number }
export interface Joined { code: string; token: string; seat: number; lobby: LobbyState; game?: StartMsg | null }
type Reply<T> = T | { error: string };

const SAVED = 'wsiz-tour-online';   // kod party i token: powrót do gry po odświeżeniu strony
const SAVED_FOR = 3 * 3600_000;

// Adres serwera gry: ten sam co strona (serwer gry wysyła też pliki gry) albo VITE_SERVER_URL z pliku .env
const serverUrl = (): string | undefined => import.meta.env.VITE_SERVER_URL || undefined;

export class OnlineClient {
  readonly socket: Socket;
  code = '';
  token = '';
  seat = -1;
  onLobby: (l: LobbyState) => void = () => {};
  onStart: (m: StartMsg) => void = () => {};
  onEvent: (ev: GameEvent) => void = () => {};
  onClock: (ms: number) => void = () => {};
  onNote: (text: string) => void = () => {};
  onClosed: (text: string) => void = () => {};   // gospodarz zamknął party
  onLost: () => void = () => {};             // zerwane połączenie (socket.io sam próbuje połączyć się znowu)
  onBack: (j: Joined) => void = () => {};    // połączenie wróciło: miejsce w grze odzyskane

  constructor() {
    this.socket = io(serverUrl(), { timeout: 6000, reconnectionDelayMax: 4000 });
    this.socket.on('lobby', (l: LobbyState) => this.onLobby(l));
    this.socket.on('start', (m: StartMsg) => this.onStart(m));
    this.socket.on('event', (ev: GameEvent) => this.onEvent(ev));
    this.socket.on('clock', (ms: number) => this.onClock(ms));
    this.socket.on('note', (text: string) => this.onNote(text));
    this.socket.on('closed', (text: string) => { forget(); this.token = ''; this.onClosed(text); });
    this.socket.on('disconnect', reason => { if (reason !== 'io client disconnect') this.onLost(); });
    this.socket.io.on('reconnect', async () => {
      if (!this.token) return;
      const r = await this.call<Joined>('resume', { code: this.code, token: this.token });
      if ('error' in r) { forget(); this.onLost(); } else this.onBack(r);
    });
  }

  // Czeka na połączenie z serwerem (albo błąd po kilku sekundach)
  connected(): Promise<boolean> {
    if (this.socket.connected) return Promise.resolve(true);
    return new Promise(resolve => {
      const ok = () => { done(); resolve(true); };
      const bad = () => { done(); resolve(false); };
      const t = setTimeout(bad, 7000);
      const done = () => { clearTimeout(t); this.socket.off('connect', ok); this.socket.off('connect_error', bad); };
      this.socket.once('connect', ok);
      this.socket.once('connect_error', bad);
    });
  }

  call<T>(type: string, msg?: unknown): Promise<Reply<T>> {
    return new Promise(resolve => {
      const t = setTimeout(() => resolve({ error: 'Serwer gry nie odpowiada.' }), 8000);
      this.socket.emit(type, msg, (r: Reply<T>) => { clearTimeout(t); resolve(r); });
    });
  }

  private async enter(type: 'create' | 'join' | 'resume', msg: unknown): Promise<Reply<Joined>> {
    if (!(await this.connected())) return { error: 'Brak połączenia z serwerem gry.' };
    const r = await this.call<Joined>(type, msg);
    if (!('error' in r)) {
      this.code = r.code; this.token = r.token; this.seat = r.seat;
      remember(r.code, r.token);
    }
    return r;
  }
  create(name: string, config: RoomConfig) { return this.enter('create', { name, config }); }
  join(code: string, name: string, pawnIdx: number) { return this.enter('join', { code, name, pawnIdx }); }
  resume(code: string, token: string) { return this.enter('resume', { code, token }); }
  start() { return this.call<{ ok: true }>('start'); }

  close(): void {
    forget();
    this.token = '';
    this.socket.emit('leave');
    this.socket.disconnect();
  }
}

export function remember(code: string, token: string): void {
  try { localStorage.setItem(SAVED, JSON.stringify({ code, token, at: Date.now() })); } catch { /* bez pamięci */ }
}
export function forget(): void {
  try { localStorage.removeItem(SAVED); } catch { /* bez pamięci */ }
}
export function saved(): { code: string; token: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED) || 'null');
    return v && v.code && v.token && Date.now() - v.at < SAVED_FOR ? v : null;
  } catch { return null; }
}

// Sterownik gry online: decyzje idą do serwera, zegar gry przychodzi z serwera
export class OnlineDriver {
  readonly net: OnlineClient;
  timeLeft: number;
  paused = false;

  constructor(net: OnlineClient, timeLeft: number, onTick?: (ms: number) => void) {
    this.net = net;
    this.timeLeft = timeLeft;
    net.onClock = ms => { this.timeLeft = ms; onTick?.(ms); };
  }

  ready(id: number): void { this.net.socket.emit('ready', id); }
  submit(id: number, value: unknown = null): boolean {
    this.net.socket.emit('submit', { id, value }, () => {});
    return true;
  }
  pause(on: boolean): void { this.paused = on; }   // gra online nie stoi: pauza tylko wstrzymuje odtwarzanie
  endNow(): void { this.net.socket.emit('end', null, () => {}); }
  stop(): void { this.net.close(); }
}
