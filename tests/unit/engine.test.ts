import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/core/engine.ts';
import { buildBank } from '../../src/core/questions.ts';
import { FIELDS } from '../../src/data/board.ts';
import type { GameEvent, GameSetup, PlayerSetup } from '../../src/core/types.ts';

const bots = (n: number, level: PlayerSetup['level'] = 'średni'): PlayerSetup[] =>
  [...Array(n).keys()].map(k => ({ slot: k, kind: 'bot', level, name: `Bot ${k + 1}`, pawnIdx: k, colorIdx: k, hex: '#000000' }));
const bank = buildBank(undefined, 8);   // pytania zastępcze

// Cała gra botów: każda decyzja od razu przez politykę bota; po maxTurns kończy czas gry
async function simulate(setup: GameSetup, maxTurns = 400) {
  const engine = new GameEngine(setup, bank);
  const events: GameEvent[] = [];
  let turns = 0;
  engine.on(ev => {
    events.push(ev);
    if (ev.type === 'turn' && ++turns === maxTurns) engine.timeUp();
    if (ev.type === 'decision') queueMicrotask(() => engine.submit(ev.decision.id, engine.botDecide()));
  });
  await engine.run();
  return { engine, events, turns };
}

describe('silnik gry', () => {
  it('gra 4 botów kończy się wynikiem, a stan zawsze jest poprawny', async () => {
    const { engine, events } = await simulate({ players: bots(4), teams: false, semester: 8, seed: 12345 });
    const s = engine.state;
    expect(s.over).toBe(true);
    expect(s.result).not.toBeNull();
    expect(s.result!.winners.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const ev of events) {
      for (const p of ev.snap.players) if (p.cash < 0 || p.pos < 0 || p.pos >= 32) bad.push(`${ev.seq}: gracz ${p.idx} cash ${p.cash} pos ${p.pos}`);
      for (const [cell, o] of Object.entries(ev.snap.own)) {
        if (!FIELDS[+cell] || o.level < 0 || o.level > 5 || ev.snap.players[o.owner].out) bad.push(`${ev.seq}: pole ${cell} ${JSON.stringify(o)}`);
      }
    }
    expect(bad).toEqual([]);
    expect(events.at(-1)!.type).toBe('over');
  }, 30_000);

  it('ten sam seed = ta sama gra (powtarzalność dla serwera i testów)', async () => {
    const a = await simulate({ players: bots(4, 'trudny'), teams: false, semester: 8, seed: 777 }, 150);
    const b = await simulate({ players: bots(4, 'trudny'), teams: false, semester: 8, seed: 777 }, 150);
    const sig = (evs: GameEvent[]) => evs.map(e => `${e.type}:${JSON.stringify({ ...e, snap: undefined, seq: undefined })}`).join('\n');
    expect(sig(a.events)).toBe(sig(b.events));
    const c = await simulate({ players: bots(4, 'trudny'), teams: false, semester: 8, seed: 778 }, 150);
    expect(sig(c.events)).not.toBe(sig(a.events));
  });

  it('tryb 2 na 2 i różne poziomy botów: wiele gier bez błędów', async () => {
    for (let seed = 1; seed <= 12; seed++) {
      const levels = ['łatwy', 'średni', 'trudny'] as const;
      const players = bots(4).map((p, k) => ({ ...p, level: levels[(seed + k) % 3] }));
      const { engine } = await simulate({ players, teams: seed % 2 === 0, semester: 8, seed }, 200);
      expect(engine.state.over).toBe(true);
      const { result } = engine.state;
      if (engine.state.teams) {
        const team = engine.state.players[result!.winners[0]].team;
        expect(result!.winners.every(w => engine.state.players[w].team === team)).toBe(true);
      }
    }
  }, 60_000);

  it('decyzje są sprawdzane: zła wartość i stary numer decyzji nie przechodzą', async () => {
    const engine = new GameEngine({ players: bots(2), teams: false, semester: 8, seed: 5 }, bank);
    const seen: number[] = [];
    engine.on(ev => { if (ev.type === 'decision') seen.push(ev.decision.id); });
    void engine.run();
    await Promise.resolve();
    const d = engine.pending!;
    expect(d.kind).toBe('roll');
    expect(engine.submit(d.id + 1)).toBe(false);
    expect(engine.submit(d.id)).toBe(true);
    expect(engine.submit(d.id)).toBe(false);   // ta sama decyzja drugi raz
    engine.quit();
  });

  it('stan publiczny nie zdradza talii, kart w stosach ani generatora', async () => {
    const engine = new GameEngine({ players: bots(2), teams: false, semester: 8, seed: 9 }, bank);
    const snap = engine.publicState() as Record<string, unknown>;
    expect(snap.decks).toBeUndefined();
    expect(snap.cardDecks).toBeUndefined();
    expect(snap.rng).toBeUndefined();
    const text = JSON.stringify(snap);
    for (const q of bank.sem) expect(text).not.toContain(q.q);   // treść pytań i odpowiedzi nie trafia do stanu
  });
});
