// Podgląd pionków w menu (karty graczy jak w Business Tour): jedno przezroczyste płótno nad menu i osobny, lekki
// renderer. W każdej klatce rysuje małe widoki w miejscach okienek podglądu, tylko tam, gdzie okienko naprawdę
// widać (nie zasłania go inny element ani krawędź przewijanego menu). Działa w WebGPU i w zapasowym WebGL2.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FOV = 26, TILT = 0.2;   // kąt widzenia i lekkie spojrzenie z góry (radiany)

export class PawnPreview {
  /**
   * @param {HTMLElement} host element, w którym leży płótno (nad menu)
   * @param {{ forceWebGL?: boolean, onDrop?: (obj: THREE.Object3D) => void }} opts onDrop: sprzątanie po pionku
   */
  constructor(host, opts = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pawn-stage';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.append(this.canvas);
    this.opts = opts;
    this.views = new Map();   // okienko → { key, obj, angle, height, width }
    this.renderer = null;
    this.ready = null;
    this.size = '';
    this.clean = true;
  }

  init() {
    this.ready ||= (async () => {
      const r = new THREE.WebGPURenderer({ canvas: this.canvas, antialias: true, alpha: true, forceWebGL: !!this.opts.forceWebGL });
      await r.init();
      r.setClearColor(0x000000, 0);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.NeutralToneMapping;
      r.toneMappingExposure = 0.95;
      const scene = new THREE.Scene();
      scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.75;
      scene.add(new THREE.HemisphereLight('#FFFFFF', '#B8C6E0', 0.75));
      const key = new THREE.DirectionalLight('#FFFFFF', 2.6);
      key.position.set(2.5, 4, 3);
      const rim = new THREE.DirectionalLight('#A9C4FF', 1.7);
      rim.position.set(-3, 2.5, -3);
      scene.add(key, rim);
      // miękki cień pod pionkiem (bez mapy cieni: podgląd ma być lekki)
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 62);
      grad.addColorStop(0, 'rgba(10,25,60,.42)'); grad.addColorStop(0.55, 'rgba(10,25,60,.16)'); grad.addColorStop(1, 'rgba(10,25,60,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
      this.shadow.rotation.x = -Math.PI / 2;
      this.shadow.position.y = 0.002;
      scene.add(this.shadow);
      this.scene = scene;
      this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 40);
      this.renderer = r;
    })();
    return this.ready;
  }

  /**
   * Okienko podglądu na stronie i pionek w nim. Gdy klucz się zmieni (inny pionek albo kolor), pionek powstaje od nowa.
   * @param {HTMLElement} el okienko
   * @param {string} key np. „3|#E5484D”
   * @param {() => THREE.Object3D} make
   */
  set(el, key, make) {
    const v = this.views.get(el);
    if (v?.key === key) return;
    const angle = v ? v.angle : 0.55;
    if (v) this.drop(el);
    if (!this.scene) { this.views.set(el, { key, make, obj: null, angle }); return; }
    const obj = make();
    const box = new THREE.Box3().setFromObject(obj);
    this.scene.add(obj);
    this.views.set(el, { key, make, obj, angle, height: Math.max(0.4, box.max.y), width: Math.max(0.46, box.max.x - box.min.x, box.max.z - box.min.z) });
  }

  drop(el) {
    const v = this.views.get(el);
    if (!v) return;
    this.views.delete(el);
    if (v.obj) { this.scene.remove(v.obj); this.opts.onDrop?.(v.obj); }
  }

  // Okienka, których nie ma już na stronie (np. po przerysowaniu kart graczy)
  prune() { for (const el of [...this.views.keys()]) if (!el.isConnected) this.drop(el); }

  render(dt) {
    const r = this.renderer;
    if (!r) return;
    // pionki dodane, zanim renderer był gotowy
    for (const [el, v] of this.views) if (!v.obj) { this.views.delete(el); this.set(el, v.key, v.make); }
    const cr = this.canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const size = `${cr.width}x${cr.height}x${dpr}`;
    if (size !== this.size) { this.size = size; r.setPixelRatio(dpr); r.setSize(cr.width, cr.height, false); }
    const shown = [];
    for (const [el, v] of this.views) {
      if (!el.isConnected || !v.obj) continue;
      const b = el.getBoundingClientRect(), clip = (el.closest('.menu') || document.body).getBoundingClientRect();
      const x0 = Math.max(b.left, clip.left, 0), y0 = Math.max(b.top, clip.top, 0);
      const x1 = Math.min(b.right, clip.right, innerWidth), y1 = Math.min(b.bottom, clip.bottom, innerHeight);
      if (x1 - x0 < 4 || y1 - y0 < 4) continue;
      // zasłonięte innym elementem (np. rozwinięte menu profilu): środek widocznej części nie należy do karty
      const hit = document.elementFromPoint((x0 + x1) / 2, (y0 + y1) / 2), host = el.closest('[data-prev-host]') || el;
      if (!hit || !host.contains(hit)) continue;
      shown.push({ v, b, x0, y0, x1, y1 });
    }
    if (!shown.length && this.clean) return;
    r.setScissorTest(false);
    r.clear();
    this.clean = !shown.length;
    for (const { v, b, x0, y0, x1, y1 } of shown) {
      for (const [, o] of this.views) if (o.obj) o.obj.visible = o === v;
      v.angle += dt * 0.55;
      v.obj.rotation.y = v.angle;
      const cam = this.camera, aspect = b.width / b.height;
      cam.aspect = aspect;
      // odległość, przy której cały pionek mieści się w okienku (wysokość i szerokość) z marginesem
      const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const dist = Math.max((v.height * 0.6) / t, (v.width * 0.62) / (t * aspect)) + v.width * 0.5;
      const cy = v.height * 0.46;
      cam.position.set(0, cy + dist * Math.sin(TILT), dist * Math.cos(TILT));
      cam.lookAt(0, cy, 0);
      cam.updateProjectionMatrix();
      r.setViewport(b.left - cr.left, b.top - cr.top, b.width, b.height);
      r.setScissor(x0 - cr.left, y0 - cr.top, x1 - x0, y1 - y0);
      r.setScissorTest(true);
      r.render(this.scene, cam);
    }
  }
}
