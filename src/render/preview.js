// Podgląd pionków w menu (karty graczy jak w Business Tour): jeden lekki renderer poza stroną rysuje po kolei
// każdy widoczny pionek, a obraz trafia do płótna w karcie (drawImage). Dzięki temu podgląd przewija się razem
// z menu i nic go nie zasłania. Pionek obraca się sam, a przeciągnięcie myszą albo palcem obraca go ręcznie.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FOV = 26, TILT = 0.2;   // kąt widzenia i lekkie spojrzenie z góry (radiany)

export class PawnPreview {
  /**
   * @param {{ spin?: boolean, onDrop?: (obj: THREE.Object3D) => void }} opts spin: sam się obraca; onDrop: sprzątanie po pionku
   */
  constructor(opts = {}) {
    this.opts = opts;
    this.views = new Map();   // płótno w karcie → { key, make, obj, angle, height, width, drag, ctx }
    this.renderer = null;
    this.ready = null;
    this.W = 0; this.H = 0;
  }

  init() {
    this.ready ||= (async () => {
      // WebGL 2: obraz z niego da się od razu skopiować do płótna w karcie
      const r = new THREE.WebGPURenderer({ antialias: true, alpha: true, forceWebGL: true });
      await r.init();
      r.setClearColor(0x000000, 0);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.NeutralToneMapping;
      r.toneMappingExposure = 1;
      const scene = new THREE.Scene();
      scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.8;
      scene.add(new THREE.HemisphereLight('#FFFFFF', '#B8C6E0', 0.8));
      const key = new THREE.DirectionalLight('#FFFFFF', 2.6);
      key.position.set(2.5, 4, 3);
      const rim = new THREE.DirectionalLight('#A9C4FF', 1.6);
      rim.position.set(-3, 2.5, -3);
      scene.add(key, rim);
      // miękki cień pod pionkiem (bez mapy cieni: podgląd ma być lekki)
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 62);
      grad.addColorStop(0, 'rgba(10,25,60,.42)'); grad.addColorStop(0.55, 'rgba(10,25,60,.16)'); grad.addColorStop(1, 'rgba(10,25,60,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      const shadowTex = new THREE.CanvasTexture(c);
      shadowTex.colorSpace = THREE.SRGBColorSpace;
      this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      this.shadow.rotation.x = -Math.PI / 2;
      this.shadow.position.y = 0.002;
      scene.add(this.shadow);
      this.scene = scene;
      this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 40);
      this.renderer = r;
    })().catch(e => console.warn('Podgląd pionków 3D niedostępny (brak WebGL 2):', e));   // karty działają dalej, bez pionka
    return this.ready;
  }

  /**
   * Płótno w karcie i pionek w nim. Gdy klucz się zmieni (inny pionek albo kolor), pionek powstaje od nowa.
   * @param {HTMLCanvasElement} el płótno
   * @param {string} key np. „3|1” (pionek i kolor)
   * @param {() => THREE.Object3D} make
   */
  set(el, key, make) {
    this.bind(el);
    const v = this.views.get(el);
    if (v?.key === key) return;
    const angle = v ? v.angle : 0.55;
    if (v) this.drop(el);
    const view = { key, make, obj: null, angle, height: 1, width: 1, drag: null, ctx: null };
    this.views.set(el, view);
    if (this.scene) this.build(view);
  }

  build(v) {
    const obj = v.make();
    const box = new THREE.Box3().setFromObject(obj);
    v.height = Math.max(0.4, box.max.y);
    v.width = Math.max(0.46, box.max.x - box.min.x, box.max.z - box.min.z);
    obj.visible = false;
    this.scene.add(obj);
    v.obj = obj;
  }

  drop(el) {
    const v = this.views.get(el);
    if (!v) return;
    this.views.delete(el);
    if (v.obj) { this.scene.remove(v.obj); this.opts.onDrop?.(v.obj); }
  }

  // Menu zamknięte: renderer podglądu znika razem z pionkami. Sam drugi kontekst WebGL (nawet bezczynny)
  // spowalniał grę; przy następnym otwarciu kart init() i set() budują wszystko od nowa.
  sleep() {
    const r = this.renderer;
    if (!r) return;
    for (const el of [...this.views.keys()]) { this.drop(el); el.width = el.height = 0; }   // płótna w kartach też zwalniają pamięć
    this.renderer = null;
    this.ready = null;
    this.W = this.H = 0;
    r.dispose().catch(() => {});   // zwalnianie jest asynchroniczne; błąd przy sprzątaniu nie przeszkadza w grze
  }

  // Płótna, których nie ma już na stronie (np. miejsce gracza zostało puste)
  prune() { for (const el of [...this.views.keys()]) if (!el.isConnected) this.drop(el); }

  // Obracanie pionka przeciągnięciem (mysz, palec)
  bind(el) {
    if (el.dataset.prevBound) return;
    el.dataset.prevBound = '1';
    el.addEventListener('pointerdown', e => {
      const v = this.views.get(el);
      if (!v) return;
      v.drag = { x: e.clientX, a: v.angle };
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-drag');
    });
    el.addEventListener('pointermove', e => {
      const v = this.views.get(el);
      if (v?.drag) v.angle = v.drag.a + (e.clientX - v.drag.x) * 0.014;
    });
    const end = () => {
      const v = this.views.get(el);
      if (v) v.drag = null;
      el.classList.remove('is-drag');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /**
   * Rysuje widoczne pionki.
   * @param {number} dt czas klatki (s)
   * @param {(obj: THREE.Object3D) => void} [tick] ruch części pionka (flaga, wentylatory, para)
   */
  render(dt, tick) {
    const r = this.renderer;
    if (!r) return;
    this.prune();
    const dpr = Math.min(devicePixelRatio || 1, 2), shown = [];
    let W = 0, H = 0;
    for (const [el, v] of this.views) {
      if (!v.obj) this.build(v);
      const b = el.getBoundingClientRect();
      // ukryta strona menu (rozmiar 0) albo karta poza ekranem
      if (b.width < 4 || b.height < 4 || b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) continue;
      const w = Math.round(b.width * dpr), h = Math.round(b.height * dpr);
      W = Math.max(W, w); H = Math.max(H, h);
      shown.push({ el, v, w, h });
    }
    if (!shown.length) return;
    if (W > this.W || H > this.H) {
      this.W = Math.max(W, this.W); this.H = Math.max(H, this.H);
      r.setPixelRatio(1);
      r.setSize(this.W, this.H, false);
    }
    const cam = this.camera, t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    for (const { el, v, w, h } of shown) {
      for (const o of this.views.values()) if (o.obj) o.obj.visible = o === v;
      if (!v.drag && this.opts.spin !== false) v.angle += dt * 0.6;
      v.obj.rotation.y = v.angle;
      tick?.(v.obj);
      this.shadow.scale.setScalar(v.width * 1.25);
      // odległość, przy której cały pionek mieści się w okienku (wysokość i szerokość) z marginesem
      const aspect = w / h;
      const dist = Math.max((v.height * 0.62) / t, (v.width * 0.64) / (t * aspect)) + v.width * 0.5;
      const cy = v.height * 0.46;
      cam.aspect = aspect;
      cam.position.set(0, cy + dist * Math.sin(TILT), dist * Math.cos(TILT));
      cam.lookAt(0, cy, 0);
      cam.updateProjectionMatrix();
      r.setViewport(0, 0, w, h);
      r.render(this.scene, cam);
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
      v.ctx ||= el.getContext('2d');
      v.ctx.clearRect(0, 0, w, h);
      v.ctx.drawImage(r.domElement, 0, 0, w, h, 0, 0, w, h);
    }
  }
}
