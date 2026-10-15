// Wykres majątku graczy w czasie (ekran końca gry): jedna linia na gracza w jego kolorze, podpis przy końcu linii,
// lekka siatka z kwotami. Rysowany jako SVG (ostry w każdej rozdzielczości, bez bibliotek).

const fmtK = v => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0).replace('.', ',')} tys.` : String(Math.round(v)));

/**
 * @param {number[][]} hist majątek po kolejnych turach: hist[tura][gracz]
 * @param {{ name: string, color: string, out?: boolean }[]} players
 * @returns {string} znacznik <svg>
 */
export function wealthChartSvg(hist, players) {
  const W = 640, H = 220, L = 46, R = 96, T = 14, B = 26;
  if (!hist.length) return '';
  const n = hist.length, max = Math.max(1, ...hist.flat()) * 1.08;
  const x = i => L + (n === 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const y = v => T + (1 - v / max) * (H - T - B);
  const step = [500, 1000, 2000, 5000, 10000].find(s => max / s <= 5) || 20000;
  let grid = '';
  for (let v = 0; v <= max; v += step) {
    grid += `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="wc-grid"/>`;
    grid += `<text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" class="wc-axis" text-anchor="end">${fmtK(v)}</text>`;
  }
  // podpisy na końcu linii, rozsunięte, żeby się nie nakładały
  const ends = players.map((p, k) => ({ k, y: y(hist[n - 1][k] ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  const labelY = Object.fromEntries(ends.map(e => [e.k, e.y]));
  const lines = players.map((p, k) => {
    const pts = hist.map((row, i) => `${x(i).toFixed(1)},${y(row[k] ?? 0).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${p.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"${p.out ? ' stroke-dasharray="4 4" opacity=".6"' : ''}/>
      <circle cx="${x(n - 1).toFixed(1)}" cy="${y(hist[n - 1][k] ?? 0).toFixed(1)}" r="3.5" fill="${p.color}"/>
      <text x="${(x(n - 1) + 9).toFixed(1)}" y="${(labelY[k] + 4).toFixed(1)}" class="wc-label" fill="${p.color}">${p.name.replace(/[<&>]/g, '')}</text>`;
  }).join('');
  return `<svg class="g-wealth" viewBox="0 0 ${W} ${H}" role="img" aria-label="Majątek graczy w kolejnych turach">
    ${grid}<text x="${(L + W - R) / 2}" y="${H - 6}" class="wc-axis" text-anchor="middle">kolejne tury</text>${lines}</svg>`;
}
