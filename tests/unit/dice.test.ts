import { beforeAll, describe, expect, it } from 'vitest';
import { loadDicePhysics, simulateThrow, upFace, FACE_AXES } from '../../src/render/dice.js';

type Sim = { dt: number; frames: Float32Array; count: number; faces: number[]; impacts: { t: number; v: number }[] };
const layout = (seed: number, from: [number, number] = [0.7071, 0.7071]) => ({
  floorY: 0.016, half: 4.14, die: 0.62, round: 0.07, from, seed,
  obstacles: [{ x: 2.95, z: 0, hx: 0.88, hy: 0.09, hz: 1.23 }, { x: -2.95, z: 0, hx: 0.88, hy: 0.09, hz: 1.23 }],
});

describe('kości z fizyką (Rapier)', () => {
  beforeAll(async () => { expect(await loadDicePhysics()).toBeTruthy(); }, 60_000);

  it('kości lądują płasko na planszy, w środku i obok siebie, z kilkoma uderzeniami', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const sim = simulateThrow(layout(seed, seed % 2 ? [0.7071, 0.7071] : [-1, 0])) as Sim | null;
      expect(sim, `seed ${seed}`).not.toBeNull();
      const s = sim!, last = (s.count - 1) * 14;
      for (const k of [0, 1]) {
        const o = last + k * 7;
        expect(Math.abs(s.frames[o])).toBeLessThan(4.14);
        expect(Math.abs(s.frames[o + 2])).toBeLessThan(4.14);
        expect(s.frames[o + 1]).toBeCloseTo(0.016 + 0.31, 1);
        const up = upFace([s.frames[o + 3], s.frames[o + 4], s.frames[o + 5], s.frames[o + 6]]);
        expect(up.face).toBe(s.faces[k]);
        expect(up.dot).toBeGreaterThan(0.985);
      }
      expect(s.impacts.length).toBeGreaterThan(1);
      expect(s.count * s.dt).toBeLessThan(5);   // rzut trwa najwyżej kilka sekund
    }
  });

  it('to samo ziarno daje ten sam lot (gracze online widzą ten sam rzut)', () => {
    const a = simulateThrow(layout(42)) as Sim, b = simulateThrow(layout(42)) as Sim;
    expect(a.count).toBe(b.count);
    expect(Array.from(a.frames)).toEqual(Array.from(b.frames));
  });

  it('każda ścianka ma inną liczbę oczek, przeciwległe sumują się do 7', () => {
    const values = FACE_AXES.map(f => f[1] as number);
    expect([...values].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (let k = 0; k < 6; k += 2) expect(values[k] + values[k + 1]).toBe(7);
  });
});
