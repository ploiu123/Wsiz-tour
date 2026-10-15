// Jakość grafiki: poziomy od Niskiej do Ultra 4K i łańcuch efektów po wyrenderowaniu sceny
// (RenderPipeline z Three.js: działa na WebGPU i na zapasowym WebGL2).
//
// - Niska: obraz prosto na ekran, 1 piksel obrazu na piksel CSS, mniejsze cienie.
// - Średnia: pełna ostrość ekranu (Retina 2x), wygładzanie krawędzi MSAA 4x, wyostrzenie i delikatny bloom.
// - Wysoka: to samo i cienie kontaktowe GTAO, czyli przyciemnienie w zagłębieniach
//   i przy styku przedmiotów (tylko światło otoczenia, jak w grach AAA).
// - Ultra 4K: co najmniej 2 piksele obrazu na piksel CSS (na zwykłym ekranie Full HD scena liczy się
//   w 4K i jest zmniejszana, czyli supersampling), do 3x na telefonach, GTAO w pełnej rozdzielczości.
// - Wysoka i Ultra mają też głębię ostrości jak w obiektywie (plansza ostra, dalsze tło miękko rozmyte).
// - Automatyczna: Wysoka na komputerze, Średnia na telefonie i tablecie. Gdy klatki są wolne, najpierw
//   znikają najdroższe efekty (głębia ostrości, potem cienie kontaktowe), a rozdzielczość spada na końcu,
//   bo od niej zależy, czy obraz jest ostry. Gdy przez dłuższy czas jest płynnie, efekty wracają.
// Na końcu obraz przechodzi mapowanie tonów, lekkie podbicie kolorów i wyostrzenie (CAS), żeby napisy
// na polach i krawędzie były wyraźne.
import * as THREE from 'three/webgpu';
import { pass, mrt, normalView, screenUV, builtinAOContext, vec4, mix, uniform, renderOutput, vibrance, texture3D } from 'three/tsl';
import { lut3D } from 'three/addons/tsl/display/Lut3DNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { sharpen } from 'three/addons/tsl/display/SharpenNode.js';

export const LEVELS = [
  ['auto', 'Automatyczna'], ['low', 'Niska'], ['medium', 'Średnia'], ['high', 'Wysoka'], ['ultra', 'Ultra 4K'],
];
export const PRESETS = {
  // sharp: siła wyostrzenia (0 = najmocniejsze, 2 = bez wyostrzenia)
  low: { minDpr: 1, maxDpr: 1, shadow: 1024, msaa: false, ao: false, aoScale: 0, bloom: false, sharp: 2 },
  medium: { minDpr: 1, maxDpr: 2, shadow: 2048, msaa: true, ao: false, aoScale: 0, bloom: true, sharp: 0.55 },
  high: { minDpr: 1, maxDpr: 2, shadow: 4096, msaa: true, ao: true, aoScale: 0.5, bloom: true, dof: true, sharp: 0.5 },
  ultra: { minDpr: 2, maxDpr: 3, shadow: 4096, msaa: true, ao: true, aoScale: 1, bloom: true, dof: true, sharp: 0.45 },
};
const MAX_PIXELS = { low: 2.1e6, medium: 7.5e6, high: 9e6, ultra: 17e6 };   // limit pikseli obrazu (Ultra: 5K)
const LUT_N = 32;   // rozmiar tablicy korekcji kolorów
const NEUTRAL_GRADE = { shadow: [0, 0, 0], high: [0, 0, 0], contrast: 0, sat: 1 };

