// Kaczki krzyżówki na wodzie: mama z pięcioma kaczątkami płynie gęsiego wzdłuż plaży, a dalej pływa para
// (kaczor i kaczka). Kaczki kołyszą się na tej samej fali co łodzie, wiosłują łapkami pod wodą i rozglądają się.
// Kaczątka co chwilę zanurzają dzióbki, a para żeruje jak prawdziwe krzyżówki: głowa pod wodę, kuper do góry.
// Za każdą kaczką rozchodzą się drobne zmarszczki z symulacji wody (src/scene/ripples.js).
//
// Wszystko z brył liczonych w kodzie, a upierzenie to kolory w wierzchołkach, bez gotowych modeli i tekstur.
// Każdy rodzaj kaczki ma tułów i głowę jako siatki z instancjami, łapki wszystkich kaczek to jedna siatka,
// więc cała gromadka to kilka wywołań rysowania.
//
// Kaczka patrzy wzdłuż osi +z, linia wody to y = 0. Dorosła kaczka ma ok. 0,75 jednostki długości z głową.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// Trasa: zamknięta pętla jak bieżnia (dwa proste odcinki wzdłuż plaży i półkola na końcach) z łagodnym wężykiem.
// Punkty są w równych odstępach wzdłuż drogi, więc pozycja zależy liniowo od przebytej drogi.
// ---------------------------------------------------------------------------
export function loopPath({ x0, x1, zc, r, meander = 0, waves = 4 }) {
  const straight = x1 - x0, arc = Math.PI * r, total = 2 * straight + 2 * arc, N = 2000;
  const raw = [];
  for (let k = 0; k < N; k++) {
    let d = (k / N) * total, x, z;
    if (d < straight) { x = x0 + d; z = zc - r; }                                          // bliżej brzegu, w prawo
    else if ((d -= straight) < arc) { const a = d / r; x = x1 + r * Math.sin(a); z = zc - r * Math.cos(a); }
    else if ((d -= arc) < straight) { x = x1 - d; z = zc + r; }                              // dalej od brzegu, w lewo
    else { d -= straight; const a = d / r; x = x0 - r * Math.sin(a); z = zc + r * Math.cos(a); }
    raw.push([x, z]);
  }
  // wężyk: przesunięcie w bok od kierunku płynięcia
  const pts = raw.map(([x, z], k) => {
    const [xa, za] = raw[(k + N - 1) % N], [xb, zb] = raw[(k + 1) % N];
    const tx = xb - xa, tz = zb - za, l = Math.hypot(tx, tz), o = meander * Math.sin(2 * Math.PI * waves * k / N);
    return [x - (tz / l) * o, z + (tx / l) * o];
  });
  const cum = [0];
  for (let k = 1; k <= N; k++) {
    const [xa, za] = pts[k - 1], [xb, zb] = pts[k % N];
    cum.push(cum[k - 1] + Math.hypot(xb - xa, zb - za));
  }
  const L = cum[N], M = Math.ceil(L / 0.04), step = L / M;
  const xs = new Float32Array(M), zs = new Float32Array(M), txs = new Float32Array(M), tzs = new Float32Array(M);
  for (let m = 0, j = 0; m < M; m++) {
    const s = m * step;
    while (cum[j + 1] < s) j++;
    const u = (s - cum[j]) / (cum[j + 1] - cum[j]), [xa, za] = pts[j], [xb, zb] = pts[(j + 1) % N];
    xs[m] = xa + (xb - xa) * u; zs[m] = za + (zb - za) * u;
  }
  for (let m = 0; m < M; m++) {
    const a = (m + M - 3) % M, b = (m + 3) % M, tx = xs[b] - xs[a], tz = zs[b] - zs[a], l = Math.hypot(tx, tz) || 1;
    txs[m] = tx / l; tzs[m] = tz / l;
  }
  return {
    length: L,
    /**
     * Punkt na drodze s (dowolna liczba, pętla się powtarza): x, z i kierunek płynięcia tx, tz
     * @param {number} s
     * @param {{ x: number, z: number, tx: number, tz: number }} [out]
     * @returns {{ x: number, z: number, tx: number, tz: number }}
     */
    at(s, out = { x: 0, z: 0, tx: 0, tz: 1 }) {
      const f = (((s % L) + L) % L) / step, i = Math.floor(f) % M, i1 = (i + 1) % M, u = f - Math.floor(f);
      out.x = xs[i] + (xs[i1] - xs[i]) * u;
      out.z = zs[i] + (zs[i1] - zs[i]) * u;
      const tx = txs[i] + (txs[i1] - txs[i]) * u, tz = tzs[i] + (tzs[i1] - tzs[i]) * u, l = Math.hypot(tx, tz) || 1;
      out.tx = tx / l; out.tz = tz / l;
      return out;
    },
  };
}

