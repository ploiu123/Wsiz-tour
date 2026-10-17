import { describe, expect, it } from 'vitest';
import { instantWin, WIN_MONOPOLIES } from '../../src/core/rules.ts';
import { GROUP_CELLS } from '../../src/data/board.ts';

// Stan na potrzeby zasad: tylko gracze (z drużyną) i właściciele pól
const view = (owned: Record<number, number>, teams = false) => ({
  teams,
  players: [0, 1, 2, 3].map(idx => ({ idx, team: idx % 2 })),
  own: Object.fromEntries(Object.entries(owned).map(([cell, owner]) => [cell, { owner, level: 0 }])),
}) as unknown as Parameters<typeof instantWin>[0];
const groups = Object.values(GROUP_CELLS);
const giveGroups = (n: number, owner: (k: number) => number) =>
  Object.fromEntries(groups.slice(0, n).flatMap((cells, k) => cells.map(c => [c, owner(k)])));

describe('wygrana od razu', () => {
  it(`${WIN_MONOPOLIES} monopole wygrywają, o jeden mniej jeszcze nie`, () => {
    expect(WIN_MONOPOLIES).toBe(3);
    expect(instantWin(view(giveGroups(3, () => 0)), 0)).toBe('monopolies');
    expect(instantWin(view(giveGroups(2, () => 0)), 0)).toBeNull();
  });
  it('w trybie 2 na 2 liczą się monopole partnera, ale nie przeciwnika', () => {
    expect(instantWin(view(giveGroups(3, k => (k === 2 ? 2 : 0)), true), 0)).toBe('monopolies');   // gracze 0 i 2 to jedna drużyna
    expect(instantWin(view(giveGroups(3, k => (k === 2 ? 1 : 0)), true), 0)).toBeNull();
  });
});
