// Symulacja wielu gier botów: jak długo trwa gra, jak często ktoś bankrutuje, ile zarabiają gracze.
// Pomaga stroić ekonomię (src/data/economy.ts). Uruchomienie: npm run sim  (albo npm run sim -- 2000)
import { GameEngine } from '../src/core/engine.ts';
import { buildBank } from '../src/core/questions.ts';
import type { PlayerSetup } from '../src/core/types.ts';

const games = Number(process.argv[2] || 500);
const maxTurns = 600;   // twardy limit, żeby żadna gra nie trwała w nieskończoność
const bank = buildBank(undefined, 8);
const levels = ['łatwy', 'średni', 'trudny'] as const;

const stats = { turns: [] as number[], reasons: {} as Record<string, number>, timeouts: 0, bought: 0, built: 0, rent: [] as number[], wealth: [] as number[] };
for (let seed = 1; seed <= games; seed++) {
  const players: PlayerSetup[] = [0, 1, 2, 3].map(k => ({ slot: k, kind: 'bot', level: levels[(seed + k) % 3], name: `Bot ${k + 1}`, pawnIdx: k, colorIdx: k, hex: '#000000' }));
  const engine = new GameEngine({ players, teams: false, semester: 8, seed }, bank);
  let turns = 0, timedOut = false;
  engine.on(ev => {
    if (ev.type === 'turn' && ++turns === maxTurns) { timedOut = true; engine.timeUp(); }
    if (ev.type === 'bought') stats.bought++;
    if (ev.type === 'level') stats.built++;
    if (ev.type === 'money' && typeof ev.from === 'number' && typeof ev.to === 'number') stats.rent.push(ev.amount);
    if (ev.type === 'decision') queueMicrotask(() => engine.submit(ev.decision.id, engine.botDecide()));
  });
  await engine.run();
  const r = engine.state.result!;
  stats.turns.push(turns);
  stats.reasons[r.reason] = (stats.reasons[r.reason] || 0) + 1;
  if (timedOut) stats.timeouts++;
  stats.wealth.push(r.rows[0].wealth);
}
const avg = (a: number[]) => Math.round(a.reduce((s, x) => s + x, 0) / Math.max(1, a.length));
const med = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
console.log(`Gier: ${games} (4 boty, poziomy mieszane, limit ${maxTurns} tur)`);
console.log(`Tury na grę: średnio ${avg(stats.turns)}, mediana ${med(stats.turns)}; bez rozstrzygnięcia przed limitem: ${stats.timeouts}`);
console.log('Jak kończą się gry:', Object.entries(stats.reasons).map(([k, v]) => `${k} ${Math.round((100 * v) / games)}%`).join(', '));
console.log(`Zakupy pól na grę: ${(stats.bought / games).toFixed(1)}, zmiany poziomów budynków na grę: ${(stats.built / games).toFixed(1)}`);
console.log(`Przelewy między graczami (czynsz i karty): średnio ${avg(stats.rent)} zł, mediana ${med(stats.rent)} zł`);
console.log(`Majątek zwycięzcy: średnio ${avg(stats.wealth)} zł, mediana ${med(stats.wealth)} zł`);
