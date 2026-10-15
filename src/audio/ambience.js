// Tło dźwiękowe: na makiecie fale, wiatr i czasem mewy, w pokoju tykanie zegara i ptaki za oknem
import { click } from './synth.js';

export function createAmbience(a) {
  const out = a.createGain(); out.gain.value = 0; out.connect(a.destination);
  const buf = a.createBuffer(2, a.sampleRate * 4, a.sampleRate);   // 4 s szumu w stereo, w pętli
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const loop = (type, f, q, v) => {
    const s = a.createBufferSource(); s.buffer = buf; s.loop = true;
    const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = a.createGain(); g.gain.value = v;
    s.connect(fl).connect(g); s.start(0, Math.random() * 3);
    return g;
  };
  const surf = a.createGain(); surf.connect(out);
  // fale: szum przypływa i odpływa (wolna zmiana głośności i jasności)
  const waves = loop('lowpass', 750, 0.4, 0.5), wl = a.createOscillator(), wlg = a.createGain();
  wl.frequency.value = 0.13; wlg.gain.value = 0.35; wl.connect(wlg).connect(waves.gain); wl.start();
  waves.connect(surf);
  // wiatr: pasmo szumu, które powoli się przesuwa
  const wind = loop('bandpass', 420, 0.5, 0.18), wo = a.createOscillator(), wog = a.createGain();
  wo.frequency.value = 0.05; wog.gain.value = 0.08; wo.connect(wog).connect(wind.gain); wo.start();
  wind.connect(surf);
  const st = { out, surf, kind: 'diorama' };
  // mewy (makieta), tykanie zegara i ptaki (pokój): krótkie dźwięki co jakiś czas
  let nextGull = a.currentTime + 4, nextBird = a.currentTime + 3, tick = 0;
  setInterval(() => {
    if (out.gain.value < 0.001 || document.hidden) return;
    const t = a.currentTime;
    if (st.kind === 'diorama' && t > nextGull) {
      nextGull = t + 6 + Math.random() * 9;
      const n = 2 + Math.floor(Math.random() * 3), pan = Math.random() * 1.6 - 0.8;
      for (let k = 0; k < n; k++) {
        const at = t + 0.05 + k * (0.22 + Math.random() * 0.08), o = a.createOscillator(), g = a.createGain(), p = a.createStereoPanner(), bp = a.createBiquadFilter();
        o.type = 'sawtooth'; bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 2; p.pan.value = pan;
        o.frequency.setValueAtTime(1350 + Math.random() * 250, at); o.frequency.exponentialRampToValueAtTime(980, at + 0.18);
        g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.05, at + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
        o.connect(bp).connect(g).connect(p).connect(out); o.start(at); o.stop(at + 0.22);
      }
    }
    if (st.kind === 'pokoj') {
      if (t > tick) { tick = Math.ceil(t); click(a, tick, tick % 2 ? 3600 : 3000, 0.03, 0.015); }   // zegar na ścianie
      if (t > nextBird) {
        nextBird = t + 5 + Math.random() * 8;
        for (let k = 0; k < 3 + Math.floor(Math.random() * 4); k++) {
          const at = t + k * 0.11, o = a.createOscillator(), g = a.createGain();
          o.frequency.setValueAtTime(3200 + Math.random() * 900, at); o.frequency.exponentialRampToValueAtTime(4300 + Math.random() * 600, at + 0.07);
          g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.012, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
          o.connect(g).connect(out); o.start(at); o.stop(at + 0.1);
        }
      }
    }
  }, 120);
  return st;
}