// Żerowanie: w każdym okresie P kaczka przez ostatnie D sekund stoi z głową pod wodą.
// swimTime to czas samego płynięcia (pozycja na trasie), dabble to wychylenie od 0 do 1.
const DAB_IN = 0.55, DAB_OUT = 0.7;
function swimTime(t, P, D, ph) {
  const u = t + ph, n = Math.floor(u / P), r = u - n * P;
  return n * (P - D) + Math.min(r, P - D);
}
function dabble(t, P, D, ph) {
  const u = t + ph, r = u - Math.floor(u / P) * P - (P - D);
  if (r <= 0) return 0;
  const ease = x => x * x * (3 - 2 * x);
  if (r < DAB_IN) return ease(r / DAB_IN);
  if (r > D - DAB_OUT) return ease(Math.max(0, D - r) / DAB_OUT);
  return 1;
}

// ---------------------------------------------------------------------------
// Bryły
// ---------------------------------------------------------------------------
function hash(i, j, seed) {
  let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
// szum wartości (plamki na piórach)
function noise2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
// szum w przestrzeni (po położeniu punktu, a nie po kącie): bez smug zbiegających się na piersi i ogonie
function noise3(x, y, z, seed) {
  return (noise2(x, y, seed) + noise2(y + 17.3, z, seed + 1) + noise2(z - 9.1, x, seed + 2)) / 3;
}
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const col = hex => new THREE.Color(hex);

/**
 * Tułów z przekrojów: od czubka ogona (t = 0) do piersi (t = 1). Przekrój to superelipsa, pełniejsza niż elipsa.
 * @param {{ z0: number, z1: number, n: number, w: (t: number) => number, up: (t: number) => number,
 *   down: (t: number) => number, axis: (t: number) => number }} P szerokość, wysokość nad i pod osią, wysokość osi
 * @param {(c: THREE.Color, p: { t: number, a: number, x: number, y: number, z: number }) => void} paint kolor punktu
 */
function bodyGeometry(P, paint, rings = 34, seg = 30) {
  const n = (rings + 1) * seg, pos = new Float32Array(n * 3), rgb = new Float32Array(n * 3), idx = [];
  const c = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const t = (1 - Math.cos(Math.PI * i / rings)) / 2;      // gęściej przy końcach: krągła pierś, ostry ogon
    const z = P.z0 + t * (P.z1 - P.z0), w = P.w(t), up = P.up(t), dn = P.down(t), ay = P.axis(t);
    const ne = 2 + (P.n - 2) * Math.sin(Math.PI * t);     // przy czubkach przekrój jak elipsa, bez kantów
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const x = w * Math.sign(ca) * Math.abs(ca) ** (2 / ne), y = ay + (sa >= 0 ? up : dn) * Math.sign(sa) * Math.abs(sa) ** (2 / ne);
      const k = (i * seg + j) * 3;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      paint(c, { t, a, x, y, z });
      rgb[k] = c.r; rgb[k + 1] = c.g; rgb[k + 2] = c.b;
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + (j + 1) % seg, c2 = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg;
    idx.push(a, b, c2, b, d, c2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // czubek ogona i środek piersi to jeden punkt: normalna wzdłuż osi (bez gwiazdki z cieni)
  const nrm = g.getAttribute('normal'), tail = new THREE.Vector3(0, 0.45, -1).normalize(), chest = new THREE.Vector3(0, 0.15, 1).normalize();
  for (let j = 0; j < seg; j++) { nrm.setXYZ(j, tail.x, tail.y, tail.z); nrm.setXYZ(rings * seg + j, chest.x, chest.y, chest.z); }
  return g;
}

/**
 * Kula zniekształcona do elipsoidy (głowa, szyja, dziób, skrzydło, oko) z kolorem liczonym w jej własnym układzie
 * (u na jednostkowej kuli), potem obrót i przesunięcie na miejsce.
 */
function blob(r, at, rot, paint, ws = 22, hs = 14, shape = null) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.deleteAttribute('uv');
  const p = g.getAttribute('position'), n = p.count, rgb = new Float32Array(n * 3), c = new THREE.Color(), u = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    u.fromBufferAttribute(p, k);
    paint(c, u);
    rgb[k * 3] = c.r; rgb[k * 3 + 1] = c.g; rgb[k * 3 + 2] = c.b;
    const s = shape ? shape(u) : 1;
    p.setXYZ(k, u.x * r[0] * s, u.y * r[1], u.z * r[2]);
  }
  g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  g.computeVertexNormals();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')), new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}
function torus(R, tube, at, rot, hex, arc = Math.PI * 2, scale = [1, 1, 1]) {
  const g = new THREE.TorusGeometry(R, tube, 8, 28, arc);
  g.deleteAttribute('uv');
  const k = col(hex), rgb = new Float32Array(g.getAttribute('position').count * 3);
  for (let i = 0; i < rgb.length; i += 3) { rgb[i] = k.r; rgb[i + 1] = k.g; rgb[i + 2] = k.b; }
  g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')), new THREE.Vector3(...scale)));
  return g;
}

// Profil tułowia dorosłej kaczki: szeroka, nisko osadzona, z zadartym, spiczastym kuprem
const ADULT = {
  z0: -0.37, z1: 0.27, n: 2.5,
  w: t => 0.165 * (t < 0.56 ? Math.sin(Math.PI / 2 * t / 0.56) ** 1.25 : Math.sqrt(Math.max(0, 1 - ((t - 0.56) / 0.44) ** 2))),
  up: t => 0.095 * (t < 0.5 ? Math.sin(Math.PI / 2 * t / 0.5) ** 1.05 : Math.max(0, 1 - ((t - 0.5) / 0.5) ** 2) ** 0.35),
  down: t => 0.105 * (t < 0.55 ? Math.sin(Math.PI / 2 * t / 0.55) ** 0.9 : Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2))),
  axis: t => 0.012 + 0.1 * Math.max(0, 1 - t / 0.42) ** 2,
};
// Kaczątko: okrągłe i puszyste, krótki ogonek
const CHICK = {
  z0: -0.14, z1: 0.12, n: 2.2,
  w: t => 0.088 * (t < 0.5 ? Math.sin(Math.PI / 2 * t / 0.5) ** 0.7 : Math.sqrt(Math.max(0, 1 - ((t - 0.5) / 0.5) ** 2))),
  up: t => 0.078 * (t < 0.45 ? Math.sin(Math.PI / 2 * t / 0.45) ** 0.6 : Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.55) ** 2)) ** 0.8),
  down: t => 0.06 * (t < 0.5 ? Math.sin(Math.PI / 2 * t / 0.5) ** 0.6 : Math.sqrt(Math.max(0, 1 - ((t - 0.5) / 0.5) ** 2))),
  axis: t => 0.022 + 0.03 * Math.max(0, 1 - t / 0.35) ** 2,
};

