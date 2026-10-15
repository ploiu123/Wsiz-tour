// Syntezator dźwięków (Web Audio): wspólny kontekst audio i proste brzmienia, z których powstają efekty,
// muzyka i tło dźwiękowe. Wszystko liczone w przeglądarce, bez plików.

let actx = null;
export function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
let noiseBuf = null;
export function noise(a) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
export function click(a, t, freq, gain, dur) {   // krótkie stuknięcie: filtrowany szum
  const src = a.createBufferSource(); src.buffer = noise(a);
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3.5;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
}
export function tone(a, t, freq, dur, gain, type = 'sine', to = null) {
  const o = a.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
// Uderzenie kości o powierzchnię: suchy trzask plus krótki ton „pudła” (drewno stołu niżej i dłużej, tektura planszy wyżej)
export function knock(a, t, vel, wood) {
  click(a, t, wood ? 1300 + Math.random() * 900 : 2000 + Math.random() * 1800, vel, wood ? 0.07 : 0.045);
  tone(a, t, wood ? 190 + Math.random() * 60 : 320 + Math.random() * 80, wood ? 0.12 : 0.06, 0.22 * vel, 'sine', wood ? 150 : 260);
}
// Czy kontekst audio już powstał (przeglądarka pozwala grać dopiero po kliknięciu)
export const audioStarted = () => !!actx;
export const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
let irBuf = null;
export function reverbIR(a) {   // pogłos sali: szum, który cichnie przez ~2,8 s
  if (irBuf && irBuf.sampleRate === a.sampleRate) return irBuf;
  const n = Math.floor(a.sampleRate * 2.8), b = a.createBuffer(2, n, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.4) * Math.min(1, i / 240);
  }
  return (irBuf = b);
}
