// Ikony gry: biblioteka Phosphor Icons (licencja MIT, https://phosphoricons.com), dołączona do paczki gry
// (bez internetu). Decyzja autora z 27.10.2026: w grze ikony z biblioteki, a nie emoji ani znaki z czcionki.
// Każda ikona to tekst SVG (viewBox 0 0 256 256, kolor z currentColor). Grubość bold w przyciskach i menu,
// fill w kafelkach (awatary pionków, osiągnięcia) i w ikonach na planszy.
import play from '@phosphor-icons/core/assets/fill/play-fill.svg?raw';
import pause from '@phosphor-icons/core/assets/fill/pause-fill.svg?raw';
import trophy from '@phosphor-icons/core/assets/bold/trophy-bold.svg?raw';
import book from '@phosphor-icons/core/assets/bold/book-open-bold.svg?raw';
import cards from '@phosphor-icons/core/assets/bold/cards-bold.svg?raw';
import gear from '@phosphor-icons/core/assets/bold/gear-six-bold.svg?raw';
import user from '@phosphor-icons/core/assets/bold/user-bold.svg?raw';
import door from '@phosphor-icons/core/assets/bold/door-open-bold.svg?raw';
import logout from '@phosphor-icons/core/assets/bold/sign-out-bold.svg?raw';
import sun from '@phosphor-icons/core/assets/bold/sun-bold.svg?raw';
import moon from '@phosphor-icons/core/assets/bold/moon-bold.svg?raw';
import back from '@phosphor-icons/core/assets/bold/caret-left-bold.svg?raw';
import next from '@phosphor-icons/core/assets/bold/caret-right-bold.svg?raw';
import chev from '@phosphor-icons/core/assets/bold/caret-down-bold.svg?raw';
import monitor from '@phosphor-icons/core/assets/bold/monitor-bold.svg?raw';
import globe from '@phosphor-icons/core/assets/bold/globe-bold.svg?raw';
import eye from '@phosphor-icons/core/assets/bold/eye-bold.svg?raw';
import key from '@phosphor-icons/core/assets/bold/key-bold.svg?raw';
import film from '@phosphor-icons/core/assets/bold/film-strip-bold.svg?raw';
import dice from '@phosphor-icons/core/assets/bold/dice-five-bold.svg?raw';
import close from '@phosphor-icons/core/assets/bold/x-bold.svg?raw';
import sound from '@phosphor-icons/core/assets/bold/speaker-high-bold.svg?raw';
import mute from '@phosphor-icons/core/assets/bold/speaker-slash-bold.svg?raw';
import star from '@phosphor-icons/core/assets/fill/star-fill.svg?raw';
import music from '@phosphor-icons/core/assets/fill/music-notes-fill.svg?raw';
import shield from '@phosphor-icons/core/assets/fill/shield-check-fill.svg?raw';
import noPower from '@phosphor-icons/core/assets/bold/lightning-slash-bold.svg?raw';
// pionki
import flag from '@phosphor-icons/core/assets/fill/flag-fill.svg?raw';
import printer from '@phosphor-icons/core/assets/fill/printer-fill.svg?raw';
import gpu from '@phosphor-icons/core/assets/fill/graphics-card-fill.svg?raw';
import coffee from '@phosphor-icons/core/assets/fill/coffee-fill.svg?raw';
import robot from '@phosphor-icons/core/assets/fill/robot-fill.svg?raw';
import drone from '@phosphor-icons/core/assets/fill/drone-fill.svg?raw';
import cap from '@phosphor-icons/core/assets/fill/graduation-cap-fill.svg?raw';
import rocket from '@phosphor-icons/core/assets/fill/rocket-launch-fill.svg?raw';
// osiągnięcia
import student from '@phosphor-icons/core/assets/fill/student-fill.svg?raw';
import cup from '@phosphor-icons/core/assets/fill/trophy-fill.svg?raw';
import buildings from '@phosphor-icons/core/assets/fill/buildings-fill.svg?raw';
import servers from '@phosphor-icons/core/assets/fill/hard-drives-fill.svg?raw';
import brain from '@phosphor-icons/core/assets/fill/brain-fill.svg?raw';
import coins from '@phosphor-icons/core/assets/fill/coins-fill.svg?raw';
import lucky from '@phosphor-icons/core/assets/fill/dice-six-fill.svg?raw';
import exit from '@phosphor-icons/core/assets/fill/door-open-fill.svg?raw';
import medal from '@phosphor-icons/core/assets/fill/medal-fill.svg?raw';
import crown from '@phosphor-icons/core/assets/fill/crown-fill.svg?raw';

const SVG = {
  play, pause, trophy, book, cards, gear, user, door, logout, sun, moon, back, next, chev, monitor, globe, eye, key, film,
  dice, close, sound, mute, star, music, shield, noPower,
  flag, printer, gpu, coffee, robot, drone, cap, rocket,
  student, cup, buildings, servers, brain, coins, lucky, exit, medal, crown,
};

/**
 * Ikona jako znacznik <svg> do wstawienia w HTML (dla czytników ekranu ukryta: opis ma przycisk albo tekst obok).
 * @param {string} name nazwa z listy SVG
 * @param {string} [cls] dodatkowa klasa
 * @param {string} [color] kolor (domyślnie kolor tekstu)
 */
export function icon(name, cls = '', color = '') {
  const svg = SVG[name];
  if (!svg) return '';
  return svg.replace('<svg ', `<svg class="ph${cls ? ` ${cls}` : ''}"${color ? ` style="color:${color}"` : ''} aria-hidden="true" focusable="false" `);
}

// Ścieżki ikony: { d, opacity }
const pathCache = new Map();
function paths(name) {
  if (!pathCache.has(name)) {
    pathCache.set(name, [...(SVG[name] || '').matchAll(/<path d="([^"]+)"(?: opacity="([\d.]+)")?\s*\/>/g)]
      .map(m => ({ d: m[1], opacity: m[2] ? +m[2] : 1 })));
  }
  return pathCache.get(name);
}

/** Ikona wewnątrz większego rysunku SVG (np. karty): grupa w punkcie (x, y) o boku size */
export function iconGroup(name, x, y, size, color) {
  const s = size / 256;
  return `<g transform="translate(${x - size / 2} ${y - size / 2}) scale(${s})" fill="${color}">${paths(name)
    .map(p => `<path d="${p.d}"${p.opacity < 1 ? ` opacity="${p.opacity}"` : ''}/>`).join('')}</g>`;
}

/** Ikona na płótnie 2D (tekstury na planszy): środek (x, y), bok size */
export function drawIcon(g, name, x, y, size, color) {
  g.save();
  g.translate(x - size / 2, y - size / 2);
  g.scale(size / 256, size / 256);
  g.fillStyle = color;
  const alpha = g.globalAlpha;
  for (const p of paths(name)) { g.globalAlpha = alpha * p.opacity; g.fill(new Path2D(p.d)); }
  g.restore();
}