// Złożone skrzydła namalowane na tułowiu: ciemniejszy pas na górze boków z rzędami piór i lusterkiem
// (niebieskie pióra z białymi brzegami) przy dolnym brzegu, z tyłu skrzydła. Sylwetka tułowia zostaje gładka.
const BLUE = col('#2F46A6'), VIOLET = col('#4B3C99'), WHITE = col('#F1F0EA'), _w = new THREE.Color();
function paintWings(c, p, base, edge) {
  if (p.t < 0.06 || p.t > 0.66) return;
  const span = Math.sin(Math.PI * (p.t - 0.06) / 0.6) ** 0.55, hb = 0.46 * span;   // skrzydło zwęża się na końcach
  for (const side of [1, -1]) {
    const da = (p.a - (side > 0 ? 0.82 : Math.PI - 0.82)) * side;   // dodatnie w stronę grzbietu, ujemne do dolnego brzegu
    const m = smooth(hb, hb - 0.07, Math.abs(da));
    if (m <= 0) continue;
    _w.copy(base).lerp(edge, smooth(0.6, 0.95, Math.sin(p.t * 75 + da * 6) * 0.5 + 0.5) * 0.3);   // rzędy piór
    if (p.t > 0.16 && p.t < 0.35 && da < -0.06 && da > -hb + 0.03) {
      _w.copy(BLUE).lerp(VIOLET, smooth(0.16, 0.35, p.t) * 0.4);
      if (p.t < 0.185 || p.t > 0.325) _w.copy(WHITE);
    }
    c.lerp(_w, m);
  }
}

