import { describe, expect, it } from 'vitest';
import { BUILD_MULT, ECON, GROUP_PRICE, RENT_MULT, levelCost, money, priceOf, roundK } from '../../src/data/economy.ts';
import { FIELDS, GROUP_CELLS } from '../../src/data/board.ts';

// toLocaleString('pl-PL') rozdziela tysiące twardą spacją (od 10 000)
const plain = (s: string) => s.replace(/ /g, ' ');

describe('ekonomia', () => {
  it('kwoty są pełne, bez „tys.” i „mln”', () => {
    expect(money(2000)).toBe('2000 zł');
    expect(plain(money(12500))).toBe('12 500 zł');
    expect(money(-150)).toBe('−150 zł');
    expect(money(9.6)).toBe('10 zł');
  });

  it('start i stałe kwoty jak w założeniach', () => {
    expect(ECON.startCash).toBe(2000);
    expect(ECON.startPay).toBe(250);
    expect(ECON.tax).toBe(150);
    expect(ECON.bail).toBe(150);
  });

  it('ceny sal rosną z numerem grupy (80–400 zł)', () => {
    const prices = Object.keys(GROUP_PRICE).map(Number).sort((a, b) => a - b).map(g => GROUP_PRICE[g]);
    expect(prices[0]).toBe(80);
    expect(prices.at(-1)).toBe(400);
    for (let k = 1; k < prices.length; k++) expect(prices[k]).toBeGreaterThan(prices[k - 1]);
    for (const [g, cells] of Object.entries(GROUP_CELLS)) for (const i of cells) expect(priceOf(i)).toBe(GROUP_PRICE[Number(g)]);
  });

  it('czynsz rośnie z poziomem budynku, budowa kosztuje pół ceny, serwerownia całą', () => {
    for (let k = 1; k < RENT_MULT.length; k++) expect(RENT_MULT[k]).toBeGreaterThan(RENT_MULT[k - 1]);
    expect(BUILD_MULT.slice(1, 5).every(m => m === 0.5)).toBe(true);
    expect(BUILD_MULT[5]).toBe(1);
    const sala44 = Number(Object.keys(FIELDS).find(i => FIELDS[Number(i)].name === 'Sala 44'));
    expect(priceOf(sala44)).toBe(400);
    expect(roundK(400 * RENT_MULT[5])).toBe(1440);
    expect(levelCost(sala44, 1)).toBe(200);
    expect(levelCost(sala44, 5)).toBe(400);
  });
});
