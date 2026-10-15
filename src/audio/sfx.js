// Efekty dźwiękowe gry: syntezowane w przeglądarce (Web Audio), bez plików
import { audio, noise, click, tone } from './synth.js';

let diceAudio = null;
/**
 * Efekt dźwiękowy.
 * @param {string} name dice, hop, good, bad, coin, card, shutter, build, click, fanfare
 * @param {number} vol głośność 0–1 (suwak „Efekty dźwiękowe”)
 * @param {string} diceFile nagranie kości zamiast dźwięku z kodu (puste = z kodu)
 */
export function playSfx(name, vol, diceFile = '') {
  if (!vol) return;
  if (name === 'dice' && diceFile) {
    diceAudio ||= new Audio(diceFile);
    diceAudio.volume = vol; diceAudio.currentTime = 0; diceAudio.play().catch(() => {});
    return;
  }
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  const v = 0.9 * vol;
  if (name === 'dice') {   // kostki: potrząśnięcie w dłoni, a potem stukot o planszę
    for (let k = 0; k < 6; k++) click(a, t + k * 0.045, 2600 + Math.random() * 1200, 0.18 * v, 0.03);
    const hits = [0.42, 0.5, 0.78, 0.86, 1.0, 1.08, 1.17, 1.25, 1.32];
    hits.forEach((h, k) => click(a, t + h, 1500 + Math.random() * 2400, (0.75 - k * 0.06) * v, 0.05 + Math.random() * 0.03));
    tone(a, t + 0.42, 140, 0.12, 0.25 * v, 'sine', 70);
  } else if (name === 'hop') tone(a, t, 520, 0.08, 0.12 * v, 'triangle', 760);
  else if (name === 'good') [523, 659, 784].forEach((f, k) => tone(a, t + k * 0.09, f, 0.32, 0.22 * v, 'triangle'));
  else if (name === 'bad') { tone(a, t, 330, 0.28, 0.2 * v, 'sawtooth', 220); tone(a, t + 0.18, 220, 0.4, 0.18 * v, 'sawtooth', 150); }
  else if (name === 'coin') {   // kilka monet: każda trochę inna, z metalicznym dzwonieniem
    for (let k = 0; k < 3; k++) {
      const f = 1250 + Math.random() * 600, at = t + k * 0.06 + Math.random() * 0.02;
      tone(a, at, f, 0.18, 0.12 * v); tone(a, at, f * 2.76, 0.12, 0.05 * v); click(a, at, 6000, 0.05 * v, 0.02);
    }
  } else if (name === 'card') {   // karta: szelest wysuwania i trzask papieru
    const n = a.createBufferSource(); n.buffer = noise(a);
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(4200, t + 0.22);
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18 * v, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    n.connect(f).connect(g).connect(a.destination); n.start(t); n.stop(t + 0.3);
    click(a, t + 0.27, 3200, 0.2 * v, 0.03);
  } else if (name === 'shutter') {   // migawka aparatu: dwa krótkie trzaski
    click(a, t, 4200, 0.22 * v, 0.02); click(a, t + 0.07, 2600, 0.18 * v, 0.03);
  } else if (name === 'build') {   // budowa: stuknięcia metalu o rusztowanie i głuche lądowanie
    [0, 0.09, 0.2].forEach((d, k) => { click(a, t + d, 2800 + k * 600, 0.16 * v, 0.06); tone(a, t + d, 880 + k * 220, 0.18, 0.05 * v, 'triangle'); });
    tone(a, t + 0.32, 170, 0.32, 0.38 * v, 'sine', 55);
    click(a, t + 0.32, 600, 0.28 * v, 0.12);
  } else if (name === 'click') tone(a, t, 1900, 0.035, 0.05 * v, 'sine', 1500);   // przycisk w menu: ciche „tyk”
  else if (name === 'fanfare') [523, 659, 784, 1046].forEach((f, k) => tone(a, t + k * 0.13, f, 0.5, 0.2 * v, 'triangle'));
}