const WING_HEN = col('#5E4530'), WING_HEN_EDGE = col('#8E6F4E'), WING_DRAKE = col('#827669'), WING_DRAKE_EDGE = col('#A3988B');

// Łapka: krótka nóżka i płetwa z trzema palcami (pod wodą, wiosłuje)
function footGeometry() {
  const leg = new THREE.CylinderGeometry(0.0065, 0.0055, 0.06, 6);
  leg.translate(0, -0.03, 0);
  const sh = new THREE.Shape();
  sh.moveTo(-0.006, 0); sh.lineTo(-0.032, 0.05); sh.quadraticCurveTo(-0.016, 0.058, 0, 0.064);
  sh.quadraticCurveTo(0.016, 0.058, 0.032, 0.05); sh.lineTo(0.006, 0); sh.closePath();
  const web = new THREE.ShapeGeometry(sh, 3);
  web.rotateX(Math.PI / 2);
  web.translate(0, -0.06, -0.008);
  for (const g of [leg, web]) g.deleteAttribute('uv');
  return mergeGeometries([leg.toNonIndexed(), web.toNonIndexed()]);
}

// Rodzaje kaczek: tułów, głowa (z szyją, dziobem i oczami, obraca się wokół podstawy szyi) i miejsce łapek
function henParts() {
  const base = col('#8E6C47'), dark = col('#57412B'), light = col('#B9997A'), pale = col('#D3C2A4');
  const body = bodyGeometry(ADULT, (c, p) => {
    const m = noise3(p.x * 34, p.y * 34, p.z * 34, 3) * 0.6 + noise3(p.x * 90, p.y * 90, p.z * 90, 8) * 0.4;   // cętki na piórach
    c.copy(base).lerp(dark, smooth(0.42, 0.7, m) * 0.9);
    c.lerp(light, smooth(0.01, -0.06, p.y) * 0.75);                                         // jaśniejszy spód
    c.lerp(pale, smooth(0.08, 0.0, p.t) * 0.55);                                             // jaśniejszy brzeg ogona
    paintWings(c, p, WING_HEN, WING_HEN_EDGE);
  }, 36, 48);
  const head = headGeometry({
    neck: '#9C7A55', face: '#B49470', crown: '#4E3A28', stripe: '#4A3726', bill: '#D2812F', billDark: '#4C3828',
  });
  return { body, head, pivot: [0, 0.088, 0.17], feet: [[0.062, -0.07, -0.02]] };
}

