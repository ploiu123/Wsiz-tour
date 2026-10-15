import { describe, expect, it } from 'vitest';
import { pickMoments, rentScore, poolScore } from '../../src/ui/moments.js';

const m = (seq: number, cell: number, score: number) => ({ seq, cell, score, title: `m${seq}`, sub: '', color: '#000' });

describe('najlepsze momenty', () => {
  it('najwyżej n momentów o najwyższej wadze, w kolejności gry', () => {
    const got = pickMoments([m(1, 3, 30), m(2, 5, 90), m(3, 7, 50), m(4, 9, 85), m(5, 11, 20)], 3);
    expect(got.map(x => x.seq)).toEqual([2, 3, 4]);
  });
  it('na jedno pole jeden moment: ten ważniejszy', () => {
    const got = pickMoments([m(1, 4, 80), m(2, 4, 95), m(3, 6, 40)]);
    expect(got.map(x => x.seq)).toEqual([2, 3]);
  });
  it('pusta gra nie ma momentów', () => {
    expect(pickMoments([])).toEqual([]);
  });
  it('czynsz i pula nie przebijają monopolu (80) ani serwerowni (90)', () => {
    expect(rentScore(100000)).toBeLessThan(80);
    expect(poolScore(100000)).toBeLessThan(80);
    expect(rentScore(400)).toBeGreaterThan(rentScore(100));
  });
});
