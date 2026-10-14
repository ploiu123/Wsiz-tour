// Jakość grafiki: poziomy od Niskiej do Ultra 4K i łańcuch efektów po wyrenderowaniu sceny
// (RenderPipeline z Three.js: działa na WebGPU i na zapasowym WebGL2).
//
// - Niska: obraz prosto na ekran, 1 piksel obrazu na piksel CSS, mniejsze cienie.
// - Średnia: do 1,5 piksela na piksel CSS, wygładzanie krawędzi MSAA 4x i delikatny bloom (poświata świateł).
// - Wysoka: ostrość ekranu Retina (2x) i cienie kontaktowe GTAO, czyli przyciemnienie w zagłębieniach
//   i przy styku przedmiotów (tylko światło otoczenia, jak w grach AAA), do tego bloom.
// - Ultra 4K: co najmniej 2 piksele obrazu na piksel CSS (na zwykłym ekranie Full HD scena liczy się
//   w 4K i jest zmniejszana, czyli supersampling), do 3x na telefonach, GTAO w pełnej rozdzielczości.
// - Automatyczna: Wysoka na komputerze, Średnia na telefonie i tablecie; gdy klatki są wolne, najpierw
//   spada rozdzielczość, potem znikają efekty (i wracają, gdy znów jest płynnie).
import * as THREE from 'three/webgpu';
import { pass, mrt, normalView, screenUV, builtinAOContext, vec4, mix } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

export const LEVELS = [
  ['auto', 'Automatyczna'], ['low', 'Niska'], ['medium', 'Średnia'], ['high', 'Wysoka'], ['ultra', 'Ultra 4K'],
];
export const PRESETS = {
  low: { minDpr: 1, maxDpr: 1, shadow: 1024, msaa: false, ao: false, aoScale: 0, bloom: false },
  medium: { minDpr: 1, maxDpr: 1.5, shadow: 2048, msaa: true, ao: false, aoScale: 0, bloom: true },
  high: { minDpr: 1, maxDpr: 2, shadow: 4096, msaa: true, ao: true, aoScale: 0.5, bloom: true },
  ultra: { minDpr: 2, maxDpr: 3, shadow: 4096, msaa: true, ao: true, aoScale: 1, bloom: true },
};
const ORDER = ['low', 'medium', 'high', 'ultra'];
const MAX_PIXELS = { low: 2.1e6, medium: 4.2e6, high: 8.9e6, ultra: 17e6 };   // limit pikseli obrazu (Ultra: 5K)

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
    this.night = false;
    this.ratio = 1;
    this.slow = { acc: 0, n: 0, wait: 0 };
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
    if (p.bloom) {
      this.bloomPass = bloom(scenePass, 0, 0.35, 0.9);
      this.nodes.push(this.bloomPass);
      out = vec4(out.rgb.add(this.bloomPass.rgb), out.a);
      this.setNight(this.night);
    }
    this.pipeline.outputNode = out;
    this.pipeline.needsUpdate = true;
    this.active = true;
  }

  // Noc: mocniejsza poświata okien i latarń. Dzień: tylko błyski słońca na wodzie i lakierze.
  setNight(night) {
    this.night = night;
    if (!this.bloomPass) return;
    // próg w jasności sceny przed mapowaniem tonów: w dzień oświetlone słońcem jasne powierzchnie mają ok. 1–2,
    // więc świecą tylko odblaski (woda, lakier), nocą także okna i latarnie
    this.bloomPass.strength.value = night ? 0.8 : 0.2;
    this.bloomPass.threshold.value = night ? 0.7 : 2.6;
    this.bloomPass.radius.value = night ? 0.5 : 0.25;
  }

  render() {
    if (this.active) this.pipeline.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // Tylko w trybie Automatyczna: wolne klatki (średnio > 24 ms) obniżają rozdzielczość, potem poziom;
  // szybkie (< 13 ms) przywracają. Zmiana najwyżej co 4 s, żeby obraz nie migał.
  frame(ms) {
    if (this.setting !== 'auto' || ms > 250) return;
    const s = this.slow;
    s.acc += ms; s.n++;
    if (s.acc < 2500) return;
    const avg = s.acc / s.n;
    s.acc = 0; s.n = 0;
    if (performance.now() < s.wait) return;
    const top = this.mobile ? 'medium' : 'high', idx = ORDER.indexOf(this.level);
    const full = this.targetRatio();
    let changed = false;
    if (avg > 24) {
      if (this.ratio > 1) { this.ratio = Math.max(1, this.ratio - 0.25); changed = true; }
      else if (idx > 0) { this.level = ORDER[idx - 1]; this.apply(); s.wait = performance.now() + 4000; return; }
    } else if (avg < 13) {
      if (this.ratio < full) { this.ratio = Math.min(full, this.ratio + 0.25); changed = true; }
      else if (idx < ORDER.indexOf(top)) { this.level = ORDER[idx + 1]; this.apply(); s.wait = performance.now() + 4000; return; }
    }
    if (!changed) return;
    this.renderer.setPixelRatio(this.ratio);
    this.onResize();
    s.wait = performance.now() + 4000;
  }

  // Opis do ustawień: silnik i rozmiar obrazu
  describe() {
    const c = this.renderer.domElement;
    return `${this.renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2'} · obraz ${c.width} × ${c.height}`;
  }
}
