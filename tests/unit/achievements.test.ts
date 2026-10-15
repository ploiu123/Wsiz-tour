import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, unlock } from '../../src/ui/achievements.js';
import { wealthChartSvg } from '../../src/ui/wealthChart.js';

const game = (o = {}) => ({ won: false, monopoly: false, hotel: false, doubles: 0, acc: 50, answered: 4, wealth: 1800, jailEscapes: 0, bankrupt: false, ...o });

describe('osiągnięcia', () => {
  it('pierwsza gra i pierwsza wygrana', () => {
    const got = unlock(game({ won: true }), { games: 1, wins: 1 }).map(a => a.id);
    expect(got).toEqual(expect.arrayContaining(['first-game', 'first-win']));
    expect(got).not.toContain('veteran');
  });

  it('nie przyznaje drugi raz tego, co gracz już ma', () => {
    const got = unlock(game({ won: true }), { games: 2, wins: 2 }, { 'first-game': '2026-10-15', 'first-win': '2026-10-15' });
    expect(got).toEqual([]);
  });

  it('kujon tylko przy co najmniej 8 pytaniach, krezus nie dla bankruta', () => {
    expect(unlock(game({ acc: 100, answered: 3 }), { games: 1, wins: 0 }).map(a => a.id)).not.toContain('scholar');
    expect(unlock(game({ acc: 92, answered: 10 }), { games: 1, wins: 0 }).map(a => a.id)).toContain('scholar');
    expect(unlock(game({ wealth: 9000, bankrupt: true }), { games: 1, wins: 0 }).map(a => a.id)).not.toContain('rich');
  });

  it('każde osiągnięcie ma nazwę i opis bez kropki na końcu (to nie są pełne zdania)', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(3);
      expect(a.desc.endsWith('.')).toBe(false);
    }
  });
});

describe('wykres majątku', () => {
  it('rysuje linię dla każdego gracza i podpisy', () => {
    const svg = wealthChartSvg([[2000, 2000], [2100, 1900], [2600, 1500]], [{ name: 'Patryk', color: '#E5484D' }, { name: 'Bot 2', color: '#2F7FF0' }]);
    expect(svg.match(/<polyline/g)).toHaveLength(2);
    expect(svg).toContain('Patryk');
    expect(svg).toContain('kolejne tury');
  });
  it('pusta historia nie rysuje nic', () => {
    expect(wealthChartSvg([], [])).toBe('');
  });
});
