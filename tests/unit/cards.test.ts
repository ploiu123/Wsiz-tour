import { describe, expect, it } from 'vitest';
import { BONUS_CARDS, PENALTY_CARDS, TAGS } from '../../src/data/cards.ts';

describe('karty', () => {
  it('11 ułatwień i 10 utrudnień, unikalne nazwy, znane znaczniki', () => {
    expect(BONUS_CARDS).toHaveLength(11);
    expect(PENALTY_CARDS).toHaveLength(10);
    const names = [...BONUS_CARDS, ...PENALTY_CARDS].map(c => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const c of [...BONUS_CARDS, ...PENALTY_CARDS]) if (c.tag) expect(TAGS[c.tag]).toBeDefined();
  });

  it('kwoty na kartach są w zwykłych złotych (bez „tys.” i „mln”)', () => {
    for (const c of [...BONUS_CARDS, ...PENALTY_CARDS]) expect(`${c.text} ${c.x2 ?? ''}`).not.toMatch(/tys\.|mln/);
  });
});