export class Graphics {
  /**
   * @param {THREE.WebGPURenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {{ sun?: THREE.DirectionalLight, mobile?: boolean, onResize?: () => void }} opts
   */
  constructor(renderer, scene, camera, opts = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sun = opts.sun ?? null;
    this.mobile = !!opts.mobile;
    this.onResize = opts.onResize ?? (() => {});
    this.setting = 'auto';
    this.level = 'high';
    this.pipeline = null;   // jeden RenderPipeline na całą grę; zmienia się tylko jego wyjście (outputNode)
    this.active = false;
    this.nodes = [];
    this.bloomPass = null;
    this.night = 0;
    this.gradeAmount = uniform(1);
    this.gradeSpec = NEUTRAL_GRADE;   // bez korekcji, dopóki gra nie poda pory dnia (pusta tablica dałaby czarny obraz)
    this.ratio = 1;
    this.slow = { acc: 0, n: 0, wait: 0, good: 0, noUpUntil: 0 };
    // głębia ostrości: odległość ostrzenia i zakres ostrości (jednostki sceny); ustawia gra co klatkę
    this.focus = { distance: uniform(20), range: uniform(18), dead: uniform(10), bokeh: uniform(0) };
    this.dofOn = true;
  }

  get preset() { return PRESETS[this.level]; }

  // Gęstość pikseli dla poziomu: ekran urządzenia, ale w granicach poziomu i limitu pikseli
  targetRatio(w = innerWidth, h = innerHeight) {
    const p = this.preset;
    let r = Math.min(p.maxDpr, Math.max(p.minDpr, devicePixelRatio || 1));
    const cap = Math.sqrt(MAX_PIXELS[this.level] / Math.max(1, w * h));
    return Math.max(0.5, Math.min(r, cap));
  }

  set(setting) {
    this.setting = setting;
    this.level = setting === 'auto' ? (this.mobile ? 'medium' : 'high') : setting;
    this.dofOn = true;
    this.apply();
  }

  apply() {
    const p = this.preset;
    this.ratio = this.targetRatio();
    this.renderer.setPixelRatio(this.ratio);
    // rozmiar mapy cieni ustawiamy raz, przy starcie (zmiana w trakcie gry psuje powiązania tekstur w WebGL2)
    if (this.sun && !this.shadowSet) { this.sun.shadow.mapSize.set(p.shadow, p.shadow); this.shadowSet = true; }
    this.build();
    this.onResize();
  }

  // Łańcuch efektów: scena (MSAA) → cienie kontaktowe w świetle otoczenia → bloom → ekran
  build() {
    // stare przejścia zwalniamy dopiero po chwili: renderer może jeszcze trzymać ich tekstury w tej klatce
    const old = this.nodes ?? [];
    if (old.length) setTimeout(() => { for (const n of old) n.dispose(); }, 1000);
    this.nodes = [];
    this.bloomPass = null;
    this.active = false;
    const p = this.preset;
    if (!p.msaa && !p.ao && !p.bloom) return;
    this.pipeline ??= new THREE.RenderPipeline(this.renderer);
    this.pipeline.outputColorTransform = false;   // robimy to sami w renderOutput (przed wyostrzeniem)
    const scenePass = pass(this.scene, this.camera, { samples: p.msaa ? 4 : 0 });
    this.nodes.push(scenePass);
    let aoValue = null;
    if (p.ao) {
      // osobne przejście z głębią i normalnymi (bez przezroczystych rzeczy, np. wody i szkła)
      const prePass = pass(this.scene, this.camera);
      prePass.transparent = false;
      prePass.setMRT(mrt({ output: normalView }));
      const aoPass = ao(prePass.getTextureNode('depth'), prePass.getTextureNode(), this.camera);
      this.nodes.push(prePass, aoPass);
      aoPass.resolutionScale = p.aoScale;
      aoPass.radius.value = 1;
      aoPass.thickness.value = 1.5;
      aoPass.distanceFallOff.value = 1;
      aoValue = aoPass.getTextureNode().sample(screenUV).r;
      scenePass.contextNode = builtinAOContext(aoValue);
    }
    // cień kontaktowy także w świetle słońca, ale lżej (makieta wygląda na postawioną, a nie wklejoną)
    let out = aoValue ? vec4(scenePass.rgb.mul(mix(1, aoValue, 0.35)), scenePass.a) : scenePass;
    // głębia ostrości jak w obiektywie: plansza ostra, pokój za nią miękko rozmyty (Wysoka i Ultra)
    if (p.dof && this.dofOn) {
      // strefa w pełni ostra wokół punktu ostrzenia (cała plansza), rozmycie zaczyna się dopiero za nią
      const f = this.focus, signed = scenePass.getViewZNode().negate().sub(f.distance);
      const shrunk = signed.sign().mul(signed.abs().sub(f.dead).max(0));
      const dofPass = dof(out, f.distance.add(shrunk).negate(), f.distance, f.range, f.bokeh);
      this.nodes.push(dofPass);
      out = vec4(dofPass.rgb, out.a);
    }
    if (p.bloom) {
      this.bloomPass = bloom(scenePass, 0, 0.35, 0.9);
      this.nodes.push(this.bloomPass);
      out = vec4(out.rgb.add(this.bloomPass.rgb), out.a);
      this.setNight(this.night);
    }
    // mapowanie tonów i przestrzeń barw tutaj (a nie na samym końcu), żeby wyostrzenie działało na gotowym obrazie
    let final = renderOutput(vec4(vibrance(out.rgb, 0.12), out.a));
    // korekcja kolorów z tablicy LUT liczonej w kodzie (odcień zależy od pory dnia, setGrade)
    const grade = lut3D(final, texture3D(this.lut()), LUT_N, this.gradeAmount);
    this.nodes.push(grade);
    final = grade;
    if (p.sharp < 2) {
      const sh = sharpen(final, p.sharp);
      this.nodes.push(sh);
      final = sh;
    }
    this.pipeline.outputNode = final;
    this.pipeline.needsUpdate = true;
    this.active = true;
  }