function drakeParts() {
  const grey = col('#CAC7BE'), grey2 = col('#B4B1A8'), back = col('#7F7367'), chest = col('#5B2F24'), black = col('#1C1C21'), white = col('#ECEAE4'), belly = col('#DAD7CF');
  const body = bodyGeometry(ADULT, (c, p) => {
    c.copy(grey).lerp(grey2, noise3(p.x * 120, p.y * 160, p.z * 60, 5) * 0.6);     // drobne prążki na bokach
    c.lerp(back, smooth(0.45, 0.85, Math.sin(p.a)) * smooth(0.06, 0.1, p.y));              // ciemniejszy grzbiet
    c.lerp(belly, smooth(0.0, -0.06, p.y));
    if (p.t > 0.72) c.lerp(chest, smooth(0.72, 0.8, p.t) * smooth(-0.07, -0.02, p.y));      // brązowa pierś
    if (p.t < 0.16) c.lerp(black, smooth(0.16, 0.1, p.t) * smooth(-0.04, 0.02, p.y));       // czarny kuper
    if (p.t < 0.05) c.lerp(white, smooth(0.05, 0.02, p.t));                                 // biały ogon
    paintWings(c, p, WING_DRAKE, WING_DRAKE_EDGE);
  }, 36, 48);
  // zakręcone czarne pióra nad ogonem: znak rozpoznawczy kaczora
  const curl = torus(0.012, 0.0042, [0, 0.107, -0.3], [0, Math.PI / 2, 0.5], '#141418', Math.PI * 1.4);
  const head = headGeometry({
    neck: '#1F5A39', neckLow: '#5B2F24', face: '#1E5B38', crown: '#1A4A47', stripe: null, bill: '#D9C64E', billDark: '#B9A43A', ring: '#F2F1EC',
  });
  return { body: mergeGeometries([body, curl]), head, pivot: [0, 0.088, 0.17], feet: [[0.062, -0.07, -0.02]], gloss: true };
}

function chickParts() {
  const yellow = col('#E9C957'), brown = col('#6E5631'), belly = col('#F3DD87'), spot = col('#EDD266'), fluff = col('#F7E9B0');
  const body = bodyGeometry(CHICK, (c, p) => {
    c.copy(yellow).lerp(brown, smooth(0.25, 0.65, Math.sin(p.a)) * smooth(0.04, 0.075, p.y));   // brązowy grzbiet
    c.lerp(belly, smooth(0.0, -0.04, p.y));
    // jasne łatki na grzbiecie, po dwie z każdej strony
    for (const [tc, ac] of [[0.32, 0.95], [0.6, 1.05], [0.32, Math.PI - 0.95], [0.6, Math.PI - 1.05]]) {
      const d = Math.hypot((p.t - tc) * 5, p.a - ac);
      c.lerp(spot, smooth(0.34, 0.18, d));
    }
    c.lerp(fluff, (noise3(p.x * 70, p.y * 70, p.z * 70, 2) - 0.5) * 0.3);          // puch
  }, 26, 24);
  const head = headGeometry({
    neck: '#E7C552', face: '#F0D35E', crown: '#6E5631', stripe: '#6E5631', bill: '#4A4541', billDark: '#3A3633', chick: true,
  });
  return { body, head, pivot: [0, 0.07, 0.07], feet: [[0.045, -0.04, -0.01]], footScale: 0.62 };
}

/**
 * Głowa z szyją, dziobem i oczami, w układzie podstawy szyi (obracając ją, kaczka się rozgląda i zanurza dziób)
 * @param {{ neck: string, neckLow?: string, face: string, crown: string, stripe: string | null, bill: string, billDark: string,
 *   ring?: string, chick?: boolean }} o neckLow: kolor szyi pod obrączką, ring: kolor obrączki (kaczor)
 */
