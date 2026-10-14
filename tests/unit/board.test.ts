import { describe, expect, it } from 'vitest';
import { CORNER_INFO, FIELDS, GROUPS, GROUP_CELLS, ROOM_CELLS, SPECIAL_CELLS, TOTAL, buyable, cellPose, fname, S } from '../../src/data/board.ts';

describe('plansza', () => {
  it('ma 32 pola: 4 narożniki i 28 pól w FIELDS', () => {
    expect(TOTAL).toBe(32);
    expect(Object.keys(CORNER_INFO).map(Number)).toEqual([0, 8, 16, 24]);
    const all = [...Object.keys(CORNER_INFO), ...Object.keys(FIELDS)].map(Number).sort((a, b) => a - b);
    expect(all).toEqual([...Array(TOTAL).keys()]);
  });

  it('każda grupa ma 2 albo 3 sale i istnieje w GROUPS', () => {
    for (const [g, cells] of Object.entries(GROUP_CELLS)) {
      expect(GROUPS[Number(g)]).toBeDefined();
      expect(cells.length).toBeGreaterThanOrEqual(2);
      expect(cells.length).toBeLessThanOrEqual(3);
    }
    expect(Object.keys(GROUP_CELLS)).toHaveLength(8);
    expect(ROOM_CELLS.every(i => FIELDS[i].type === 'room')).toBe(true);
  });

  it('ma 4 pola specjalne i 2 parkingi do kupienia', () => {
    expect(SPECIAL_CELLS).toHaveLength(4);
    const stations = Object.values(FIELDS).filter(f => f.type === 'station');
    expect(stations).toHaveLength(2);
    expect(buyable(3)).toBe(true);
    expect(buyable(5)).toBe(false);   // Szansa
    expect(buyable(0)).toBe(false);   // START
  });

  it('pola leżą na obwodzie planszy, narożniki w rogach', () => {
    const half = S / 2;
    for (let i = 0; i < TOTAL; i++) {
      const p = cellPose(i);
      expect(Math.max(Math.abs(p.x), Math.abs(p.z))).toBeLessThan(half);
      expect(p.corner).toBe(i % 8 === 0);
    }
    const start = cellPose(0);
    expect(start.x).toBeGreaterThan(0);
    expect(start.z).toBeGreaterThan(0);
  });

  it('nazwy pól', () => {
    expect(fname(0)).toBe('START');
    expect(fname(1)).toBe('Sala 04');
    expect(fname(8)).toBe('Dziekanat');
  });
});
