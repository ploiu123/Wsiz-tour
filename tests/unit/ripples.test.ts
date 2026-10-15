import { describe, expect, it } from 'vitest';
import { RippleSim } from '../../src/scene/ripples.js';

const sim = () => new RippleSim({ nx: 121, nz: 61, x0: -30, x1: 30, z0: 0, z1: 30, speed: 2.6, decay: 0.55 });

describe('zmarszczki na wodzie (równanie falowe)', () => {
  it('fala rozchodzi się równo na boki i dociera dalej z czasem', () => {
    const s = sim();
    s.disturb(0, 15, 0.3, 0.6);
    for (let k = 0; k < 30; k++) s.step(1 / 60);   // 0,5 s
    const near = Math.abs(s.heightAt(1.2, 15)), far = Math.abs(s.heightAt(8, 15));
    expect(near).toBeGreaterThan(1e-4);
    expect(far).toBeLessThan(near);
    expect(s.heightAt(-2, 15)).toBeCloseTo(s.heightAt(2, 15), 6);   // symetria w lewo i w prawo
    for (let k = 0; k < 120; k++) s.step(1 / 60);  // po 2,5 s fala jest już daleko
    expect(Math.abs(s.heightAt(5.5, 15)) + Math.abs(s.heightAt(6.5, 15))).toBeGreaterThan(1e-5);
  });

  it('fala wygasa i nie rośnie bez końca (schemat jest stabilny)', () => {
    const s = sim();
    s.disturb(5, 10, 0.4, 0.8);
    s.step(1 / 60);
    const e0 = s.energy();
    for (let k = 0; k < 600; k++) s.step(1 / 60);   // 10 s
    expect(s.energy()).toBeLessThan(e0 * 0.05);
    expect(Number.isFinite(s.energy())).toBe(true);
  });

  it('wynik nie zależy od liczby klatek (stały krok symulacji)', () => {
    const a = sim(), b = sim();
    a.disturb(-4, 12, 0.3); b.disturb(-4, 12, 0.3);
    for (let k = 0; k < 60; k++) a.step(1 / 60);
    for (let k = 0; k < 30; k++) b.step(1 / 30);
    expect(a.heightAt(-1, 12)).toBeCloseTo(b.heightAt(-1, 12), 6);
  });
});