function headGeometry(o) {
  const F = col(o.face), N = col(o.neck), K = col(o.crown), S = o.stripe && col(o.stripe), B = col(o.bill), BD = col(o.billDark);
  const SHEEN = col('#2C6E59'), SHADE = col('#173F2C');   // połysk zielonej głowy kaczora
  const ch = !!o.chick, parts = [];
  // szyja: gruba i krótka, płynnie przechodzi w głowę (u kaczątka prawie jej nie widać)
  const NL = o.neckLow ? col(o.neckLow) : N;   // u kaczora pod obrączką już brązowa pierś
  parts.push(blob(ch ? [0.042, 0.036, 0.044] : [0.049, 0.085, 0.054], ch ? [0, 0.012, 0] : [0, 0.045, 0.008], [ch ? 0 : 0.18, 0, 0], (c, u) => c.copy(u.y < -0.35 ? NL : N), 20, 14));
  // głowa: wydłużona, czoło opada do dzioba; ciemna czapeczka i pasek przez oko (samica i kaczątko),
  // u kaczora zielona z połyskiem
  const hr = ch ? [0.05, 0.048, 0.054] : [0.052, 0.056, 0.077];
  const hc = ch ? [0, 0.05, 0.02] : [0, 0.104, 0.034];
  const eyeY = 0.25;   // wysokość oka na głowie (w jednostkach promienia)
  const headPaint = (c, u) => {
    c.copy(F);
    if (o.ring) c.lerp(SHEEN, smooth(0.2, 0.9, u.y) * 0.6).lerp(SHADE, smooth(0.1, -0.7, u.y) * 0.5);
    c.lerp(K, smooth(0.5, 0.8, u.y));
    if (S && u.z < 0.8) c.lerp(S, smooth(0.12, 0.05, Math.abs(u.y - eyeY)) * 0.9);
  };
  parts.push(blob(hr, hc, [ch ? 0 : 0.12, 0, 0], headPaint));
  // policzki i czoło między głową a dziobem (bez tego dziób sterczałby z kuli)
  if (!ch) parts.push(blob([0.034, 0.03, 0.05], [0, 0.094, 0.092], [0.3, 0, 0], (c, u) => headPaint(c, { x: u.x, y: u.y * 0.5, z: u.z }), 16, 10));
  // dziób: długi, płaski i szerszy na końcu
  const br = ch ? [0.016, 0.0075, 0.026] : [0.024, 0.0095, 0.058];
  const bc = ch ? [0, 0.042, 0.075] : [0, 0.086, 0.15];
  parts.push(blob(br, bc, [ch ? 0.18 : 0.34, 0, 0], (c, u) => {
    c.copy(B);
    if (u.y > 0 && Math.abs(u.x) < 0.5 && u.z > -0.75 && u.z < 0.6) c.lerp(BD, 0.85);    // ciemny grzbiet dzioba (samica)
    if (u.z > 0.85) c.lerp(BD, 0.6);                                                        // paznokieć na końcu dzioba
  }, 16, 10, u => 1 + 0.2 * smooth(-0.6, 0.8, u.z)));
  // oczy z błyskiem
  for (const sd of [-1, 1]) {
    const er = ch ? 0.0086 : 0.0095;
    const ez = hc[2] + 0.024, ey = hc[1] + eyeY * hr[1];
    const ex = hr[0] * Math.sqrt(Math.max(0, 1 - ((ez - hc[2]) / hr[2]) ** 2 - eyeY ** 2)) - er * 0.35;
    parts.push(blob([er, er, er], [sd * ex, ey, ez], [0, 0, 0], (c, u) => {
      c.set(u.z > 0.5 && u.y > 0.3 ? '#FFFFFF' : '#141414');
    }, 10, 8));
  }
  // biała obrączka na szyi kaczora
  if (o.ring) parts.push(torus(0.05, 0.0068, [0, 0.016, 0.004], [Math.PI / 2 + 0.25, 0, 0], o.ring, Math.PI * 2, [1, 1.12, 1]));
  return mergeGeometries(parts.map(g => (g.index ? g.toNonIndexed() : g)));
}

