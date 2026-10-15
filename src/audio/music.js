// ---------------------------------------------------------------------------
// Muzyka: wszystko syntezowane w przeglądarce (Web Audio), bez plików.
//  - „game”: spokojny, ciepły podkład do menu i gry (elektryczne pianino, miękki bas,
//    delikatna perkusja z lekkim „bujaniem” i cichy szum płyty winylowej),
//  - „promo”: utwór do prezentacji, który rośnie razem z energią sceny:
//    0 pad i pianino, 1 bas i arpeggio, 2 bit, 3 pełny bit z melodią i „pompowaniem” w rytm stopy.
// Wspólny mikser: pogłos, echo raz w lewo, raz w prawo, kompresor i limiter, żeby nic nie przesterowało.
// ---------------------------------------------------------------------------
// opts: level() głośność 0–1, hold() pauza, ctx (np. OfflineAudioContext do nagrania), until (długość nagrania),
// useFile: w prezentacji utwór z pliku zamiast syntezatora (wybór w Ustawieniach)
import { audio, noise, midiHz, reverbIR } from './synth.js';

// Akordy: [bas, dźwięki pianina lub padu] w zapisie MIDI (60 = środkowe C)
export const SONGS = {
  game: {   // C-dur, 84 BPM: Dm9 G13 Cmaj9 Am9 | Fmaj9 Em7 Dm9 G11
    bpm: 84, swing: 0.17,
    chords: [[38, [53, 57, 60, 64]], [43, [53, 57, 59, 64]], [36, [52, 55, 59, 62]], [45, [55, 59, 60, 64]],
      [41, [52, 55, 57, 60]], [40, [50, 55, 59, 64]], [38, [53, 57, 60, 64]], [43, [53, 57, 60, 65]]],
    hook: [[0, 76], [6, 74], [8, 72], [14, 69]],   // krótka melodia co drugi takt: [krok, nuta]
  },
  // Prezentacja: utwór filmowy w d-moll, 100 BPM, napisany pod sceny (energia sceny 0–3 dokłada instrumenty).
  // Część A: Dm Bb F C (i–VI–III–VII), część B: Gm Bb Dm A (A-dur na końcu frazy buduje napięcie), co 8 taktów.
  promo: {
    bpm: 100, swing: 0,
    chords: [[38, [50, 57, 62, 65]], [34, [50, 58, 62, 65]], [41, [53, 57, 60, 65]], [36, [52, 55, 60, 64]]],
    chordsB: [[43, [50, 55, 58, 62]], [34, [53, 58, 62, 65]], [38, [53, 57, 62, 65]], [33, [52, 57, 61, 64]]],
    lead: [[74, 0, 72, 74, 77, 0, 76, 74], [74, 0, 0, 72, 70, 0, 69, 0], [72, 0, 74, 0, 77, 76, 74, 72], [76, 0, 0, 0, 72, 0, 0, 0]],
    leadB: [[74, 0, 79, 0, 77, 0, 74, 0], [77, 0, 74, 0, 70, 0, 74, 0], [77, 0, 76, 0, 74, 0, 72, 74], [73, 0, 0, 0, 76, 0, 0, 0]],
  },
};
const ARP = [0, 1, 2, 3, 2, 1, 3, 2];
// Muzyka z plików (licencje i autorzy: assets/muzyka/AUTORZY.md). Lista = utwory grają po kolei.
// Brak pliku albo błąd = następny z listy, a gdy żadnego nie ma, muzyka z syntezatora (napisana w kodzie, w całości nasza).
//  - prezentacja: „Epic Cinematic Trailer | ELITE”, Alex-Productions, CC BY 3.0 (plik jest w repozytorium),
//  - menu i gra: „Tropical Sun” (All Good Folks) i „New Life” (Moire) z Uppbeat, tylko lokalnie (pliki w .gitignore).
const MUSIC_FILE = { game: ['assets/muzyka/gra.mp3', 'assets/muzyka/gra-2.mp3'], promo: ['assets/muzyka/prezentacja.mp3'] };
export function createMusic(style, opts = {}) {
  const a = opts.ctx || audio();
  if (!a) return null;
  const song = SONGS[style], promo = style === 'promo';
  const BEAT = 60 / song.bpm, STEP = BEAT / 4;
  const level = opts.level || (() => 0.5);
  const hold = opts.hold || (() => false);
  const nodes = [];
  const gain = (v = 1) => { const g = a.createGain(); g.gain.value = v; return g; };
  const filter = (type, f, q = 0.7) => { const b = a.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const panner = p => { const s = a.createStereoPanner(); s.pan.value = p; return s; };
  const osc = (type, f) => { const o = a.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const play = (src, t, end) => { src.start(t); src.stop(end); };
  const hiss = (t, end) => { const s = a.createBufferSource(); s.buffer = noise(a); s.loop = true; s.start(t, Math.random() * 0.4); s.stop(end); return s; };

  // mikser: suma → „powietrze” → kompresor → limiter → głośność
  const out = gain(opts.until ? level() : 0);
  const mix = gain(1);
  const air = filter('highshelf', 6500); air.gain.value = 2;
  const glue = a.createDynamicsCompressor();
  glue.threshold.value = -20; glue.knee.value = 8; glue.ratio.value = 3.5; glue.attack.value = 0.008; glue.release.value = 0.22;
  const limit = a.createDynamicsCompressor();
  limit.threshold.value = -3; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.002; limit.release.value = 0.12;
  mix.connect(air).connect(glue).connect(limit).connect(out).connect(a.destination);
  // pogłos i echo jako wysyłki
  const verbIn = gain(1), verb = a.createConvolver();
  verb.buffer = reverbIR(a);
  verbIn.connect(filter('highpass', 240)).connect(verb).connect(gain(promo ? 0.34 : 0.4)).connect(mix);
  const echoIn = gain(1), dl = a.createDelay(2), dr = a.createDelay(2), tone = filter('lowpass', 3000), echoOut = gain(0.5);
  dl.delayTime.value = dr.delayTime.value = BEAT * 0.75;   // echo co kropkowaną ósemkę: raz w lewo, raz w prawo
  echoIn.connect(dl); dl.connect(tone); tone.connect(panner(-0.7)).connect(echoOut);
  tone.connect(dr); dr.connect(panner(0.7)).connect(echoOut); dr.connect(gain(0.36)).connect(dl);
  echoOut.connect(mix);
  // „duck”: szyna ściszana na chwilę przy każdej stopie (pad, bas, pianino, arpeggio)
  const duck = gain(1);
  duck.connect(mix);
  const bus = (to, v, verbAmt = 0, echoAmt = 0) => {
    const b = gain(v); b.connect(to);
    if (verbAmt) b.connect(gain(verbAmt)).connect(verbIn);
    if (echoAmt) b.connect(gain(echoAmt)).connect(echoIn);
    return b;
  };
  const B = {
    keys: bus(duck, promo ? 2.2 : 3, 0.5, promo ? 0.1 : 0.16),
    pad: bus(duck, promo ? 2 : 1, 0.55),
    bass: bus(duck, promo ? 0.5 : 0.42),
    arp: bus(duck, 2.3, 0.25, 0.45),
    lead: bus(mix, 1.8, 0.35, 0.3),
    drums: bus(mix, promo ? 0.65 : 0.5, 0.06),
    hats: bus(mix, promo ? 3 : 3.2, 0.05),
    snare: bus(mix, promo ? 1.2 : 1.1, 0.28),
    fx: bus(mix, 1, 0.45),
    strings: bus(duck, 1.6, 0.6),
    choir: bus(duck, 0.9, 0.8),
  };
  const strF = filter('lowpass', 900, 0.5);   // jasność smyczków rośnie z energią sceny
  strF.connect(B.strings);
  // pad: trzy lekko rozstrojone piły na dźwięk, filtr powoli „oddycha”
  const padF = filter('lowpass', 700, 0.6);
  padF.connect(B.pad);
  const lfo = osc('sine', 0.07), lfoG = gain(220);
  lfo.connect(lfoG).connect(padF.frequency);
  lfo.start();
  nodes.push(lfo);

  // ----- instrumenty -----
  function keys(t, m, vel, len, p = 0) {   // elektryczne pianino (FM): ciepły ton i krótki „dzwonek” przy uderzeniu
    const f = midiHz(m), end = t + len + 0.8;
    const car = osc('sine', f), mod = osc('sine', f), idx = gain(0), bell = osc('sine', f * 14), bg = gain(0);
    idx.gain.setValueAtTime(f * 2.6 * vel, t); idx.gain.exponentialRampToValueAtTime(f * 0.3 + 1, t + 1.0);
    bg.gain.setValueAtTime(f * 1.2 * vel, t); bg.gain.exponentialRampToValueAtTime(1, t + 0.09);
    mod.connect(idx).connect(car.frequency);
    bell.connect(bg).connect(car.frequency);
    const g = gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.1 * vel, t + 0.006);
    g.gain.setTargetAtTime(0.0001, t + 0.006, 0.9);
    g.gain.setTargetAtTime(0.0001, t + len, 0.14);
    car.connect(g).connect(panner(p)).connect(B.keys);
    for (const o of [car, mod, bell]) play(o, t, end);
  }
  function pad(t, notes, len) {
    notes.forEach((m, k) => [-13, 0, 13].forEach((det, j) => {
      const o = osc('sawtooth', midiHz(m));
      o.detune.value = det + (Math.random() - 0.5) * 4;
      const g = gain(0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.016, t + 0.9);
      g.gain.setValueAtTime(0.016, t + len - 0.25);
      g.gain.linearRampToValueAtTime(0.0001, t + len + 1.1);
      o.connect(g).connect(panner([-0.55, 0, 0.55][j] * (k % 2 ? 1 : -1))).connect(padF);
      play(o, t, t + len + 1.2);
    }));
  }
  function bass(t, m, len, vel = 1) {   // sinus na dole i trochę trójkąta oktawę wyżej, żeby bas był słychać w małych głośnikach
    const f = midiHz(m), o = osc('sine', f), o2 = osc('triangle', f * 2), lp = filter('lowpass', 900), g2 = gain(0.45), g = gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.34 * vel, t + 0.012);
    g.gain.setTargetAtTime(0.24 * vel, t + 0.012, 0.18);
    g.gain.setTargetAtTime(0.0001, t + len, 0.05);
    o.connect(g); o2.connect(g2).connect(lp).connect(g);
    g.connect(B.bass);
    play(o, t, t + len + 0.35); play(o2, t, t + len + 0.35);
  }
  function pluck(t, m, vel, p) {   // arpeggio: piła z szybko zamykanym filtrem
    const f = midiHz(m), o = osc('sawtooth', f), lp = filter('lowpass', f * 8 + 1400, 3.5), g = gain(0);
    lp.frequency.setValueAtTime(f * 8 + 1400, t); lp.frequency.exponentialRampToValueAtTime(f * 1.4, t + 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(lp).connect(g).connect(panner(p)).connect(B.arp);
    play(o, t, t + 0.32);
  }
  function bell(t, m, vel, len = 0.9, p = 0) {   // melodia: szklisty dzwonek (FM 1:2)
    const f = midiHz(m), car = osc('sine', f), mod = osc('sine', f * 2), idx = gain(0), g = gain(0);
    idx.gain.setValueAtTime(f * 2.6 * vel, t); idx.gain.exponentialRampToValueAtTime(f * 0.15 + 1, t + 0.5);
    mod.connect(idx).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    car.connect(g).connect(panner(p)).connect(B.lead);
    play(car, t, t + len + 0.05); play(mod, t, t + len + 0.05);
  }
  function kick(t, vel = 1, duckAmt = 0) {
    const o = osc('sine', 165), g = gain(0);
    o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.1); o.frequency.exponentialRampToValueAtTime(42, t + 0.4);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.95 * vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(B.drums);
    play(o, t, t + 0.45);
    const n = hiss(t, t + 0.03), ng = gain(0);   // „klik” na początku, żeby stopa przebijała się w małych głośnikach
    ng.gain.setValueAtTime(0.22 * vel, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    n.connect(filter('highpass', 2500)).connect(ng).connect(B.drums);
    if (duckAmt) { duck.gain.setTargetAtTime(1 - duckAmt, t, 0.004); duck.gain.setTargetAtTime(1, t + 0.06, BEAT * 0.2); }
  }
  function clap(t, vel = 1) {
    const n = hiss(t, t + 0.3), g = gain(0);
    for (let k = 0; k < 3; k++) { g.gain.setValueAtTime(0.42 * vel, t + k * 0.011); g.gain.exponentialRampToValueAtTime(0.04, t + k * 0.011 + 0.009); }
    g.gain.setValueAtTime(0.38 * vel, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    n.connect(filter('bandpass', 1250, 1.1)).connect(g).connect(B.snare);
  }
  function snare(t, vel = 1) {   // miękki werbel: szum i krótki ton
    const n = hiss(t, t + 0.25), g = gain(0);
    g.gain.setValueAtTime(0.3 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    n.connect(filter('bandpass', 2000, 0.8)).connect(g).connect(B.snare);
    const o = osc('triangle', 190), g2 = gain(0);
    o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    g2.gain.setValueAtTime(0.22 * vel, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g2).connect(B.snare);
    play(o, t, t + 0.12);
  }
  function hat(t, vel = 1, open = false, p = 0.25) {
    const len = open ? 0.26 : 0.045, n = hiss(t, t + len + 0.02), g = gain(0);
    g.gain.setValueAtTime(0.1 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(filter('highpass', 7200)).connect(filter('peaking', 10500, 1.2)).connect(g).connect(panner(p)).connect(B.hats);
  }
  function shaker(t, vel = 1) {
    const n = hiss(t, t + 0.1), g = gain(0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * vel, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    n.connect(filter('bandpass', 5800, 1.4)).connect(g).connect(panner(-0.3)).connect(B.hats);
  }
  function crash(t, vel = 1) {   // talerz na początku nowej frazy
    const n = hiss(t, t + 1.9), g = gain(0);
    g.gain.setValueAtTime(0.13 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    n.connect(filter('highpass', 5200)).connect(filter('peaking', 8000, 0.8)).connect(g).connect(B.fx);
  }
  function riser(t, len) {   // narastający szum przed wejściem nowej frazy
    const n = hiss(t, t + len + 0.05), f = filter('bandpass', 400, 1.6), g = gain(0);
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(6500, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + len * 0.95); g.gain.linearRampToValueAtTime(0.0001, t + len + 0.04);
    n.connect(f).connect(g).connect(B.fx);
  }
  // ----- instrumenty filmowe (prezentacja) -----
  function strings(t, notes, len, vel = 1) {   // smyczki: trzy rozstrojone piły na dźwięk, miękkie wejście i wybrzmienie
    notes.forEach((m, k) => [-9, 0, 9].forEach((det, j) => {
      const o = osc('sawtooth', midiHz(m));
      o.detune.value = det + (Math.random() - 0.5) * 6;
      const vib = osc('sine', 5 + Math.random()), vg = gain(3);
      vib.connect(vg).connect(o.detune);
      const g = gain(0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.012 * vel, t + 0.45);
      g.gain.setValueAtTime(0.012 * vel, t + len - 0.2);
      g.gain.linearRampToValueAtTime(0.0001, t + len + 0.9);
      o.connect(g).connect(panner([-0.6, 0, 0.6][j] * (k % 2 ? 1 : -1))).connect(strF);
      play(o, t, t + len + 1); play(vib, t, t + len + 1);
    }));
  }
  function pulse(t, m, len, vel = 1) {   // niskie smyczki staccato (spiccato): piła z krótką obwiednią filtra
    const f = midiHz(m), o = osc('sawtooth', f), lp = filter('lowpass', 1800, 1.2), g = gain(0);
    lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(320, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * vel, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(lp).connect(g).connect(B.bass);
    play(o, t, t + len + 0.02);
  }
  function taiko(t, vel = 1, f0 = 90) {   // bęben taiko: niski ton z opadającą wysokością i uderzenie w skórę
    const o = osc('sine', f0), g = gain(0);
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.48, t + 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.75 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g).connect(B.drums);
    play(o, t, t + 0.75);
    const n = hiss(t, t + 0.12), ng = gain(0);
    ng.gain.setValueAtTime(0.35 * vel, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    n.connect(filter('lowpass', 420)).connect(ng).connect(B.drums);
  }
  function brass(t, notes, len, vel = 1) {   // dęte blachy: piły z filtrem, który otwiera się przy ataku
    notes.forEach((m, k) => {
      const f = midiHz(m), o = osc('sawtooth', f), o2 = osc('sawtooth', f * 1.003), lp = filter('lowpass', 400, 1.4), g = gain(0);
      lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(2600 + 300 * vel, t + 0.07);
      lp.frequency.exponentialRampToValueAtTime(900, t + Math.min(len, 0.6));
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * vel, t + 0.03);
      g.gain.setTargetAtTime(0.03 * vel, t + 0.05, 0.15); g.gain.setTargetAtTime(0.0001, t + len, 0.12);
      o.connect(lp); o2.connect(lp); lp.connect(g).connect(panner((k - 1.5) * 0.25)).connect(B.lead);
      play(o, t, t + len + 0.6); play(o2, t, t + len + 0.6);
    });
  }
  function choir(t, notes, len, vel = 1) {   // chór „aa”: piły przez dwa filtry formantowe
    notes.forEach((m, k) => {
      const o = osc('sawtooth', midiHz(m)), f1 = filter('bandpass', 750, 6), f2 = filter('bandpass', 1150, 7), g = gain(0);
      o.detune.value = (k - 1.5) * 7;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * vel, t + 0.8);
      g.gain.setValueAtTime(0.06 * vel, t + len - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len + 1.2);
      o.connect(f1).connect(g); o.connect(f2).connect(g);
      g.connect(panner((k - 1.5) * 0.4)).connect(B.choir);
      play(o, t, t + len + 1.3);
    });
  }
  function crackle(t) {   // trzask płyty winylowej, bardzo cicho
    const n = hiss(t, t + 0.01), g = gain(0);
    g.gain.setValueAtTime(0.012 + Math.random() * 0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.004);
    n.connect(filter('highpass', 1800)).connect(g).connect(panner(Math.random() * 1.6 - 0.8)).connect(mix);
  }

  // ----- aranżacja -----
  let energy = opts.energy ?? 0, step = 0;
  function stepPromo(n, t) {
    const bar = Math.floor(n / 16), s = n % 16, e = energy, partB = Math.floor(bar / 8) % 2 === 1;
    const [root, notes] = (partB ? song.chordsB : song.chords)[bar % 4];
    const phraseEnd = bar % 8 === 7;
    if (e >= 2 && bar > 0 && bar % 8 === 0 && s === 0) crash(t, e === 3 ? 1 : 0.7);
    if (e >= 2 && phraseEnd && s === 0) riser(t, BEAT * 4);
    if (e >= 2 && phraseEnd && s >= 12) taiko(t, 0.45 + (s - 12) * 0.14, 110);   // przejście: werble na taiko
    if (s === 0) {
      strF.frequency.setTargetAtTime([900, 1500, 2300, 3400][e], t, 0.8);
      strings(t, notes.map(m => m + 12), BEAT * 4, [0.42, 0.7, 0.95, 1.2][e]);
      if (e === 0) bass(t, root, BEAT * 3.8, 0.3);   // niski bordun
      if (e >= 3) choir(t, notes.slice(1).map(m => m + 12), BEAT * 4, 0.9);
    }
    // fortepian: ostinato ósemkami na dźwiękach akordu (cichnie, gdy wchodzą bębny)
    if (e <= 2 && s % 2 === 0) {
      const pat = [1, 2, 3, 2, 1, 2, 3, 2][s / 2];
      keys(t, notes[pat] + 12, [0.3, 0.38, 0.26][e], BEAT * 0.9, (pat - 2) * 0.3);
    }
    if (e >= 1) {
      if (s % 2 === 0) pulse(t, root + (s % 4 === 2 ? 12 : 0), STEP * 1.6, s % 8 === 0 ? 1 : 0.75);
      if (e === 1 && (s === 0 || s === 8)) taiko(t, 0.55, 80);
    }
    if (e >= 2) {
      if ([0, 6, 8, 11, 14].includes(s) && !(phraseEnd && s >= 12)) taiko(t, s === 0 || s === 8 ? 1 : 0.65, s % 8 === 0 ? 85 : 120);
      if (s === 4 || s === 12) clap(t, e === 3 ? 0.9 : 0.7);
      if (s % 2 === 0) hat(t, s % 4 === 2 ? 0.8 : 0.45, false, 0.3);
      if (s === 0) brass(t, notes.slice(1), BEAT * (e === 3 ? 1.5 : 0.9), e === 3 ? 1 : 0.8);
      if (s % 2 === 1 && e === 2) pluck(t, notes[ARP[(s >> 1) % 8]] + 24, 0.55, s % 4 === 1 ? -0.4 : 0.4);
    }
    if (e === 3) {
      if (s % 4 === 0 && !(phraseEnd && s >= 12)) kick(t, 1.1, 0.5);
      if (s % 4 === 2) hat(t, 0.7, true, -0.25);
      if (s % 2 === 0) {
        const m = (partB ? song.leadB : song.lead)[bar % 4][s / 2];
        if (m) { brass(t, [m], BEAT * 0.45, 1.15); bell(t + 0.004, m + 12, 0.4, 0.6, 0.25); }
      }
    }
  }
  function stepGame(n, t) {
    const bar = Math.floor(n / 16), s = n % 16, [root, notes] = song.chords[bar % 8];
    const drums = bar >= 2 && bar % 16 < 14;   // dwa takty wstępu, a co 16 taktów krótka przerwa bez perkusji
    if (s === 0) { padF.frequency.setTargetAtTime(900, t, 1); pad(t, notes, BEAT * 4); notes.forEach((m, k) => keys(t + k * 0.02, m, 0.62 - k * 0.04, BEAT * 2.5, (k - 1.5) * 0.28)); }
    if (s === 10) notes.slice(1).forEach((m, k) => keys(t + k * 0.016, m, 0.36, BEAT * 1.3, (k - 1) * 0.3));
    if (bar % 2 === 1) for (const [st, m] of song.hook) if (s === st) keys(t, m - (bar % 4 === 3 ? 2 : 0), 0.34, BEAT * 1.1, 0.35);
    if (s === 0) bass(t, root, BEAT * 1.7, 0.95);
    if (s === 10) bass(t, root, BEAT * 0.6, 0.7);
    if (s === 14) bass(t, root + 7, BEAT * 0.4, 0.55);
    if (drums) {
      if (s === 0 || s === 10) kick(t, 0.6, 0.18);
      if (s === 4 || s === 12) snare(t, 0.55);
      if (s % 2 === 0) hat(t, s % 4 === 0 ? 0.38 : 0.24, false, 0.2);
      if (s % 4 === 3 && Math.random() < 0.35) hat(t, 0.12, false, 0.35);
      if (s % 2 === 1) shaker(t, 0.45);
    }
    if (Math.random() < 0.28) crackle(t + Math.random() * STEP);
  }
  const stepFn = promo ? stepPromo : stepGame;
  let next = a.currentTime + 0.12;
  function run(until) {
    while (next < until) {
      stepFn(step, next + (step % 2 ? STEP * song.swing : 0));
      step++; next += STEP;
    }
  }
  let timer = 0, fileEl = null, fileSrc = null;
  // prezentacja: domyślnie nasza muzyka z kodu, utwór z pliku tylko, gdy wybrany w Ustawieniach
  const useFile = style !== 'promo' || !!opts.useFile;
  const list = opts.until || !useFile ? [] : [].concat(MUSIC_FILE[style] || []).filter(Boolean);
  if (list.length) {   // utwory z plików zamiast syntezatora; efekty (uderzenia, szum) zostają
    let k = 0, failed = 0;
    fileEl = new Audio();
    fileEl.preload = 'auto';
    fileEl.loop = list.length === 1;
    fileSrc = a.createMediaElementSource(fileEl);
    fileSrc.connect(out);
    const playK = () => { fileEl.src = list[k % list.length]; fileEl.play().catch(() => {}); };
    fileEl.addEventListener('playing', () => { failed = 0; });
    fileEl.addEventListener('ended', () => { k++; playK(); });
    fileEl.addEventListener('error', () => {
      if (++failed >= list.length) { fileSrc.disconnect(); fileEl = null; next = a.currentTime + 0.1; return; }   // żadnego pliku: syntezator
      k++; playK();
    });
    playK();
  }
  if (opts.until) run(opts.until);   // tryb nagrania (OfflineAudioContext): wszystko planowane od razu
  else {
    out.gain.setTargetAtTime(level(), a.currentTime, promo ? 0.8 : 1.6);
    timer = setInterval(() => {
      const wait = hold() || document.hidden;
      if (fileEl) { if (wait) fileEl.pause(); else if (fileEl.paused) fileEl.play().catch(() => {}); return; }
      if (wait) { next = Math.max(next, a.currentTime + 0.1); return; }
      run(a.currentTime + 0.3);
    }, 50);
    if (!fileEl) run(a.currentTime + 0.3);
  }
  return {
    setEnergy(e) { energy = e; },
    volume() { out.gain.setTargetAtTime(level(), a.currentTime, 0.15); },
    whoosh() {   // przejście między scenami: szum, który rośnie w górę
      const t = a.currentTime, s = hiss(t, t + 0.8), f = filter('bandpass', 300, 1.4), g = gain(0);
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(4200, t + 0.55);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + 0.75);
      s.connect(f).connect(g).connect(B.fx);
    },
    impact() {   // uderzenie: niski „boom”, talerz i chwilowe ściszenie reszty
      const t = a.currentTime + 0.01;
      const o = osc('sine', 90), g = gain(0);
      o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.3);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.85, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(B.drums);
      play(o, t, t + 1.7);
      const n = hiss(t, t + 2.3), ng = gain(0);
      ng.gain.setValueAtTime(0.16, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      n.connect(filter('highpass', 4200)).connect(ng).connect(B.fx);
      duck.gain.setTargetAtTime(0.25, t, 0.005); duck.gain.setTargetAtTime(1, t + 0.15, 0.35);
    },
    chime() { [84, 88, 91, 96].forEach((m, k) => bell(a.currentTime + 0.01 + k * 0.07, m, 0.8, 1.1, (k - 1.5) * 0.4)); },
    thump() { if (!fileEl) kick(a.currentTime + 0.01, 0.85, 0.3); },   // przy utworze z pliku bez dodatkowej stopy (inne tempo)
    stop() {
      clearInterval(timer);
      out.gain.setTargetAtTime(0, a.currentTime, 0.25);
      setTimeout(() => { for (const o of nodes) { try { o.stop(); } catch { /* już zatrzymany */ } } fileEl?.pause(); fileSrc?.disconnect(); out.disconnect(); }, 1800);
    },
  };
}
