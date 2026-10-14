// Gra przy jednym komputerze: silnik działa w przeglądarce. Sterownik pilnuje zegara gry i pauzy
// oraz podejmuje decyzje za boty, gdy interfejs pokaże już daną decyzję (żeby gracz widział, co robi bot).
// W trybie online tę samą rolę przejmie serwer (etap 3).
import { GameEngine } from './engine.ts';
import type { Decision } from './types.ts';

export interface LocalDriverOptions {
  timeLimitMs?: number;              // 0 = bez limitu czasu
  onTick?: (timeLeftMs: number) => void;
  isBot?: (player: number) => boolean;
}

// Ile bot „myśli” nad decyzją (ms): jak dawniej w grze
const THINK: Record<Decision['kind'], () => number> = {
  roll: () => 700,
  choose: () => 700 + Math.random() * 600,
  answer: () => 1300 + Math.random() * 1500,
  ack: () => 2400,
};

export class LocalDriver {
  readonly engine: GameEngine;
  timeLeft: number;
  paused = false;
  private clock: ReturnType<typeof setInterval> | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly onTick?: (ms: number) => void;
  private readonly isBot: (player: number) => boolean;

  constructor(engine: GameEngine, opts: LocalDriverOptions = {}) {
    this.engine = engine;
    this.timeLeft = opts.timeLimitMs ?? 0;
    this.onTick = opts.onTick;
    this.isBot = opts.isBot ?? (k => engine.state.players[k].kind === 'bot');
  }

  start(): Promise<void> {
    if (this.timeLeft > 0) {
      this.clock = setInterval(() => {
        if (this.paused || this.engine.state.over || this.timeLeft <= 0) return;
        this.timeLeft = Math.max(0, this.timeLeft - 1000);
        this.onTick?.(this.timeLeft);
        if (!this.timeLeft) this.engine.timeUp();
      }, 1000);
    }
    return this.engine.run();
  }

  // Interfejs pokazał decyzję: jeśli decyduje bot, odpowiada po chwili namysłu (pauza wstrzymuje bota)
  ready(id: number): void {
    const d = this.engine.pending;
    if (!d || d.id !== id || !this.isBot(d.player)) return;
    const act = () => {
      if (this.engine.pending?.id !== id) return;
      if (this.paused) { this.later(act, 150); return; }
      this.engine.submit(id, this.engine.botDecide());
    };
    this.later(act, THINK[d.kind]());
  }

  submit(id: number, value: unknown = null): boolean { return this.engine.submit(id, value); }
  pause(on: boolean): void { this.paused = on; }
  endNow(): void { this.engine.endNow(); this.stopTimers(); }
  stop(): void { this.stopTimers(); this.engine.quit(); }

  private later(fn: () => void, ms: number): void {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
  }
  private stopTimers(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}
