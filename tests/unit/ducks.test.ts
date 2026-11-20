import { describe, expect, it } from 'vitest';
import { createDucks, loopPath } from '../../src/scene/ducks.js';

// Układ jak w grze (game.js): rodzina między plażą a bojami, para dalej w prawo
const FAMILY = { x0: -11, x1: 5, zc: 16.35, r: 1.25 };
const PAIR = { x0: 13.5, x1: 23, zc: 16.4, r: 1.15 };
const flat = (): [number, number, number] => [0, 0, 0];
const make = (ripples?: { heightAt: (x: number, z: number) => number; disturb: (x: number, z: number, amount: number, radius: number) => void }) =>
  createDucks({ waterY: -1, waveAt: flat, ripples, family: FAMILY, pair: PAIR });

describe('kaczki na wodzie', () => {
  it('trasa: zamknięta pętla o długości bieżni, punkty w równych odstępach i kierunek płynięcia', () => {
    const p = loopPath({ x0: 0, x1: 10, zc: 0, r: 2 });
    expect(p.length).toBeCloseTo(20 + 4 * Math.PI, 1);
    const a = p.at(0), b = p.at(p.length);   // pętla: koniec to początek
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1e-3);
    for (let s = 0; s < p.length; s += 0.37) {
      const q = p.at(s), q2 = p.at(s + 0.05);
      expect(Math.hypot(q.tx, q.tz)).toBeCloseTo(1, 5);
      expect(Math.hypot(q2.x - q.x, q2.z - q.z)).toBeCloseTo(0.05, 2);   // droga s to naprawdę przebyta droga
    }
  });

  it('gromadka: mama, 5 kaczątek i para (kaczor i kaczka); tułowie, głowy i łapki to siatki z instancjami', () => {
    const d = make();
    expect(d.count).toBe(8);
    const kinds = d.place(0).map(s => s.kind);
    expect(kinds.filter(k => k === 'hen')).toHaveLength(2);
    expect(kinds.filter(k => k === 'drake')).toHaveLength(1);
    expect(kinds.filter(k => k === 'chick')).toHaveLength(5);
    const meshes = d.group.children as unknown as { count: number; geometry: { getAttribute: (n: string) => { array: ArrayLike<number> } } }[];
    expect(meshes).toHaveLength(7);   // 3 rodzaje × (tułów, głowa) + łapki
    expect(meshes.map(m => m.count)).toEqual([2, 2, 1, 1, 5, 5, 16]);
    for (const m of meshes) {
      const pos = m.geometry.getAttribute('position').array;
      expect(Array.from(pos).every(Number.isFinite)).toBe(true);
    }
    for (const m of meshes.slice(0, 6)) expect(m.geometry.getAttribute('color')).toBeTruthy();   // upierzenie w wierzchołkach
  });

  it('kaczki zostają na swoim kawałku wody i na siebie nie wpadają', () => {
    const d = make();
    let minFam = Infinity, minPair = Infinity, maxGap = 0;
    for (let t = 0; t < 900; t += 0.25) {
      const st = d.place(t);
      for (const [k, s] of st.entries()) {
        const box = k < 6 ? FAMILY : PAIR;
        expect(s.x).toBeGreaterThan(box.x0 - box.r - 0.6);
        expect(s.x).toBeLessThan(box.x1 + box.r + 0.6);
        expect(Math.abs(s.z - box.zc)).toBeLessThan(box.r + 0.6);
      }
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) minFam = Math.min(minFam, Math.hypot(st[i].x - st[j].x, st[i].z - st[j].z));
      minPair = Math.min(minPair, Math.hypot(st[6].x - st[7].x, st[6].z - st[7].z));
      maxGap = Math.max(maxGap, Math.hypot(st[0].x - st[1].x, st[0].z - st[1].z));
    }
    expect(minFam).toBeGreaterThan(0.29);    // kaczątka płyną gęsiego, ale się nie zderzają
    expect(minPair).toBeGreaterThan(0.45);   // para płynie obok siebie
    expect(maxGap).toBeLessThan(0.75);       // pierwsze kaczątko trzyma się blisko mamy
  });

  it('para żeruje na zmianę: stoi z głową pod wodą, potem płynie dalej; przy zanurzeniu woda chlupie', () => {
    const calls: number[] = [];
    const d = make({ heightAt: () => 0, disturb: (_x, _z, amount) => calls.push(amount) });
    const dab: [number, number][] = [];
    let before: { x: number; z: number } | null = null;
    for (let t = 0; t < 40; t += 0.1) {
      const st = d.place(t);
      dab.push([st[6].dab, st[7].dab]);
      if (st[6].dab === 1) {
        if (before) expect(Math.hypot(st[6].x - before.x, st[6].z - before.z)).toBeLessThan(1e-6);   // przy żerowaniu nie płynie
        before = { x: st[6].x, z: st[6].z };
      } else before = null;
      d.update(t);
    }
    expect(dab.some(([a, b]) => a === 1 && b === 0)).toBe(true);
    expect(dab.some(([a, b]) => b === 1 && a === 0)).toBe(true);
    expect(dab.every(([a, b]) => a + b < 2)).toBe(true);   // nigdy obie naraz
    expect(calls.some(a => a > 0.01)).toBe(true);          // plusk przy zanurzeniu głowy
    expect(calls.filter(a => a > 0 && a < 0.01).length).toBeGreaterThan(100);   // drobne zmarszczki za kaczkami
  });
});