  // Noc (1): mocniejsza poświata okien i latarń. Dzień (0): tylko błyski słońca na wodzie i lakierze.
  // Wartości pośrednie (zachód słońca) dają pośrednią poświatę.
  setNight(night) {
    const n = Math.min(1, Math.max(0, +night));
    this.night = n;
    if (!this.bloomPass) return;
    // próg w jasności sceny przed mapowaniem tonów: w dzień oświetlone słońcem jasne powierzchnie mają ok. 1–2,
    // więc świecą tylko odblaski (woda, lakier), nocą także okna i latarnie
    this.bloomPass.strength.value = 0.2 + 0.6 * n;
    this.bloomPass.threshold.value = 2.6 - 1.9 * n;
    this.bloomPass.radius.value = 0.25 + 0.25 * n;
  }

  // Tablica LUT 32 x 32 x 32 (wejście: kolor na ekranie, wyjście: kolor po korekcji), jedna na cały czas gry
  lut() {
    if (!this.lutTex) {
      const t = new THREE.Data3DTexture(new Uint8Array(LUT_N ** 3 * 4), LUT_N, LUT_N, LUT_N);
      t.format = THREE.RGBAFormat;
      t.type = THREE.UnsignedByteType;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping;
      t.unpackAlignment = 1;
      this.lutTex = t;
      this.setGrade(this.gradeSpec);
    }
    return this.lutTex;
  }

  // Korekcja kolorów: chłodniejsze albo cieplejsze cienie i światła (shadow, high: dodatki RGB), lekki kontrast
  // i nasycenie. Liczona raz przy zmianie pory dnia, potem karta graficzna tylko czyta tablicę.
  setGrade(spec) {
    this.gradeSpec = spec || this.gradeSpec || NEUTRAL_GRADE;
    const t = this.lutTex, g = this.gradeSpec;
    if (!t || !g) return;
    const d = t.image.data, N = LUT_N;
    for (let b = 0; b < N; b++) for (let gg = 0; gg < N; gg++) for (let r = 0; r < N; r++) {
      let c = [r / (N - 1), gg / (N - 1), b / (N - 1)];
      const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      const ws = (1 - L) * (1 - L), wh = L * L;
      c = c.map((v, k) => v + g.shadow[k] * ws + g.high[k] * wh);
      c = c.map(v => { const x = Math.min(1, Math.max(0, v)); return x + g.contrast * (x * x * (3 - 2 * x) - x); });
      const L2 = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      c = c.map(v => L2 + (v - L2) * g.sat);
      const o = ((b * N + gg) * N + r) * 4;
      for (let k = 0; k < 3; k++) d[o + k] = Math.round(255 * Math.min(1, Math.max(0, c[k])));
      d[o + 3] = 255;
    }
    t.needsUpdate = true;
  }