// ---------------------------------------------------------------------------
// Gromadka
// ---------------------------------------------------------------------------
/**
 * @param {{
 *   waterY: number,
 *   waveAt: (x: number, z: number, t: number) => [number, number, number],
 *   ripples?: { heightAt: (x: number, z: number) => number, disturb: (x: number, z: number, amount: number, radius: number) => void },
 *   family: { x0: number, x1: number, zc: number, r: number },
 *   pair: { x0: number, x1: number, zc: number, r: number },
 * }} o
 */
export function createDucks(o) {
  const group = new THREE.Group();
  group.name = 'kaczki';
  const kinds = { hen: henParts(), drake: drakeParts(), chick: chickParts() };
  const famPath = loopPath({ ...o.family, meander: 0.22, waves: 4 });
  const pairPath = loopPath({ ...o.pair, meander: 0.18, waves: 3 });

  // kaczki: mama i 5 kaczątek gęsiego, para krzyżówek obok siebie (każda żeruje w innym momencie)
  const ducks = [{ kind: 'hen', path: famPath, v: 0.2, gap: 0, side: 0, ph: 0.3 }];
  for (let k = 0; k < 5; k++) ducks.push({ kind: 'chick', path: famPath, v: 0.2, gap: 0.6 + 0.38 * k, side: 0, ph: 1.7 * k + 0.9, scale: 0.94 + 0.12 * hash(k, 1, 9) });
  ducks.push({ kind: 'hen', path: pairPath, v: 0.17, gap: 0, side: 0.27, ph: 2.1, dab: [17, 4.2, 0] });
  ducks.push({ kind: 'drake', path: pairPath, v: 0.17, gap: 0.45, side: -0.27, ph: 4.4, dab: [17, 4.2, 8.5] });

  const counts = { hen: 0, drake: 0, chick: 0 };
  for (const d of ducks) { d.idx = counts[d.kind]++; d.scale ??= 1; d.splash = false; }
  const feather = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
  const gloss = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0 });   // zielona głowa kaczora lśni
  const footMat = new THREE.MeshStandardMaterial({ color: '#E98A2E', roughness: 0.6, side: THREE.DoubleSide });
  const inst = (geo, mat, n) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;   // kaczki płyną, więc stała bryła brzegowa siatki by je gubiła
    group.add(m);
    return m;
  };
  const meshes = {};
  for (const [k, p] of Object.entries(kinds)) {
    meshes[k] = { body: inst(p.body, feather, counts[k]), head: inst(p.head, p.gloss ? gloss : feather, counts[k]) };
  }
  const feet = inst(footGeometry(), footMat, ducks.length * 2);

  // stan kaczek (pozycja na wodzie, kierunek, żerowanie, ruch głowy): liczy go place(t), test też go czyta
  const state = ducks.map(d => ({ kind: d.kind, x: 0, z: 0, yaw: 0, dab: 0 }));
  const pt = { x: 0, z: 0, tx: 0, tz: 1 };
  function place(t) {
    ducks.forEach((d, k) => {
      const swim = d.dab ? swimTime(t, d.dab[0], d.dab[1], d.dab[2]) : t;
      // kaczątka nie płyną idealnie równo: raz zostają w tyle, raz doganiają mamę
      d.path.at(d.v * swim - d.gap + (d.kind === 'chick' ? 0.04 * Math.sin(t * 0.83 + d.ph) : 0), pt);
      const lat = d.side + (d.kind === 'chick' ? 0.07 * Math.sin(t * 0.6 + d.ph) : 0);
      const st = state[k];
      st.x = pt.x + pt.tz * lat; st.z = pt.z - pt.tx * lat;
      st.yaw = Math.atan2(pt.tx, pt.tz) + (d.kind === 'chick' ? 0.12 * Math.sin(t * 1.3 + d.ph) : 0);
      st.dab = d.dab ? dabble(t, d.dab[0], d.dab[1], d.dab[2]) : 0;
    });
    return state;
  }

  const M = new THREE.Matrix4(), H = new THREE.Matrix4(), F = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion(), qy = new THREE.Quaternion(), e = new THREE.Euler(), up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3();
  const v = new THREE.Vector3(), sc = new THREE.Vector3();
  function update(t) {
    place(t);
    ducks.forEach((d, k) => {
      const st = state[k], P = kinds[d.kind], s = d.scale;
      const [h, sx, sz] = o.waveAt(st.x, st.z, t);
      const y = o.waterY + h + (o.ripples ? o.ripples.heightAt(st.x, st.z) : 0);
      // tułów: na fali, w kierunku płynięcia, lekko kołysze się od wiosłowania; przy żerowaniu przechyla się
      // wokół punktu na linii wody (głowa pod wodę, kuper do góry)
      q.setFromUnitVectors(up, nrm.set(-sx, 1, -sz).normalize()).multiply(qy.setFromAxisAngle(up, st.yaw));
      const paddle = Math.sin(t * 4.4 + d.ph);
      M.compose(v.set(st.x, y + 0.003 * paddle * (1 - st.dab), st.z), q, sc.set(s, s, s));
      M.multiply(tmp.makeTranslation(0, 0, -0.08));
      M.multiply(tmp.makeRotationFromEuler(e.set(1.95 * st.dab, 0, 0.025 * Math.sin(t * 2.2 + d.ph), 'XYZ')));
      M.multiply(tmp.makeTranslation(0, 0, 0.08));
      meshes[d.kind].body.setMatrixAt(d.idx, M);
      // głowa: rozglądanie się, lekkie kiwanie; kaczątka co jakiś czas zanurzają dziób
      const look = 0.55 * Math.sin(t * 0.31 + d.ph) * (0.55 + 0.45 * Math.sin(t * 0.13 + d.ph * 1.7));
      const dip = d.kind === 'chick' ? 1.45 * Math.max(0, Math.sin(t * (0.5 + 0.07 * d.idx) + d.ph)) ** 16 : 0;
      H.copy(M).multiply(tmp.makeTranslation(...P.pivot));
      H.multiply(tmp.makeRotationFromEuler(e.set(0.06 * Math.sin(t * 1.1 + d.ph) + dip + 0.45 * st.dab, look * (1 - dip) * (1 - st.dab), 0, 'YXZ')));
      meshes[d.kind].head.setMatrixAt(d.idx, H);
      // łapki wiosłują na zmianę (przy żerowaniu szybciej, żeby utrzymać się kuprem do góry)
      const fs = P.footScale ?? 1, [fx, fy, fz] = P.feet[0];
      for (const side of [-1, 1]) {
        const sw = Math.sin(t * (st.dab > 0.5 ? 9 : 4.4) + d.ph + (side > 0 ? Math.PI : 0));
        F.copy(M).multiply(tmp.makeTranslation(side * fx, fy, fz)).multiply(tmp.makeRotationX(0.25 + 0.65 * sw)).multiply(tmp.makeScale(fs, fs, fs));
        feet.setMatrixAt(k * 2 + (side > 0 ? 1 : 0), F);
      }
      // woda: drobne zmarszczki od piersi, a przy zanurzaniu i wynurzaniu głowy mały plusk
      if (o.ripples) {
        const fwd = 0.2 * s * (d.kind === 'chick' ? 0.6 : 1);
        o.ripples.disturb(st.x + Math.sin(st.yaw) * fwd, st.z + Math.cos(st.yaw) * fwd, (d.kind === 'chick' ? 0.0012 : 0.0026) * (1 - st.dab), d.kind === 'chick' ? 0.18 : 0.25);
        const diving = st.dab > 0.5;
        if (diving !== d.splash) { d.splash = diving; o.ripples.disturb(st.x, st.z, 0.012, 0.3); }
      }
    });
    for (const k of Object.keys(meshes)) { meshes[k].body.instanceMatrix.needsUpdate = true; meshes[k].head.instanceMatrix.needsUpdate = true; }
    feet.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { group, update, place, count: ducks.length };
}
