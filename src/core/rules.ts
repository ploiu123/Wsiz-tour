// Zasady gry jako czyste funkcje na stanie: czynsz, wartość pól, majątek, monopole, wygrana.
// Korzysta z nich silnik, interfejs (okienko pola) i w przyszłości serwer.
import { FIELDS, GROUP_CELLS, SPECIAL_CELLS } from '../data/board.ts';
import { ECON, RENT_MULT, levelCost, priceOf, roundK } from '../data/economy.ts';
import type { GameResult, GameState, PlayerState, PublicState } from './types.ts';

type View = Pick<GameState, 'players' | 'own' | 'teams'> | PublicState;

export const pct = (ok: number, q: number): number | null => (q ? Math.round((100 * ok) / q) : null);

export const ownerOf = (s: View, cell: number): number | undefined => s.own[cell]?.owner;
export const ownedBy = (s: View, player: number): number[] =>
  Object.keys(s.own).map(Number).filter(i => s.own[i].owner === player);
export const sameTeam = (s: View, a: number, b: number): boolean => a === b || (s.teams && s.players[a].team === s.players[b].team);
export const activePlayers = (s: View): PlayerState[] => s.players.filter(p => !p.out);
export const opponents = (s: View, player: number): PlayerState[] => activePlayers(s).filter(o => !sameTeam(s, o.idx, player));

// Wartość pola: cena i wszystkie postawione poziomy budynku
export function fieldValue(s: View, cell: number): number {
  const o = s.own[cell];
  let v = priceOf(cell);
  if (o) for (let l = 1; l <= o.level; l++) v += levelCost(cell, l);
  return v;
}
export function wealth(s: View, player: number): number {
  let v = s.players[player].cash;
  for (const i of ownedBy(s, player)) v += fieldValue(s, i);
  return v;
}

export const hasMonopoly = (s: View, player: number, group: number): boolean =>
  GROUP_CELLS[group].every(i => s.own[i]?.owner === player);

// Czynsz: sala = cena × mnożnik poziomu (×2 przy monopolu bez budynku), parking i pole specjalne zależnie od liczby pól
export function rentOf(s: View, cell: number): number {
  const o = s.own[cell];
  if (!o || o.off > 0) return 0;
  const f = FIELDS[cell];
  if (f.type === 'room') {
    let r = priceOf(cell) * RENT_MULT[o.level];
    if (o.level === 0 && hasMonopoly(s, o.owner, f.group!)) r *= 2;
    return roundK(r);
  }
  const n = ownedBy(s, o.owner).filter(k => FIELDS[k].type === f.type).length;
  return f.type === 'station' ? ECON.stationRent[n] : ECON.specialRent[n];
}

// Czynsz od razu po zakupie (pole bez budynku, jeden parking albo jedno pole specjalne)
export const startRent = (cell: number): number => {
  const f = FIELDS[cell];
  return f.type === 'room' ? roundK(priceOf(cell) * RENT_MULT[0]) : f.type === 'station' ? ECON.stationRent[1] : ECON.specialRent[1];
};

// Ile poziomów można dobudować za jednym razem: najwyżej 2, a hotel (poziom 5) tylko z poziomu 4
export const maxAdd = (level: number): number => (level >= 5 ? 0 : level === 4 ? 1 : Math.min(2, 4 - level));
export function buildCost(cell: number, level: number, n: number): number {
  let cost = 0;
  for (let k = 1; k <= n; k++) cost += levelCost(cell, level + k);
  return cost;
}

// Cel ataku: sala przeciwnika bez hotelu, a właściciel nie ma ubezpieczenia
export function attackable(s: View, cell: number, attacker: number): boolean {
  const o = s.own[cell];
  return !!o && FIELDS[cell].type === 'room' && o.level < 5 && !sameTeam(s, o.owner, attacker) && !(s.players[o.owner].insured > 0);
}

// Wygrana od razu: wszystkie 4 pola specjalne albo 4 monopole (w trybie 2 na 2 liczą się pola drużyny)
export function instantWin(s: View, player: number): 'specials' | 'monopolies' | null {
  const mine = (o: number | undefined) => o !== undefined && (s.teams ? s.players[o].team === s.players[player].team : o === player);
  if (SPECIAL_CELLS.every(i => mine(s.own[i]?.owner))) return 'specials';
  const monos = Object.values(GROUP_CELLS).filter(cells => {
    const o = s.own[cells[0]]?.owner;
    return mine(o) && cells.every(i => s.own[i]?.owner === o);
  }).length;
  return monos >= 4 ? 'monopolies' : null;
}

// Wynik: majątek, skuteczność odpowiedzi, zwycięzcy i Prymus
export function scoreGame(s: View, reason: GameResult['reason'], instantWinner: number | null = null): GameResult {
  const acc = (p: PlayerState) => pct(p.total.ok, p.total.q);
  const rows = s.players.map(p => ({ player: p.idx, wealth: p.out ? 0 : wealth(s, p.idx), acc: acc(p) }));
  const order = (a: (typeof rows)[number], b: (typeof rows)[number]) => b.wealth - a.wealth || (b.acc ?? -1) - (a.acc ?? -1);
  let winners: number[];
  if (instantWinner !== null) {
    winners = s.teams ? s.players.filter(p => p.team === s.players[instantWinner].team).map(p => p.idx) : [instantWinner];
  } else if (s.teams) {
    const team = (t: number) => rows.filter(r => s.players[r.player].team === t);
    const sum = (t: number) => team(t).reduce((v, r) => v + r.wealth, 0);
    const tacc = (t: number) => pct(team(t).reduce((v, r) => v + s.players[r.player].total.ok, 0), team(t).reduce((v, r) => v + s.players[r.player].total.q, 0)) ?? -1;
    const wt = sum(0) - sum(1) || tacc(0) - tacc(1);
    winners = team(wt >= 0 ? 0 : 1).map(r => r.player);
  } else winners = [rows.slice().sort(order)[0].player];
  rows.sort(order);
  const scored = rows.filter(r => r.acc != null);
  const top = scored.length ? Math.max(...scored.map(r => r.acc!)) : null;
  const prymus = top == null ? null : scored.find(r => r.acc === top)!.player;
  return { reason, winners, rows, prymus, teams: s.teams };
}