  // Ostrość na punkt w odległości dist od kamery: w promieniu dead wszystko jest ostre, potem rozmycie
  // rośnie i jest pełne po kolejnych range jednostkach. strength 0 wyłącza rozmycie (menu ma własne).
  setFocus(dist, range, strength = 1, dead = 0) {
    this.focus.distance.value = dist;
    this.focus.range.value = range;
    this.focus.dead.value = dead;
    this.focus.bokeh.value = this.dofOn ? strength * (this.level === 'ultra' ? 1.6 : 1.2) : 0;
  }

  render() {
    if (this.active) this.pipeline.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // Zdjęcie (tryb zdjęć): jedna klatka narysowana w szerokości width pikseli, potem powrót do zwykłej rozdzielczości.
  // Obraz trzeba skopiować z płótna w tym samym zadaniu co rysowanie (toBlob robi kopię od razu).
  capture(width = 3840) {
    const c = this.renderer.domElement, css = c.clientWidth || innerWidth, old = this.ratio;
    this.renderer.setPixelRatio(width / css);
    this.render();
    const shot = new Promise(res => c.toBlob(res, 'image/png'));
    this.renderer.setPixelRatio(old);
    return shot;
  }

  // Tylko w trybie Automatyczna. Okna po 2,5 s: średnio ponad 24 ms na klatkę (poniżej ok. 42 kl./s)
  // to „wolno”: najpierw znika głębia ostrości, potem cienie kontaktowe (Średnia), dopiero potem spada
  // rozdzielczość (najniżej do 75% ekranu), a na końcu poziom Niski. Powrót: po 3 płynnych oknach z rzędu
  // (do 17,5 ms, czyli pełne 60 kl./s), ale nie wcześniej niż minutę po ostatnim obniżeniu.
  frame(ms) {
    if (this.setting !== 'auto' || ms > 250) return;
    const s = this.slow;
    s.acc += ms; s.n++;
    if (s.acc < 2500) return;
    const avg = s.acc / s.n, now = performance.now();
    s.acc = 0; s.n = 0;
    if (now < s.wait) return;
    const full = this.targetRatio(), floor = Math.max(1, full * 0.75), top = this.mobile ? 'medium' : 'high';
    const setRatio = r => { this.ratio = r; this.renderer.setPixelRatio(r); this.onResize(); };
    if (avg > 24) {
      s.good = 0; s.wait = now + 4000; s.noUpUntil = now + 60000;
      if (this.preset.dof && this.dofOn) { this.dofOn = false; this.build(); }
      else if (this.level === 'high' || this.level === 'ultra') { this.level = 'medium'; this.apply(); }
      else if (this.ratio > floor + 0.01) setRatio(Math.max(floor, this.ratio - 0.25));
      else if (this.level === 'medium') { this.level = 'low'; this.apply(); }
      return;
    }
    if (avg > 17.5 || now < s.noUpUntil || ++s.good < 3) return;
    s.good = 0; s.wait = now + 4000;
    if (this.level === 'low') { this.level = 'medium'; this.apply(); setRatio(floor); }
    else if (this.ratio < full - 0.01) setRatio(Math.min(full, this.ratio + 0.25));
    else if (this.level === 'medium' && top === 'high') { this.level = 'high'; this.dofOn = false; this.apply(); }
    else if (this.preset.dof && !this.dofOn) { this.dofOn = true; this.build(); }
  }

  // Opis do ustawień: silnik i rozmiar obrazu
  describe() {
    const c = this.renderer.domElement;
    return `${this.renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2'} · obraz ${c.width} × ${c.height}`;
  }
}
