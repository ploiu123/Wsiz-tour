// Pokój ze stołem: główna scena gry. Plansza leży na dębowym stole w jasnym pokoju uczelni:
// parkiet, ściany z granatową boazerią, duże okno z dziennym światłem, regał z książkami,
// lampa nad stołem, krzesła, dywan i kilka drobiazgów na stole. Wszystko rysowane w kodzie
// (geometria i tekstury z płótna), bez gotowych modeli i zdjęć.
//
// Skala: podstawa planszy ma 13,4 jednostki, czyli ok. 50 cm, więc 1 jednostka ≈ 3,7 cm.
// Stół ma 1,8 × 1,2 m i 75 cm wysokości, pokój 6 × 5 m i 2,7 m wysokości.
import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const U = 1 / 0.0373;                 // jednostek na metr
const TABLE = { w: 1.8 * U, d: 1.2 * U, h: 0.75 * U, top: 0.05 * U };
const ROOM = { w: 6.2 * U, d: 5.2 * U, h: 2.7 * U };

// ---------------------------------------------------------------------------
// Szum wartości z okresem (tekstury bez szwów) i pomocnicze
// ---------------------------------------------------------------------------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0) / 4294967296;
}
function makeNoise(seed, size = 256) {
  const r = rng(seed), grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const m = size - 1;
  // x, y w komórkach siatki; px, py: okres (w komórkach), żeby tekstura się powtarzała bez szwu
  return (x, y, px = size, py = size) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % px) + px) % px & m, x1 = (((xi + 1) % px) + px) % px & m;
    const y0 = (((yi % py) + py) % py & m) * size, y1 = ((((yi + 1) % py) + py) % py & m) * size;
    const a = grid[y0 + x0], b = grid[y0 + x1], c = grid[y1 + x0], d = grid[y1 + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

// Mapa normalnych z mapy wysokości (operator Sobela), z zawijaniem brzegów
function normalMap(height, w, h, strength) {
  const [c, g] = canvas(w, h), img = g.createImageData(w, h), d = img.data;
  const H = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const k = (y * w + x) * 4;
      d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (-ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
function texture(c, { srgb = true, aniso = 8, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  return t;
}

// ---------------------------------------------------------------------------
// Drewno: słoje (pierścienie przyrostu wygięte szumem), włókna i pory. Zwraca kolor, chropowatość
// i wysokość. Deski biegną wzdłuż osi x; widthPx: szerokość deski w pikselach.
// ---------------------------------------------------------------------------
function woodMaps(w, h, { seed = 1, boards = 4, light = '#8A6446', dark = '#4A3020', contrast = 1, joints = 0, rings = [14, 24] } = {}) {
  const n1 = makeNoise(seed), n2 = makeNoise(seed + 7), n3 = makeNoise(seed + 13), n4 = makeNoise(seed + 21);
  const L = hexRgb(light), Dk = hexRgb(dark);
  const color = new Uint8ClampedArray(w * h * 4), rough = new Uint8ClampedArray(w * h * 4), height = new Float32Array(w * h);
  const bw = h / boards, r = rng(seed + 99);
  const board = Array.from({ length: boards }, () => ({
    off: r() * 200, tint: (r() - 0.5) * 0.14, rings: rings[0] + r() * (rings[1] - rings[0]), joint: r() * w,
    cath: r() < 0.6 ? 0.08 + r() * 0.12 : 0, cathAt: r(), slope: (r() - 0.5) * 0.6,
  }));
  // okres szumu w komórkach: tekstura powtarza się bez szwu wzdłuż desek
  const PX = 6, PXF = 96;
  for (let y = 0; y < h; y++) {
    const b = Math.min(boards - 1, Math.floor(y / bw)), B = board[b], vy = (y - b * bw) / bw;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      // słoje prawie równoległe do deski, delikatnie falujące; czasem łuk „katedry” (deska cięta stycznie)
      const wave = (n1(u * PX, B.off, PX, 256) - 0.5) * 0.16 + (n2(u * PX * 4, vy * 3 + B.off, PX * 4, 256) - 0.5) * 0.035;
      const du = Math.min(Math.abs(u - B.cathAt), 1 - Math.abs(u - B.cathAt));
      const arch = B.cath * Math.exp(-du * du * 60) * (1 - 4 * (vy - 0.5) * (vy - 0.5));
      const ring = (vy + wave + arch + B.slope * Math.sin(u * Math.PI * 2) * 0.05) * B.rings;
      const f = ring - Math.floor(ring);
      const late = smooth(0.62, 0.8, f) * (1 - smooth(0.88, 1, f));             // ciemniejsze drewno późne
      const fiber = n3(u * PXF, (y / h) * 1400, PXF, 256);                       // drobne włókna wzdłuż deski
      const pore = fiber > 0.8 ? (fiber - 0.8) * 5 : 0;                          // pory
      const slow = n4(u * 3, vy * 0.7 + B.off, 3, 256) - 0.5;                    // łagodne zmiany odcienia
      let k = 0.4 + (late * 0.42 + (fiber - 0.5) * 0.16 + pore * 0.22 + slow * 0.24) * contrast + B.tint;
      let hgt = -late * 0.04 - pore * 0.35 + fiber * 0.03;   // lakier jest gładki: słoje widać, prawie nie czuć
      const e = Math.min(vy, 1 - vy) * bw;                                       // spoiny desek
      if (e < 1.4) { k += 0.35 * (1 - e / 1.4); hgt -= 2 * (1 - e / 1.4); }
      if (joints) {                                                             // styki desek na długości (podłoga)
        const span = w / joints, jx = (x - B.joint + w) % span, ej = Math.min(jx, span - jx);
        if (ej < 1.3) { k += 0.3 * (1 - ej / 1.3); hgt -= 1.8 * (1 - ej / 1.3); }
      }
      k = Math.min(1, Math.max(0, k));
      const i = (y * w + x) * 4;
      color[i] = L[0] + (Dk[0] - L[0]) * k; color[i + 1] = L[1] + (Dk[1] - L[1]) * k; color[i + 2] = L[2] + (Dk[2] - L[2]) * k; color[i + 3] = 255;
      const rv = 0.32 + pore * 0.4 + late * 0.06;                                // lakier satynowy, pory matowe
      rough[i] = rough[i + 1] = rough[i + 2] = Math.min(255, rv * 255); rough[i + 3] = 255;
      height[y * w + x] = hgt;
    }
  }
  const toCanvas = data => { const [c, g] = canvas(w, h); g.putImageData(new ImageData(data, w, h), 0, 0); return c; };
  return { color: toCanvas(color), rough: toCanvas(rough), normal: normalMap(height, w, h, 0.8) };
}

// Tynk: ciepła biel z delikatnym szumem i chropowatością
function plasterMaps(size, seed) {
  const n = makeNoise(seed), n2 = makeNoise(seed + 3);
  const col = new Uint8ClampedArray(size * size * 4), height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = n(x / size * 16, y / size * 16, 16, 16) * 0.3 + n2(x / size * 64, y / size * 64, 64, 64) * 0.7;
      const i = (y * size + x) * 4, k = 236 + (v - 0.5) * 4;
      col[i] = k + 2; col[i + 1] = k - 1; col[i + 2] = k - 6; col[i + 3] = 255;
      height[y * size + x] = v;
    }
  }
  const [c, g] = canvas(size, size);
  g.putImageData(new ImageData(col, size, size), 0, 0);
  return { color: c, normal: normalMap(height, size, size, 0.12) };
}

// Dywan: wełna z ramką w kolorach uczelni
function rugMap(w, h) {
  const [c, g] = canvas(w, h), n = makeNoise(5);
  g.fillStyle = '#D9D4CA'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1D2B4F'; g.lineWidth = w * 0.035; g.strokeRect(w * 0.05, h * 0.07, w * 0.9, h * 0.86);
  g.strokeStyle = '#8C97B0'; g.lineWidth = w * 0.008; g.strokeRect(w * 0.1, h * 0.15, w * 0.8, h * 0.7);
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = (n(x / 3, y / 3) - 0.5) * 26 + (n(x / 40, y / 40) - 0.5) * 10, i = (y * w + x) * 4;
    d[i] += v; d[i + 1] += v; d[i + 2] += v;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Widok za oknem: niebo, odległe drzewa i budynki kampusu (świeci, żeby okno było jasne)
function windowView(w, h) {
  const [c, g] = canvas(w, h);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#9CC9EE'); sky.addColorStop(0.62, '#E6F2FB'); sky.addColorStop(1, '#F7F4EC');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const r = rng(21);
  g.fillStyle = 'rgba(214,224,236,.9)';
  for (let k = 0; k < 6; k++) { const x = r() * w, bw = w * (0.08 + r() * 0.12), bh = h * (0.12 + r() * 0.16); g.fillRect(x, h * 0.72 - bh, bw, bh); }
  g.fillStyle = 'rgba(150,186,150,.85)';
  for (let k = 0; k < 40; k++) { const x = r() * w, rr = w * (0.02 + r() * 0.04); g.beginPath(); g.arc(x, h * 0.74 - r() * h * 0.05, rr, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#C9D6C2'; g.fillRect(0, h * 0.74, w, h * 0.26);
  return c;
}

// ---------------------------------------------------------------------------
// Budowa pokoju
// ---------------------------------------------------------------------------
/**
 * @param {{ baseH: number, aniso: number, texSize?: number }} opts
 * @returns {{ group: THREE.Group, floorY: number, tableTop: number, lights: THREE.Light[], tick: (t: number) => void, envProbe: THREE.Vector3 }}
 */
export function buildRoom({ baseH, aniso, texSize = 2048 }) {
  const group = new THREE.Group();
  group.name = 'pokoj';
  const top = -baseH;                          // blat stołu: tu leży plansza
  const floorY = top - TABLE.h;
  const tick = [];
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
  const add = (geo, m, { x = 0, y = 0, z = 0, cast = false, receive = true, ry = 0 } = {}) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z); o.rotation.y = ry;
    o.castShadow = cast; o.receiveShadow = receive;
    group.add(o);
    return o;
  };

  // --- stół: dębowy blat z zaokrąglonymi krawędziami, lakier z połyskiem (clearcoat), cztery nogi
  // orzech: ciemny blat, na którym biała plansza wyraźnie się odcina
  const wood = woodMaps(texSize, texSize / 2, { seed: 4, boards: 5 });
  const tw = texture(wood.color, { aniso }), tr = texture(wood.rough, { srgb: false, aniso }), tn = texture(wood.normal, { srgb: false, aniso });
  const tableMat = new THREE.MeshPhysicalMaterial({
    map: tw, roughnessMap: tr, normalMap: tn, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 1,
    clearcoat: 0.5, clearcoatRoughness: 0.25,
  });
  const tableTop = add(new RoundedBoxGeometry(TABLE.w, TABLE.top, TABLE.d, 4, TABLE.top * 0.35), tableMat, { y: top - TABLE.top / 2, receive: true });
  tableTop.name = 'blat';
  const legMat = new THREE.MeshPhysicalMaterial({ map: tw, normalMap: tn, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  const legH = TABLE.h - TABLE.top, legW = 0.07 * U;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(new RoundedBoxGeometry(legW, legH, legW, 2, legW * 0.2), legMat, { x: sx * (TABLE.w / 2 - 0.12 * U), y: floorY + legH / 2, z: sz * (TABLE.d / 2 - 0.12 * U) });
  }
  // oskrzynia pod blatem (rama łącząca nogi)
  const apronMat = legMat;
  for (const sz of [-1, 1]) add(new THREE.BoxGeometry(TABLE.w - 0.3 * U, 0.09 * U, 0.025 * U), apronMat, { y: top - TABLE.top - 0.045 * U, z: sz * (TABLE.d / 2 - 0.12 * U) });
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.025 * U, 0.09 * U, TABLE.d - 0.3 * U), apronMat, { x: sx * (TABLE.w / 2 - 0.12 * U), y: top - TABLE.top - 0.045 * U });

  // --- podłoga: dębowe deski z przesuniętymi stykami, matowy olej
  const fw = woodMaps(texSize, texSize, { seed: 9, boards: 8, light: '#CDAA80', dark: '#9C7650', contrast: 0.8, joints: 2, rings: [10, 18] });
  const floorRep = [ROOM.w / (8 * 0.14 * U) / 2, ROOM.d / (8 * 0.14 * U)];
  const floorMat = new THREE.MeshStandardMaterial({
    map: texture(fw.color, { aniso, repeat: floorRep }), roughnessMap: texture(fw.rough, { srgb: false, aniso, repeat: floorRep }),
    normalMap: texture(fw.normal, { srgb: false, aniso, repeat: floorRep }), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1.4,
  });
  const floor = add(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat, { y: floorY });
  floor.rotation.x = -Math.PI / 2;

  // --- dywan pod stołem
  const rug = add(new THREE.PlaneGeometry(2.8 * U, 2.0 * U), mat('#FFFFFF', { map: texture(rugMap(1024, 730), { aniso }), roughness: 0.95 }), { y: floorY + 0.012 * U });
  rug.rotation.x = -Math.PI / 2;
  rug.material.map.wrapS = rug.material.map.wrapT = THREE.ClampToEdgeWrapping;

  // --- ściany: tynk na górze, granatowa boazeria na dole, listwa przypodłogowa
  const pl = plasterMaps(512, 3);
  const wallRep = [ROOM.w / (1.6 * U), ROOM.h / (1.6 * U)];
  const wallMat = mat('#FFFFFF', { map: texture(pl.color, { aniso, repeat: wallRep }), normalMap: texture(pl.normal, { srgb: false, aniso, repeat: wallRep }), roughness: 0.92 });
  const panelMat = mat('#24345C', { roughness: 0.55 });
  const trimMat = mat('#F2EEE6', { roughness: 0.5 });
  const frameInset = mat('#2B3D68', { roughness: 0.5 });
  const wainH = 0.95 * U;
  const walls = [
    { x: 0, z: -ROOM.d / 2, ry: 0, len: ROOM.w },             // tył (regał)
    { x: -ROOM.w / 2, z: 0, ry: Math.PI / 2, len: ROOM.d },   // lewa (okno)
    { x: ROOM.w / 2, z: 0, ry: -Math.PI / 2, len: ROOM.d },
    { x: 0, z: ROOM.d / 2, ry: Math.PI, len: ROOM.w },
  ];
  for (const wl of walls) {
    const g = new THREE.Group();
    g.position.set(wl.x, floorY, wl.z); g.rotation.y = wl.ry;
    group.add(g);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(wl.len, ROOM.h), wallMat);
    plane.position.y = ROOM.h / 2; plane.receiveShadow = true;
    g.add(plane);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(wl.len, wainH, 0.02 * U), panelMat);
    panel.position.set(0, wainH / 2, 0.01 * U);
    g.add(panel);
    // ramki płycin boazerii
    const n = Math.round(wl.len / (0.9 * U)), pw = wl.len / n;
    const frGeo = new THREE.BoxGeometry(pw - 0.16 * U, wainH - 0.28 * U, 0.012 * U);
    for (let k = 0; k < n; k++) {
      const fr = new THREE.Mesh(frGeo, frameInset);
      fr.position.set(-wl.len / 2 + pw * (k + 0.5), wainH / 2 + 0.03 * U, 0.026 * U);
      g.add(fr);
    }
    const cap = new THREE.Mesh(new THREE.BoxGeometry(wl.len, 0.04 * U, 0.05 * U), trimMat);
    cap.position.set(0, wainH, 0.025 * U);
    g.add(cap);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(wl.len, 0.1 * U, 0.03 * U), trimMat);
    skirt.position.set(0, 0.05 * U, 0.03 * U);
    g.add(skirt);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(wl.len, 0.07 * U, 0.06 * U), trimMat);
    crown.position.set(0, ROOM.h - 0.035 * U, 0.03 * U);
    g.add(crown);
  }
  // sufit
  const ceil = add(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mat('#F4F1EB', { roughness: 0.95 }), { y: floorY + ROOM.h, receive: false });
  ceil.rotation.x = Math.PI / 2;

  // --- okno w lewej ścianie: jasny widok, biała rama ze szprosami, parapet, smuga światła
  const winW = 2.4 * U, winH = 1.55 * U, winY = floorY + 1.0 * U + winH / 2;
  const winX = -ROOM.w / 2 + 0.03 * U, winZ = -0.2 * U;
  const view = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), new THREE.MeshBasicMaterial({ map: texture(windowView(1024, 660), { aniso }), toneMapped: true }));
  view.material.map.wrapS = view.material.map.wrapT = THREE.ClampToEdgeWrapping;
  view.material.color.setScalar(2.2);           // jaśniej niż wnętrze: okno świeci (poświata w trybie Wysokim)
  view.position.set(winX + 0.01, winY, winZ); view.rotation.y = Math.PI / 2;
  group.add(view);
  const frameMat = mat('#FAFAF7', { roughness: 0.4 });
  const bar = (w, h, y, z) => add(new THREE.BoxGeometry(0.08 * U, h, w), frameMat, { x: winX + 0.04 * U, y, z });
  bar(winW + 0.16 * U, 0.08 * U, winY + winH / 2, winZ); bar(winW + 0.16 * U, 0.08 * U, winY - winH / 2, winZ);
  bar(0.08 * U, winH, winY, winZ - winW / 2); bar(0.08 * U, winH, winY, winZ + winW / 2);
  bar(0.05 * U, winH, winY, winZ); bar(winW, 0.04 * U, winY + winH * 0.18, winZ);
  add(new THREE.BoxGeometry(0.22 * U, 0.04 * U, winW + 0.3 * U), mat('#F2EEE6', { roughness: 0.35 }), { x: winX + 0.11 * U, y: winY - winH / 2 - 0.06 * U, z: winZ });
  // --- regał z książkami przy tylnej ścianie
  {
    const sx = 1.4 * U, sh = 2.0 * U, sd = 0.32 * U, x0 = 1.0 * U, z0 = -ROOM.d / 2 + sd / 2 + 0.02 * U;
    const shelfMat = mat('#EDE7DC', { roughness: 0.55 });
    add(new THREE.BoxGeometry(sx, 0.03 * U, sd), shelfMat, { x: x0, y: floorY + sh, z: z0 });
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.03 * U, sh, sd), shelfMat, { x: x0 + s * sx / 2, y: floorY + sh / 2, z: z0 });
    add(new THREE.BoxGeometry(sx, sh, 0.01 * U), shelfMat, { x: x0, y: floorY + sh / 2, z: z0 - sd / 2 });
    const r = rng(17), cols = ['#1D2B4F', '#B5543A', '#E6DCC6', '#5D7A6B', '#C9A24B', '#3F4A5E', '#8C97B0', '#F2EEE6', '#7A3B3B'].map(c => new THREE.Color(c));
    // wszystkie książki to jedna siatka z instancjami (jedno wywołanie rysowania), kolor osobno dla każdej
    const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('#FFFFFF', { roughness: 0.65 }), 200);
    const dummy = new THREE.Object3D();
    let count = 0;
    for (let row = 0; row < 5; row++) {
      const y = floorY + 0.06 * U + row * (sh / 5);
      add(new THREE.BoxGeometry(sx - 0.06 * U, 0.025 * U, sd - 0.02 * U), shelfMat, { x: x0, y: y - 0.02 * U, z: z0 });
      let x = x0 - sx / 2 + 0.06 * U;
      while (x < x0 + sx / 2 - 0.12 * U) {
        if (r() < 0.12) { x += 0.08 * U + r() * 0.15 * U; continue; }   // luka albo stojak
        const bw = (0.025 + r() * 0.035) * U, bh = (0.2 + r() * 0.12) * U, bd = (0.16 + r() * 0.08) * U;
        const lean = r() < 0.06 ? 0.25 : 0;
        if (count >= 200) break;
        dummy.scale.set(bw, bh, bd);
        dummy.position.set(x + bw / 2, y + bh / 2, z0 + sd / 2 - bd / 2 - 0.02 * U);
        dummy.rotation.set(0, 0, lean);
        dummy.updateMatrix();
        books.setMatrixAt(count, dummy.matrix);
        books.setColorAt(count, cols[Math.floor(r() * cols.length)]);
        count++;
        x += bw + 0.003 * U;
      }
    }
    books.count = count;
    books.receiveShadow = true;
    group.add(books);
  }

  // --- krzesła (dwa po dalszych stronach stołu)
  const chairMat = new THREE.MeshPhysicalMaterial({ map: tw, normalMap: tn, roughness: 0.5, clearcoat: 0.25 });
  const seatMat = mat('#2B3D68', { roughness: 0.85 });
  // krzesło: lekko pochylone oparcie z giętej sklejki, tapicerowane siedzisko, toczone nogi
  const backGeo = (() => {
    const g = new RoundedBoxGeometry(0.44 * U, 0.2 * U, 0.025 * U, 4, 0.01 * U), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, pos.getZ(i) - (x * x) / (0.9 * U)); }   // wygięcie
    g.computeVertexNormals();
    return g;
  })();
  const chair = (x, z, ry) => {
    const g = new THREE.Group();
    g.position.set(x, floorY, z); g.rotation.y = ry;
    group.add(g);
    const seatH = 0.46 * U, sw = 0.46 * U;
    const frame = new THREE.Mesh(new RoundedBoxGeometry(sw, 0.035 * U, sw, 3, 0.01 * U), chairMat);
    frame.position.y = seatH - 0.02 * U;
    g.add(frame);
    const seat = new THREE.Mesh(new RoundedBoxGeometry(sw - 0.03 * U, 0.045 * U, sw - 0.04 * U, 4, 0.02 * U), seatMat);
    seat.position.set(0, seatH + 0.02 * U, 0.01 * U);
    g.add(seat);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.017 * U, 0.012 * U, seatH, 14), chairMat);
      leg.position.set(a * (sw / 2 - 0.035 * U), seatH / 2, b * (sw / 2 - 0.035 * U));
      leg.rotation.set(b * 0.04, 0, -a * 0.04);
      g.add(leg);
    }
    for (const a of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * U, 0.016 * U, 0.44 * U, 12), chairMat);
      post.position.set(a * (sw / 2 - 0.035 * U), seatH + 0.2 * U, -sw / 2 + 0.03 * U);
      post.rotation.x = -0.1;
      g.add(post);
    }
    const back = new THREE.Mesh(backGeo, chairMat);
    back.position.set(0, seatH + 0.33 * U, -sw / 2 + 0.005 * U);
    back.rotation.x = -0.1;
    g.add(back);
  };
  chair(-0.35 * U, -TABLE.d / 2 - 0.32 * U, 0);
  chair(-TABLE.w / 2 - 0.32 * U, 0.25 * U, Math.PI / 2);

  // --- lampa nad stołem: klosz w granacie, ciepłe światło
  {
    const lampY = top + 1.05 * U;
    const shadeGeo = new THREE.LatheGeometry([0.02, 0.06, 0.16, 0.22, 0.225].map((r, k) => new THREE.Vector2(r * U, (0.18 - k * 0.045) * U)), 48);
    const shade = add(shadeGeo, mat('#1D2B4F', { roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide }), { y: lampY, receive: false });
    shade.castShadow = false;
    const inner = add(new THREE.CircleGeometry(0.2 * U, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE8C2').multiplyScalar(2.5) }), { y: lampY + 0.02 * U, receive: false });
    inner.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.004 * U, 0.004 * U, floorY + ROOM.h - lampY - 0.18 * U, 6), mat('#222222'), { y: (lampY + 0.18 * U + floorY + ROOM.h) / 2, receive: false });
    add(new THREE.CylinderGeometry(0.05 * U, 0.05 * U, 0.02 * U, 24), mat('#1D2B4F'), { y: floorY + ROOM.h - 0.01 * U, receive: false });
  }
  const lamp = new THREE.PointLight('#FFD9A8', 90, 0, 1.2);
  lamp.position.set(0, top + 1.0 * U, 0);
  group.add(lamp);

  // --- drobiazgi na stole (poza miejscami na pieniądze i karty graczy)
  {
    // kubek z kawą
    const mug = new THREE.Group();
    mug.position.set(TABLE.w * 0.36, top, -TABLE.d * 0.3);
    group.add(mug);
    const body = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.042, 0.004], [0.042, 0.095], [0.038, 0.095], [0.036, 0.008], [0, 0.008]].map(([r, y]) => new THREE.Vector2(r * U, y * U)), 48),
      new THREE.MeshPhysicalMaterial({ color: '#F4F1EA', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1 }));
    body.castShadow = true;
    mug.add(body);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025 * U, 0.007 * U, 12, 32, Math.PI * 1.2), body.material);
    handle.position.set(0.045 * U, 0.05 * U, 0); handle.rotation.z = -Math.PI * 0.6;
    mug.add(handle);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.036 * U, 40), new THREE.MeshPhysicalMaterial({ color: '#3B2416', roughness: 0.1, clearcoat: 1 }));
    coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.08 * U;
    mug.add(coffee);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0425 * U, 0.0425 * U, 0.018 * U, 48, 1, true), mat('#1D2B4F', { roughness: 0.3 }));
    band.position.y = 0.06 * U;
    mug.add(band);
    // zeszyt i ołówek
    const nb = new THREE.Group();
    nb.position.set(-TABLE.w * 0.36, top, TABLE.d * 0.28); nb.rotation.y = 0.35;
    group.add(nb);
    const pages = new THREE.Mesh(new RoundedBoxGeometry(0.21 * U, 0.012 * U, 0.297 * U, 2, 0.003 * U), mat('#F7F4EC', { roughness: 0.9 }));
    pages.position.y = 0.006 * U; pages.castShadow = true;
    nb.add(pages);
    const cover = new THREE.Mesh(new RoundedBoxGeometry(0.215 * U, 0.003 * U, 0.3 * U, 2, 0.001 * U), mat('#24345C', { roughness: 0.7 }));
    cover.position.y = 0.0135 * U;
    nb.add(cover);
    const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.0035 * U, 0.0035 * U, 0.17 * U, 6), mat('#E2B33C', { roughness: 0.5 }));
    pencil.rotation.set(0, 0.6, Math.PI / 2); pencil.position.set(0.15 * U, 0.004 * U, 0.02 * U); pencil.castShadow = true;
    nb.add(pencil);
    // roślinka w doniczce
    const pot = new THREE.Group();
    pot.position.set(-TABLE.w * 0.38, top, -TABLE.d * 0.32);
    group.add(pot);
    const potBody = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.045, 0], [0.055, 0.1], [0.05, 0.1], [0.04, 0.012], [0, 0.012]].map(([r, y]) => new THREE.Vector2(r * U, y * U)), 40), mat('#C9714E', { roughness: 0.85 }));
    potBody.castShadow = true;
    pot.add(potBody);
    const leafMat = mat('#4E8A55', { roughness: 0.6, side: THREE.DoubleSide });
    const r = rng(31);
    for (let k = 0; k < 14; k++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.035 * U, 12, 8), leafMat);
      const a = r() * Math.PI * 2, h = 0.11 + r() * 0.12;
      leaf.scale.set(0.5, 1.6, 0.18);
      leaf.position.set(Math.cos(a) * 0.03 * U, h * U, Math.sin(a) * 0.03 * U);
      leaf.rotation.set(Math.cos(a) * 0.6, a, Math.sin(a) * 0.6);
      leaf.castShadow = true;
      pot.add(leaf);
    }
  }

  // światło z okna na podłodze: jasna plama z cieniem szprosów (bez kosztownego światła z cieniem)
  {
    const [c, g] = canvas(512, 512);
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
    g.filter = 'blur(10px)';
    g.fillStyle = '#FFF6E2';
    g.fillRect(40, 60, 432, 392);
    g.fillStyle = '#000';
    g.fillRect(248, 40, 16, 432); g.fillRect(30, 300, 452, 12);
    g.filter = 'none';
    const patch = add(new THREE.PlaneGeometry(2.4 * U, 2.0 * U), new THREE.MeshBasicMaterial({ map: texture(c), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }), { x: -ROOM.w / 2 + 1.55 * U, y: floorY + 0.004 * U, z: winZ - 0.3 * U, receive: false });
    patch.rotation.set(-Math.PI / 2, 0, 0.35);
    patch.renderOrder = 2;
  }

  return {
    group, floorY, tableTop: top, lights: [lamp],
    tick: t => { for (const f of tick) f(t); },
    envProbe: new THREE.Vector3(0, top + 0.6 * U, 0),
  };
}
