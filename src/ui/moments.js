// Najlepsze momenty gry (ekran po grze): w trakcie gry zbieramy ciekawe chwile (monopol, serwerownia, bankructwo,
// wysoki czynsz, zgarnięta pula, dziekanat), a po grze kamera przelatuje nad kilkoma najważniejszymi.
//
// moment: { seq, cell, title, sub, color, score }; seq to kolejność w grze, score to waga (im wyżej, tym ciekawiej)

/**
 * Wybór momentów do powtórki: na każde pole jeden (ważniejszy), najwyżej n o najwyższej wadze,
 * pokazane w kolejności, w jakiej działy się w grze.
 * @param {{ seq: number, cell: number, score: number }[]} list
 * @param {number} n
 */
export function pickMoments(list, n = 5) {
  const byCell = new Map();
  for (const m of list) {
    const old = byCell.get(m.cell);
    if (!old || m.score > old.score) byCell.set(m.cell, m);
  }
  return [...byCell.values()]
    .sort((a, b) => b.score - a.score || a.seq - b.seq)
    .slice(0, n)
    .sort((a, b) => a.seq - b.seq);
}

// Waga czynszu i puli rośnie z kwotą, ale nie przebija monopolu ani serwerowni
export const rentScore = amount => 40 + Math.min(35, amount / 25);
export const poolScore = amount => 45 + Math.min(30, amount / 30);
