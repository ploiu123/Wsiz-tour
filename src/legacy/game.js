// WSiZ Tour: grafika 3D i interfejs gry. Zasady gry są w src/core (silnik), dane w src/data.
// Rysuje WebGPURenderer z Three.js: WebGPU tam, gdzie przeglądarka go ma, a w innych WebGL2.
// Własne efekty (woda, niebo) są napisane w TSL, języku węzłów Three.js, który działa w obu.
import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { Graphics, LEVELS as GFX_LEVELS } from '../render/graphics.js';
import { buildRoom } from '../scene/room.js';
import { loadDicePhysics, diceReady, simulateThrow, FACE_AXES } from '../render/dice.js';
import { loadModels, cloneModel } from '../render/assets.js';
import { PawnPreview } from '../render/preview.js';
import { RippleSim } from '../scene/ripples.js';
import { ACHIEVEMENTS, unlock } from '../ui/achievements.js';
import { wealthChartSvg } from '../ui/wealthChart.js';
import { pickMoments, rentScore, poolScore } from '../ui/moments.js';
import { TIPS, createTips } from '../ui/tips.js';
import { icon, iconGroup, drawIcon } from '../ui/icons.js';
import { audio, audioStarted, click, knock } from '../audio/synth.js';
import { playSfx } from '../audio/sfx.js';
import { createMusic } from '../audio/music.js';
import { createAmbience } from '../audio/ambience.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  N, SIDE, TOTAL, W, D, S, H, NO_GROUP,
  CORNER_INFO, GROUPS, FIELDS, FIELD_DESC, cellPose, START_CELL, JAIL_CELL, POOL_CELL,
  GOTO_CELL, ROOM_CELLS, GROUP_CELLS, SPECIAL_CELLS, buyable, fname,
} from '../data/board.ts';
import { CUR, K, money, roundK, ECON, GROUP_PRICE, RENT_MULT, BUILD_MULT, BOT, priceOf, levelCost } from '../data/economy.ts';
import { TAGS, BONUS_CARDS, PENALTY_CARDS } from '../data/cards.ts';
import { PAWN_COLORS } from '../data/players.ts';
import { GameEngine } from '../core/engine.ts';
import { LocalDriver } from '../core/local-driver.ts';
import { buildBank } from '../core/questions.ts';
import * as R from '../core/rules.ts';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// Kolory wspólne (układ planszy jest w src/data/board.ts)
// ---------------------------------------------------------------------------
const NAVY = '#1E2A47';
const GOLD = '#E0B04A';
// Jedna czcionka w całej grze (menu i napisy na planszy): Figtree z paczki gry, taka sama na każdym komputerze
const UI_FONT = 'Figtree, system-ui, sans-serif';

// Wygląd planszy: jasne pola, trawa na środku, plansza na wyspie kampusu
const LOOK = {
  paper: '#FFFFFF', tileBody: '#E6EAF1', tileH: 0.025, baseTop: '#F4F6FA', baseSide: '#CDD4E0', baseH: 0.45, margin: 0.5,
  tone: 'neutral', exposure: 0.85, env: 0.7,
  hemi: ['#FFFFFF', '#A8C8E8', 0.55], sun: ['#FFF4E2', 2.4, [9, 18, 6]],
  bg: ['#8FD3F4', '#E6F6FF'], vignette: 0.08,
};
const TILE_H = LOOK.tileH;
const BASE_H = LOOK.baseH;
const CENTER_Y = 0.016;


const PLAYERS = [
  { name: 'Gracz 1', pawn: 'Sztandar', color: '#E5484D', make: c => glbPawn('banner', c) || makeBanner(c) },
  { name: 'Gracz 2', pawn: 'Drukarka 3D', color: '#2F7FF0', make: c => glbPawn('printer', c) || makePrinter(c) },
  { name: 'Gracz 3', pawn: 'Koparka kryptowalut', color: '#1FA463', make: c => glbPawn('miner', c) || makeMiner(c) },
  { name: 'Gracz 4', pawn: 'Ekspres do kawy', color: '#F2B72E', make: c => glbPawn('espresso', c) || makeEspresso(c) },
  { name: 'Gracz 5', pawn: 'Robot', color: '#8B5CF6', make: c => glbPawn('robot', c) || makeRobot(c) },
  { name: 'Gracz 6', pawn: 'Dron', color: '#F2762E', make: c => glbPawn('drone', c) || makeDrone(c) },
  { name: 'Gracz 7', pawn: 'Biret absolwenta', color: '#14B3A6', make: c => glbPawn('cap', c) || makeCap(c) },
  { name: 'Gracz 8', pawn: 'Rakieta startupu', color: '#E5579A', make: c => glbPawn('rocket', c) || makeRocket(c) },
];
// Opisy pionków (karty graczy w menu i prezentacja)
const PAWN_DESC = [
  'Dla tych, którzy prowadzą. Na złotym maszcie powiewa logo uczelni.',
  'Dla tych, którzy budują. Drukuje warstwa po warstwie w kolorze gracza.',
  'Dla tych, którzy liczą. Kopie kryptowaluty, nawet gdy inni śpią.',
  'Dla tych, którzy nie śpią przed sesją. Para leci naprawdę.',
  'Dla tych, którzy programują. Świeci oczami, gdy kod się kompiluje.',
  'Dla tych, którzy patrzą z góry. Cztery śmigła i kamera na gimbalu.',
  'Dla tych, którzy kończą studia. Biret na stosie przeczytanych książek.',
  'Dla tych, którzy zakładają firmę. Startuje z ogniem i dymem.',
];

// Stosy kart na środku: ułatwienia przy narożniku START, utrudnienia naprzeciwko (od strony dziekanatu)
const INNER = S - 2 * D - 0.12;   // bok środka planszy
const CARD_W = 1.7, CARD_L = 2.4;
// Rogi środka planszy dla graczy: 0 = róg START, dalej zgodnie z ruchem pionków
const DECKS = [
  // Stosy leżą po bokach logo. Cztery rogi środka planszy należą do graczy (karty, które gracz trzyma).
  { title: 'UŁATWIENIA', name: 'Ułatwienia', kind: 'ulatwienia', color: '#2E9E8A', icon: '+', x: 2.95, z: 0, rotY: 0 },
  { title: 'UTRUDNIENIA', name: 'Utrudnienia', kind: 'utrudnienia', color: '#D6534F', icon: '!', x: -2.95, z: 0, rotY: Math.PI },
];


// ---------------------------------------------------------------------------
// Renderer, scena, kamera
// ---------------------------------------------------------------------------
const stage = $('stage');
// Zgodność: Three.js podaje widokom tekstur pole swizzle: 'rgba' (bez zmian kanałów), a część wersji Chrome
// zna to pole w starszej postaci i odrzuca cały widok. Domyślnej wartości nie trzeba podawać, więc ją usuwamy.
if (globalThis.GPUTexture) {
  const createView = GPUTexture.prototype.createView;
  GPUTexture.prototype.createView = function (desc) {
    if (desc?.swizzle !== 'rgba') return createView.call(this, desc);
    const { swizzle: _, ...rest } = desc;
    return createView.call(this, rest);
  };
}
let renderer;
try {
  // ?webgl wymusza zapasowy WebGL2 (porównanie i testy)
  renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true, forceWebGL: new URLSearchParams(location.search).has('webgl') });
  await renderer.init();
} catch (err) {
  $('loader').textContent = 'Ta przeglądarka nie obsługuje grafiki 3D (WebGPU ani WebGL2), więc plansza się nie wyświetli.';
  throw err;
}
const GPU = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
let gfx = null;   // jakość grafiki i efekty po renderze (tworzone niżej, gdy scena jest gotowa)
document.documentElement.dataset.gpu = GPU;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = { neutral: THREE.NeutralToneMapping, agx: THREE.AgXToneMapping, aces: THREE.ACESFilmicToneMapping }[LOOK.tone];
renderer.toneMappingExposure = LOOK.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // miękkie brzegi cieni: shadow.radius przy słońcu
renderer.domElement.className = 'gl';
renderer.domElement.setAttribute('aria-label', 'Plansza 3D');
stage.prepend(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
labelRenderer.domElement.hidden = true;
renderer.domElement.after(labelRenderer.domElement);

// Czcionka do napisów na planszy. Czekamy najwyżej 3 s; jeśli dojdzie później, tekstury z napisami
// rysują się jeszcze raz (inaczej napisy na polach zostawały w zapasowej czcionce).
const modelsReady = loadModels();   // modele z Blendera wczytują się razem z czcionką
let fontsOk = false;
const fontsLoaded = Promise.all([
  // z polskimi literami w tekście: przeglądarka pobiera też zestaw latin-ext (inaczej „ą”, „ł”, „ż” na planszy
  // mogły się rysować w zapasowej czcionce)
  document.fonts.load('700 120px Figtree', 'Aąćęłńóśźż ĄĆĘŁŃÓŚŹŻ'),
  document.fonts.load('600 30px Figtree', 'Aąćęłńóśźż ĄĆĘŁŃÓŚŹŻ'),
]).then(() => { fontsOk = true; }, () => {});
await Promise.race([fontsLoaded, new Promise(r => setTimeout(r, 3000))]);
const fontsLate = !fontsOk;
await Promise.race([modelsReady, new Promise(r => setTimeout(r, 2500))]);   // modele z Blendera są potrzebne już do makiety

// Logo uczelni. Plik jest okrągły na białym tle, więc rysujemy je przycięte do koła.
// Kolory logo: granat i jasny szaroniebieski.
const UNI_NAVY = '#00276F';
const UNI_LIGHT = '#CCD3E1';
const logoImg = new Image();
let logoOk = false;
if (location.protocol !== 'file:') {   // otwarta z pliku przeglądarka nie pozwala użyć obrazka w teksturach 3D
  logoImg.src = 'assets/logo-wsiz.png';
  try { await logoImg.decode(); logoOk = logoImg.naturalWidth > 0; } catch (e) { /* bez logo zostaje napis */ }
}
function drawLogo(g, cx, cy, r) {
  if (!logoOk) return false;
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  g.drawImage(logoImg, cx - r, cy - r, r * 2, r * 2);
  g.restore();
  return true;
}
// Logo w jednym kolorze: granatowe na jasnym tle, białe na ciemnym.
// Ciemne elementy logo są pełne, jasny szaroniebieski zostaje delikatnym odcieniem, białe tło znika.
// gain: im mniejszy, tym logo pełniejsze i bardziej wyraziste.
const logoInkCache = new Map();
function logoInk(color, gain = 200) {
  const key = `${color}|${gain}`;
  if (!logoInkCache.has(key)) {
    const [c, g] = makeCanvas(logoImg.naturalWidth, logoImg.naturalHeight);
    g.drawImage(logoImg, 0, 0);
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const n = parseInt(color.slice(1), 16);
    for (let i = 0; i < d.length; i += 4) {
      const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i + 3] = Math.round(Math.min(1, Math.pow(Math.max(0, 255 - L) / gain, 0.7)) * 255);   // pogrubia cienkie linie przy małym logo
      d[i] = n >> 16; d[i + 1] = (n >> 8) & 255; d[i + 2] = n & 255;
    }
    g.putImageData(img, 0, 0);
    logoInkCache.set(key, c);
  }
  return logoInkCache.get(key);
}
function drawLogoInk(g, cx, cy, r, color, gain) {
  if (!logoOk) return false;
  g.imageSmoothingQuality = 'high';
  g.drawImage(logoInk(color, gain), cx - r, cy - r, r * 2, r * 2);
  return true;
}

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = LOOK.env;

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minPolarAngle = 0;
controls.maxPolarAngle = 1.2;   // można obracać na boki i patrzeć z góry, ale nie od spodu
controls.minDistance = 5;

const hemi = new THREE.HemisphereLight(LOOK.hemi[0], LOOK.hemi[1], LOOK.hemi[2]);
scene.add(hemi);
const sun = new THREE.DirectionalLight(LOOK.sun[0], LOOK.sun[1]);
sun.position.set(...LOOK.sun[2]);
sun.castShadow = true;
const lowEnd = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;
sun.shadow.mapSize.set(lowEnd ? 2048 : 4096, lowEnd ? 2048 : 4096);   // poziom jakości (gfx) ustawia to później
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 3;
scene.add(sun);

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------
const maxAniso = renderer.getMaxAnisotropy();
function mat(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...o }); }
function mesh(geo, material, cast = true, receive = false) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}
function mix(hex, other, a) { return '#' + new THREE.Color(hex).lerp(new THREE.Color(other), a).getHexString(); }
function gradientTexture(top, bottom) {
  const [c, g] = makeCanvas(4, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, top); grad.addColorStop(1, bottom);
  g.fillStyle = grad; g.fillRect(0, 0, 4, 512);
  return tex(c);
}
// Ziarno papieru albo szum materiału
function noiseCanvas(size, amount) {
  const [c, g] = makeCanvas(size, size);
  const img = g.createImageData(size, size);
  for (let k = 0; k < img.data.length; k += 4) {
    const v = 255 - Math.random() * amount * 255;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function addGrain(g, w, h, amount) {
  if (!amount) return;
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = g.createPattern(noiseCanvas(256, amount), 'repeat');
  g.fillRect(0, 0, w, h);
  g.restore();
}
// Miękki cień pod planszą, żeby nie wisiała w powietrzu
function contactShadowTexture() {
  const s = 512;
  const [c, g] = makeCanvas(s, s);
  g.shadowColor = 'rgba(0,0,0,1)'; g.shadowBlur = 60; g.shadowOffsetX = s * 2;
  g.fillStyle = '#000';
  g.beginPath(); g.roundRect(-s * 2 + 70, 70, s - 140, s - 140, 30); g.fill();
  const t = new THREE.CanvasTexture(c);
  return t;
}
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const tweens = [];
function tween(dur, update) {
  return new Promise(resolve => tweens.push({ start: performance.now(), dur, update, resolve }));
}
function runTweens(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    const p = Math.min(1, (now - tw.start) / tw.dur);
    tw.update(p);
    if (p >= 1) { tweens.splice(i, 1); tw.resolve(); }
  }
}

// Wspólne materiały
const goldMat = mat(GOLD, { metalness: 0.7, roughness: 0.3 });
const aluMat = mat('#C9CFDA', { metalness: 0.55, roughness: 0.35 });
const bezelMat = mat('#161A24', { roughness: 0.4 });
const flags = [];
const steams = [];
const coins = [];
const liveParts = [];   // ruchome części modeli z Blendera: wentylatory, rosnący wydruk, głowica drukarki
const sceneParts = { flags, steams, coins, parts: liveParts };
// Ruch części modeli: flagi falują, para i płomień migocą, monety i wentylatory się kręcą, wydruk rośnie.
// Ten sam ruch w scenie gry (sceneParts) i w podglądzie pionków w menu (każdy pionek ma tam własne listy).
function animateParts(set, t, dt) {
  for (const f of set.flags) {
    const pos = f.geo.attributes.position;
    for (let j = 0; j < pos.count; j++) {
      const x = f.base[j * 3], y = f.base[j * 3 + 1];
      pos.setZ(j, 0.035 * (x / f.width) * Math.sin(x * 14 - t * 3.2 + y * 3));
    }
    pos.needsUpdate = true;
    f.geo.computeVertexNormals();
  }
  for (const s of set.steams) {
    s.material.opacity = 0.28 + 0.2 * Math.sin(t * 2 + s.userData.phase);
    s.position.y = 0.02 * Math.sin(t * 1.5 + s.userData.phase);
  }
  for (const c of set.coins) { c.rotation.y += dt * 2.2; c.position.y = 0.52 + 0.02 * Math.sin(t * 2); }
  for (const p of set.parts) {
    if (p.kind === 'fan') p.obj.rotateY(dt * 16);
    else if (p.kind === 'print') p.obj.scale.y = 0.12 + 0.88 * Math.min(1, ((t * 0.07 + p.phase) % 1.15));   // wydruk rośnie i zaczyna od nowa
    else if (p.kind === 'slide') p.obj.position.x = p.x0 + 0.035 * Math.sin(t * 2.1 + p.phase);
    else if (p.kind === 'flame') p.obj.scale.set(1, 0.8 + 0.2 * Math.sin(t * 23 + p.phase) + 0.1 * Math.sin(t * 37), 1);   // płomień rakiety migocze
  }
}
// Podgląd pionków w menu (src/render/preview.js): pionek ma własne listy ruchomych części, poza sceną gry
const preview = new PawnPreview({ spin: !reduceMotion, onDrop: dropPreviewPawn });
function previewPawn(k, hex) {
  const n = { flags: flags.length, steams: steams.length, coins: coins.length, parts: liveParts.length };
  const o = PLAYERS[k].make(hex);
  o.userData.anim = { flags: flags.splice(n.flags), steams: steams.splice(n.steams), coins: coins.splice(n.coins), parts: liveParts.splice(n.parts) };
  return o;
}
function dropPreviewPawn(o) {
  const a = o.userData.anim;
  o.traverse(m => { if (m.isMesh && a.flags.some(f => f.geo === m.geometry)) { m.material.map?.dispose(); m.material.dispose(); } });
  for (const st of a.steams) st.material.dispose();
  disposeTree(o);   // siatki z pliku GLB są wspólne i zostają
}
// Płótna podglądu zostają między przerysowaniami kart, więc pionek nie powstaje od nowa przy każdym kliknięciu
const stageCanvases = new Map();
function stageCanvas(key) {
  if (!stageCanvases.has(key)) {
    const c = document.createElement('canvas');
    c.className = 'm-stage-cv';
    c.setAttribute('aria-hidden', 'true');
    stageCanvases.set(key, c);
  }
  return stageCanvases.get(key);
}

// ---------------------------------------------------------------------------
// Tekstury pól
// ---------------------------------------------------------------------------
function rotatedText(g, w, h, fn) {
  g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 4); fn(); g.restore();
}
// Tekst zawijany do 2 linii; czcionka maleje, aż się zmieści
function drawLines(g, text, x, y, maxW, size, weight = 700) {
  let lines;
  for (;;) {
    g.font = `${weight} ${size}px ${UI_FONT}`;
    lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (line && g.measureText(t).width > maxW) { lines.push(line); line = word; } else line = t;
    }
    lines.push(line);
    const widest = Math.max(...lines.map(l => g.measureText(l).width));
    if ((lines.length <= 2 && widest <= maxW) || size <= 26) break;
    size -= 4;
  }
  const lh = size * 1.02;
  lines.forEach((l, k) => g.fillText(l, x, y + (k - (lines.length - 1) / 2) * lh));
}
function drawChandelier(g, x, y) {
  g.save(); g.translate(x, y);
  g.strokeStyle = GOLD; g.fillStyle = GOLD; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, -78); g.lineTo(0, 30); g.stroke();
  g.beginPath(); g.moveTo(-90, 0); g.quadraticCurveTo(0, 70, 90, 0); g.stroke();
  g.beginPath(); g.arc(0, 40, 13, 0, Math.PI * 2); g.fill();
  for (const [cx, cy] of [[-90, 0], [-45, 26], [45, 26], [90, 0]]) {
    g.fillStyle = '#FFFFFF'; g.fillRect(cx - 6, cy - 32, 12, 30);
    g.fillStyle = '#FFD166'; g.beginPath(); g.ellipse(cx, cy - 44, 8, 12, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
// Sala senatu: fasada z kolumnami
function drawSenate(g, x, y) {
  g.save(); g.translate(x, y);
  g.fillStyle = GOLD;
  g.beginPath(); g.moveTo(-96, -34); g.lineTo(0, -84); g.lineTo(96, -34); g.closePath(); g.fill();   // tympanon
  g.fillStyle = '#5C1B2F'; g.beginPath(); g.arc(0, -50, 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = GOLD;
  g.fillRect(-92, -30, 184, 14);
  for (let k = 0; k < 5; k++) g.fillRect(-80 + k * 36, -12, 16, 72);   // kolumny
  g.fillRect(-100, 62, 200, 12);
  g.fillRect(-110, 76, 220, 12);
  g.restore();
}
function drawVase(g, x, y) {
  g.save(); g.translate(x, y);
  g.fillStyle = '#D9895B'; g.strokeStyle = GOLD; g.lineWidth = 6;
  g.beginPath();   // wazon z koła garncarskiego
  g.moveTo(-26, -78); g.lineTo(26, -78);
  g.bezierCurveTo(22, -50, 72, -30, 70, 12);
  g.bezierCurveTo(68, 52, 38, 72, 30, 78);
  g.lineTo(-30, 78);
  g.bezierCurveTo(-38, 72, -68, 52, -70, 12);
  g.bezierCurveTo(-72, -30, -22, -50, -26, -78);
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#B86A3E';
  g.beginPath(); g.ellipse(0, -78, 30, 8, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(-64, 0); g.bezierCurveTo(-30, 14, 30, 14, 64, 0); g.stroke();
  g.beginPath(); g.moveTo(-58, 30); g.bezierCurveTo(-26, 42, 26, 42, 58, 30); g.stroke();
  g.restore();
}
function drawServerRack(g, x, y) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.strokeStyle = GOLD; g.lineWidth = 6;
  g.beginPath(); g.roundRect(-70, -80, 140, 160, 10); g.fill(); g.stroke();
  for (let k = 0; k < 4; k++) {
    const yy = -64 + k * 38;
    g.fillStyle = '#2A2326'; g.beginPath(); g.roundRect(-56, yy, 112, 28, 5); g.fill();
    g.fillStyle = k % 2 ? '#7FD1FF' : '#9FE0A8'; g.beginPath(); g.arc(-40, yy + 14, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FFD166'; g.beginPath(); g.arc(-26, yy + 14, 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3;
    for (let n = 0; n < 4; n++) { g.beginPath(); g.moveTo(-6 + n * 14, yy + 7); g.lineTo(-6 + n * 14, yy + 21); g.stroke(); }
  }
  g.restore();
}
function drawPot(g, x, y) {
  g.save(); g.translate(x, y);
  g.strokeStyle = 'rgba(224,123,57,.5)'; g.lineWidth = 6; g.lineCap = 'round';
  for (const sx of [-26, 0, 26]) {   // para
    g.beginPath(); g.moveTo(sx, -44); g.bezierCurveTo(sx - 12, -60, sx + 12, -72, sx, -90); g.stroke();
  }
  g.fillStyle = '#E07B39';
  g.beginPath(); g.roundRect(-70, -22, 140, 84, [8, 8, 26, 26]); g.fill();
  g.fillStyle = '#C4652A';
  g.beginPath(); g.roundRect(-80, -34, 160, 16, 8); g.fill();
  g.beginPath(); g.roundRect(-14, -46, 28, 14, 6); g.fill();
  g.beginPath(); g.roundRect(-96, -6, 28, 14, 6); g.fill();
  g.beginPath(); g.roundRect(68, -6, 28, 14, 6); g.fill();
  g.restore();
}
function drawExamSheet(g, x, y) {
  g.save(); g.translate(x, y); g.rotate(-0.06);
  g.fillStyle = '#FFFFFF'; g.strokeStyle = '#C9D0DC'; g.lineWidth = 4;
  g.beginPath(); g.roundRect(-62, -82, 124, 164, 8); g.fill(); g.stroke();
  g.strokeStyle = '#D5DBE6'; g.lineWidth = 5;
  for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-44, -54 + k * 22); g.lineTo(k === 4 ? 0 : 44, -54 + k * 22); g.stroke(); }
  g.strokeStyle = '#D6534F'; g.lineWidth = 7; g.beginPath(); g.arc(26, 46, 30, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#D6534F'; g.font = `700 50px ${UI_FONT}`; g.fillText('2', 26, 49);   // ocena 2 = niezdany
  g.restore();
}
function drawCorner(g, i, w, h) {
  if (i === 0) {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#2BAE74'); grad.addColorStop(1, '#17784F');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // strzałka w kierunku ruchu
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    g.moveTo(80, h - 110); g.lineTo(170, h - 165); g.lineTo(170, h - 132);
    g.lineTo(w - 80, h - 132); g.lineTo(w - 80, h - 88); g.lineTo(170, h - 88);
    g.lineTo(170, h - 55); g.closePath(); g.fill();
    rotatedText(g, w, h, () => {
      g.fillStyle = '#FFFFFF'; g.font = `700 128px ${UI_FONT}`; g.fillText('START', 0, -20);
      g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `600 40px ${UI_FONT}`; g.fillText(`POLE ${i + 1}`, 0, 70);
    });
  } else if (i === SIDE) {
    g.fillStyle = '#FFF4E2'; g.fillRect(0, 0, w, h);
    rotatedText(g, w, h, () => {
      g.strokeStyle = NAVY; g.lineWidth = 10;
      g.beginPath(); g.arc(0, -135, 62, 0, Math.PI * 2); g.stroke();
      g.fillStyle = NAVY; g.font = `700 70px ${UI_FONT}`; g.fillText('D', 0, -130);
      g.font = `700 92px ${UI_FONT}`; g.fillText('DZIEKANAT', 0, 0);
      g.fillStyle = '#7A849C'; g.font = `600 40px ${UI_FONT}`; g.fillText(`POLE ${i + 1}`, 0, 85);
    });
  } else if (i === 2 * SIDE) {
    g.fillStyle = '#FFF4D2'; g.fillRect(0, 0, w, h);
    rotatedText(g, w, h, () => {
      for (let k = 0; k < 3; k++) {   // stos monet
        const y = -120 - k * 28;
        g.fillStyle = '#B98A2A'; g.beginPath(); g.ellipse(0, y + 10, 74, 26, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = GOLD; g.beginPath(); g.ellipse(0, y, 74, 26, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = NAVY; g.font = `700 80px ${UI_FONT}`;
      g.fillText('STYPENDIUM', 0, 5); g.fillText('REKTORSKIE', 0, 85);
      g.fillStyle = '#8A7440'; g.font = `600 38px ${UI_FONT}`; g.fillText(`POLE ${i + 1}`, 0, 160);
    });
  } else {
    g.fillStyle = '#FDE9E7'; g.fillRect(0, 0, w, h);
    rotatedText(g, w, h, () => {
      g.fillStyle = '#D6534F'; g.beginPath(); g.arc(0, -150, 62, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.moveTo(-32, -162); g.lineTo(4, -162); g.lineTo(4, -186); g.lineTo(40, -150);
      g.lineTo(4, -114); g.lineTo(4, -138); g.lineTo(-32, -138); g.closePath(); g.fill();
      g.fillStyle = NAVY; g.font = `700 58px ${UI_FONT}`; g.fillText('UDAJ SIĘ DO', 0, -35);
      g.font = `700 88px ${UI_FONT}`; g.fillText('DZIEKANATU', 0, 45);
      g.fillStyle = '#A0706C'; g.font = `600 38px ${UI_FONT}`; g.fillText(`POLE ${i + 1}`, 0, 125);
    });
  }
}
// Tekstury pól: rysunek 384 × 640 (narożnik 640 × 640) w skali 1,5x na komputerze i 2x na ekranach 4K i 5K,
// żeby napisy były ostre także przy najeździe kamery i na poziomie Ultra
const TILE_SCALE = lowEnd ? 1 : Math.max(screen.width, screen.height) * (devicePixelRatio || 1) >= 3400 ? 2 : 1.5;
function tileTexture(i) {
  const corner = i % SIDE === 0;
  const field = FIELDS[i];
  const w = corner ? 640 : 384, h = 640;
  const [c, g] = makeCanvas(Math.round(w * TILE_SCALE), Math.round(h * TILE_SCALE));
  g.scale(TILE_SCALE, TILE_SCALE);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = LOOK.paper; g.fillRect(0, 0, w, h);
  if (corner) {
    drawCorner(g, i, w, h);
  } else {
    const type = field ? field.type : 'blank';
    let numColor = NAVY;
    if (type === 'room' || type === 'blank') {
      const grp = field && GROUPS[field.group];
      const band = grp ? grp.color : NO_GROUP;   // pas w kolorze grupy
      g.fillStyle = mix(band, '#ffffff', 0.72); g.fillRect(0, 0, w, h * 0.34);   // działka na budynki
      g.fillStyle = band; g.fillRect(0, 0, w, grp ? 92 : 64);
      if (grp) { g.fillStyle = '#FFFFFF'; g.font = `700 38px ${UI_FONT}`; g.fillText(grp.name.toUpperCase(), w / 2, 48); }
      if (field) { g.fillStyle = NAVY; drawLines(g, field.name.toUpperCase(), w / 2, h * 0.46, w - 36, 66); }
    } else if (type === 'tax') {
      g.fillStyle = '#FFF7E6'; g.fillRect(0, 0, w, h);
      g.fillStyle = NO_GROUP; g.fillRect(0, 0, w, 20);
      for (let k = 0; k < 2; k++) {   // banknoty
        g.save();
        g.translate(w / 2 + (k ? 14 : -10), h * 0.22 + (k ? 10 : -6));
        g.rotate(k ? 0.12 : -0.1);
        g.fillStyle = k ? '#4FA36B' : '#3E8A58'; g.beginPath(); g.roundRect(-92, -48, 184, 96, 10); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 4; g.beginPath(); g.roundRect(-80, -36, 160, 72, 6); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.fillStyle = NAVY; g.font = `700 66px ${UI_FONT}`; g.fillText('CZESNE', w / 2, h * 0.45);
      g.fillStyle = '#B4533F'; g.font = `700 32px ${UI_FONT}`; g.fillText('ZAPŁAĆ DO PULI', w / 2, h * 0.55);
    } else if (type === 'special') {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#9A3550'); grad.addColorStop(1, '#5C1B2F');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.strokeStyle = GOLD; g.lineWidth = 6; g.strokeRect(16, 16, w - 32, h - 32);
      if (field.icon === 'server') drawServerRack(g, w / 2, h * 0.2);
      else if (field.icon === 'vase') drawVase(g, w / 2, h * 0.2);
      else if (field.icon === 'senate') drawSenate(g, w / 2, h * 0.2);
      else drawChandelier(g, w / 2, h * 0.2);
      g.fillStyle = '#FFFFFF'; drawLines(g, field.name.toUpperCase(), w / 2, h * 0.47, w - 52, 64);
      g.fillStyle = GOLD; g.font = `700 32px ${UI_FONT}`; g.fillText(`SPECJALNE ${field.no}/4`, w / 2, h * 0.61);
      numColor = GOLD;
    } else if (type === 'chance') {
      g.fillStyle = NO_GROUP; g.fillRect(0, 0, w, 20);
      const cy = h * 0.24;
      g.fillStyle = '#2E9E8A'; g.beginPath(); g.arc(w / 2, cy, 80, Math.PI / 2, Math.PI * 1.5); g.fill();
      g.fillStyle = '#D6534F'; g.beginPath(); g.arc(w / 2, cy, 80, -Math.PI / 2, Math.PI / 2); g.fill();
      g.fillStyle = '#FFFFFF'; g.font = `700 116px ${UI_FONT}`; g.fillText('?', w / 2, cy + 6);
      g.fillStyle = NAVY; g.font = `700 62px ${UI_FONT}`; g.fillText('SZANSA', w / 2, h * 0.45);
      g.font = `700 30px ${UI_FONT}`;
      g.fillStyle = '#2E9E8A'; g.fillText('DOBRZE: UŁATWIENIE', w / 2, h * 0.54);
      g.fillStyle = '#D6534F'; g.fillText('ŹLE: UTRUDNIENIE', w / 2, h * 0.595);
    } else if (type === 'earn') {
      g.fillStyle = '#FFF3E6'; g.fillRect(0, 0, w, h);
      g.fillStyle = NO_GROUP; g.fillRect(0, 0, w, 20);
      drawPot(g, w / 2, h * 0.25);
      g.fillStyle = NAVY; drawLines(g, field.name.toUpperCase(), w / 2, h * 0.45, w - 44, 60);
      g.fillStyle = '#C4652A'; g.font = `700 32px ${UI_FONT}`; g.fillText('POLE ZAROBKOWE', w / 2, h * 0.55);
    } else if (type === 'station') {
      g.fillStyle = '#EEF4FB'; g.fillRect(0, 0, w, h);
      g.fillStyle = NO_GROUP; g.fillRect(0, 0, w, 20);
      const cy = h * 0.24;   // znak parkingu
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(w / 2 - 86, cy - 86, 172, 172, 22); g.fill();
      g.fillStyle = '#1F5FBF'; g.beginPath(); g.roundRect(w / 2 - 76, cy - 76, 152, 152, 16); g.fill();
      g.fillStyle = '#FFFFFF'; g.font = `700 130px ${UI_FONT}`; g.fillText('P', w / 2, cy + 6);
      g.fillStyle = NAVY; drawLines(g, field.name.toUpperCase(), w / 2, h * 0.45, w - 44, 60);
      g.fillStyle = '#1F5FBF'; g.font = `700 32px ${UI_FONT}`; g.fillText(`STACJA ${field.no}/2`, w / 2, h * 0.55);
      g.font = `700 28px ${UI_FONT}`; g.fillText('Z BONUSAMI', w / 2, h * 0.6);
    } else if (type === 'exam') {
      g.fillStyle = '#FBF1F0'; g.fillRect(0, 0, w, h);
      g.fillStyle = NO_GROUP; g.fillRect(0, 0, w, 20);
      drawExamSheet(g, w / 2, h * 0.21);
      g.fillStyle = NAVY; drawLines(g, field.name.toUpperCase(), w / 2, h * 0.47, w - 44, 50);
      g.fillStyle = '#B4533F'; g.font = `700 32px ${UI_FONT}`; g.fillText('PYTANIE', w / 2, h * 0.59);
    } else if (type === 'todo') {
      g.fillStyle = '#F2F4F8'; g.fillRect(0, 0, w, h);
      g.setLineDash([18, 12]); g.strokeStyle = '#B7BFCE'; g.lineWidth = 5; g.strokeRect(22, 22, w - 44, h - 44); g.setLineDash([]);
      g.fillStyle = '#9AA3B5'; g.font = `700 110px ${UI_FONT}`; g.fillText('?', w / 2, h * 0.27);
      g.font = `700 38px ${UI_FONT}`; g.fillText('DO USTALENIA', w / 2, h * 0.45);
      numColor = '#8A93A8';
    }
    g.fillStyle = numColor;
    g.font = `700 ${field ? 96 : 150}px ${UI_FONT}`;
    g.fillText(String(i + 1), w / 2, field ? h * 0.83 : h * 0.745);
  }
  g.strokeStyle = 'rgba(30,42,71,.14)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  return tex(c);
}
function centerBackground(g, s) {
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const grad = g.createRadialGradient(s / 2, s / 2, 100, s / 2, s / 2, s * 0.75);
  grad.addColorStop(0, '#6DB84A'); grad.addColorStop(1, '#468F2E');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(255,255,255,.06)';   // pasy po koszeniu
  for (let x = -s; x < s * 2; x += 256) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 128, 0); g.lineTo(x + 128 - s, s); g.lineTo(x - s, s); g.closePath(); g.fill();
  }
  for (let k = 0; k < 9000; k++) {   // źdźbła
    g.fillStyle = rnd() < 0.5 ? 'rgba(40,110,30,.22)' : 'rgba(190,240,140,.18)';
    g.fillRect(rnd() * s, rnd() * s, 3, 7);
  }
}
// Wzór z logo uczelni: ukośne taśmy biegnące z lewego dolnego do prawego górnego rogu.
// Na każdej taśmie stoi rząd małych logo, każde kolejne trochę wyżej. Samo logo się nie obraca.
function logoRibbons(g, w, h, { band, bg, tape, edge, ink, inkGain, logoAlpha = 1 }) {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const period = band * 1.55;          // taśma + przerwa
  const r = band * 0.36, step = r * 2.6;
  const c = Math.SQRT1_2;
  const L = Math.hypot(w, h) / 2 + period;
  const n = Math.ceil(L / period);
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(-Math.PI / 4);
  for (let k = -n; k <= n; k++) {
    const y = k * period - band / 2;
    g.fillStyle = tape; g.fillRect(-L, y, 2 * L, band);
    if (edge) {
      g.fillStyle = edge;
      g.fillRect(-L, y, 2 * L, band * 0.05);
      g.fillRect(-L, y + band * 0.95, 2 * L, band * 0.05);
    }
  }
  g.restore();
  g.globalAlpha = logoAlpha;
  for (let k = -n; k <= n; k++) {
    const v = k * period;
    for (let u = -L + (k % 2) * step / 2; u <= L; u += step) {
      const x = w / 2 + (u + v) * c, y = h / 2 + (v - u) * c;   // punkt na taśmie, logo rysowane prosto
      if (x < -r || x > w + r || y < -r || y > h + r) continue;
      if (ink) drawLogoInk(g, x, y, r, ink, inkGain); else drawLogo(g, x, y, r);
    }
  }
  g.globalAlpha = 1;
}

// Tył kart w kolorach uczelni: ułatwienia białe z granatowym logo, utrudnienia granatowe z białym logo.
// Jak na kartach do gry: gładki margines, w środku ukośne taśmy z logo, podwójna ramka.
const CARD_BACKS = {
  ulatwienia: { bg: '#FFFFFF', tape: '#EDF1F8', ink: UNI_NAVY, inkGain: 105, frame: UNI_NAVY },   // pełniejsze, wyraziste logo
  utrudnienia: { bg: UNI_NAVY, tape: '#0B348F', ink: '#FFFFFF', frame: '#FFFFFF' },
};
function drawCardBack(g, w, h, kind) {
  const b = CARD_BACKS[kind];
  const m1 = w * 0.05, m2 = w * 0.075;
  g.fillStyle = b.bg; g.fillRect(0, 0, w, h);
  g.save();
  g.beginPath(); g.roundRect(m2, m2, w - 2 * m2, h - 2 * m2, w * 0.03); g.clip();
  logoRibbons(g, w, h, { band: w * 0.13, bg: b.bg, tape: b.tape, ink: b.ink, inkGain: b.inkGain });
  g.restore();
  g.strokeStyle = b.frame;
  g.lineWidth = w * 0.011;
  g.beginPath(); g.roundRect(m1, m1, w - 2 * m1, h - 2 * m1, w * 0.045); g.stroke();
  g.lineWidth = w * 0.0045;
  g.beginPath(); g.roundRect(m2, m2, w - 2 * m2, h - 2 * m2, w * 0.03); g.stroke();
}
const backUrls = {};
function cardBackUrl(kind) {   // obrazek tyłu karty do widoku „Karty”
  if (!backUrls[kind]) {
    const [c, g] = makeCanvas(1260, 1760);
    drawCardBack(g, 1260, 1760, kind);
    backUrls[kind] = c.toDataURL('image/jpeg', 0.9);
  }
  return backUrls[kind];
}

// Logo uczelni w medalionie na środku planszy
function medallion(g, cx, cy) {
  const R = 440;
  g.save();
  g.shadowColor = 'rgba(0,0,0,.28)'; g.shadowBlur = 48; g.shadowOffsetY = 14;
  g.fillStyle = '#FFFFFF';
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.restore();
  g.lineWidth = 16; g.strokeStyle = UNI_NAVY;
  g.beginPath(); g.arc(cx, cy, R - 8, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 6; g.strokeStyle = UNI_LIGHT;
  g.beginPath(); g.arc(cx, cy, R - 28, 0, Math.PI * 2); g.stroke();
  if (!drawLogo(g, cx, cy, R - 46)) {
    g.fillStyle = 'rgba(30,42,71,.5)'; g.font = `700 124px ${UI_FONT}`;
    g.fillText('LOGO', cx, cy - 68); g.fillText('UCZELNI', cx, cy + 76);
  }
}

function centerTexture() {
  const s = 2048;
  const [c, g] = makeCanvas(s, s);
  centerBackground(g, s);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  medallion(g, s / 2, s / 2);
  // miejsca na stosy kart (widoczne też na wydruku planszy)
  const px = s / INNER;
  for (const deck of DECKS) {
    g.save();
    g.translate(s / 2 + deck.x * px, s / 2 + deck.z * px);
    g.rotate(-deck.rotY);
    const w = (CARD_W + 0.16) * px, l = (CARD_L + 0.16) * px;
    g.fillStyle = mix(deck.color, '#ffffff', 0.82);
    g.beginPath(); g.roundRect(-w / 2, -l / 2, w, l, 28); g.fill();
    g.setLineDash([26, 18]); g.strokeStyle = deck.color; g.lineWidth = 8; g.stroke(); g.setLineDash([]);
    g.font = `700 58px ${UI_FONT}`;
    const lw = g.measureText(deck.title).width + 70;
    g.fillStyle = deck.color;
    g.beginPath(); g.roundRect(-lw / 2, l / 2 + 22, lw, 84, 42); g.fill();
    g.fillStyle = '#FFFFFF'; g.fillText(deck.title, 0, l / 2 + 66);
    g.restore();
  }
  return tex(c);
}
// ---------------------------------------------------------------------------
// Modele: pionki
// ---------------------------------------------------------------------------
// Podest pionka: lakierowany granat uczelni, pas w kolorze gracza i jasna płytka ze srebrnym rantem
const UNI_LACQUER = new THREE.MeshPhysicalMaterial({ color: '#00276F', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18 });
const UNI_PLATE = new THREE.MeshStandardMaterial({ color: '#CCD3E1', roughness: 0.35, metalness: 0.25 });
function pawnBase(color) {
  const g = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(0.205, 0.225, 0.045, 48), UNI_LACQUER);
  base.position.y = 0.0225;
  const band = mesh(new THREE.CylinderGeometry(0.207, 0.207, 0.014, 48), mat(color, { roughness: 0.35, emissive: color, emissiveIntensity: 0.12 }));
  band.position.y = 0.052;
  const plate = mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.012, 48), UNI_PLATE);
  plate.position.y = 0.065;
  const rim = mesh(new THREE.TorusGeometry(0.193, 0.006, 8, 48), aluMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.071;
  g.add(base, band, plate, rim);
  return g;
}
// Paleta pionka: bryła w kolorze gracza, ciemne części w granacie uczelni, jasne w jej szaroniebieskim
const pawnPalCache = new Map();
function pawnPal(color) {
  if (!pawnPalCache.has(color)) {
    pawnPalCache.set(color, {
      main: new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
      dark: mat('#0A2A66', { roughness: 0.45 }),
      light: mat('#DDE3EE', { roughness: 0.4 }),
    });
  }
  return pawnPalCache.get(color);
}

function bannerTexture(color) {
  const [c, g] = makeCanvas(256, 240);
  g.fillStyle = color; g.fillRect(0, 0, 256, 240);
  g.strokeStyle = GOLD; g.lineWidth = 9; g.strokeRect(14, 12, 228, 196);
  g.fillStyle = GOLD;
  for (let x = 0; x < 256; x += 16) { g.beginPath(); g.moveTo(x, 216); g.lineTo(x + 8, 240); g.lineTo(x + 16, 216); g.fill(); }
  // logo uczelni na fladze
  g.fillStyle = '#FFFFFF';
  g.beginPath(); g.arc(128, 110, 66, 0, Math.PI * 2); g.fill();
  if (!drawLogo(g, 128, 110, 62)) {
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 34px ${UI_FONT}`; g.fillText('LOGO', 128, 110);
  }
  return tex(c);
}
function makeBanner(color) {
  const g = new THREE.Group();
  g.add(pawnBase(color));
  const px = -0.1;
  const foot = mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.05, 20), goldMat); foot.position.set(px, 0.095, 0);
  const pole = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.86, 12), goldMat); pole.position.set(px, 0.5, 0);
  const knob = mesh(new THREE.SphereGeometry(0.034, 16, 12), goldMat); knob.position.set(px, 0.955, 0);
  const tip = mesh(new THREE.ConeGeometry(0.022, 0.08, 12), goldMat); tip.position.set(px, 1.02, 0);
  g.add(foot, pole, knob, tip, bannerFlag(color, px));
  return g;
}
// Flaga sztandaru z logo uczelni, falująca na wietrze (fale liczone w każdej klatce)
function bannerFlag(color, px) {
  const geo = new THREE.PlaneGeometry(0.36, 0.34, 18, 6);
  geo.translate(0.18, 0, 0);
  const flag = mesh(geo, new THREE.MeshStandardMaterial({ map: bannerTexture(color), side: THREE.DoubleSide, roughness: 0.75 }));
  flag.position.set(px + 0.014, 0.73, 0);
  flags.push({ geo, base: Float32Array.from(geo.attributes.position.array), width: 0.36 });
  return flag;
}

// Drukarka 3D: rama w kolorze gracza, stół, głowica i wydruk
function makePrinter(color) {
  const p = pawnPal(color);
  const g = new THREE.Group();
  g.add(pawnBase(color));
  const y0 = 0.07, W = 0.3, H = 0.4;
  const base = mesh(new RoundedBoxGeometry(W, 0.06, W, 2, 0.01), p.main); base.position.y = y0 + 0.03;
  g.add(base);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // słupki ramy
    const post = mesh(new THREE.BoxGeometry(0.03, H, 0.03), p.main);
    post.position.set(x * (W / 2 - 0.015), y0 + 0.06 + H / 2, z * (W / 2 - 0.015));
    g.add(post);
  }
  const roof = mesh(new THREE.BoxGeometry(W, 0.03, W), p.main); roof.position.y = y0 + 0.06 + H;
  const bed = mesh(new THREE.BoxGeometry(W - 0.07, 0.015, W - 0.07), p.dark); bed.position.y = y0 + 0.1;
  const rail = mesh(new THREE.BoxGeometry(W - 0.03, 0.02, 0.02), p.light); rail.position.set(0, y0 + 0.32, 0);
  const head = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), p.light); head.position.set(0.03, y0 + 0.29, 0);
  const nozzle = mesh(new THREE.ConeGeometry(0.012, 0.03, 10), goldMat); nozzle.rotation.x = Math.PI; nozzle.position.set(0.03, y0 + 0.245, 0);
  const pts = [[0, 0], [0.045, 0], [0.05, 0.03], [0.035, 0.07], [0.04, 0.1], [0, 0.1]].map(([x, y]) => new THREE.Vector2(x, y));
  const print = mesh(new THREE.LatheGeometry(pts, 24), p.light); print.position.set(0.03, y0 + 0.108, 0);   // wydruk na stole
  const spool = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 28), p.dark); spool.rotation.z = Math.PI / 2; spool.position.set(0, y0 + 0.06 + H + 0.085, 0);
  const fil = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.052, 28), p.light); fil.rotation.z = Math.PI / 2; fil.position.copy(spool.position);
  const holder = mesh(new THREE.BoxGeometry(0.02, 0.07, 0.02), p.dark); holder.position.set(0, y0 + 0.06 + H + 0.035, 0);
  g.add(roof, bed, rail, head, nozzle, print, holder, spool, fil);
  return g;
}

// Koparka kryptowalut: otwarta rama z kartami graficznymi i złotą monetą nad nią
function makeMiner(color) {
  const p = pawnPal(color);
  const g = new THREE.Group();
  g.add(pawnBase(color));
  const y0 = 0.07;
  const plate = mesh(new THREE.BoxGeometry(0.34, 0.025, 0.24), p.dark); plate.position.y = y0 + 0.0125;
  g.add(plate);
  for (const x of [-0.16, 0.16]) for (const z of [-0.1, 0.1]) {
    const post = mesh(new THREE.BoxGeometry(0.02, 0.26, 0.02), p.main); post.position.set(x, y0 + 0.155, z); g.add(post);
  }
  const top = mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), p.main); top.position.y = y0 + 0.29;
  g.add(top);
  const fanMat = new THREE.MeshBasicMaterial({ color: mix(color, '#ffffff', 0.55), toneMapped: false });
  for (let k = 0; k < 3; k++) {   // karty graficzne z wentylatorami
    const x = -0.09 + k * 0.09;
    const card = mesh(new THREE.BoxGeometry(0.04, 0.2, 0.2), p.main); card.position.set(x, y0 + 0.13, 0);
    g.add(card);
    for (const z of [-0.05, 0.05]) {
      const fan = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), fanMat);
      fan.rotation.y = Math.PI / 2; fan.position.set(x + 0.021, y0 + 0.13, z);
      const hub = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), p.dark);
      hub.rotation.y = Math.PI / 2; hub.position.set(x + 0.022, y0 + 0.13, z);
      g.add(fan, hub);
    }
  }
  const coin = new THREE.Group();
  const disc = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.025, 36), goldMat); disc.rotation.x = Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(0.075, 0.008, 8, 32), mat('#C8962F', { metalness: 0.7, roughness: 0.3 }));
  rim.position.z = 0.013;
  coin.add(disc, rim);
  coin.position.y = y0 + 0.45;
  coin.userData.spin = true;
  coins.push(coin);
  g.add(coin);
  return g;
}

// Ekspres do kawy: obudowa w kolorze gracza, kolba, filiżanka z parą
function makeEspresso(color) {
  const p = pawnPal(color);
  const g = new THREE.Group();
  g.add(pawnBase(color));
  const y0 = 0.07;
  const body = mesh(new RoundedBoxGeometry(0.3, 0.34, 0.22, 3, 0.03), p.main); body.position.set(0, y0 + 0.17, -0.02);
  const cut = mesh(new THREE.BoxGeometry(0.2, 0.13, 0.08), p.dark); cut.position.set(0, y0 + 0.09, 0.07);   // wnęka na filiżankę
  const tray = mesh(new THREE.BoxGeometry(0.22, 0.02, 0.1), p.light); tray.position.set(0, y0 + 0.02, 0.07);
  const top = mesh(new THREE.BoxGeometry(0.26, 0.02, 0.18), p.light); top.position.set(0, y0 + 0.35, -0.02);
  const group = mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.03, 20), aluMat); group.position.set(0, y0 + 0.19, 0.1);
  const handle = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 10), p.dark);
  handle.rotation.x = Math.PI / 2; handle.position.set(0, y0 + 0.19, 0.18);
  const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  gauge.position.set(0.08, y0 + 0.28, 0.092);
  const needle = mesh(new THREE.BoxGeometry(0.004, 0.022, 0.002), p.dark, false); needle.position.set(0.08, y0 + 0.285, 0.094); needle.rotation.z = -0.6;
  const cupPts = [[0, 0], [0.03, 0], [0.036, 0.05], [0.032, 0.05], [0.027, 0.006], [0, 0.006]].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = mesh(new THREE.LatheGeometry(cupPts, 24), mat('#FFFFFF', { roughness: 0.35, side: THREE.DoubleSide }));
  cup.position.set(0, y0 + 0.03, 0.07);
  const coffee = mesh(new THREE.CircleGeometry(0.03, 20), mat('#4E321E', { roughness: 0.25 }), false);
  coffee.rotation.x = -Math.PI / 2; coffee.position.set(0, y0 + 0.07, 0.07);
  g.add(body, cut, tray, top, group, handle, gauge, needle, cup, coffee);
  addSteam(g, y0 + 0.08, 0.07);
  return g;
}
// Robot: korpus w kolorze gracza, jasna głowa z wizjerem i świecącymi oczami, antena
function makeRobot(color) {
  const p = pawnPal(color);
  const g = new THREE.Group();
  g.add(pawnBase(color));
  const y0 = 0.07, eye = new THREE.MeshBasicMaterial({ color: '#5BE7FF', toneMapped: false });
  for (const x of [-0.075, 0.075]) {
    const track = mesh(new RoundedBoxGeometry(0.07, 0.05, 0.19, 2, 0.02), p.dark); track.position.set(x, y0 + 0.025, 0);
    const leg = mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.1, 14), aluMat); leg.position.set(x, y0 + 0.1, 0);
    g.add(track, leg);
  }
  const torso = mesh(new RoundedBoxGeometry(0.25, 0.22, 0.18, 3, 0.045), p.main); torso.position.y = y0 + 0.29;
  const head = mesh(new RoundedBoxGeometry(0.23, 0.16, 0.18, 3, 0.05), p.light); head.position.y = y0 + 0.53;
  const visor = mesh(new RoundedBoxGeometry(0.18, 0.08, 0.02, 2, 0.008), p.dark); visor.position.set(0, y0 + 0.535, 0.085);
  const neck = mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.05, 14), aluMat); neck.position.y = y0 + 0.425;
  const ant = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8), aluMat); ant.position.set(0.05, y0 + 0.67, 0);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color: mix(color, '#ffffff', 0.35), toneMapped: false }));
  tip.position.set(0.05, y0 + 0.74, 0);
  g.add(torso, head, visor, neck, ant, tip);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), eye); e.scale.z = 0.45; e.position.set(s * 0.045, y0 + 0.538, 0.096);
    const arm = mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.17, 10), aluMat); arm.position.set(s * 0.17, y0 + 0.25, 0.03); arm.rotation.x = 0.35;
    const hand = mesh(new THREE.SphereGeometry(0.032, 14, 10), p.main); hand.position.set(s * 0.17, y0 + 0.175, 0.075);
    g.add(e, arm, hand);
  }
  return g;
}
// Dron: czterowirnikowiec na statywie, śmigła kręcą się w grze
function makeDrone(color) {
  const p = pawnPal(color);
  const g = new THREE.Group();
  g.add(pawnBase(color));
  const y0 = 0.07, yd = y0 + 0.5;
  const stand = mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.46, 10), aluMat); stand.position.y = y0 + 0.24;
  const body = mesh(new RoundedBoxGeometry(0.15, 0.06, 0.2, 2, 0.025), p.main); body.position.y = yd;
  const canopy = mesh(new THREE.SphereGeometry(0.07, 20, 12), p.light); canopy.scale.set(1, 0.55, 1.25); canopy.position.set(0, yd + 0.02, -0.01);
  g.add(stand, body, canopy);
  const bladeMat = new THREE.MeshBasicMaterial({ color: '#E9EEF6', transparent: true, opacity: 0.85 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const arm = mesh(new THREE.BoxGeometry(0.02, 0.016, 0.22), p.dark);
    arm.position.set(sx * 0.1, yd, sz * 0.1); arm.rotation.y = Math.atan2(sx, sz);
    const motor = mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.036, 16), p.dark); motor.position.set(sx * 0.17, yd + 0.026, sz * 0.17);
    const rotor = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.003, 0.024), bladeMat);
    rotor.add(blade); rotor.position.set(sx * 0.17, yd + 0.052, sz * 0.17);
    liveParts.push({ obj: rotor, kind: 'fan' });
    const guard = mesh(new THREE.TorusGeometry(0.108, 0.0045, 6, 36), p.main); guard.rotation.x = Math.PI / 2; guard.position.copy(rotor.position);
    g.add(arm, motor, rotor, guard);
  }
  return g;
}
// Biret absolwenta na stosie książek
function makeCap(color) {
  const p = pawnPal(color);
  const g = new THREE.Group();
  g.add(pawnBase(color));
  let y = 0.07;
  const pages = mat('#FAFAF7', { roughness: 0.6 });
  for (const [w, d, h, rot, m] of [[0.3, 0.22, 0.055, 0, p.main], [0.28, 0.2, 0.05, 0.2, p.dark], [0.27, 0.19, 0.052, -0.12, p.main], [0.24, 0.17, 0.045, 0.32, p.light]]) {
    const book = mesh(new RoundedBoxGeometry(w, h, d, 2, 0.008), m); book.position.y = y + h / 2; book.rotation.y = rot;
    const pg = mesh(new THREE.BoxGeometry(w - 0.012, h - 0.012, d - 0.004), pages); pg.position.set(0.006, 0, 0.004); book.add(pg);
    g.add(book);
    y += h;
  }
  const black = mat('#1B1E25', { roughness: 0.8 });
  const skull = mesh(new THREE.CylinderGeometry(0.098, 0.085, 0.065, 28), black); skull.position.y = y + 0.0325;
  const board = mesh(new THREE.BoxGeometry(0.29, 0.014, 0.29), black); board.position.y = y + 0.07; board.rotation.y = Math.PI / 4;
  const button = mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.012, 14), goldMat); button.position.y = y + 0.082;
  const cord = mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.2, 6), goldMat); cord.rotation.z = Math.PI / 2; cord.position.set(0.1, y + 0.082, 0);
  const tassel = mesh(new THREE.ConeGeometry(0.016, 0.08, 10), goldMat); tassel.position.set(0.205, y + 0.02, 0);
  g.add(skull, board, button, cord, tassel);
  return g;
}
// Rakieta startupu: biały kadłub, nos i stateczniki w kolorze gracza, płomień migocze w grze
function makeRocket(color) {
  const p = pawnPal(color);
  const g = new THREE.Group();
  g.add(pawnBase(color));
  const y0 = 0.07 + 0.13;
  const white = mat('#FAFAF7', { roughness: 0.3 });
  const hull = mesh(new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.075, 0.03], [0.082, 0.12], [0.082, 0.36], [0.074, 0.44], [0, 0.44]].map(([x, y]) => new THREE.Vector2(x, y)), 32), white);
  hull.position.y = y0;
  const nose = mesh(new THREE.ConeGeometry(0.074, 0.225, 32), p.main); nose.position.y = y0 + 0.44 + 0.1125;
  const win = new THREE.Mesh(new THREE.SphereGeometry(0.027, 16, 10), new THREE.MeshBasicMaterial({ color: '#5BE7FF', toneMapped: false }));
  win.scale.z = 0.35; win.position.set(0, y0 + 0.31, 0.082);
  g.add(hull, nose, win);
  for (let k = 0; k < 3; k++) {
    const a = (2 * Math.PI * k) / 3 + Math.PI / 6;
    const fin = mesh(new THREE.BoxGeometry(0.1, 0.17, 0.014), p.main);
    fin.position.set(0.11 * Math.cos(a), y0 + 0.02, -0.11 * Math.sin(a)); fin.rotation.y = a;
    g.add(fin);
  }
  const flame = new THREE.Group();
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.046, 0.11, 16), new THREE.MeshBasicMaterial({ color: '#FF8A2A', toneMapped: false }));
  fl.rotation.x = Math.PI; fl.position.y = -0.055;
  flame.add(fl); flame.position.y = y0 - 0.02;
  liveParts.push({ obj: flame, kind: 'flame', phase: Math.random() * 6 });
  g.add(flame);
  return g;
}
// Para nad filiżanką (dwie smużki, które falują i przygasają)
function addSteam(g, y, z) {
  for (let k = 0; k < 2; k++) {
    const pts3 = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8;
      pts3.push(new THREE.Vector3((k ? 0.015 : -0.015) + Math.sin(t * Math.PI * 2 + k * 2) * 0.012, y + t * 0.2, 0));
    }
    const steam = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3), 24, 0.008, 8, false),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }),
    );
    steam.position.z = z;
    steam.userData.phase = k * 1.7;
    steams.push(steam);
    g.add(steam);
  }
}

// ---------------------------------------------------------------------------
// Pionki z Blendera (assets/models/pawns.glb, tools/blender/pawns.py): fazowane krawędzie, więcej detali
// i cienie kontaktowe wypalone w kolorach wierzchołków. Bez pliku zostają pionki z kodu (wyżej).
// ---------------------------------------------------------------------------
const glbMats = new Map();
function pawnSwap(name, color) {
  const key = `${name}|${color}`;
  if (!glbMats.has(key)) {
    let m = null;
    if (name === 'player') m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.18, vertexColors: true });
    else if (name === 'player_dark') m = mat('#0A2A66', { roughness: 0.45, vertexColors: true });
    else if (name === 'player_light') m = mat('#DDE3EE', { roughness: 0.4, vertexColors: true });
    else if (name === 'player_band') m = mat(color, { roughness: 0.35, emissive: color, emissiveIntensity: 0.12, vertexColors: true });
    else if (name === 'player_glow') m = new THREE.MeshBasicMaterial({ color: mix(color, '#ffffff', 0.35), toneMapped: false });
    glbMats.set(key, m);
  }
  return glbMats.get(key);
}
function glbPawn(name, color) {
  const o = cloneModel(name, n => pawnSwap(n, color));
  if (!o) return null;
  o.traverse(m => { if (/^fan_/.test(m.name)) liveParts.push({ obj: m, kind: 'fan' }); });
  const coin = o.getObjectByName('coin');
  if (coin) { coin.userData.spin = true; coins.push(coin); }
  const print = o.getObjectByName('print');
  if (print) liveParts.push({ obj: print, kind: 'print', phase: Math.random() });
  const head = o.getObjectByName('carriage');
  if (head) liveParts.push({ obj: head, kind: 'slide', x0: head.position.x, phase: Math.random() * 6 });
  const flame = o.getObjectByName('flame');
  if (flame) liveParts.push({ obj: flame, kind: 'flame', phase: Math.random() * 6 });
  if (name === 'banner') o.add(bannerFlag(color, -0.1));
  if (name === 'espresso') addSteam(o, 0.21, 0.1);
  return o;
}

// ---------------------------------------------------------------------------
// Modele: budynki (1 telefon, 2 laptop, 3 komputer, 4 szafa rack, 5 serwerownia = hotel)
// ---------------------------------------------------------------------------
let keyboardTex;
function getKeyboardTex() {
  if (keyboardTex) return keyboardTex;
  const [c, g] = makeCanvas(540, 190);
  g.fillStyle = '#1D212B'; g.fillRect(0, 0, 540, 190);
  g.fillStyle = '#3A4152';
  const cols = 14, rows = 5, pad = 6;
  const kw = (540 - pad * (cols + 1)) / cols, kh = (190 - pad * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      if (r === rows - 1 && k > 3 && k < 10) continue;
      g.beginPath(); g.roundRect(pad + k * (kw + pad), pad + r * (kh + pad), kw, kh, 5); g.fill();
    }
  }
  g.beginPath(); g.roundRect(pad + 4 * (kw + pad), pad + (rows - 1) * (kh + pad), 6 * kw + 5 * pad, kh, 5); g.fill();
  return (keyboardTex = tex(c));
}
const screenCache = new Map();
function screenTexture(color) {
  if (screenCache.has(color)) return screenCache.get(color);
  const [c, g] = makeCanvas(512, 320);
  const grad = g.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, '#20242B'); grad.addColorStop(1, '#0F1115');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 320);
  g.fillStyle = color; g.fillRect(0, 0, 512, 26);
  g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, 26, 112, 294);
  let seed = parseInt(color.slice(1), 16) || 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const palette = [color, '#7FD1FF', '#F7C873', '#9FE0A8', '#E6EAF2'];
  g.globalAlpha = 0.28; g.fillStyle = '#FFFFFF';
  for (let y = 48; y < 300; y += 24) g.fillRect(16, y, 50 + rnd() * 30, 8);
  g.globalAlpha = 0.92;
  for (let y = 46; y < 300; y += 22) {
    let x = 132 + Math.floor(rnd() * 3) * 18;
    const n = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < n && x < 470; k++) {
      const w = Math.min(30 + rnd() * 110, 492 - x);
      g.fillStyle = palette[Math.floor(rnd() * palette.length)];
      g.fillRect(x, y, w, 9);
      x += w + 12;
    }
  }
  g.globalAlpha = 1;
  const t = tex(c);
  screenCache.set(color, t);
  return t;
}
const screenMat = color => new THREE.MeshBasicMaterial({ map: screenTexture(color), toneMapped: false });

// Budynki są w całości w kolorze gracza: kolor główny, ciemniejszy i jaśniejszy odcień
const palCache = new Map();
function pal(color) {
  if (!palCache.has(color)) {
    palCache.set(color, {
      main: mat(color, { roughness: 0.4, metalness: 0.1 }),
      dark: mat(mix(color, '#000000', 0.45), { roughness: 0.5 }),
      light: mat(mix(color, '#ffffff', 0.5), { roughness: 0.45 }),
      glow: new THREE.MeshBasicMaterial({ color: mix(color, '#ffffff', 0.35), toneMapped: false }),
    });
  }
  return palCache.get(color);
}

function makePhone(color) {
  const p = pal(color);
  const g = new THREE.Group();
  const stand = mesh(new RoundedBoxGeometry(0.24, 0.02, 0.2, 2, 0.008), p.light); stand.position.y = 0.01;
  const lip = mesh(new THREE.BoxGeometry(0.24, 0.035, 0.02), p.light); lip.position.set(0, 0.035, 0.07);
  const tilt = new THREE.Group();
  tilt.position.set(0, 0.02, 0.05);
  tilt.rotation.x = -0.32;
  const body = mesh(new RoundedBoxGeometry(0.2, 0.4, 0.024, 3, 0.01), [p.main, p.main, p.main, p.main, p.dark, p.main]);
  body.position.y = 0.2;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.37), screenMat(color));
  screen.position.set(0, 0.2, 0.0125);
  const cam = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 20), p.dark);
  cam.rotation.x = Math.PI / 2; cam.position.set(-0.055, 0.34, -0.015);
  tilt.add(body, screen, cam);
  const brace = mesh(new THREE.BoxGeometry(0.06, 0.2, 0.02), p.light);
  brace.position.set(0, 0.1, -0.05); brace.rotation.x = 0.45;
  g.add(stand, lip, tilt, brace);
  return g;
}

function makeLaptop(color) {
  const p = pal(color);
  const g = new THREE.Group();
  const base = mesh(new RoundedBoxGeometry(0.62, 0.03, 0.42, 2, 0.012), p.main); base.position.y = 0.015;
  const keys = mesh(new THREE.PlaneGeometry(0.54, 0.19), new THREE.MeshStandardMaterial({ map: getKeyboardTex(), roughness: 0.7 }), false);
  keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.0305, -0.06);
  const pad = mesh(new THREE.PlaneGeometry(0.17, 0.09), p.light, false);
  pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.0305, 0.125);
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.03, -0.2);
  const lid = mesh(new RoundedBoxGeometry(0.62, 0.016, 0.41, 2, 0.006), [p.main, p.main, p.main, p.dark, p.main, p.main]);
  lid.position.set(0, 0.008, 0.205);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34), screenMat(color));
  screen.rotation.x = Math.PI / 2; screen.position.set(0, -0.0008, 0.21);
  const logo = mesh(new THREE.CircleGeometry(0.045, 32), p.glow, false);
  logo.rotation.x = -Math.PI / 2; logo.position.set(0, 0.0168, 0.21);
  hinge.add(lid, screen, logo);
  hinge.rotation.x = -1.83;
  g.add(base, keys, pad, hinge);
  return g;
}

function makeComputer(color) {
  const p = pal(color);
  const g = new THREE.Group();
  const mx = -0.12;
  const monitor = mesh(new RoundedBoxGeometry(0.8, 0.5, 0.04, 2, 0.015), p.main); monitor.position.set(mx, 0.49, -0.1);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.44), screenMat(color)); screen.position.set(mx, 0.49, -0.079);
  const neck = mesh(new THREE.BoxGeometry(0.06, 0.24, 0.035), p.dark); neck.position.set(mx, 0.15, -0.135);
  const foot = mesh(new RoundedBoxGeometry(0.3, 0.02, 0.18, 2, 0.008), p.dark); foot.position.set(mx, 0.01, -0.12);
  const tower = mesh(new RoundedBoxGeometry(0.2, 0.5, 0.42, 2, 0.02), p.main); tower.position.set(0.46, 0.25, -0.08);
  const led = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.38), p.glow);
  led.position.set(0.41, 0.27, 0.131);
  const power = new THREE.Mesh(new THREE.CircleGeometry(0.014, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  power.position.set(0.5, 0.44, 0.131);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.38), p.dark);
  glass.rotation.y = Math.PI / 2; glass.position.set(0.561, 0.26, -0.08);
  const kbd = mesh(new RoundedBoxGeometry(0.52, 0.024, 0.15, 2, 0.008), p.light); kbd.position.set(mx, 0.012, 0.2);
  const keys = mesh(new THREE.PlaneGeometry(0.48, 0.12), new THREE.MeshStandardMaterial({ map: getKeyboardTex(), roughness: 0.7 }), false);
  keys.rotation.x = -Math.PI / 2; keys.position.set(mx, 0.0245, 0.2);
  const mouse = mesh(new THREE.SphereGeometry(0.04, 16, 12), p.light); mouse.scale.set(1, 0.5, 1.5); mouse.position.set(0.3, 0.018, 0.22);
  g.add(monitor, screen, neck, foot, tower, led, power, glass, kbd, keys, mouse);
  return g;
}

// Szafa rack: obudowa w kolorze gracza, serwery z diodami
function makeRack(color) {
  const p = pal(color);
  const g = new THREE.Group();
  const W = 0.4, H = 0.86, Dp = 0.42;
  const frame = mesh(new THREE.BoxGeometry(W, H, Dp), p.main); frame.position.y = H / 2 + 0.03;
  const top = mesh(new THREE.BoxGeometry(W + 0.01, 0.03, Dp + 0.01), p.light); top.position.y = H + 0.045;
  g.add(frame, top);
  for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // nóżki
    const f = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 12), p.dark);
    f.position.set(fx * (W / 2 - 0.03), 0.015, fz * (Dp / 2 - 0.03));
    g.add(f);
  }
  const greenMat = new THREE.MeshBasicMaterial({ color: '#7CF29A', toneMapped: false });
  const whiteMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  for (let k = 0; k < 8; k++) {
    const y = 0.1 + k * 0.1;
    const unit = mesh(new THREE.BoxGeometry(W - 0.05, 0.075, 0.02), p.dark, false);
    unit.position.set(0, y, Dp / 2 + 0.005);
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.012), p.glow);
    led.position.set(-0.06, y, Dp / 2 + 0.016);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), k % 3 ? greenMat : whiteMat);
    dot.position.set(0.13, y, Dp / 2 + 0.016);
    g.add(unit, led, dot);
  }
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.02, H - 0.04),
    new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.4, depthWrite: false }));
  glass.position.set(0, H / 2 + 0.03, Dp / 2 + 0.03);
  g.add(glass);
  return g;
}

// Serwerownia (hotel): pomieszczenie w kolorze gracza z trzema szafami rack i klimatyzacją
function makeServerRoom(color) {
  const p = pal(color);
  const g = new THREE.Group();
  const floor = mesh(new THREE.BoxGeometry(1.3, 0.05, 0.95), p.light); floor.position.y = 0.025;
  const back = mesh(new THREE.BoxGeometry(1.3, 0.62, 0.05), p.main); back.position.set(0, 0.36, -0.45);
  const side = mesh(new THREE.BoxGeometry(0.05, 0.62, 0.95), p.main); side.position.set(-0.625, 0.36, 0);
  const band = mesh(new THREE.BoxGeometry(1.32, 0.05, 0.06), p.dark); band.position.set(0, 0.695, -0.45);
  const band2 = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.97), p.dark); band2.position.set(-0.625, 0.695, 0);
  g.add(floor, back, side, band, band2);
  for (let k = 0; k < 3; k++) {
    const r = makeRack(color);
    r.scale.setScalar(0.62);
    r.position.set(-0.3 + k * 0.33, 0.05, -0.18);
    g.add(r);
  }
  const tray = mesh(new THREE.BoxGeometry(1.0, 0.03, 0.08), p.dark); tray.position.set(0.03, 0.66, -0.18);
  const ac = mesh(new RoundedBoxGeometry(0.3, 0.12, 0.08, 2, 0.02), p.light); ac.position.set(0.35, 0.55, -0.4);
  const vent = mesh(new THREE.BoxGeometry(0.24, 0.015, 0.01), p.dark); vent.position.set(0.35, 0.51, -0.355);
  g.add(tray, ac, vent);
  return g;
}

// Budynki z Blendera (assets/models/buildings.glb, tools/blender/buildings.py); bez pliku zostają budynki z kodu
const glbBuildMats = new Map();
let glbKeysMat;
function buildingSwap(name, color) {
  if (name === 'screen') return screenMat(color);
  if (name === 'keys') return (glbKeysMat ??= new THREE.MeshStandardMaterial({ map: getKeyboardTex(), roughness: 0.7 }));
  if (!name.startsWith('player')) return null;
  const key = `${name}|${color}`;
  if (!glbBuildMats.has(key)) {
    const p = pal(color);
    const src = { player: p.main, player_dark: p.dark, player_light: p.light }[name];
    let m = p.glow;
    if (src) { m = src.clone(); m.vertexColors = true; }
    glbBuildMats.set(key, m);
  }
  return glbBuildMats.get(key);
}
const glbBuilding = (name, color) => cloneModel(name, n => buildingSwap(n, color));

// scale: w widoku Modele, board: na polu planszy
const BUILDINGS = [
  { name: 'Telefon', make: c => glbBuilding('phone', c) || makePhone(c), scale: 2.4, board: 1.5 },
  { name: 'Laptop', make: c => glbBuilding('laptop', c) || makeLaptop(c), scale: 1.9, board: 1.05 },
  { name: 'Komputer', make: c => glbBuilding('computer', c) || makeComputer(c), scale: 1.6, board: 0.85 },
  { name: 'Szafa rack', make: c => glbBuilding('rack', c) || makeRack(c), scale: 1.45, board: 0.95 },
  { name: 'Serwerownia', make: c => glbBuilding('serverroom', c) || makeServerRoom(c), scale: 1.4, board: 0.72 },
];

// ---------------------------------------------------------------------------
// Plansza
// ---------------------------------------------------------------------------
// Plansza jak z pudełka premium: lakierowana podstawa z zaokrąglonymi krawędziami, na brzegu złota inkrustacja
// z rozetami w narożnikach, pola z fazowanymi brzegami i fakturą papieru, złota folia na polach specjalnych.
const board = new THREE.Group();
scene.add(board);

const baseSideMat = new THREE.MeshPhysicalMaterial({ color: LOOK.baseSide, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.28 });
const baseTopMat = new THREE.MeshPhysicalMaterial({ color: LOOK.baseTop, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.35 });
const base = mesh(new RoundedBoxGeometry(S + 2 * LOOK.margin, BASE_H, S + 2 * LOOK.margin, 5, 0.09),
  [baseSideMat, baseSideMat, baseTopMat, baseSideMat, baseSideMat, baseSideMat], true, true);
base.position.y = -BASE_H / 2;
board.add(base);
const inlay = new THREE.Group();
{
  const gold = mat(GOLD, { metalness: 1, roughness: 0.26 });
  const R0 = S / 2 + LOOK.margin * 0.5, L = 2 * R0;
  for (const [w, d, x, z] of [[L, 0.032, 0, R0], [L, 0.032, 0, -R0], [0.032, L, R0, 0], [0.032, L, -R0, 0]]) {
    const bar = mesh(new THREE.BoxGeometry(w, 0.005, d), gold, false, true);
    bar.position.set(x, 0.0025, z);
    inlay.add(bar);
  }
  const roseGeo = new THREE.CylinderGeometry(0.1, 0.11, 0.012, 48), dotGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.016, 32);
  const navyDot = new THREE.MeshPhysicalMaterial({ color: '#00276F', roughness: 0.3, clearcoat: 1 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const rose = mesh(roseGeo, gold, false, true); rose.position.set(sx * R0, 0.006, sz * R0);
    const dot = mesh(dotGeo, navyDot, false, true); dot.position.set(sx * R0, 0.008, sz * R0);
    inlay.add(rose, dot);
  }
}
board.add(inlay);

// Miękki cień planszy na stole
const floorGroup = new THREE.Group();
floorGroup.position.y = -BASE_H;
scene.add(floorGroup);
const contact = new THREE.Mesh(new THREE.PlaneGeometry((S + 2 * LOOK.margin) * 1.25, (S + 2 * LOOK.margin) * 1.25),
  new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
contact.rotation.x = -Math.PI / 2;
contact.position.y = 0.003;
floorGroup.add(contact);
scene.background = gradientTexture(LOOK.bg[0], LOOK.bg[1]);
document.body.style.background = `linear-gradient(180deg, ${LOOK.bg[0]}, ${LOOK.bg[1]})`;
$('vignette').style.setProperty('--v', LOOK.vignette);

// ---------------------------------------------------------------------------
// Diorama (jak makieta w przekroju): plansza leży prosto na jasnym placu uczelni.
// Wzdłuż jednego boku planszy jest plaża i turkusowa, przezroczysta woda (klimat wakacji),
// z drugiej strony uniwersytet: gmach z kolumnami i wieżą zegarową, wydziały, dziedziniec,
// boisko i parking. Boki bloku pokazują warstwy ziemi, a woda jest widoczna w przekroju.
// Ciągle coś się dzieje: fale, żaglówki, motorówka, mewy, balon, ryby.
// Wszystko z prostych brył i tekstur rysowanych w kodzie, bez gotowych modeli.
// ---------------------------------------------------------------------------
const PLINTH_HALF = S / 2 + LOOK.margin + 3.6;            // pas placu wokół planszy: tu leżą pieniądze i karty graczy
const STASH_AT = S / 2 + LOOK.margin + 1.6;               // pieniądze i karty gracza: na stole przy środku boku planszy
const GROUND_Y = -BASE_H - 0.02;                           // plac jest na wysokości spodu planszy
const BX = 36;                                             // pół szerokości bloku (oś x)
const BZB = -38;                                           // tył bloku (uniwersytet)
const SHORE_Z = 13.2;                                      // tu kończy się ląd i zaczyna zejście do wody
const BZF = 34;                                            // przód bloku (koniec wody)
const SAND_Z = PLINTH_HALF + 0.3;                          // plaża zaczyna się tuż za placem
const WATER_Y = GROUND_Y - 0.5;
const FLOOR_Y = GROUND_Y - 4.6;
const BOTTOM_Y = GROUND_Y - 8.4;
const WZ0 = SHORE_Z + 0.6, WD = BZF - WZ0;                // powierzchnia wody: od brzegu do przodu bloku
// Fale Gerstnera: grzbiety ostrzejsze, doliny łagodniejsze, woda krąży po małych okręgach.
// [kierunek x, kierunek z, długość fali, stromość]. Ta sama funkcja liczy powierzchnię w shaderze
// i pozycję łodzi, motorówki i boi, więc wszystko unosi się i przechyla razem z falą.
// Widmo fal jak na morzu (uproszczone widmo JONSWAP): dziesięć fal od 11 do 0,9 długości, z kierunku wiatru
// z rozrzutem (krótkie fale bardziej rozrzucone). Najwięcej energii mają fale o długości ok. 6,5.
// Suma stromości jest ograniczona, żeby grzbiety się nie zawijały.
const WAVES = (() => {
  let seed = 7;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const wind = Math.atan2(0.35, 1), n = 10, Lp = 6.5, out = [];
  for (let k = 0; k < n; k++) {
    const L = 11 * Math.pow(0.9 / 11, k / (n - 1)), w = Math.sqrt(Lp / L);   // częstość względem szczytu widma
    const sig = w <= 1 ? 0.07 : 0.09;
    const S = Math.pow(w, -5) * Math.exp(-1.25 * Math.pow(w, -4)) * Math.pow(3.3, Math.exp(-((w - 1) ** 2) / (2 * sig * sig)));
    const amp = Math.sqrt(S * w) * L;                 // wysokość fali z energii w paśmie
    const a = wind + (r() - 0.5) * (0.5 + 1.4 * k / n);
    out.push([Math.cos(a), Math.sin(a), L, (2 * Math.PI / L) * amp]);
  }
  const sum = out.reduce((s2, w) => s2 + w[3], 0);
  return out.map(([x, z, L, st]) => [x, z, L, st * 0.62 / sum]);
})();
const WAVE_MAX = WAVES.reduce((s2, [, , L, st]) => s2 + st * L / (2 * Math.PI), 0);   // najwyższy możliwy grzbiet
const WAVE_SPEED = 0.55;
let updateWaterSky = () => {};   // niebo odbijane w wodzie: odświeża je pora dnia (setWorldMood)
const waterLight = TSL.uniform(1);   // ile światła rozprasza się w wodzie (dzień 1, nocą mało), ustawia pora dnia
// Zmarszczki z symulacji (równanie falowe, src/scene/ripples.js) na całej powierzchni wody: fale od łodzi i ryb
const ripples = new RippleSim({ nx: 200, nz: 56, x0: -BX, x1: BX, z0: WZ0, z1: BZF, speed: 2.6, decay: 0.55 });
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function waveAt(x, z, t) {   // [wysokość, nachylenie w x, nachylenie w z]
  const u = (x + BX) / (2 * BX), v = 1 - (z - WZ0) / WD;
  const amp = smooth01(0, 0.035, u) * smooth01(0, 0.035, 1 - u) * smooth01(0, 0.05, v) * (0.4 + 0.6 * (1 - smooth01(0.72, 1, v)));
  let y = 0, sx = 0, sz = 0;
  for (const [dx, dz, L, st0] of WAVES) {
    const k = 2 * Math.PI / L, c = Math.sqrt(9.8 / k) * WAVE_SPEED, f = k * (dx * x + dz * z - c * t), st = st0 * amp;
    y += (st / k) * Math.sin(f); sx += st * dx * Math.cos(f); sz += st * dz * Math.cos(f);
  }
  return [y, sx, sz];
}
const QUIET_X = 14;                                        // plaża dla |x| < QUIET_X jest pusta: to dół kadru w grze
const world = new THREE.Group();
scene.add(world);
const ROOF = '#C8664A';                                    // dachówka jak na starówce w Bielsku-Białej
const TRIM = '#E4DCCD';                                    // jasny kamień: gzymsy i attyki
const IRON = '#3A3D42';                                    // grafit: latarnie, nogi ławek, wskazówki zegara
const worldAnim = [];                                      // (t, dt) => void, co klatkę
let wSeed = 11;
const wr = () => ((wSeed = (wSeed * 16807) % 2147483647) / 2147483647);
const wrr = (a, b) => a + (b - a) * wr();
const flat = (color, o = {}) => mat(color, { flatShading: true, roughness: 0.8, ...o });
const nightMats = [];                                      // materiały, które świecą nocą (okna, latarnie)
// Profil dna morskiego (z, y): plaża schodzi do wody, potem dno opada i jest płaskie
const SEABED = [[SHORE_Z, GROUND_Y], [SHORE_Z + 1.4, WATER_Y - 0.25], [SHORE_Z + 4, WATER_Y - 1.3], [SHORE_Z + 9, FLOOR_Y + 0.5], [SHORE_Z + 14, FLOOR_Y + 0.15], [BZF, FLOOR_Y + 0.15]];
function seabedY(z) {
  for (let k = 1; k < SEABED.length; k++) {
    const [z0, y0] = SEABED[k - 1], [z1, y1] = SEABED[k];
    if (z <= z1) return y0 + (y1 - y0) * Math.max(0, (z - z0) / (z1 - z0));
  }
  return FLOOR_Y + 0.15;
}
// Warstwy ziemi w przekroju bloku: od góry trawa, próchnica, glina, piasek, żwir, skała
function strataTexture() {
  const [c, g] = makeCanvas(256, 1024);
  const bands = [[0.03, '#5DAE3E'], [0.12, '#6B4A2F'], [0.11, '#9A5E38'], [0.15, '#DDBD86'], [0.15, '#B6A288'], [0.2, '#8C8378'], [0.24, '#5F5A54']];
  let y = 0;
  for (const [h, col] of bands) {
    const hh = h * 1024;
    g.fillStyle = col;
    g.beginPath(); g.moveTo(0, y - 6);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 5);
    g.lineTo(256, y + hh + 8); g.lineTo(0, y + hh + 8); g.closePath(); g.fill();
    y += hh;
  }
  g.globalAlpha = 0.18;
  for (let k = 0; k < 900; k++) { g.fillStyle = wr() < 0.5 ? '#000' : '#fff'; g.fillRect(wr() * 256, wr() * 1024, 2 + wr() * 4, 2 + wr() * 3); }
  g.globalAlpha = 1;
  const t = tex(c); t.wrapS = THREE.RepeatWrapping;
  return t;
}
// Kaustyki: jasna sieć światła na dnie, przesuwana jak przez falującą wodę
// Tekstury: trawa, kostka brukowa, skała, piasek
// Generator liczb losowych dla tekstur (osobny, żeby nie przestawiać rozmieszczenia drzew i rekwizytów)
const texRng = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// Mapa normalnych z mapy wysokości (jasne = wyżej): światło łapie krawędzie kostek i zmarszczki piasku
function normalFromHeight(hc, strength = 2.5) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const [c, g] = makeCanvas(w, h), img = g.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (H(x - 1, y) - H(x + 1, y)) * strength, ny = (H(x, y - 1) - H(x, y + 1)) * strength;
    const l = Math.hypot(nx, ny, 1), i = (y * w + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
  return t;
}
// Trawnik: źdźbła w kilku odcieniach i jaśniejsze, ciemniejsze pasy jak po koszeniu
function grassTexture() {
  const s = 512, [c, g] = makeCanvas(s, s), r = texRng(3);
  g.fillStyle = '#62AE43'; g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, 0, s, s / 2);   // pas koszenia
  for (let k = 0; k < 9000; k++) {
    g.fillStyle = ['#58A23B', '#6FBA4C', '#4F9534', '#7CC458', '#66B046'][k % 5];
    g.globalAlpha = 0.55;
    g.fillRect(r() * s, r() * s, 1 + r() * 2, 2 + r() * 5);
  }
  g.globalAlpha = 1;
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.12, 0.12);
  return t;
}
// Kostka granitowa w wiązaniu: każda kostka w trochę innym odcieniu, z ziarnem kamienia i fugą.
// Jeden kafel tekstury to 8 x 16 kostek; brzegi kafla są dopasowane, więc nie widać szwów.
function paversTexture() {
  const s = 1024, pw = 128, ph = 64, gr = 4, r = texRng(11);
  const [c, g] = makeCanvas(s, s), [hc, hg] = makeCanvas(s, s);
  g.fillStyle = '#A39C90'; g.fillRect(0, 0, s, s);   // fuga
  hg.fillStyle = '#000000'; hg.fillRect(0, 0, s, s);
  const tones = ['#CFC8BC', '#C9C2B5', '#D4CEC3', '#C4BDB0', '#D1C9BC', '#C0B9AC', '#D7D1C7', '#CBC5BB'];
  const paver = (x, y, tone, seed) => {
    const x0 = x + gr / 2, y0 = y + gr / 2, w = pw - gr, h = ph - gr, pr = texRng(seed);
    g.fillStyle = tone; g.fillRect(x0, y0, w, h);
    for (let k = 0; k < 140; k++) {   // ziarno granitu
      g.fillStyle = pr() < 0.55 ? 'rgba(70,64,58,.22)' : 'rgba(255,255,255,.28)';
      g.fillRect(x0 + pr() * w, y0 + pr() * h, 1 + pr() * 2, 1 + pr() * 2);
    }
    if (pr() < 0.18) {   // ślad zużycia: ciemniejsza plama
      const cx = x0 + pr() * w, cy = y0 + pr() * h, rad = 10 + pr() * 22;
      const gg = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gg.addColorStop(0, 'rgba(80,72,62,.16)'); gg.addColorStop(1, 'rgba(80,72,62,0)');
      g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip(); g.fillStyle = gg; g.fillRect(x0, y0, w, h); g.restore();
    }
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x0, y0, w, 2); g.fillRect(x0, y0, 2, h);           // jasna krawędź od słońca
    g.fillStyle = 'rgba(40,34,28,.16)'; g.fillRect(x0, y0 + h - 2, w, 2); g.fillRect(x0 + w - 2, y0, 2, h);   // cień na drugiej krawędzi
    for (let i = 0; i < 5; i++) {   // wysokość: fazowane brzegi
      const v = [110, 165, 205, 235, 255][i];
      hg.fillStyle = `rgb(${v},${v},${v})`; hg.fillRect(x0 + i, y0 + i, w - 2 * i, h - 2 * i);
    }
  };
  for (let y = 0; y < s; y += ph) {
    const off = (y / ph) % 2 ? pw / 2 : 0;
    for (let x = off - (off ? pw : 0); x < s; x += pw) {
      const tone = '#' + new THREE.Color(tones[Math.floor(r() * tones.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.04).getHexString();
      const seed = 1 + Math.floor(r() * 1e6);
      paver(x, y, tone, seed);
      if (x < 0) paver(x + s, y, tone, seed);          // ta sama kostka po drugiej stronie kafla
      else if (x + pw > s) paver(x - s, y, tone, seed);
    }
  }
  const map = tex(c); map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const normalMap = normalFromHeight(hc, 3);
  return { map, normalMap };
}
// Piasek: drobne ziarna, jaśniejsze i ciemniejsze plamy oraz delikatne zmarszczki od wiatru
function sandTextures() {
  const s = 512, r = texRng(5), [c, g] = makeCanvas(s, s), [hc, hg] = makeCanvas(s, s);
  g.fillStyle = '#E7D3A5'; g.fillRect(0, 0, s, s);
  for (let k = 0; k < 40; k++) {
    const x = r() * s, y = r() * s, rad = 30 + r() * 90, gg = g.createRadialGradient(x, y, 0, x, y, rad);
    const col = r() < 0.5 ? '232,214,170' : '214,192,146';
    gg.addColorStop(0, `rgba(${col},.35)`); gg.addColorStop(1, `rgba(${col},0)`);
    for (const [dx, dy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) { g.save(); g.translate(dx, dy); g.fillStyle = gg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore(); }
  }
  for (let k = 0; k < 16000; k++) { g.fillStyle = ['#D9C08C', '#F3E4BF', '#CDB27D', '#EFDDB2', '#BFA372'][k % 5]; g.fillRect(r() * s, r() * s, 1 + r() * 1.5, 1 + r() * 1.5); }
  const img = hg.createImageData(s, s), d = img.data;   // zmarszczki: fale z małym zaburzeniem
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const v = 0.5 + 0.35 * Math.sin((y / s) * Math.PI * 2 * 9 + Math.sin((x / s) * Math.PI * 2 * 2) * 1.6) + 0.15 * Math.sin((x / s) * Math.PI * 2 * 5 + (y / s) * Math.PI * 2 * 3);
    const i = (y * s + x) * 4; d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, v * 255)); d[i + 3] = 255;
  }
  hg.putImageData(img, 0, 0);
  const map = tex(c); map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return { map, normalMap: normalFromHeight(hc, 1.2) };
}
// Okna budynków: mapa koloru i mapa świecenia (nocą część okien się pali)
function facadeTexture(cols, rows, kind, wall) {
  const cw = 64, rh = 72, w = cols * cw, h = rows * rh;
  const [c, g] = makeCanvas(w, h), [cl, gl] = makeCanvas(w, h);
  g.fillStyle = wall; g.fillRect(0, 0, w, h);
  gl.fillStyle = '#000'; gl.fillRect(0, 0, w, h);
  const glass = g.createLinearGradient(0, 0, 0, rh);
  glass.addColorStop(0, '#9CC3EC'); glass.addColorStop(1, '#3F6FAE');
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    if (kind === 'band') {
      g.fillStyle = glass; g.save(); g.translate(0, y); g.fillRect(4, 16, w - 8, rh - 30); g.restore();
      g.fillStyle = 'rgba(255,255,255,.55)'; for (let x = cw; x < w; x += cw) g.fillRect(x - 2, y + 16, 4, rh - 30);
    }
    for (let k = 0; k < cols; k++) {
      const x = k * cw;
      if (kind === 'grid') { g.fillStyle = glass; g.save(); g.translate(0, y); g.fillRect(x + 12, 14, cw - 24, rh - 26); g.restore(); }
      if (kind === 'curtain') {
        g.fillStyle = glass; g.save(); g.translate(0, y); g.fillRect(x + 2, 2, cw - 4, rh - 4); g.restore();
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 6, y + 6, 8, rh - 12);
      }
      if (wr() < 0.38) {
        gl.fillStyle = ['#FFD58A', '#FFE7B8', '#FFF2D6'][k % 3];
        if (kind === 'curtain') gl.fillRect(x + 2, y + 2, cw - 4, rh - 4);
        else gl.fillRect(x + 12, y + 16, cw - 24, rh - 30);
      }
    }
  }
  if (kind !== 'curtain') { g.fillStyle = '#C9BFAE'; g.fillRect(0, 0, w, 10); }   // kamienny pas pod dachem
  return [tex(c), tex(cl)];
}
function campusBuilding(w, h, d, kind, wall = '#F2F4F8') {
  const grp = new THREE.Group();
  const rows = Math.max(1, Math.round(h / 1.15));
  const [fm, fl] = facadeTexture(Math.max(2, Math.round(w / 1.25)), rows, kind, wall);
  const [sm, sl] = facadeTexture(Math.max(2, Math.round(d / 1.25)), rows, kind, wall);
  const mk = (map, lit) => {
    const m = new THREE.MeshStandardMaterial({ map, emissiveMap: lit, emissive: '#FFFFFF', emissiveIntensity: 0, roughness: 0.55 });
    nightMats.push([m, 1.15]);
    return m;
  };
  const front = mk(fm, fl), side = mk(sm, sl), roof = mat('#D9D4CA', { roughness: 0.9 });
  const body = mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, front, front], false, false);
  body.position.y = h / 2;
  grp.add(body);
  const parapet = mesh(new THREE.BoxGeometry(w + 0.2, 0.25, d + 0.2), mat(TRIM, { roughness: 0.7 }), false, false);
  parapet.position.y = h + 0.12;
  grp.add(parapet);
  for (let k = 0; k < 3; k++) {          // urządzenia na dachu
    const box = mesh(new THREE.BoxGeometry(wrr(0.6, 1.4), wrr(0.3, 0.7), wrr(0.6, 1.2)), mat('#E3E7EE', { roughness: 0.7 }), false, false);
    box.position.set(wrr(-w / 3, w / 3), h + 0.35, wrr(-d / 3, d / 3));
    grp.add(box);
  }
  const door = mesh(new THREE.BoxGeometry(Math.min(2.4, w * 0.3), 1.4, 0.3), mat('#5D8A9C', { roughness: 0.25, metalness: 0.2 }), false, false);
  door.position.set(0, 0.7, d / 2 + 0.05);
  grp.add(door);
  const canopy = mesh(new THREE.BoxGeometry(Math.min(3.4, w * 0.42), 0.14, 1.2), mat(ROOF), false, false);
  canopy.position.set(0, 1.6, d / 2 + 0.55);
  grp.add(canopy);
  return grp;
}
// Drzewa z Blendera (assets/models/nature.glb): liściaste o koronie z kilku nieregularnych brył, iglaste, brzozy
const TREE_KINDS = ['tree_round_a', 'tree_round_b', 'tree_round_c', 'tree_round_a', 'tree_pine', 'tree_birch'];
function lowTree(scale = 1) {
  const pick = TREE_KINDS[Math.floor(wr() * TREE_KINDS.length)];
  const glb = cloneModel(pick, () => null);
  if (glb) {
    glb.scale.setScalar(scale);
    glb.rotation.y = wr() * Math.PI * 2;
    glb.traverse(m => { m.castShadow = false; });
    const ph = wr() * 6, amp = 0.012 + wr() * 0.01;
    worldAnim.push(t => { glb.rotation.z = amp * Math.sin(t * 1.15 + ph); glb.rotation.x = amp * 0.6 * Math.sin(t * 0.9 + ph * 1.3); });
    return glb;
  }
  return lowTreeCode(scale);
}
function lowTreeCode(scale = 1) {
  const grp = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6), flat('#8A5A3B'), false, false);
  trunk.position.y = 0.6;
  grp.add(trunk);
  const greens = ['#4FA845', '#5DB850', '#3E9440', '#6CC25A'];
  const kind = wr();
  if (kind < 0.4) {
    for (let k = 0; k < 3; k++) {
      const cone = mesh(new THREE.ConeGeometry(1.0 - k * 0.22, 1.3, 7), flat(greens[(k + 1) % 4]), false, false);
      cone.position.y = 1.4 + k * 0.62;
      grp.add(cone);
    }
  } else {
    const ball = mesh(new THREE.IcosahedronGeometry(1.0, 0), flat(greens[Math.floor(wr() * 4)]), false, false);
    ball.position.y = 1.9; ball.scale.set(1, 1.1, 1);
    grp.add(ball);
    const ball2 = mesh(new THREE.IcosahedronGeometry(0.65, 0), flat(greens[Math.floor(wr() * 4)]), false, false);
    ball2.position.set(0.5, 1.6, 0.3);
    grp.add(ball2);
  }
  grp.scale.setScalar(scale);
  grp.rotation.y = wr() * Math.PI * 2;
  return grp;
}
// Miękki cień pod drzewem, ławką i budynkiem
const blobTex = (() => {
  const [c, g] = makeCanvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
function blob(x, z, r, y = GROUND_Y + 0.03) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), blobMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  world.add(m);
}
// Plaża: palma, parasol, leżak
function palm(h = 3.6) {
  const glb = cloneModel('palm', () => null);
  if (glb) {
    glb.scale.setScalar(h / 3.6);
    glb.traverse(m => { m.castShadow = false; });
    const ph = wr() * 6;
    worldAnim.push(t => { glb.rotation.z = 0.025 * Math.sin(t * 0.8 + ph); });
    return glb;
  }
  const g = new THREE.Group();
  const trunkM = flat('#9C7148');
  let x = 0, y = 0;
  for (let k = 0; k < 7; k++) {
    const seg = mesh(new THREE.CylinderGeometry(0.13 - k * 0.008, 0.16 - k * 0.008, h / 7 + 0.05, 7), trunkM, false, false);
    x += 0.06 * k;
    seg.position.set(x, y + h / 14, 0);
    seg.rotation.z = -0.05 * k;
    g.add(seg);
    y += h / 7;
  }
  const leafM = flat('#3FA34D', { side: THREE.DoubleSide });
  for (let k = 0; k < 7; k++) {
    const leaf = mesh(new THREE.ConeGeometry(0.28, 1.9, 4), leafM, false, false);
    leaf.scale.set(1, 1, 0.25);
    const a = (k / 7) * Math.PI * 2;
    leaf.position.set(x + Math.cos(a) * 0.75, y - 0.15, Math.sin(a) * 0.75);
    leaf.rotation.set(Math.sin(a) * 1.25, -a, -Math.cos(a) * 1.25);
    g.add(leaf);
  }
  for (let k = 0; k < 3; k++) {
    const nut = mesh(new THREE.SphereGeometry(0.11, 8, 6), flat('#6B4A2F'), false, false);
    nut.position.set(x + Math.cos(k * 2.1) * 0.15, y - 0.25, Math.sin(k * 2.1) * 0.15);
    g.add(nut);
  }
  return g;
}
function parasolTex(a, b) {
  const [c, g] = makeCanvas(256, 256);
  for (let k = 0; k < 8; k++) {
    g.fillStyle = k % 2 ? a : b;
    g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 128, (k / 8) * Math.PI * 2, ((k + 1) / 8) * Math.PI * 2); g.closePath(); g.fill();
  }
  return tex(c);
}
function parasol(a, b) {
  const g = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 6), flat('#FFFFFF'), false, false);
  pole.position.y = 1.0;
  const top = mesh(new THREE.ConeGeometry(1.15, 0.45, 8, 1, true), new THREE.MeshStandardMaterial({ map: parasolTex(a, b), side: THREE.DoubleSide, roughness: 0.7, flatShading: true }), false, false);
  top.position.y = 2.05;
  g.add(pole, top);
  return g;
}
function lounger(color) {
  const g = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(0.62, 0.08, 1.4), flat('#FFFFFF'), false, false);
  base.position.y = 0.28;
  const back = mesh(new THREE.BoxGeometry(0.62, 0.08, 0.6), flat('#FFFFFF'), false, false);
  back.position.set(0, 0.48, -0.85); back.rotation.x = -0.75;
  const towel = mesh(new THREE.BoxGeometry(0.5, 0.02, 1.25), flat(color), false, false);
  towel.position.y = 0.33;
  for (const [x, z] of [[-0.26, -0.6], [0.26, -0.6], [-0.26, 0.6], [0.26, 0.6]]) {
    const leg = mesh(new THREE.BoxGeometry(0.05, 0.28, 0.05), flat('#D9DEE6'), false, false);
    leg.position.set(x, 0.14, z);
    g.add(leg);
  }
  g.add(base, back, towel);
  return g;
}
// Uniwersytet: główny gmach z kolumnadą, frontonem i wieżą zegarową
function clockTexture() {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
  g.strokeStyle = IRON; g.lineWidth = 12; g.stroke();
  g.fillStyle = IRON;
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.fillRect(128 + Math.cos(a) * 92 - 5, 128 + Math.sin(a) * 92 - 5, 10, 10); }
  for (let k = 0; k < 60; k++) { if (k % 5) { const a = (k / 60) * Math.PI * 2; g.fillRect(128 + Math.cos(a) * 98 - 1.5, 128 + Math.sin(a) * 98 - 1.5, 3, 3); } }
  g.beginPath(); g.arc(128, 128, 9, 0, Math.PI * 2); g.fill();
  return tex(c);
}
function universityHall() {
  const g = new THREE.Group();
  const W = 20, Dp = 8, H = 6.4;
  const cream = '#F3EEE3';
  const [fm, fl] = facadeTexture(12, 4, 'grid', cream);
  const [sm, sl] = facadeTexture(5, 4, 'grid', cream);
  const mk = (map, lit) => { const m = new THREE.MeshStandardMaterial({ map, emissiveMap: lit, emissive: '#FFFFFF', emissiveIntensity: 0, roughness: 0.6 }); nightMats.push([m, 1.15]); return m; };
  const front = mk(fm, fl), side = mk(sm, sl), roofM = mat('#D9D4CA', { roughness: 0.9 });
  const body = mesh(new THREE.BoxGeometry(W, H, Dp), [side, side, roofM, roofM, front, front], false, false);
  body.position.y = H / 2;
  g.add(body);
  const cornice = mesh(new THREE.BoxGeometry(W + 0.5, 0.35, Dp + 0.5), mat(TRIM, { roughness: 0.7 }), false, false);
  cornice.position.y = H + 0.17;
  g.add(cornice);
  // portyk: schody, kolumny, belkowanie i trójkątny fronton
  const portW = 11, portD = 3.2;
  for (let k = 0; k < 3; k++) {
    const step = mesh(new THREE.BoxGeometry(portW + 1.6 - k * 0.5, 0.22, portD + 1.4 - k * 0.45), flat('#E8E1D3'), false, false);
    step.position.set(0, 0.11 + k * 0.22, Dp / 2 + (portD + 1.4 - k * 0.45) / 2 - 0.2);
    g.add(step);
  }
  const colM = flat('#FFFFFF');
  for (let k = 0; k < 8; k++) {
    const col = mesh(new THREE.CylinderGeometry(0.28, 0.32, H - 0.7, 12), colM, false, false);
    col.position.set(-portW / 2 + 0.6 + k * ((portW - 1.2) / 7), 0.66 + (H - 0.7) / 2, Dp / 2 + portD - 0.5);
    g.add(col);
  }
  const beam = mesh(new THREE.BoxGeometry(portW, 0.55, portD), flat(cream), false, false);
  beam.position.set(0, H - 0.05 + 0.25, Dp / 2 + portD / 2 - 0.1);
  g.add(beam);
  const ped = new THREE.Shape(); ped.moveTo(-portW / 2, 0); ped.lineTo(portW / 2, 0); ped.lineTo(0, 1.7); ped.closePath();
  const pedM = mesh(new THREE.ExtrudeGeometry(ped, { depth: portD, bevelEnabled: false }), flat(cream), false, false);
  pedM.position.set(0, H + 0.5, Dp / 2 - 0.1);
  g.add(pedM);
  const pedRim = mesh(new THREE.ExtrudeGeometry(ped, { depth: 0.12, bevelEnabled: false }), goldMat, false, false);
  pedRim.scale.set(0.82, 0.62, 1); pedRim.position.set(0, H + 0.68, Dp / 2 + portD - 0.05);
  g.add(pedRim);
  // wieża zegarowa w środku
  const tower = mesh(new THREE.BoxGeometry(3.2, 6.5, 3.2), flat(cream), false, false);
  tower.position.set(0, H + 3.25, -0.6);
  g.add(tower);
  const clockM = new THREE.MeshStandardMaterial({ map: clockTexture(), roughness: 0.5, transparent: true });
  // zegar działa: wskazówki pokazują prawdziwą godzinę (czas komputera gracza)
  const handM = mat(IRON, { roughness: 0.4, metalness: 0.3 });
  const hourGeo = new THREE.BoxGeometry(0.11, 0.62, 0.035).translate(0, 0.25, 0), minGeo = new THREE.BoxGeometry(0.07, 0.92, 0.035).translate(0, 0.38, 0);
  const hands = [];
  for (const [x, z, ry] of [[0, 1.01, 0], [0, -2.21, Math.PI], [1.61, -0.6, Math.PI / 2], [-1.61, -0.6, -Math.PI / 2]]) {
    const cl = new THREE.Mesh(new THREE.CircleGeometry(1.15, 32), clockM);
    cl.position.set(x, H + 4.6, z);
    cl.rotation.y = ry;
    const hh = new THREE.Mesh(hourGeo, handM), mh = new THREE.Mesh(minGeo, handM);
    hh.position.z = 0.03; mh.position.z = 0.055;
    cl.add(hh, mh);
    hands.push([hh, mh]);
    g.add(cl);
  }
  worldAnim.push(() => {
    const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
    for (const [hh, mh] of hands) { hh.rotation.z = -h / 12 * Math.PI * 2; mh.rotation.z = -m / 60 * Math.PI * 2; }
  });
  const roof = mesh(new THREE.ConeGeometry(2.6, 2.6, 4), flat(ROOF), false, false);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, H + 6.5 + 1.3, -0.6);
  const spire = mesh(new THREE.CylinderGeometry(0.03, 0.08, 1.4, 6), goldMat, false, false);
  spire.position.set(0, H + 6.5 + 3.2, -0.6);
  g.add(roof, spire);
  return g;
}
// Parking: samochodziki w różnych kolorach
const carMats = new Map();
function car(color) {
  const glb = cloneModel('car', n => {
    if (n !== 'player') return null;
    if (!carMats.has(color)) carMats.set(color, new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08, vertexColors: true }));
    return carMats.get(color);
  });
  if (glb) { glb.traverse(m => { m.castShadow = false; }); return glb; }
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(1.0, 0.42, 2.0), flat(color, { roughness: 0.4 }), false, false);
  body.position.y = 0.36;
  const cabin = mesh(new THREE.BoxGeometry(0.86, 0.36, 1.05), flat('#DDE7F3', { roughness: 0.2 }), false, false);
  cabin.position.set(0, 0.74, -0.1);
  const roofC = mesh(new THREE.BoxGeometry(0.88, 0.06, 0.95), flat(color), false, false);
  roofC.position.set(0, 0.94, -0.1);
  g.add(body, cabin, roofC);
  for (const [x, z] of [[-0.5, -0.62], [0.5, -0.62], [-0.5, 0.62], [0.5, 0.62]]) {
    const wh = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12), flat('#22252B'), false, false);
    wh.rotation.z = Math.PI / 2; wh.position.set(x, 0.18, z);
    g.add(wh);
  }
  return g;
}
// Łodzie: kadłub z przekrojów (ostry dziób, płaska rufa, burty zaokrąglone ku stępce), pokład z deskami,
// maszt z bomem i wybrzuszone żagle. Dziób na +z, linia wody na y = 0. Na pokładach nie ma ludzi.
function hullTexture(stripe) {
  const [c, g] = makeCanvas(64, 512);   // v: 0 stępka (dół płótna), 1 krawędź pokładu (góra płótna)
  g.fillStyle = '#F7F9FC'; g.fillRect(0, 0, 64, 512);
  const band = (v0, v1, col) => { g.fillStyle = col; g.fillRect(0, (1 - v1) * 512, 64, (v1 - v0) * 512 + 1); };
  band(0, 0.54, '#A9433D');        // farba pod linią wody
  band(0.54, 0.575, '#2B2F36');    // cienki pas przy linii wody
  band(0.8, 0.875, stripe);        // pas burtowy w kolorze łodzi
  band(0.965, 1, '#C3CAD4');       // listwa odbojowa
  return tex(c);
}
function plankTexture(base, line) {
  const [c, g] = makeCanvas(256, 256), r = texRng(17);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 12; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '90,60,30'},${0.04 + r() * 0.06})`;
    g.fillRect(0, k * 21.3, 256, 21.3);
    g.fillStyle = line; g.fillRect(0, k * 21.3, 256, 1.6);
  }
  return tex(c);
}
function sailTexture(col) {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = col; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
  for (let k = 1; k < 8; k++) { g.beginPath(); g.moveTo(0, k * 32); g.lineTo(256, k * 32 - 18); g.stroke(); }   // szwy paneli
  g.strokeStyle = 'rgba(0,0,0,.12)';
  for (let k = 1; k < 8; k++) { g.beginPath(); g.moveTo(0, k * 32 + 2); g.lineTo(256, k * 32 - 16); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(246, 0, 10, 256); g.fillRect(0, 0, 8, 256);   // taśmy na krawędziach
  return tex(c);
}
const BOAT_TEX = new Map();
const boatTex = (key, make) => { if (!BOAT_TEX.has(key)) BOAT_TEX.set(key, make()); return BOAT_TEX.get(key); };
function hullGeometry(L, B, H, draft, rows = 30, cols = 12) {
  const sec = u => {
    const w = (B / 2) * (u < 0.42 ? 0.8 + 0.2 * Math.sin((u / 0.42) * Math.PI / 2) : Math.pow(Math.max(0, Math.cos(((u - 0.42) / 0.58) * Math.PI / 2)), 0.8));   // max(0): przy samym dziobie cos bywa minimalnie ujemny
    const top = H * (1 + 0.22 * u * u);            // pokład wznosi się ku dziobowi
    const keel = -draft * (1 - Math.pow(u, 2.5));  // stępka wychodzi ku górze przy dziobie
    return [w, top, keel];
  };
  const pos = [], uv = [], idx = [], n = 2 * cols + 1;
  for (let i = 0; i <= rows; i++) {
    const u = i / rows, z = -L / 2 + u * L, [w, top, keel] = sec(u);
    for (let j = 0; j < n; j++) {
      const v = (j - cols) / cols, th = Math.abs(v) * Math.PI / 2;
      pos.push(Math.sign(v) * w * Math.pow(Math.sin(th), 0.55), keel + (top - keel) * (1 - Math.cos(th)), z);
      uv.push(u, Math.abs(v));
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < n - 1; j++) {
    const a = i * n + j, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hull.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  hull.setIndex(idx); hull.computeVertexNormals();
  // pokład: lekko wypukły, trochę cofnięty od burty (widać listwę)
  const dp = [], duv = [], di = [];
  for (let i = 0; i <= rows; i++) {
    const u = i / rows, z = -L / 2 + u * L, [w, top] = sec(u), ww = w * 0.94, y = top - 0.012;
    dp.push(-ww, y, z, 0, y + 0.035 * (w / (B / 2)), z, ww, y, z);
    duv.push(u, 0, u, 0.5, u, 1);
  }
  for (let i = 0; i < rows; i++) {
    const p = i * 3, q = p + 3;
    di.push(p, q, p + 1, p + 1, q, q + 1, p + 1, q + 1, p + 2, p + 2, q + 1, q + 2);
  }
  const deck = new THREE.BufferGeometry();
  deck.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  deck.setAttribute('uv', new THREE.Float32BufferAttribute(duv, 2));
  deck.setIndex(di); deck.computeVertexNormals();
  // pawęż (płaska rufa)
  const [w0, top0, keel0] = sec(0), sh = new THREE.Shape();
  for (let j = 0; j < n; j++) {
    const v = (j - cols) / cols, th = Math.abs(v) * Math.PI / 2;
    const x = Math.sign(v) * w0 * Math.pow(Math.sin(th), 0.55), y = keel0 + (top0 - keel0) * (1 - Math.cos(th));
    if (j === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
  }
  sh.closePath();
  const transom = new THREE.ShapeGeometry(sh);
  transom.rotateY(Math.PI); transom.translate(0, 0, -L / 2);
  return { hull, deck, transom, sec };
}
// Żagiel: trójkąt rozpięty między halsem, głowicą i rogiem szotowym, wybrzuszony od wiatru
function sailGeometry(tack, head, clew, belly, roach = 0.12, rows = 12, cols = 8) {
  const pos = [], uv = [], idx = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i <= rows; i++) {
    const s = i / rows;
    a.copy(tack).lerp(head, s);
    b.copy(clew).lerp(head, s);
    b.z -= roach * Math.sin(Math.PI * s);   // lekko wypukła tylna krawędź
    for (let j = 0; j <= cols; j++) {
      const t = j / cols;
      p.copy(a).lerp(b, t);
      p.x += belly * Math.sin(Math.PI * t) * (1 - 0.65 * s);
      pos.push(p.x, p.y, p.z); uv.push(t, s);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const q = i * (cols + 1) + j;
    idx.push(q, q + 1, q + cols + 1, q + 1, q + cols + 2, q + cols + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
const tube = (pts, r, material) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 6), material);
function railing(g, sec, L, from, to, height, material) {
  for (const side of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const u = from + (to - from) * (k / 8), [w, top] = sec(u);
      pts.push(new THREE.Vector3(side * w * 0.9, top + height, -L / 2 + u * L));
    }
    g.add(tube(pts, 0.012, material));
    for (let k = 0; k <= 4; k++) {
      const u = from + (to - from) * (k / 4), [w, top] = sec(u);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, height, 6), material);
      post.position.set(side * w * 0.9, top + height / 2, -L / 2 + u * L);
      g.add(post);
    }
  }
}
// Łodzie z Blendera (assets/models/boats.glb, tools/blender/boats.py): gładki kadłub z pasami, kabina z oknami,
// olinowanie i relingi, wybrzuszone żagle. Pasy i grot gra barwi na kolor łodzi. Bez pliku zostają łodzie z kodu (niżej).
const boatMats = new Map();
function glbBoat(name, sail, stripe) {
  const once = (key, make) => { if (!boatMats.has(key)) boatMats.set(key, make()); return boatMats.get(key); };
  return cloneModel(name, n => {
    if (n === 'boat_stripe') return once(`stripe${stripe}`, () => new THREE.MeshPhysicalMaterial({ color: stripe, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.1, vertexColors: true }));
    if (n === 'boat_sail') return once(`sail${sail}`, () => new THREE.MeshStandardMaterial({ color: sail === '#FFFFFF' ? '#F3F0E8' : sail, roughness: 0.8, side: THREE.DoubleSide, vertexColors: true }));
    return null;
  });
}
function sailboat(sail, stripe = sail === '#FFFFFF' ? '#2F7FF0' : sail) {
  const glb = glbBoat('sailboat', sail, stripe);
  if (glb) return glb;
  const g = new THREE.Group();
  const L = 3.0, B = 1.05, H = 0.42, draft = 0.3;
  const { hull, deck, transom, sec } = hullGeometry(L, B, H, draft);
  const white = mat('#F7F9FC', { roughness: 0.35 });
  g.add(mesh(hull, new THREE.MeshStandardMaterial({ map: boatTex('hull' + stripe, () => hullTexture(stripe)), roughness: 0.32 }), false, false));
  g.add(mesh(deck, new THREE.MeshStandardMaterial({ map: boatTex('teak', () => plankTexture('#C99A68', 'rgba(70,45,25,.55)')), roughness: 0.75 }), false, false));
  g.add(mesh(transom, white, false, false));
  // kabina z oknami i kokpit
  const cabin = mesh(new RoundedBoxGeometry(0.6, 0.2, 0.95, 3, 0.07), white, false, false);
  cabin.position.set(0, sec(0.5)[1] + 0.08, 0.05);
  const glass = mesh(new RoundedBoxGeometry(0.62, 0.065, 0.62, 2, 0.03), mat('#2E4466', { roughness: 0.15, metalness: 0.3 }), false, false);
  glass.position.set(0, cabin.position.y + 0.02, 0.05);
  g.add(cabin, glass);
  // kil i ster pod wodą
  const fin = mesh(new THREE.BoxGeometry(0.05, 0.55, 0.62), mat('#2B2F36'), false, false);
  fin.position.set(0, -draft - 0.24, 0.1);
  const rudder = mesh(new THREE.BoxGeometry(0.04, 0.42, 0.24), mat('#2B2F36'), false, false);
  rudder.position.set(0, -0.2, -L / 2 + 0.22);
  g.add(fin, rudder);
  // maszt, bom, olinowanie
  const alu = mat('#D5DBE4', { roughness: 0.3, metalness: 0.6 });
  const mz = 0.42, deckY = sec(0.5 + mz / L)[1];
  const mast = mesh(new THREE.CylinderGeometry(0.03, 0.042, 3.7, 10), alu, false, false);
  mast.position.set(0, deckY + 1.85, mz);
  const boomY = deckY + 0.62;
  const boom = mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.55, 8), alu, false, false);
  boom.rotation.x = Math.PI / 2; boom.position.set(0, boomY, mz - 0.77);
  g.add(mast, boom);
  const wire = mat('#9AA3B0', { roughness: 0.4, metalness: 0.5 });
  const topY = deckY + 3.65, bowZ = L / 2 - 0.05, bowY = sec(0.985)[1];
  g.add(tube([new THREE.Vector3(0, bowY, bowZ), new THREE.Vector3(0, topY - 0.3, mz + 0.02)], 0.008, wire));
  g.add(tube([new THREE.Vector3(0, sec(0.02)[1], -L / 2 + 0.05), new THREE.Vector3(0, topY, mz - 0.02)], 0.008, wire));
  railing(g, sec, L, 0.08, 0.9, 0.24, alu);
  // grot (kolor łodzi) i fok (biały), lekko wybrzuszone
  const main = sailGeometry(new THREE.Vector3(0, boomY + 0.03, mz - 0.05), new THREE.Vector3(0, topY - 0.05, mz - 0.04), new THREE.Vector3(0, boomY + 0.03, mz - 1.5), 0.2);
  const jib = sailGeometry(new THREE.Vector3(0, bowY + 0.06, bowZ - 0.08), new THREE.Vector3(0, topY - 0.45, mz + 0.06), new THREE.Vector3(0, deckY + 0.45, mz - 0.25), 0.16, 0.05);
  g.add(mesh(main, new THREE.MeshStandardMaterial({ map: boatTex('sail' + sail, () => sailTexture(sail)), side: THREE.DoubleSide, roughness: 0.75 }), false, false));
  g.add(mesh(jib, new THREE.MeshStandardMaterial({ map: boatTex('sail#FFFFFF', () => sailTexture('#FFFFFF')), side: THREE.DoubleSide, roughness: 0.75 }), false, false));
  return g;
}
// Motorówka (zamiast skutera z ludzikiem): ostry kadłub, konsola z szybą, kanapy i silnik za rufą
function motorboat(stripe = '#F2B72E') {
  const glb = glbBoat('motorboat', '#FFFFFF', stripe);
  if (glb) return glb;
  const g = new THREE.Group();
  const L = 2.7, B = 1.15, H = 0.36, draft = 0.2;
  const { hull, deck, transom, sec } = hullGeometry(L, B, H, draft);
  const white = mat('#F7F9FC', { roughness: 0.35 });
  g.add(mesh(hull, new THREE.MeshStandardMaterial({ map: boatTex('hull' + stripe, () => hullTexture(stripe)), roughness: 0.3 }), false, false));
  g.add(mesh(deck, new THREE.MeshStandardMaterial({ map: boatTex('deckW', () => plankTexture('#EEF1F5', 'rgba(120,130,145,.35)')), roughness: 0.6 }), false, false));
  g.add(mesh(transom, white, false, false));
  const y0 = sec(0.5)[1];
  const consoleM = mesh(new RoundedBoxGeometry(0.42, 0.34, 0.36, 3, 0.06), white, false, false);
  consoleM.position.set(0, y0 + 0.17, 0.12);
  const shield = mesh(new THREE.BoxGeometry(0.5, 0.26, 0.02), new THREE.MeshStandardMaterial({ color: '#9CC4EA', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55 }), false, false);
  shield.position.set(0, y0 + 0.44, 0.31); shield.rotation.x = -0.45;
  const seatM = mat('#E9DCC6', { roughness: 0.8 });
  const bench = mesh(new RoundedBoxGeometry(0.85, 0.16, 0.34, 3, 0.06), seatM, false, false);
  bench.position.set(0, y0 + 0.08, -0.72);
  const back = mesh(new RoundedBoxGeometry(0.85, 0.3, 0.1, 3, 0.04), seatM, false, false);
  back.position.set(0, y0 + 0.22, -0.92);
  const chair = mesh(new RoundedBoxGeometry(0.3, 0.14, 0.3, 3, 0.05), seatM, false, false);
  chair.position.set(0, y0 + 0.07, -0.18);
  g.add(consoleM, shield, bench, back, chair);
  // silnik za burtą
  const dark = mat('#2B2F36', { roughness: 0.45, metalness: 0.2 });
  const cowl = mesh(new RoundedBoxGeometry(0.26, 0.32, 0.3, 3, 0.07), dark, false, false);
  cowl.position.set(0, y0 + 0.08, -L / 2 - 0.12);
  const leg = mesh(new THREE.BoxGeometry(0.08, 0.5, 0.12), dark, false, false);
  leg.position.set(0, y0 - 0.3, -L / 2 - 0.14);
  g.add(cowl, leg);
  railing(g, sec, L, 0.62, 0.97, 0.18, mat('#D5DBE4', { roughness: 0.3, metalness: 0.6 }));
  return g;
}

{
  // Blok ziemi: trawa na górze, warstwy ziemi na bokach (ląd i podstawa pod wodą)
  const strata = strataTexture();
  const strataMat = (w, frac = 1) => {
    const t = strata.clone(); t.needsUpdate = true;
    t.repeat.set(w / 7, frac); t.offset.set(0, 0);
    return mat('#FFFFFF', { map: t, roughness: 0.95 });
  };
  const LAND_D = SHORE_Z - BZB, H_ALL = GROUND_Y - BOTTOM_Y;
  const grassTop = mat('#FFFFFF', { map: grassTexture(), roughness: 0.95 });
  grassTop.map.repeat.set(LAND_D / 9, BX * 2 / 9);
  const land = mesh(new THREE.BoxGeometry(BX * 2, H_ALL, LAND_D),
    [strataMat(LAND_D), strataMat(LAND_D), grassTop, flat('#4A4540'), strataMat(BX * 2), strataMat(BX * 2)], false, true);
  land.position.set(0, BOTTOM_Y + H_ALL / 2, (BZB + SHORE_Z) / 2);
  world.add(land);
  const SEA_D = BZF - SHORE_Z, H_SEA = FLOOR_Y - BOTTOM_Y;
  const seaBase = mesh(new THREE.BoxGeometry(BX * 2, H_SEA, SEA_D),
    [strataMat(SEA_D, H_SEA / H_ALL), strataMat(SEA_D, H_SEA / H_ALL), flat('#E3C893'), flat('#4A4540'), strataMat(BX * 2, H_SEA / H_ALL), strataMat(BX * 2, H_SEA / H_ALL)], false, false);
  seaBase.position.set(0, BOTTOM_Y + H_SEA / 2, (SHORE_Z + BZF) / 2);
  world.add(seaBase);
  // Dno morskie z piasku: zejście z plaży do wody, na dnie przesuwają się kaustyki
  const prof = new THREE.Shape();
  prof.moveTo(SHORE_Z, FLOOR_Y);
  for (const [z, y] of SEABED) prof.lineTo(z, y);
  prof.lineTo(BZF, FLOOR_Y);
  prof.closePath();
  const wedgeGeo = new THREE.ExtrudeGeometry(prof, { depth: BX * 2, bevelEnabled: false });
  wedgeGeo.rotateY(-Math.PI / 2);
  wedgeGeo.translate(BX, 0, 0);
  // Kaustyki: fale skupiają światło na dnie w siatkę jasnych linii. Linie to krawędzie komórek Voronoi
  // (szum MaterialX), dwie warstwy płyną w różne strony; im głębiej, tym słabsze
  const causT = TSL.uniform(0);
  const sandM = new THREE.MeshStandardNodeMaterial({ color: '#E9D3A0', roughness: 1 });
  {
    const { vec3, smoothstep, max, exp, float, positionWorld, mx_worley_noise_vec2, mx_noise_vec3 } = TSL;
    // współrzędne lekko falują (szum), więc komórki mają różne kształty jak prawdziwe kaustyki
    const warp = mx_noise_vec3(vec3(positionWorld.x.mul(0.3), positionWorld.z.mul(0.3), causT.mul(0.08))).xy.mul(0.9);
    const px = positionWorld.x.add(warp.x), pz = positionWorld.z.add(warp.y);
    const net = (sc, sx, sz, st) => {
      const f = mx_worley_noise_vec2(vec3(px.mul(sc).add(causT.mul(sx)), pz.mul(sc).add(causT.mul(sz)), causT.mul(st)));
      return smoothstep(0.15, 0, f.y.sub(f.x));
    };
    const c = max(net(0.8, 0.05, 0.03, 0.22), net(1.3, -0.04, 0.05, 0.3).mul(0.7));
    const depth = max(float(WATER_Y).sub(positionWorld.y), 0);
    const under = smoothstep(SHORE_Z + 0.4, SHORE_Z + 1.6, positionWorld.z);
    sandM.emissiveNode = vec3(0.96, 1, 0.94).mul(c).mul(under).mul(exp(depth.mul(-0.55))).mul(waterLight).mul(0.65);
  }
  const wedge = mesh(wedgeGeo, sandM, false, true);
  world.add(wedge);
  worldAnim.push(t => { causT.value = t; });
  // Plaża: pas piasku zaraz za stołem, wzdłuż całego boku
  const sand = sandTextures(), BEACH_D = SHORE_Z - SAND_Z + 0.02;
  for (const t of [sand.map, sand.normalMap]) t.repeat.set(BX * 2 / 6, BEACH_D / 6);
  const beach = mesh(new THREE.PlaneGeometry(BX * 2, BEACH_D), mat('#FFFFFF', { map: sand.map, normalMap: sand.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1 }), false, true);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, GROUND_Y + 0.015, (SAND_Z + SHORE_Z) / 2);
  world.add(beach);
  // mokry piasek: ciemniejszy i lekko błyszczący pas tuż przy wodzie
  const [wc, wg] = makeCanvas(4, 128);
  const wgr = wg.createLinearGradient(0, 0, 0, 128);
  wgr.addColorStop(0, '#000'); wgr.addColorStop(0.55, '#666'); wgr.addColorStop(1, '#FFF');
  wg.fillStyle = wgr; wg.fillRect(0, 0, 4, 128);
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(BX * 2, 1.8), new THREE.MeshStandardMaterial({ color: '#9C8257', roughness: 0.35, transparent: true, opacity: 0.55, alphaMap: new THREE.CanvasTexture(wc), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  wet.rotation.x = -Math.PI / 2;
  wet.position.set(0, GROUND_Y + 0.02, SHORE_Z - 0.9);
  world.add(wet);

  // Woda: przezroczysta jak galaretka, z falami na powierzchni i widoczna w przekroju.
  // Jak prawdziwa woda: przez powierzchnię widać dno (załamane przez fale), a im głębiej, tym więcej światła
  // woda pochłania: najpierw czerwień, potem zieleń, więc płycizna jest prawie przezroczysta i turkusowa,
  // a głębia granatowa. Pod małym kątem odbija niebo (Fresnel), słońce daje ostry połysk.
  const {
    Fn, uniform, vec2, vec3, vec4, float, uv, positionLocal, positionWorld, normalLocal, cameraPosition, screenUV,
    smoothstep, mix, sin, cos, cross, normalize, pow, clamp, dot, abs, exp, max, varyingProperty, output, select,
    texture, viewportSharedTexture, transformNormalToView, mx_noise_float, mx_noise_vec3,
  } = TSL;
  const waterU = { uTime: uniform(0), uSunDir: uniform(new THREE.Vector3(0.4, 0.8, 0.3)) };
  const ripTex = ripples.getTexture();
  const waterMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.06, metalness: 0, transparent: true });
  // Odbicia w wodzie: osobna mapa otoczenia z nieba (ten sam gradient co tło i ciepła poświata wokół słońca).
  // Wspólna mapa sceny (pokój z lampami) dawała na falach białe prostokątne pasy, których na morzu nie ma.
  const wsTop = uniform(new THREE.Color('#DCE6EF')), wsBottom = uniform(new THREE.Color('#F4F1EB'));
  const wsSun = uniform(new THREE.Vector3(0.4, 0.8, 0.3)), wsSunCol = uniform(new THREE.Color('#FFF4E2'));
  const wsMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false });
  wsMat.colorNode = Fn(() => {
    const d = normalize(positionLocal);
    const base = mix(wsBottom, wsTop, d.y.mul(1.6).add(0.08).clamp(0, 1).pow(0.8));
    const glow = pow(max(dot(d, wsSun), 0), 10).mul(0.35).add(pow(max(dot(d, wsSun), 0), 90).mul(1.2));
    return base.add(wsSunCol.mul(glow));
  })();
  const wsScene = new THREE.Scene();
  wsScene.add(new THREE.Mesh(new THREE.SphereGeometry(5, 48, 24), wsMat));
  let wsTarget = null;
  updateWaterSky = (top, bottom, sunPos, sunColor) => {
    wsTop.value.copy(top); wsBottom.value.copy(bottom);
    wsSun.value.copy(sunPos).normalize(); wsSunCol.value.copy(sunColor);
    const next = pmrem.fromScene(wsScene, 0, 0.1, 20);
    waterMat.envMap = next.texture;
    waterMat.needsUpdate = true;
    wsTarget?.dispose();
    wsTarget = next;
  };
  updateWaterSky(wsTop.value, wsBottom.value, wsSun.value, wsSunCol.value);
  const waveH = varyingProperty('float', 'vWaveH'), waveN = varyingProperty('vec3', 'vWaveN');
  // fale Gerstnera i zmarszczki z symulacji liczone na karcie graficznej: przesunięcie powierzchni i nowa normalna
  waterMat.positionNode = Fn(() => {
    const p = positionLocal, u = uv();
    const wp = vec3(p.x, float(WZ0 + WD / 2).sub(p.y), 0);
    const wAmp = smoothstep(0, 0.035, u.x).mul(smoothstep(0, 0.035, u.x.oneMinus())).mul(smoothstep(0, 0.05, u.y))
      .mul(smoothstep(0.72, 1, u.y).oneMinus().mul(0.6).add(0.4));
    let disp = vec3(0), tan = vec3(1, 0, 0), bin = vec3(0, 0, 1);
    for (const [dx, dz, L, st0] of WAVES) {
      const k = 2 * Math.PI / L, c = Math.sqrt(9.8 / k) * WAVE_SPEED;
      const f = wp.x.mul(dx).add(wp.y.mul(dz)).sub(waterU.uTime.mul(c)).mul(k);
      const st = wAmp.mul(st0), a = st.div(k), sf = sin(f), cf = cos(f);
      disp = disp.add(vec3(a.mul(cf).mul(dx), a.mul(sf), a.mul(cf).mul(dz)));
      tan = tan.add(vec3(st.mul(sf).mul(-dx * dx), st.mul(cf).mul(dx), st.mul(sf).mul(-dx * dz)));
      bin = bin.add(vec3(st.mul(sf).mul(-dx * dz), st.mul(cf).mul(dz), st.mul(sf).mul(-dz * dz)));
    }
    const rip = texture(ripTex, vec2(p.x.add(BX).div(2 * BX), wp.y.sub(WZ0).div(WD))).level(0).r;
    const n = normalize(cross(bin, tan));
    normalLocal.assign(vec3(n.x, n.z.negate(), n.y));
    waveN.assign(n);
    waveH.assign(disp.y);
    return p.add(vec3(disp.x, disp.z.negate(), disp.y.add(rip)));
  })();
  // drobne zmarszczki od wiatru (fale kapilarne) i nachylenie zmarszczek z symulacji: tylko w normalnej
  const ripUV = vec2(positionWorld.x.add(BX).div(2 * BX), positionWorld.z.sub(WZ0).div(WD));
  const rdx = 1 / (ripples.nx - 1), rdz = 1 / (ripples.nz - 1);
  const ripH = texture(ripTex, ripUV).r;
  const gx = texture(ripTex, ripUV.add(vec2(rdx, 0))).r.sub(texture(ripTex, ripUV.sub(vec2(rdx, 0))).r).div(2 * ripples.dx);
  const gz = texture(ripTex, ripUV.add(vec2(0, rdz))).r.sub(texture(ripTex, ripUV.sub(vec2(0, rdz))).r).div(2 * ripples.dz);
  // drobne zmarszczki od wiatru: dwie warstwy szumu płynące z wiatrem (bez regularnych pasów); z daleka słabną, żeby nie migotały
  const near = smoothstep(55, 12, positionWorld.distance(cameraPosition));
  const wp2 = positionWorld.xz, tt = waterU.uTime;
  const ch1 = mx_noise_vec3(vec3(wp2.x.mul(0.85).sub(tt.mul(0.32)), wp2.y.mul(0.85).sub(tt.mul(0.11)), tt.mul(0.22))).xy;
  const ch2 = mx_noise_vec3(vec3(wp2.x.mul(2.4).add(tt.mul(0.2)), wp2.y.mul(2.4).sub(tt.mul(0.45)), tt.mul(0.5))).xy;
  const chop = ch1.mul(0.075).add(ch2.mul(0.04)).mul(near);
  const nW = normalize(waveN.add(vec3(gx.add(chop.x).negate(), 0, gz.add(chop.y).negate())));
  waterMat.normalNode = transformNormalToView(vec3(nW.x, nW.z.negate(), nW.y));
  // grubość wody pod punktem: poziom wody minus dno (ten sam profil co seabedY: suma odcinków)
  let bed = float(SEABED[0][1]);
  for (let k = 1; k < SEABED.length; k++) {
    const [z0, y0] = SEABED[k - 1], [z1, y1] = SEABED[k];
    bed = bed.add(clamp(positionWorld.z.sub(z0), 0, z1 - z0).mul((y1 - y0) / (z1 - z0)));
  }
  const depth = max(float(WATER_Y).sub(bed), 0);
  const cosV = max(abs(normalize(cameraPosition.sub(positionWorld)).y), 0.2);
  const depthN = depth.mul(mx_noise_float(vec3(positionWorld.x.mul(0.11), positionWorld.z.mul(0.16), 3.7)).mul(0.35).add(1));   // nierówne dno: granica płycizny nie jest prostą linią
  const T = exp(vec3(0.42, 0.11, 0.075).mul(depthN.div(cosV)).negate());   // Beer–Lambert: ile światła przechodzi
  const refr = screenUV.add(vec2(nW.x, nW.z.negate()).mul(0.045).mul(smoothstep(0, 1.4, depth)));
  waterMat.backdropNode = viewportSharedTexture(refr).rgb.mul(T).add(vec3(0.02, 0.27, 0.38).mul(waterLight).mul(T.oneMinus()));
  waterMat.backdropAlphaNode = float(1);
  // Odbicie nieba liczy materiał (Fresnel, mapa otoczenia wyżej). Po oświetleniu dochodzą:
  // piana: rzadko na najwyższych grzbietach, za łodziami (strome zmarszczki) i przy brzegu, zawsze poszarpana szumem;
  // prześwit: grzbiet fali pod słońce świeci turkusem, bo światło przechodzi przez cienką wodę
  const lace = mx_noise_float(vec3(positionWorld.x.mul(1.9), positionWorld.z.mul(1.9), tt.mul(0.3)))
    .add(mx_noise_float(vec3(positionWorld.x.mul(5.2), positionWorld.z.mul(5.2), tt.mul(0.6))).mul(0.5));
  const ripSlope = vec2(gx, gz).length();
  const swash = sin(tt.mul(0.9).add(positionWorld.x.mul(0.21))).mul(0.5).add(0.5);   // przypływ i odpływ fali na plaży
  const crestFoam = smoothstep(WAVE_MAX * 0.78, WAVE_MAX * 0.97, waveH).mul(smoothstep(0.15, 0.6, lace));
  const wakeFoam = smoothstep(0.2, 0.5, ripSlope).mul(smoothstep(-0.1, 0.4, lace));
  const shoreFoam = smoothstep(mix(0.14, 0.32, swash), 0.02, depth).mul(smoothstep(-0.25, 0.35, lace));
  const foamAmt = clamp(crestFoam.mul(0.5).add(wakeFoam.mul(0.75)).add(shoreFoam.mul(0.85)), 0, 1);
  const toCam = normalize(positionWorld.sub(cameraPosition));
  const sss = smoothstep(WAVE_MAX * 0.2, WAVE_MAX, waveH).mul(pow(max(dot(toCam, waterU.uSunDir), 0), 4))
    .mul(waterLight).mul(0.22);
  waterMat.outputNode = vec4(output.rgb.add(vec3(0.06, 0.52, 0.48).mul(sss)).add(foamAmt.mul(0.62)), 1);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(BX * 2, WD, 260, 100), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_Y, WZ0 + WD / 2);
  water.renderOrder = 2;
  world.add(water);
  worldAnim.push((t, dt) => {
    waterU.uTime.value = t;
    waterU.uSunDir.value.copy(sun.position).normalize();
    ripples.step(dt);
    ripples.upload();
  });
  // przekrój wody: z przodu i po bokach, jaśniejszy przy powierzchni, ciemniejszy w głębi
  const sideWaterMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  {
    const k = clamp(positionWorld.y.sub(FLOOR_Y).div(WATER_Y - FLOOR_Y), 0, 1), edge = k.greaterThan(0.975);
    const c = mix(vec3(0.02, 0.33, 0.46), vec3(0.36, 0.88, 0.86), pow(k, 1.4));
    sideWaterMat.colorNode = select(edge, mix(c, vec3(0.92, 1, 1), 0.65), c).mul(waterLight.max(0.3));
    sideWaterMat.opacityNode = select(edge, float(0.9), mix(0.86, 0.6, k));
  }
  const frontW = new THREE.Mesh(new THREE.PlaneGeometry(BX * 2, WATER_Y - FLOOR_Y), sideWaterMat);
  frontW.position.set(0, (WATER_Y + FLOOR_Y) / 2, BZF + 0.01);
  frontW.renderOrder = 3;
  world.add(frontW);
  const cut = (sign) => {
    const sh = new THREE.Shape();
    const zc = SHORE_Z + 0.93;
    const pts = SEABED.filter(([z]) => z > zc);
    sh.moveTo(zc * sign, WATER_Y);
    sh.lineTo(BZF * sign, WATER_Y);
    for (let k = pts.length - 1; k >= 0; k--) sh.lineTo(pts[k][0] * sign, pts[k][1]);
    sh.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), sideWaterMat);
    m.rotation.y = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
    m.position.x = sign > 0 ? -BX - 0.01 : BX + 0.01;
    m.renderOrder = 3;
    world.add(m);
  };
  cut(1); cut(-1);
  // miękki cień pod całym blokiem
  const [shc, shg] = makeCanvas(256, 256);
  const shgr = shg.createRadialGradient(128, 128, 30, 128, 128, 128);
  shgr.addColorStop(0, 'rgba(20,30,50,.35)'); shgr.addColorStop(1, 'rgba(20,30,50,0)');
  shg.fillStyle = shgr; shg.fillRect(0, 0, 256, 256);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(BX * 3, (BZF - BZB) * 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shc), transparent: true, depthWrite: false }));
  under.rotation.x = -Math.PI / 2;
  under.position.set(3, BOTTOM_Y - 2, (BZB + BZF) / 2 + 3);
  world.add(under);

  // Plac uczelni wokół planszy: kostka, żywopłot, ławki, latarnie, flagi
  const PL = { x: 17, zb: -17, zf: SAND_Z };
  const pav = paversTexture(), TILE = 3.4;   // jeden kafel tekstury = 3,4 jednostki: kostka ma ok. 0,42 x 0,21 (w skali ludzików)
  const pavMat = (w, d) => {
    const m = pav.map.clone(), n = pav.normalMap.clone();
    for (const t of [m, n]) { t.needsUpdate = true; t.repeat.set(w / TILE, d / TILE); }
    return mat('#FFFFFF', { map: m, normalMap: n, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.88 });
  };
  const plaza = mesh(new THREE.PlaneGeometry(PL.x * 2, PL.zf - PL.zb), pavMat(PL.x * 2, PL.zf - PL.zb), false, true);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, GROUND_Y + 0.02, (PL.zb + PL.zf) / 2);
  world.add(plaza);
  const path = (x, z, w, d) => {
    const p = mesh(new THREE.PlaneGeometry(w, d), pavMat(w, d), false, true);
    p.rotation.x = -Math.PI / 2; p.position.set(x, GROUND_Y + 0.018, z);
    world.add(p);
  };
  path(0, (PL.zb - 26.5) / 2, 4, -26.5 - PL.zb);            // aleja do głównego gmachu
  path(-(PL.x + 4), -14, 8, 3); path(PL.x + 4, -14, 8, 3);    // ścieżki do wydziałów
  path(-(PL.x + 4), -1, 8, 3); path(PL.x + 4, 3, 8, 3);
  // Granitowa opaska dookoła placu (płasko z kostką) i krawężnik promenady nad plażą
  const borderM = mat('#9E978C', { roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const strip = (x, z, w, d) => { const m = mesh(new THREE.PlaneGeometry(w, d), borderM, false, true); m.rotation.x = -Math.PI / 2; m.position.set(x, GROUND_Y + 0.022, z); world.add(m); };
  strip(0, PL.zb + 0.2, PL.x * 2, 0.4); strip(-PL.x + 0.2, (PL.zb + PL.zf) / 2, 0.4, PL.zf - PL.zb); strip(PL.x - 0.2, (PL.zb + PL.zf) / 2, 0.4, PL.zf - PL.zb);
  const kerb = mesh(new THREE.BoxGeometry(BX * 2, 0.16, 0.34), mat('#DAD4CA', { roughness: 0.8 }), false, true);
  kerb.position.set(0, GROUND_Y + 0.08, SAND_Z + 0.05);
  world.add(kerb);
  const hedgeMat = flat('#3F8F3C');
  const hedge = (x, z, w, d) => { const h = mesh(new THREE.BoxGeometry(w, 0.75, d), hedgeMat, false, false); h.position.set(x, GROUND_Y + 0.37, z); world.add(h); };
  hedge(-(PL.x + 0.5), -8.5, 0.8, 9); hedge(-(PL.x + 0.5), 6.5, 0.8, 4.5); hedge(PL.x + 0.5, -8.5, 0.8, 9); hedge(PL.x + 0.5, 7.5, 0.8, 2.5);
  hedge(-10.5, PL.zb - 0.5, 13, 0.8); hedge(10.5, PL.zb - 0.5, 13, 0.8);
  const lampHead = new THREE.MeshStandardMaterial({ color: '#FFF6DE', emissive: '#FFD58A', emissiveIntensity: 0.2, roughness: 0.4 });
  nightMats.push([lampHead, 2.2, 0.2]);
  const poleMat = mat(IRON, { roughness: 0.5 });
  const lamp = (x, z) => {
    const l = new THREE.Group();
    const pole = mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.2, 8), poleMat, false, false); pole.position.y = 1.6;
    const head = mesh(new THREE.SphereGeometry(0.26, 12, 8), lampHead, false, false); head.position.y = 3.3;
    const cap = mesh(new THREE.ConeGeometry(0.32, 0.2, 12), poleMat, false, false); cap.position.y = 3.55;
    l.add(pole, head, cap); l.position.set(x, GROUND_Y, z); world.add(l);
    blob(x, z, 0.55);
  };
  for (const [x, z] of [[-15.5, -15.5], [15.5, -15.5], [-15.5, 0], [15.5, 0], [-5, -15.5], [5, -15.5]]) lamp(x, z);
  const woodM = flat('#B07A4A'), legM = mat(IRON);
  const bench = (x, z, ry) => {
    const b = new THREE.Group();
    const seat = mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), woodM, false, false); seat.position.y = 0.45;
    const back = mesh(new THREE.BoxGeometry(1.6, 0.4, 0.07), woodM, false, false); back.position.set(0, 0.72, 0.24);
    const l1 = mesh(new THREE.BoxGeometry(0.08, 0.45, 0.45), legM, false, false); l1.position.set(-0.65, 0.22, 0);
    const l2 = l1.clone(); l2.position.x = 0.65;
    b.add(seat, back, l1, l2); b.position.set(x, GROUND_Y, z); b.rotation.y = ry; world.add(b);
    blob(x, z, 1.1);
  };
  for (const z of [-11, -4, 3]) { bench(-14.6, z, -Math.PI / 2); bench(14.6, z, Math.PI / 2); }
  for (const x of [-9, 9]) bench(x, -14.8, Math.PI);
  // kosze na śmieci przy ławkach
  const binM = mat('#5E646C', { roughness: 0.6 }), binTop = mat('#3F444B', { roughness: 0.5 });
  const bin = (x, z) => {
    const b = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.62, 12), binM, false, false); body.position.y = 0.31;
    const lid = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12), binTop, false, false); lid.position.y = 0.65;
    b.add(body, lid); b.position.set(x, GROUND_Y, z); world.add(b);
    blob(x, z, 0.4);
  };
  for (const z of [-9.7, -2.7]) { bin(-14.7, z); bin(14.7, z); }
  bin(-10.3, -15.3); bin(10.3, -15.3);
  // stojak z rowerami (z tyłu placu, po prawej) i donica z kwiatami (po lewej)
  const bike = (x, z, color) => {
    const b = new THREE.Group(), fM = flat(color), tM = flat('#24272C');
    for (const dz of [-0.48, 0.48]) {
      const w = mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 18), tM, false, false);
      w.rotation.y = Math.PI / 2; w.position.set(0, 0.32, dz); b.add(w);
    }
    const bar = (len, y, z, rx) => { const m = mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), fM, false, false); m.position.set(0, y, z); m.rotation.x = rx; b.add(m); };
    bar(0.75, 0.55, 0, Math.PI / 2);        // rama górna
    bar(0.62, 0.42, 0.12, 0.85);            // rura dolna
    bar(0.5, 0.52, -0.3, -0.35);            // tylny widelec
    const seat = mesh(new THREE.BoxGeometry(0.1, 0.04, 0.22), tM, false, false); seat.position.set(0, 0.72, -0.32); b.add(seat);
    const hb = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), tM, false, false); hb.rotation.z = Math.PI / 2; hb.position.set(0, 0.78, 0.38); b.add(hb);
    b.position.set(x, GROUND_Y, z); world.add(b);
  };
  const rackM = mat('#AEB4BC', { roughness: 0.35, metalness: 0.6 });
  for (let k = 0; k < 4; k++) {
    const x = 11.3 + k * 0.85;
    const hoop = mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 14, Math.PI), rackM, false, false);
    hoop.position.set(x, GROUND_Y + 0.25, -15.6); world.add(hoop);
    for (const s of [-1, 1]) { const leg = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6), rackM, false, false); leg.position.set(x + 0.32 * s, GROUND_Y + 0.125, -15.6); world.add(leg); }
    if (k !== 2) bike(x + 0.42, -15.6, ['#E5484D', '#2F7FF0', '#F2B72E', '#1FA463'][k]);
  }
  blob(12.6, -15.6, 2.2);
  {
    const pl = new THREE.Group();
    const box = mesh(new THREE.BoxGeometry(3.0, 0.5, 0.9), mat('#CFC8BC', { roughness: 0.85 }), false, false); box.position.y = 0.25;
    const soil = mesh(new THREE.BoxGeometry(2.8, 0.04, 0.7), flat('#5B4330'), false, false); soil.position.y = 0.5;
    pl.add(box, soil);
    const r = texRng(21);
    for (let k = 0; k < 22; k++) {
      const f = mesh(new THREE.SphereGeometry(0.1 + r() * 0.08, 6, 5), flat(['#E5484D', '#F2B72E', '#FFFFFF', '#E87BB0', '#3F8F3C', '#3F8F3C'][k % 6]), false, false);
      f.position.set(-1.25 + r() * 2.5, 0.58 + r() * 0.1, -0.25 + r() * 0.5); pl.add(f);
    }
    pl.position.set(-12.6, GROUND_Y, -15.6); world.add(pl);
    blob(-12.6, -15.6, 2.0);
  }
  const [fc, fg] = makeCanvas(256, 160);
  fg.fillStyle = '#FFFFFF'; fg.fillRect(0, 0, 256, 160);
  fg.fillStyle = GOLD; fg.fillRect(0, 62, 256, 36);
  fg.fillStyle = ROOF; fg.fillRect(0, 98, 256, 10);
  const flagMat = new THREE.MeshStandardMaterial({ map: tex(fc), side: THREE.DoubleSide, roughness: 0.8 });
  for (const [x, z] of [[-3.2, -17.8], [3.2, -17.8], [-17.8, -12], [17.8, -12]]) {
    const pole = mesh(new THREE.CylinderGeometry(0.05, 0.06, 5, 8), aluMat, false, false);
    pole.position.set(x, GROUND_Y + 2.5, z);
    world.add(pole);
    const geo = new THREE.PlaneGeometry(1.5, 0.95, 12, 4);
    geo.translate(0.75, 0, 0);
    const fl = new THREE.Mesh(geo, flagMat);
    fl.position.set(x, GROUND_Y + 4.45, z);
    fl.rotation.y = wr() * Math.PI * 2;
    world.add(fl);
    flags.push({ geo, base: Float32Array.from(geo.attributes.position.array), width: 1.5 });
  }

  // Uniwersytet: główny gmach naprzeciw pola START, wydziały po bokach, biblioteka, fontanna, boisko, parking
  const homes = [];
  const hall = universityHall();
  hall.position.set(0, GROUND_Y, -31);
  world.add(hall);
  blob(0, -30, 14);
  homes.push([0, -31, 13]);
  const FAC = [[-27, -26, 10, 6.5, 8, 'band', Math.PI / 2], [-27, -10, 9, 5.5, 9, 'grid', Math.PI / 2], [27, -26, 10, 7.5, 8, 'grid', -Math.PI / 2], [27, -10, 9, 6, 9, 'curtain', -Math.PI / 2], [-15, -33, 8, 5, 6, 'grid', 0], [15, -33, 8, 6.5, 6, 'curtain', 0]];
  for (const [x, z, w, h, d, kind, ry] of FAC) {
    const b = campusBuilding(w, h, d, kind, kind === 'curtain' ? '#E9EEF6' : ['#F4F5F8', '#EEF1F6', '#F6F2EA'][homes.length % 3]);
    b.position.set(x, GROUND_Y, z);
    b.rotation.y = ry;
    world.add(b);
    blob(x, z, Math.max(w, d) * 0.75);
    homes.push([x, z, Math.max(w, d) * 0.62]);
  }
  // fontanna na dziedzińcu
  {
    const f = new THREE.Group();
    const basin = mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.5, 32), flat('#E8E1D3'), false, false); basin.position.y = 0.25;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), new THREE.MeshStandardMaterial({ color: '#58C7D6', roughness: 0.1, transparent: true, opacity: 0.85 }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.48;
    const col = mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.3, 12), flat('#E8E1D3'), false, false); col.position.y = 0.9;
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#DFF7FF', transparent: true, opacity: 0.55, depthWrite: false }));
    jet.position.y = 1.9; jet.rotation.x = Math.PI;
    f.add(basin, pool, col, jet);
    f.position.set(0, GROUND_Y, -21.5);
    world.add(f);
    worldAnim.push(t => { jet.scale.set(1 + 0.08 * Math.sin(t * 6), 1 + 0.12 * Math.sin(t * 4.3), 1 + 0.08 * Math.sin(t * 6)); });
    homes.push([0, -21.5, 2.6]);
  }
  // boisko (lewa strona, blisko plaży)
  {
    const [bc, bg] = makeCanvas(512, 320);
    bg.fillStyle = '#3B8C5A'; bg.fillRect(0, 0, 512, 320);
    bg.strokeStyle = '#FFFFFF'; bg.lineWidth = 5;
    bg.strokeRect(14, 14, 484, 292); bg.beginPath(); bg.moveTo(256, 14); bg.lineTo(256, 306); bg.stroke();
    bg.beginPath(); bg.arc(256, 160, 46, 0, Math.PI * 2); bg.stroke();
    bg.strokeRect(14, 100, 60, 120); bg.strokeRect(438, 100, 60, 120);
    const pitch = mesh(new THREE.PlaneGeometry(14, 9), mat('#FFFFFF', { map: tex(bc), roughness: 0.95 }), false, true);
    pitch.rotation.x = -Math.PI / 2; pitch.rotation.z = Math.PI / 2;
    pitch.position.set(-27, GROUND_Y + 0.02, 3);
    world.add(pitch);
    for (const z of [-3.6, 9.6]) {
      const goal = mesh(new THREE.BoxGeometry(2.4, 1.0, 0.1), flat('#FFFFFF'), false, false);
      goal.position.set(-27, GROUND_Y + 0.5, z);
      world.add(goal);
    }
    homes.push([-27, 3, 8.5]);
  }
  // parking (prawa strona)
  {
    const [pc, pg] = makeCanvas(512, 512);
    pg.fillStyle = '#5B6270'; pg.fillRect(0, 0, 512, 512);
    pg.strokeStyle = '#FFFFFF'; pg.lineWidth = 5;
    for (let k = 0; k <= 4; k++) { pg.beginPath(); pg.moveTo(40 + k * 108, 30); pg.lineTo(40 + k * 108, 200); pg.stroke(); pg.beginPath(); pg.moveTo(40 + k * 108, 312); pg.lineTo(40 + k * 108, 482); pg.stroke(); }
    pg.fillStyle = '#2F7FF0'; pg.font = `700 90px ${UI_FONT}`; pg.textAlign = 'center'; pg.textBaseline = 'middle'; pg.fillText('P', 256, 256);
    const lot = mesh(new THREE.PlaneGeometry(11, 11), mat('#FFFFFF', { map: tex(pc), roughness: 0.95 }), false, true);
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(27, GROUND_Y + 0.02, 4);
    world.add(lot);
    const cars = ['#E5484D', '#FFFFFF', '#2F7FF0', '#F2B72E', '#1FA463', IRON, '#C9CFDA'];
    [[-3.3, -2.5], [-1.0, -2.5], [1.3, -2.5], [3.6, 2.6], [-3.3, 2.6], [1.3, 2.6]].forEach(([dx, dz], k) => {
      const c = car(cars[k % cars.length]);
      c.position.set(27 + dx, GROUND_Y + 0.02, 4 + dz);
      c.rotation.y = dz < 0 ? 0 : Math.PI;
      world.add(c);
    });
    // dwa samochody jeżdżą po alejce parkingu: w jedną stronę jednym pasem, zawracają łukiem i wracają drugim
    const L0 = 22.6, L1 = 31.4, R = 0.55, len = 2 * (L1 - L0) + 2 * Math.PI * R;
    const lane = (sd, out) => {
      let d = ((sd % len) + len) % len;
      if (d < L1 - L0) return out.set(L0 + d, 4 + R, 0);
      d -= L1 - L0;
      if (d < Math.PI * R) { const a = d / R; return out.set(L1 + R * Math.sin(a), 4 + R * Math.cos(a), a); }
      d -= Math.PI * R;
      if (d < L1 - L0) return out.set(L1 - d, 4 - R, Math.PI);
      d -= L1 - L0;
      const a = d / R;
      return out.set(L0 - R * Math.sin(a), 4 - R * Math.cos(a), Math.PI + a);
    };
    const pv = new THREE.Vector3();
    [['#2F7FF0', 0], ['#E5484D', len / 2]].forEach(([col, off]) => {
      const c = car(col);
      world.add(c);
      worldAnim.push(t => {
        lane(t * 1.7 + off, pv);
        c.position.set(pv.x, GROUND_Y + 0.02, pv.y);
        c.rotation.y = Math.PI / 2 + pv.z;
      });
    });
    homes.push([27, 4, 7.5]);
  }
  // drzewa na trawie
  let placed = 0;
  for (let tries = 0; placed < 70 && tries < 3000; tries++) {
    const x = wrr(-BX + 1.5, BX - 1.5), z = wrr(BZB + 1.5, SAND_Z - 1);
    if (Math.abs(x) < PL.x + 1.4 && z > PL.zb - 1.4) continue;          // plac
    if (Math.abs(x) < 3 && z > -27) continue;                           // aleja
    if (homes.some(([hx, hz, hr]) => Math.hypot(x - hx, z - hz) < hr + 1.4)) continue;
    const s = wrr(0.75, 1.3);
    const tr = lowTree(s);
    tr.position.set(x, GROUND_Y, z);
    world.add(tr);
    blob(x, z, 1.2 * s);
    placed++;
  }

  // Plaża: parasole, leżaki, palmy, ratownik
  const PAR = [['#E5484D', '#FFFFFF'], ['#2E9E8A', '#FFFFFF'], ['#2F7FF0', '#FFFFFF'], [GOLD, '#FFFFFF'], ['#1FA463', '#FFFFFF'], ['#F2B72E', '#FFFFFF']];
  let pk = 0;
  for (let x = -33; x <= 33; x += 5.2) {
    if (Math.abs(x) < QUIET_X || Math.abs(x - 19) < 2.5) continue;   // pusty kawałek plaży przed planszą i miejsce na wieżę ratownika
    const z = (SAND_Z + SHORE_Z) / 2 + wrr(-0.4, 0.3);
    const [a, b] = PAR[pk++ % PAR.length];
    const p = parasol(a, b);
    p.position.set(x, GROUND_Y, z);
    p.rotation.z = wrr(-0.08, 0.08);
    world.add(p);
    const l = lounger(PAR[(pk + 2) % PAR.length][0]);
    l.position.set(x + 1.0, GROUND_Y, z + 0.1);
    l.rotation.y = Math.PI + wrr(-0.2, 0.2);
    world.add(l);
    blob(x + 0.3, z + 0.3, 1.5, GROUND_Y + 0.03);   // cień parasola
  }
  for (const [x, z, h] of [[-35, 12.2, 4.2], [-24.5, 11.6, 3.6], [23.8, 11.6, 4.1], [34.5, 12.4, 3.7]]) {
    const pl = palm(h);
    pl.position.set(x, GROUND_Y, z);
    pl.rotation.y = wr() * Math.PI * 2;
    world.add(pl);
    blob(x, z, 1.7);
  }
  {
    const lg = new THREE.Group();
    for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      const leg = mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), flat('#FFFFFF'), false, false); leg.position.set(x, 1.1, z); lg.add(leg);
    }
    const cab = mesh(new THREE.BoxGeometry(1.4, 0.9, 1.3), flat('#E5484D'), false, false); cab.position.y = 2.6;
    const roof = mesh(new THREE.BoxGeometry(1.7, 0.12, 1.6), flat('#FFFFFF'), false, false); roof.position.y = 3.15;
    const [cc, cg] = makeCanvas(64, 64); cg.fillStyle = '#FFFFFF'; cg.fillRect(0, 0, 64, 64); cg.fillStyle = '#E5484D'; cg.fillRect(26, 8, 12, 48); cg.fillRect(8, 26, 48, 12);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: tex(cc) }));
    sign.position.set(0, 2.6, 0.66);
    lg.add(cab, roof, sign);
    lg.position.set(19, GROUND_Y, 12.1);
    blob(19, 12.1, 1.3);
    lg.rotation.y = 0;
    world.add(lg);
  }

  // Pływanie: obiekt stoi na powierzchni fali i przechyla się zgodnie z jej nachyleniem
  const W_UP = new THREE.Vector3(0, 1, 0), wN = new THREE.Vector3(), wQ = new THREE.Quaternion(), wQy = new THREE.Quaternion();
  const floatOn = (obj, x, z, yaw, t, lift = 0, tilt = 1) => {
    const [y, sx, sz] = waveAt(x, z, t);
    obj.position.set(x, WATER_Y + y + ripples.heightAt(x, z) + lift, z);
    wQ.setFromUnitVectors(W_UP, wN.set(-sx * tilt, 1, -sz * tilt).normalize());
    obj.quaternion.copy(wQ).multiply(wQy.setFromAxisAngle(W_UP, yaw));
  };
  // Pomost z łódką i falochron z latarnią (jak w porcie)
  {
    const pier = new THREE.Group();
    const len = 11;
    for (let k = 0; k < len / 0.65; k++) {
      const plank = mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), flat('#A9764B'), false, false);
      plank.position.set(0, 0, k * 0.65);
      pier.add(plank);
    }
    for (let k = 0; k < len / 0.65; k += 3) for (const s of [-1, 1]) {
      const post = mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 6), flat('#7C5434'), false, false);
      post.position.set(s * 1.0, -2.4, k * 0.65);
      pier.add(post);
    }
    pier.position.set(-22, WATER_Y + 0.45, SHORE_Z - 0.5);
    world.add(pier);
    const boat = sailboat('#FFFFFF');
    boat.scale.setScalar(0.8);
    world.add(boat);
    worldAnim.push(t => floatOn(boat, -19.8, SHORE_Z + 7, 0, t, 0.05, 0.7));
  }
  {
    const rockM = flat('#9A958C');
    for (let k = 0; k < 18; k++) {
      const r = mesh(new THREE.IcosahedronGeometry(wrr(0.7, 1.3), 0), rockM, false, false);
      const z = SHORE_Z + 0.5 + k * 0.85;
      r.position.set(30 + wrr(-0.8, 0.8), seabedY(z) + wrr(0.4, 1.0) + (WATER_Y - seabedY(z)) * 0.85, z);
      r.rotation.set(wr() * 3, wr() * 3, wr() * 3);
      world.add(r);
    }
    const lh = new THREE.Group();
    lh.position.set(30, WATER_Y + 0.7, SHORE_Z + 15.5);
    const [stc, stg] = makeCanvas(64, 256);
    for (let k = 0; k < 8; k++) { stg.fillStyle = k % 2 ? '#D6453F' : '#FFFFFF'; stg.fillRect(0, k * 32, 64, 32); }
    const tower = mesh(new THREE.CylinderGeometry(0.6, 0.95, 5.2, 18), mat('#FFFFFF', { map: tex(stc), roughness: 0.5 }), false, false);
    tower.position.y = 2.6;
    const deck = mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.2, 18), mat(IRON), false, false); deck.position.y = 5.3;
    const lightM = new THREE.MeshStandardMaterial({ color: '#FFF8E0', emissive: '#FFE08A', emissiveIntensity: 0.6 });
    nightMats.push([lightM, 3, 0.6]);
    const lampL = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 14), lightM, false, false); lampL.position.y = 5.8;
    const roofL = mesh(new THREE.ConeGeometry(0.7, 0.8, 14), mat('#C7423C', { roughness: 0.5 }), false, false); roofL.position.y = 6.6;
    lh.add(tower, deck, lampL, roofL);
    const beamMat = new THREE.MeshBasicMaterial({ color: '#FFF1C2', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    nightMats.push([beamMat, 0.3, 0, 'opacity']);
    const beam = new THREE.Group();
    for (const s of [1, -1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 20, 24, 1, true), beamMat);
      cone.rotation.z = s * Math.PI / 2; cone.position.x = s * 10;
      beam.add(cone);
    }
    beam.position.y = 5.8;
    lh.add(beam);
    world.add(lh);
    worldAnim.push(t => { beam.rotation.y = t * 0.8; });
  }

  // Żaglówki i motorówka: płyną wzdłuż plaży i zawracają, kołyszą się na fali; za nimi zostaje prawdziwy klin fal
  // z symulacji zmarszczek (piana pojawia się tam, gdzie fale są najbardziej strome)
  const along = (obj, z, speed, x0, x1, ph, tilt = 0.8) => {
    const fenders = obj.getObjectByName('sailboat_fender');   // odbijacze wiszą tylko przy pomoście, w rejsie są schowane
    if (fenders) fenders.visible = false;
    world.add(obj);
    worldAnim.push(t => {
      const u = ((t * speed + ph) % 2 + 2) % 2, back = u > 1, k = back ? 2 - u : u;
      const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
      const x = x0 + (x1 - x0) * e, dir = back ? -1 : 1, zz = z + 0.6 * Math.sin(t * 0.4 + ph);
      floatOn(obj, x, zz, dir > 0 ? Math.PI / 2 : -Math.PI / 2, t, 0.02, tilt);
      // kadłub wypiera wodę: dziób i rufa robią falę, która rozchodzi się klinem za łodzią
      const v = Math.abs(Math.sin(Math.PI * k)) * Math.PI * speed * Math.abs(x1 - x0);   // prędkość łodzi
      ripples.disturb(x + dir * 1.0, zz, 0.0011 * v * tilt, 0.8);
      ripples.disturb(x - dir * 1.0, zz, -0.0007 * v * tilt, 0.9);
    });
  };
  along(sailboat('#E5484D'), SHORE_Z + 11, 0.035, -30, 22, 0);
  along(sailboat('#2F7FF0'), SHORE_Z + 16, 0.028, -26, 26, 0.9);
  along(sailboat('#F2B72E'), SHORE_Z + 19, 0.04, -30, 24, 1.5);
  along(motorboat(), SHORE_Z + 7.5, 0.09, -28, 26, 0.3, 1.2);
  // Boje wyznaczające kąpielisko: kilka sztuk, kołyszą się na fali
  const buoy = col => {
    const g = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(0.17, 0.27, 0.4, 14), mat(col, { roughness: 0.4 }), false, false); body.position.y = 0.06;
    const band = mesh(new THREE.CylinderGeometry(0.215, 0.235, 0.1, 14), mat('#FFFFFF', { roughness: 0.4 }), false, false); band.position.y = 0.12;
    const top = mesh(new THREE.ConeGeometry(0.17, 0.32, 14), mat(col, { roughness: 0.4 }), false, false); top.position.y = 0.42;
    g.add(body, band, top);
    return g;
  };
  [-27, -17, -7, 3, 13, 23].forEach((x, k) => {
    const b = buoy(k % 2 ? '#F2B72E' : '#E5484D');
    world.add(b);
    worldAnim.push(t => floatOn(b, x, SHORE_Z + 5.5, 0, t, -0.05, 1.5));
  });

  // Mewy krążą nad wodą: machają skrzydłami (ramię i dłoń osobno), a co jakiś czas szybują
  const gullWhite = mat('#FFFFFF', { roughness: 0.55 }), gullGrey = mat('#B7C1CD', { roughness: 0.6, side: THREE.DoubleSide });
  const gullTip = mat('#2B2F36', { roughness: 0.6, side: THREE.DoubleSide }), gullBeak = mat('#F2B72E', { roughness: 0.45 }), gullEye = mat('#1A1C20', { roughness: 0.3 });
  const shapeGeo = pts => { const sh = new THREE.Shape(); pts.forEach(([x, z], k) => (k ? sh.lineTo(x, z) : sh.moveTo(x, z))); sh.closePath(); const g = new THREE.ShapeGeometry(sh); g.rotateX(Math.PI / 2); return g; };
  const gullBodyGeo = new THREE.LatheGeometry([[0, -0.36], [0.035, -0.3], [0.075, -0.17], [0.11, -0.02], [0.118, 0.08], [0.1, 0.18], [0.05, 0.26], [0, 0.28]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
  gullBodyGeo.rotateX(Math.PI / 2);
  const innerGeo = shapeGeo([[0, 0.12], [0.5, 0.1], [0.5, -0.11], [0, -0.16]]);
  const outerGeo = shapeGeo([[0, 0.1], [0.24, 0.06], [0.24, -0.09], [0, -0.11]]);
  const tipGeo = shapeGeo([[0.24, 0.06], [0.44, 0.0], [0.38, -0.05], [0.24, -0.09]]);
  const tailGeo = shapeGeo([[0, 0], [0.11, -0.16], [0, -0.13], [-0.11, -0.16]]);
  const wing = () => {
    const shoulder = new THREE.Group(), elbow = new THREE.Group();
    shoulder.add(new THREE.Mesh(innerGeo, gullGrey));
    elbow.position.x = 0.5;
    elbow.add(new THREE.Mesh(outerGeo, gullGrey), new THREE.Mesh(tipGeo, gullTip));
    shoulder.add(elbow);
    return [shoulder, elbow];
  };
  for (let k = 0; k < 6; k++) {
    const gull = new THREE.Group();
    const body = mesh(gullBodyGeo, gullWhite, false, false);
    const head = mesh(new THREE.SphereGeometry(0.085, 14, 10), gullWhite, false, false); head.position.set(0, 0.05, 0.27);
    const beak = mesh(new THREE.ConeGeometry(0.024, 0.12, 8), gullBeak, false, false); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.035, 0.38);
    const eyes = [-1, 1].map(sd => { const e = mesh(new THREE.SphereGeometry(0.013, 8, 6), gullEye, false, false); e.position.set(sd * 0.06, 0.08, 0.31); return e; });
    const tail = new THREE.Mesh(tailGeo, gullGrey); tail.position.set(0, 0.01, -0.3);
    const [pl, el] = wing(), [pr, er] = wing();
    pl.position.set(0.07, 0.04, 0.02); pr.position.set(-0.07, 0.04, 0.02); pr.scale.x = -1;
    gull.add(body, head, beak, ...eyes, tail, pl, pr);
    gull.scale.setScalar(1.15);
    world.add(gull);
    const cx = wrr(-14, 14), cz = SHORE_Z + 12, r = wrr(6, 13), h = wrr(5, 8), sp = wrr(0.12, 0.2) * (k % 2 ? 1 : -1), a0 = wr() * 7, ph = wr() * 7;
    worldAnim.push(t => {
      const a = a0 + t * sp;
      gull.position.set(cx + r * Math.cos(a), GROUND_Y + h + 0.6 * Math.sin(t * 0.7 + ph), cz + r * 0.5 * Math.sin(a));
      gull.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(sp), Math.cos(a) * 0.5 * Math.sign(sp));
      gull.rotation.z = -0.3 * Math.sign(sp);
      const flap = Math.max(0, Math.sin(t * 0.45 + ph)) ** 0.6;    // 0 = szybuje, 1 = macha
      const f = (0.15 + 0.5 * flap) * Math.sin(t * 6.5 + ph);
      pl.rotation.z = 0.12 + f; pr.rotation.z = -(0.12 + f);
      el.rotation.z = er.rotation.z = 0.1 + 0.7 * f;
    });
  }
  // Kolorowy balon nad kampusem
  {
    const [bc, bg] = makeCanvas(1024, 512);
    const cols = ['#E5484D', '#FFFFFF', GOLD, '#FFFFFF', '#2F7FF0', '#FFFFFF'];
    for (let k = 0; k < 24; k++) { bg.fillStyle = cols[k % cols.length]; bg.fillRect(k * 1024 / 24, 0, 1024 / 24 + 1, 512); }
    bg.fillStyle = 'rgba(255,255,255,.9)'; bg.fillRect(0, 512 * 0.38, 1024, 18);   // jasny pas na wysokości „równika”
    bg.fillStyle = 'rgba(0,0,0,.18)';
    for (let k = 0; k < 24; k++) bg.fillRect(k * 1024 / 24, 0, 2, 512);           // szwy między pasami
    for (let k = 1; k < 8; k++) bg.fillRect(0, k * 64, 1024, 1.5);
    const balloon = new THREE.Group();
    const prof = [[0.42, -2.3], [0.7, -1.95], [1.2, -1.35], [1.72, -0.55], [1.98, 0.2], [2.04, 0.85], [1.88, 1.5], [1.48, 2.02], [0.88, 2.38], [0.3, 2.52], [0, 2.54]];
    const env = mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48), mat('#FFFFFF', { map: tex(bc), roughness: 0.55, side: THREE.DoubleSide }), false, false);
    const basketTex = (() => {
      const [c, g] = makeCanvas(256, 256);
      g.fillStyle = '#B07D4E'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 16) for (let x = 0; x < 256; x += 16) {
        g.fillStyle = (x / 16 + y / 16) % 2 ? 'rgba(80,50,25,.35)' : 'rgba(255,230,190,.18)';
        g.fillRect(x, y, 16, 8);
      }
      return tex(c);
    })();
    const basket = mesh(new RoundedBoxGeometry(0.8, 0.6, 0.8, 3, 0.06), mat('#FFFFFF', { map: basketTex, roughness: 0.85 }), false, false);
    basket.position.y = -3.75;
    const rim = mesh(new THREE.TorusGeometry(0.52, 0.04, 6, 4), mat('#6E4A2C', { roughness: 0.8 }), false, false);
    rim.rotation.set(Math.PI / 2, 0, Math.PI / 4); rim.position.y = -3.45; rim.scale.set(1, 1, 1);
    const burner = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.25, 12), mat('#9AA3B0', { roughness: 0.3, metalness: 0.7 }), false, false);
    burner.position.y = -2.95;
    const rope = mat('#6E5A44', { roughness: 0.9 });
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      balloon.add(tube([new THREE.Vector3(x * 0.3, -2.25, z * 0.3), new THREE.Vector3(x * 0.36, -3.45, z * 0.36)], 0.012, rope));
    }
    balloon.add(env, basket, rim, burner);
    world.add(balloon);
    worldAnim.push(t => {
      const a = 2.2 + t * 0.03;
      balloon.position.set(26 * Math.cos(a), GROUND_Y + 15 + 1.5 * Math.sin(t * 0.35), -14 + 16 * Math.sin(a));
      balloon.rotation.y = t * 0.08;
    });
  }
  // Chmurki nad makietą
  const clouds = new THREE.Group();
  const cloudMat = flat('#FFFFFF', { roughness: 1, emissive: '#FFFFFF', emissiveIntensity: 0.25 });
  for (let k = 0; k < 7; k++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = mesh(new THREE.IcosahedronGeometry(wrr(1.2, 2.0), 1), cloudMat, false, false);
      puff.position.set(j * 1.5 - 2.2, wrr(-0.3, 0.5), wrr(-0.7, 0.7));
      puff.scale.y = 0.65;
      c.add(puff);
    }
    c.position.set(wrr(-40, 40), GROUND_Y + wrr(17, 25), wrr(-64, -44));   // za kampusem, nigdy między kamerą a planszą
    c.userData.v = wrr(0.6, 1.2);
    clouds.add(c);
  }
  world.add(clouds);
  worldAnim.push((t, dt) => { for (const c of clouds.children) { c.position.x += dt * c.userData.v; if (c.position.x > 46) c.position.x = -46; } });

  // Ryba co jakiś czas wyskakuje z wody
  {
    const fish = mesh(new THREE.ConeGeometry(0.16, 0.7, 6), flat('#FF8A3D'), false, false);
    fish.rotation.x = Math.PI / 2;
    const fishG = new THREE.Group(); fishG.add(fish); fishG.visible = false;
    const ringMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false });
    const splash = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32), ringMat);
    splash.rotation.x = -Math.PI / 2;
    world.add(fishG, splash);
    let next = 3, at = 0, fx = 0, fz = 0, fishOut = false;
    worldAnim.push(t => {
      if (t > next) { next = t + wrr(3, 7); at = t; fx = wrr(-30, 28); fz = SHORE_Z + wrr(6, 19); }
      const u = (t - at) / 1.1;
      fishG.visible = u >= 0 && u <= 1;
      if (fishG.visible) {
        fishG.position.set(fx + 1.8 * (u - 0.5), WATER_Y + 1.8 * Math.sin(Math.PI * u), fz);
        fishG.rotation.set(0, Math.PI / 2, 0);
        fish.rotation.x = Math.PI / 2 + (u - 0.5) * 2.4;
      }
      const v = (t - at - 1.05) / 1.5;
      if (u > 0 && !fishOut) { fishOut = true; ripples.disturb(fx - 0.9, fz, 0.035, 0.7); }
      if (v > 0 && fishOut) { fishOut = false; ripples.disturb(fx + 0.9, fz, 0.055, 0.75); }
      ringMat.opacity = 0;
      if (v > 0 && v < 1) { splash.position.set(fx + 0.9, WATER_Y + 0.08, fz); splash.scale.setScalar(1 + v * 4); }
    });
  }
}

// Tło: jasne i czyste jak na zdjęciu makiety (nocą granat)
const skyU = { top: TSL.uniform(new THREE.Color('#DCE6EF')), bottom: TSL.uniform(new THREE.Color('#F4F1EB')) };
const skyMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
skyMat.colorNode = TSL.mix(skyU.bottom, skyU.top, TSL.normalize(TSL.positionLocal).y.mul(1.6).add(0.08).clamp(0, 1).pow(0.8));
const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 32, 16), skyMat);
sky.renderOrder = -1;
world.add(sky);
// Pora dnia (Ustawienia → Pora dnia): kolory nieba, słońce (kolor, siła, kierunek), światło otoczenia,
// świecące okna i latarnie (0 = zgaszone, 1 = wszystkie), poświata i korekcja kolorów (tablica LUT w graphics.js).
// Na zachodzie słońce stoi nisko, więc cienie są długie, a woda odbija ciepłe niebo. Nocą świeci księżyc,
// na niebie są gwiazdy, a nad planszą pali się ciepła lampa, żeby pola były czytelne.
const TIMES = {
  dzien: {
    top: '#DCE6EF', bottom: '#F4F1EB', sun: ['#FFF4E2', 2.4, [9, 18, 6]], hemi: ['#FFFFFF', '#A8C8E8', 0.55], env: LOOK.env, lights: 0, water: 1, lamp: 0,
    grade: { shadow: [-0.01, 0, 0.022], high: [0.018, 0.01, -0.012], contrast: 0.1, sat: 1.04 },
  },
  zachod: {
    top: '#E7B49B', bottom: '#FBE4CD', sun: ['#FFAE68', 2.7, [-15, 6.5, 8]], hemi: ['#FFDDBF', '#6C7CB0', 0.45], env: 0.5, lights: 0.45, water: 0.8, lamp: 8,
    grade: { shadow: [0, -0.006, 0.04], high: [0.055, 0.022, -0.03], contrast: 0.14, sat: 1.08 },
  },
  noc: {
    top: '#04081A', bottom: '#0E1C44', sun: ['#A9BEFF', 0.55, [-8, 16, -6]], hemi: ['#41558A', '#0B1024', 0.34], env: 0.24, lights: 1, water: 0.16, lamp: 34,
    grade: { shadow: [-0.01, 0, 0.05], high: [0.03, 0.02, -0.012], contrast: 0.1, sat: 0.96 },
  },
};
const TIME_NAMES = [['auto', 'Jak teraz'], ['dzien', 'Dzień'], ['zachod', 'Zachód słońca'], ['noc', 'Noc']];
// „Jak teraz”: pora dnia według zegara komputera
function timeNow(pref) {
  if (pref !== 'auto') return TIMES[pref] ? pref : 'dzien';
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  return h >= 7 && h < 17.5 ? 'dzien' : (h >= 17.5 && h < 20.5) || (h >= 5.5 && h < 7) ? 'zachod' : 'noc';
}
// Gwiazdy i księżyc (tylko nocą), lampa nad planszą (zachód i noc)
const stars = (() => {
  // gwiazdy narysowane na teksturze nieba (działa tak samo w WebGPU i WebGL2): drobne, różnej jasności, gęściej wysoko
  const w = 2048, h = 1024, [c, g] = makeCanvas(w, h);
  let seed = 3;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 1400; k++) {
    const y = Math.pow(r(), 1.6) * h * 0.46, x = r() * w, rad = 0.6 + Math.pow(r(), 3) * 1.8;
    g.fillStyle = `rgba(255,255,${235 + Math.floor(r() * 20)},${0.35 + r() * 0.65})`;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.SphereGeometry(185, 48, 24), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  m.visible = false;
  m.renderOrder = -1;
  return m;
})();
sky.add(stars);
const moon = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshBasicMaterial({ color: '#F4F1E4', fog: false, toneMapped: false }));
moon.position.set(-80, 95, -120);
moon.lookAt(0, 0, 0);
moon.visible = false;
sky.add(moon);
const boardLamp = new THREE.SpotLight('#FFE0B5', 0, 60, 0.62, 0.7, 1.2);
boardLamp.position.set(2, 16, 6);
boardLamp.target.position.set(0, 0, 0);
scene.add(boardLamp, boardLamp.target);
let worldNight = false, worldTime = 'dzien', worldSkin = 'diorama';
// Dzień, zachód albo noc na makiecie (prezentacja: dzień, a noc tylko w finale z fajerwerkami)
function setWorldMood(mood) {
  const key = mood === true ? 'noc' : mood === false ? 'dzien' : TIMES[mood] ? mood : 'dzien';
  const m = TIMES[key];
  worldTime = key;
  worldNight = key === 'noc';
  skyU.top.value.set(m.top); skyU.bottom.value.set(m.bottom);
  gfx?.setNight(m.lights);
  gfx?.setGrade(m.grade);
  scene.fog = null;
  for (const [mt, on, off = 0, prop = 'emissiveIntensity'] of nightMats) mt[prop] = off + (on - off) * m.lights;
  stars.visible = moon.visible = worldNight;
  boardLamp.intensity = m.lamp;
  waterLight.value = m.water;
  applyLights();
}
// Słońce i światło otoczenia według pory dnia (pokój ze stołem ma własne światło)
function applyLights() {
  if (worldSkin === 'pokoj') return;
  const m = TIMES[worldTime];
  sun.color.set(m.sun[0]); sun.intensity = m.sun[1]; sun.position.set(...m.sun[2]);
  hemi.color.set(m.hemi[0]); hemi.groundColor.set(m.hemi[1]); hemi.intensity = m.hemi[2];
  scene.environmentIntensity = m.env;
  updateWaterSky(skyU.top.value, skyU.bottom.value, sun.position, sun.color);
}
setWorldMood('dzien');
function worldTick(t, dt) {
  if (!world.visible) return;
  for (const f of worldAnim) f(t, dt);
}

const tileBodyMat = mat(LOOK.tileBody, { roughness: 0.6 });

// ---------------------------------------------------------------------------
// Dwa wyglądy do wyboru (Ustawienia → Wygląd planszy):
//  - „Diorama nad wodą”: makieta z plażą, wodą i uniwersytetem (wyżej),
//  - „Czysta tektura”: sama plansza jak z kartonu na jasnym, gładkim stole.
// ---------------------------------------------------------------------------
const cardboard = new THREE.Group();
cardboard.visible = false;
scene.add(cardboard);
const kraftTex = (() => {
  const [c, g] = makeCanvas(256, 64);
  g.fillStyle = '#C49A63'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#D9B27C'; g.fillRect(0, 0, 256, 10); g.fillRect(0, 54, 256, 10);   // papier na wierzchu i od spodu
  g.strokeStyle = '#A97D48'; g.lineWidth = 3;                                          // fala tektury w środku
  g.beginPath();
  for (let x = 0; x <= 256; x += 4) g.lineTo(x, 32 + 13 * Math.sin(x * 0.35));
  g.stroke();
  g.fillStyle = 'rgba(80,50,20,.25)'; g.fillRect(0, 10, 256, 2); g.fillRect(0, 52, 256, 2);
  const t = tex(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1);
  return t;
})();
const kraftMat = mat('#FFFFFF', { map: kraftTex, roughness: 0.95 });
const paperMat = (() => {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#F7F3EA'; g.fillRect(0, 0, 256, 256);
  g.globalAlpha = 0.05; g.drawImage(noiseCanvas(256, 1), 0, 0); g.globalAlpha = 1;
  return mat('#FFFFFF', { map: tex(c), roughness: 0.92 });
})();
{
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#EBE6DE'; g.fillRect(0, 0, 512, 512);
  g.globalAlpha = 0.04; g.drawImage(noiseCanvas(256, 1), 0, 0, 512, 512); g.globalAlpha = 1;
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40);
  const table = mesh(new THREE.PlaneGeometry(400, 400), mat('#FFFFFF', { map: t, roughness: 1 }), false, true);
  table.rotation.x = -Math.PI / 2;
  table.position.y = -BASE_H - 0.003;
  cardboard.add(table);
}
const cardboardBg = gradientTexture('#F4F1EC', '#E2DCD2');
const roomBg = new THREE.Color('#D9D2C6');
let curSkin = 'diorama', boardBg = null, room = null, roomEnv = null, baseEnv = null;
const SKIN_NAMES = [['diorama', 'Makieta nad wodą'], ['pokoj', 'Pokój ze stołem'], ['tektura', 'Czysta tektura']];
// Świat wokół planszy: widoczny tylko na widoku planszy, zależnie od wybranego wyglądu
function showWorld(on) {
  world.visible = on && curSkin === 'diorama';
  cardboard.visible = on && curSkin === 'tektura';
  if (room) room.group.visible = on && curSkin === 'pokoj';
}
// Pokój budujemy dopiero, gdy jest potrzebny (tekstury drewna liczą się chwilę)
function ensureRoom() {
  if (room) return room;
  const big = !lowEnd && Math.max(screen.width, screen.height) * (devicePixelRatio || 1) > 1600;
  room = buildRoom({ baseH: BASE_H, aniso: maxAniso, texSize: big ? 2048 : 1024 });
  room.group.visible = false;
  scene.add(room.group);
  return room;
}
// Odbicia w pokoju: kamera sześcienna nad stołem fotografuje pokój (okno, ściany, lampę),
// a materiały (lakier stołu, pionki, kubek) odbijają prawdziwe otoczenie zamiast studia
function captureRoomEnv() {
  if (roomEnv) return roomEnv;
  const rt = new THREE.CubeRenderTarget(512, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(0.5, 400, rt);
  cam.position.copy(room.envProbe);
  const hidden = [board, floorGroup].filter(o => o.visible);
  hidden.forEach(o => { o.visible = false; });
  room.group.visible = true;
  cam.update(renderer, scene);
  hidden.forEach(o => { o.visible = true; });
  roomEnv = rt.texture;
  return roomEnv;
}
function applySkin(name) {
  curSkin = SKIN_NAMES.some(([v]) => v === name) ? name : 'diorama';
  worldSkin = curSkin;
  document.documentElement.dataset.skin = curSkin;
  const t = curSkin === 'tektura', r = curSkin === 'pokoj';
  boardBg ||= scene.background;
  baseEnv ||= scene.environment;
  if (r) ensureRoom();
  showWorld(view === 'board' && board.visible);
  scene.environment = r ? captureRoomEnv() : baseEnv;
  // w pokoju światło jest cieplejsze i spokojniejsze: odbicia z prawdziwego pokoju, mniej światła z „nieba”;
  // poza pokojem światło zależy od pory dnia
  if (r) {
    scene.environmentIntensity = 0.42;
    hemi.color.set('#FFF3E4'); hemi.groundColor.set('#7A5A40'); hemi.intensity = 0.3;
    sun.color.set('#FFEBD2'); sun.intensity = 2.1; sun.position.set(...LOOK.sun[2]);
  } else applyLights();
  boardLamp.visible = !r;
  base.material = t ? [kraftMat, kraftMat, paperMat, kraftMat, kraftMat, kraftMat] : [baseSideMat, baseSideMat, baseTopMat, baseSideMat, baseSideMat, baseSideMat];
  inlay.visible = !t;
  tileBodyMat.map = t ? kraftTex : null;
  tileBodyMat.color.set(t ? '#FFFFFF' : LOOK.tileBody);
  tileBodyMat.needsUpdate = true;
  contact.material.opacity = t ? 0.6 : 0.45;
  scene.background = t ? cardboardBg : r ? roomBg : boardBg;
  document.body.style.background = t ? 'linear-gradient(180deg, #F4F1EC, #E2DCD2)' : r ? '#D9D2C6' : `linear-gradient(180deg, ${LOOK.bg[0]}, ${LOOK.bg[1]})`;
}

const tileGeo = new RoundedBoxGeometry(W - 0.06, TILE_H, D - 0.06, 2, 0.007);
const cornerGeo = new RoundedBoxGeometry(D - 0.06, TILE_H, D - 0.06, 2, 0.007);
// Faktura papieru: włókna i drobne ziarno jako mapa normalnych (widać je, gdy światło pada z boku)
const paperNormal = (() => {
  const n = 256;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hgt = new Float32Array(n * n);
  for (let k = 0; k < hgt.length; k++) hgt[k] = rnd() * 0.35;
  for (let f = 0; f < 900; f++) {   // włókna: krótkie, lekko zakrzywione kreski
    let x = rnd() * n, y = rnd() * n, a = rnd() * Math.PI * 2;
    const len = 6 + rnd() * 18;
    for (let s = 0; s < len; s++) {
      x += Math.cos(a); y += Math.sin(a); a += (rnd() - 0.5) * 0.3;
      hgt[((Math.round(y) % n + n) % n) * n + ((Math.round(x) % n + n) % n)] += 0.8;
    }
  }
  const [c, g] = makeCanvas(n, n);
  const img = g.createImageData(n, n);
  const at = (x, y) => hgt[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = at(x + 1, y) - at(x - 1, y), dy = at(x, y + 1) - at(x, y - 1);
    const len = Math.hypot(dx, dy, 2), o = (y * n + x) * 4;
    img.data[o] = 128 - (dx / len) * 127; img.data[o + 1] = 128 + (dy / len) * 127; img.data[o + 2] = 128 + (2 / len) * 127; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  t.anisotropy = maxAniso;
  return t;
})();
// Złota folia: piksele w kolorze złota stają się metalem z połyskiem (mapa: zielony = szorstkość, niebieski = metal)
function foilMap(t) {
  const c = t.image, g = c.getContext('2d'), { width: w, height: h } = c;
  const src = g.getImageData(0, 0, w, h).data;
  const [c2, g2] = makeCanvas(w, h);
  const out = g2.createImageData(w, h);
  let n = 0;
  for (let k = 0; k < src.length; k += 4) {
    const dr = src[k] - 224, dg = src[k + 1] - 176, db = src[k + 2] - 74;
    const gold = dr * dr + dg * dg + db * db < 2600;
    if (gold) n++;
    out.data[k + 1] = gold ? 72 : 209; out.data[k + 2] = gold ? 230 : 0; out.data[k + 3] = 255;
  }
  if (n < w * h * 0.004) return null;
  g2.putImageData(out, 0, 0);
  const f = new THREE.CanvasTexture(c2);
  f.anisotropy = maxAniso;
  return f;
}
// matowy, drukowany papier: kolory są czyste i nie bieleją od odbić lampy i okna
function tileMaterial(i) {
  const map = tileTexture(i), f = FIELDS[i]?.type === 'special' || i % SIDE === 0 ? foilMap(map) : null;
  return new THREE.MeshStandardMaterial({
    map, normalMap: paperNormal, normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: f ? 1.4 : 0.6,
    roughness: f ? 1 : 0.82, metalness: f ? 1 : 0, roughnessMap: f, metalnessMap: f,
  });
}
const tileTops = [];
const cellGroups = [];
for (let i = 0; i < TOTAL; i++) {
  const p = cellPose(i);
  const cg = new THREE.Group();
  cg.position.set(p.x, 0, p.z);
  cg.rotation.y = p.rotY;
  board.add(cg);
  cellGroups.push(cg);
  const w = p.corner ? D : W;
  const body = mesh(p.corner ? cornerGeo : tileGeo, tileBodyMat, false, true);
  body.position.y = TILE_H / 2;
  const top = mesh(new THREE.PlaneGeometry(w - 0.1, D - 0.1), tileMaterial(i), false, true);
  top.rotation.x = -Math.PI / 2;
  top.position.y = TILE_H + 0.002;
  top.userData.cell = i;
  cg.add(body, top);
  tileTops.push(top);
}

const center = mesh(new THREE.PlaneGeometry(INNER, INNER), new THREE.MeshStandardMaterial({ map: centerTexture(), roughness: 0.85 }), false, true);
if (fontsLate) fontsLoaded.then(() => {   // czcionka doszła później: przerysuj pola i środek planszy
  if (!fontsOk) return;
  const swap = (m, t) => { const old = m.map; m.map = t; m.needsUpdate = true; old?.dispose(); };
  tileTops.forEach(top => { const old = top.material; top.material = tileMaterial(top.userData.cell); old.map?.dispose(); old.roughnessMap?.dispose(); old.dispose(); });
  swap(center.material, centerTexture());
});
center.rotation.x = -Math.PI / 2;
center.position.y = CENTER_Y;
board.add(center);

function cardBackTexture(deck) {
  const [c, g] = makeCanvas(512, 724);
  drawCardBack(g, 512, 724, deck.kind);
  return tex(c);
}
const deckFaces = [];
const cardEdgeMats = [mat('#F7F8FB', { roughness: 0.7 }), mat('#E7EAF0', { roughness: 0.7 })];
// Karta: zaokrąglone rogi jak w prawdziwej talii, grubość kartonu; przód z mapowaniem obrazu na cały prostokąt
function roundedRect(w, l, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -l / 2);
  s.lineTo(w / 2 - r, -l / 2); s.quadraticCurveTo(w / 2, -l / 2, w / 2, -l / 2 + r);
  s.lineTo(w / 2, l / 2 - r); s.quadraticCurveTo(w / 2, l / 2, w / 2 - r, l / 2);
  s.lineTo(-w / 2 + r, l / 2); s.quadraticCurveTo(-w / 2, l / 2, -w / 2, l / 2 - r);
  s.lineTo(-w / 2, -l / 2 + r); s.quadraticCurveTo(-w / 2, -l / 2, -w / 2 + r, -l / 2);
  return s;
}
const cardGeo = new THREE.ExtrudeGeometry(roundedRect(CARD_W, CARD_L, 0.13), { depth: 0.014, bevelEnabled: false, curveSegments: 6 })
  .rotateX(-Math.PI / 2).translate(0, -0.007, 0);
const cardFaceGeo = (() => {
  const w = CARD_W - 0.03, l = CARD_L - 0.03, geo = new THREE.ShapeGeometry(roundedRect(w, l, 0.115), 6);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let k = 0; k < pos.count; k++) uv.setXY(k, (pos.getX(k) + w / 2) / w, (pos.getY(k) + l / 2) / l);
  return geo.rotateX(-Math.PI / 2);
})();
let deckSeed = 7;
const deckRnd = () => ((deckSeed = (deckSeed * 16807) % 2147483647) / 2147483647) - 0.5;
for (const deck of DECKS) {
  const pile = new THREE.Group();
  pile.position.set(deck.x, CENTER_Y, deck.z);
  pile.rotation.y = deck.rotY;
  let top;
  for (let k = 0; k < 12; k++) {
    top = mesh(cardGeo, cardEdgeMats[k % 2], true, true);
    top.position.set(deckRnd() * 0.05, 0.007 + k * 0.014, deckRnd() * 0.05);
    top.rotation.y = deckRnd() * 0.06;
    pile.add(top);
  }
  // tył karty z folią holograficzną: tęczowy połysk zmienia się z kątem patrzenia
  const face = mesh(cardFaceGeo, new THREE.MeshPhysicalMaterial({
    map: cardBackTexture(deck), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2,
    iridescence: 0.7, iridescenceIOR: 1.7, iridescenceThicknessRange: [180, 640],
  }), false, true);
  face.position.y = 0.0075;
  face.userData.deck = deck;
  top.add(face);
  deckFaces.push(face);
  board.add(pile);
}

// ---------------------------------------------------------------------------
// Widok „Modele”
// ---------------------------------------------------------------------------
const show = new THREE.Group();
show.visible = false;
show.position.y = 0.4 - BASE_H;
scene.add(show);
const stageDisc = mesh(new THREE.CylinderGeometry(6.9, 7.2, 0.4, 96), mat('#DDD6CA', { roughness: 0.7 }), true, true);
stageDisc.position.y = -0.2;
const stageTop = mesh(new THREE.CylinderGeometry(6.75, 6.75, 0.02, 96), mat('#F5F2EC', { roughness: 0.8 }), false, true);
stageTop.position.y = 0.01;
show.add(stageDisc, stageTop);
const turntables = [];
function addShowItem(obj, x, z, scale, title, sub) {
  const holder = new THREE.Group();
  holder.position.set(x, 0, z);
  const ped = mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.1, 64), mat('#FFFFFF', { roughness: 0.6 }), false, true);
  ped.position.y = 0.07;
  obj.scale.multiplyScalar(scale);
  obj.position.y = 0.12;
  holder.add(ped, obj);
  turntables.push(obj);
  const el = document.createElement('div');
  el.className = 'label3d';
  el.innerHTML = `<b>${title}</b><small>${sub}</small>`;
  const label = new CSS2DObject(el);
  label.position.set(0, -0.05, 1.15);
  holder.add(label);
  show.add(holder);
}
await Promise.race([modelsReady, new Promise(r => setTimeout(r, 2500))]);
// Wypukłe ikony z Blendera nad nadrukiem pól Szansa i Parking (środek ikony: 24% wysokości nadruku)
modelsReady.then(() => {
  for (let i = 0; i < TOTAL; i++) {
    const type = FIELDS[i]?.type, name = type === 'chance' ? 'icon_chance' : type === 'station' ? 'icon_parking' : null;
    const icon = name && cloneModel(name, () => null);
    if (!icon) continue;
    icon.position.set(0, TILE_H + 0.002, -(D - 0.1) * 0.26);
    icon.traverse(m => { m.castShadow = false; m.receiveShadow = true; });
    cellGroups[i].add(icon);
  }
});
// pionki w dwóch rzędach, drugi przesunięty o pół odstępu (pionki z przodu stoją między tymi z tyłu)
PLAYERS.forEach((p, i) => addShowItem(p.make(p.color), i < 4 ? -4.5 + i * 3 : -3 + (i - 4) * 3, i < 4 ? -5.8 : -2.4, 2.2, p.pawn, 'pionek'));
const demoColor = PLAYERS[1].color;
BUILDINGS.forEach((b, i) => addShowItem(b.make(demoColor), -4.4 + i * 2.2, 2.0, b.scale, b.name, i === 4 ? 'hotel · poziom 5' : `budynek · poziom ${i + 1}`));

// ---------------------------------------------------------------------------
// Kamera i widoki
// ---------------------------------------------------------------------------
let view = 'board';
const DIR_BOARD = new THREE.Vector3(1, 1.05, 1).normalize();
const DIR_SHOW = new THREE.Vector3(0, 0.55, 1).normalize();
// Wolne miejsce na planszę w pikselach od krawędzi ekranu. W grze panele stoją po bokach,
// więc środek planszy przesuwamy na środek wolnego miejsca i dopasowujemy do niego odległość kamery.
const safe = { l: 0, r: 0, t: 0, b: 0, fit: false, avoid: [] };
function fitDistance(size) {
  const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
  const fw = safe.fit ? w - safe.l - safe.r : w, fh = safe.fit ? h - safe.t - safe.b : h;
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  return size / (tv * Math.max(80, Math.min(fw, fh)) / h);
}
// W grze kamera stoi w miejscu: odległość dobrana tak, żeby cała plansza była jak największa i w całości widoczna
const boardDist = () => (safe.fit ? fitBoardDistance() : fitDistance(S * 0.7));
const showDist = () => fitDistance(5.9);
let viewCorner = 0;   // róg planszy gracza, z którego perspektywy patrzymy (0 = START)
// W grze kamera patrzy bardziej z góry (ok. 47°, jak w Business Tour): plansza wypełnia ekran, pola są mniej spłaszczone
const DIR_GAME = new THREE.Vector3(1, 1.5, 1).normalize();
const boardDir = () => (G && safe.fit ? DIR_GAME : DIR_BOARD).clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -viewCorner * Math.PI / 2);
function presetBoard() { return [boardDir().multiplyScalar(boardDist()), new THREE.Vector3(0, 0, 0)]; }
// Szuka najmniejszej odległości kamery, przy której narożniki planszy (także z budynkami) mieszczą się w wolnym miejscu
const fitCam = new THREE.PerspectiveCamera();
const fitPts = [];
// narożniki planszy, dół jej podstawy i punkty nad polami bliżej narożników (budynki i pionki)
for (const [y, k] of [[0, 1], [1.1, 0.85], [-BASE_H, 1]]) for (const [x, z] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) fitPts.push(new THREE.Vector3(x * k, y, z * k));
// Gdzie na wysokości wolnego miejsca stoi środek planszy. Bliższa połowa planszy jest na ekranie większa (perspektywa),
// więc w grze środek jest wyżej niż w połowie; fitBoardDistance dobiera go tak, żeby nad i pod planszą było tyle samo miejsca.
let fitShift = 0.4;
function viewCenter() {
  const w = stage.clientWidth, h = stage.clientHeight;
  return [safe.l + (w - safe.l - safe.r) / 2, safe.t + (h - safe.t - safe.b) * (safe.fit ? fitShift : 0.5)];
}
function setViewOffset() {
  const w = stage.clientWidth, h = stage.clientHeight, [cx, cy] = viewCenter();
  camera.setViewOffset(w, h, Math.round(w / 2 - cx), Math.round(h / 2 - cy), w, h);
  camera.updateProjectionMatrix();
  stage.style.setProperty('--cy', `${Math.round(cy)}px`);
}
function fitBoardDistance() {
  let d = fitBoardOnce();
  const h = stage.clientHeight, band = h - safe.t - safe.b;
  for (let k = 0; k < 4 && band > 0; k++) {
    const [top, bottom] = fitExtent(d);
    const shift = ((h - safe.b - bottom) - (top - safe.t)) / 2;   // >0: plansza ma za dużo miejsca pod spodem
    if (Math.abs(shift) < 1.5) break;
    fitShift = THREE.MathUtils.clamp(fitShift + shift / band, 0.2, 0.6);
    setViewOffset();
    d = fitBoardOnce();
  }
  return d;
}
// Górna i dolna krawędź planszy na ekranie (w pikselach) przy odległości kamery d
function fitExtent(d) {
  const h = stage.clientHeight || 1, half = S / 2 + LOOK.margin, v = new THREE.Vector3();
  fitCam.copy(camera);
  fitCam.position.copy(boardDir()).multiplyScalar(d);
  fitCam.lookAt(0, 0, 0);
  fitCam.updateMatrixWorld();
  let top = Infinity, bottom = -Infinity;
  for (const pt of fitPts) {
    const y = (1 - v.set(pt.x * half, pt.y, pt.z * half).project(fitCam).y) * h / 2;
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return [top, bottom];
}
function fitBoardOnce() {
  const w = stage.clientWidth || 1, h = stage.clientHeight || 1, half = S / 2 + LOOK.margin, m = 0.012;
  const x0 = (2 * safe.l) / w - 1 + m, x1 = 1 - (2 * safe.r) / w - m, y0 = (2 * safe.b) / h - 1 + m, y1 = 1 - (2 * safe.t) / h - m;
  fitCam.copy(camera);
  const dir = boardDir(), v = new THREE.Vector3();
  const px = pt => { v.set(pt.x * half, pt.y, pt.z * half).project(fitCam); return [(v.x + 1) * w / 2, (1 - v.y) * h / 2, v.x, v.y]; };
  // punkt w czworokącie wypukłym (narożniki planszy na ekranie)
  const inside = (poly, x, y) => {
    let sgn = 0;
    for (let k = 0; k < poly.length; k++) {
      const [ax, ay] = poly[k], [bx, by] = poly[(k + 1) % poly.length];
      const c = Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
      if (c && sgn && c !== sgn) return false;
      if (c) sgn = c;
    }
    return true;
  };
  const fits = d => {
    fitCam.position.copy(dir).multiplyScalar(d);
    fitCam.lookAt(0, 0, 0);
    fitCam.updateMatrixWorld();
    const all = fitPts.map(px);
    if (!all.every(([, , nx, ny]) => nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1)) return false;
    for (const poly of [all.slice(0, 4), all.slice(4, 8), all.slice(8)]) {
      for (const [ax, ay, bx, by] of safe.avoid) {
        if ([[ax, ay], [bx, ay], [ax, by], [bx, by]].some(([x, y]) => inside(poly, x, y))) return false;
        if (poly.some(([x, y]) => x >= ax && x <= bx && y >= ay && y <= by)) return false;
      }
    }
    return true;
  };
  let lo = 4, hi = 400;
  for (let k = 0; k < 32; k++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  return hi;
}
function presetShow() {
  const t = new THREE.Vector3(0, 0.8 + show.position.y, 0);
  return [t.clone().add(DIR_SHOW.clone().multiplyScalar(showDist())), t];
}
function flyTo([pos, target], dur = 700) {
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  controls.enabled = false;
  return tween(reduceMotion ? 1 : dur, t => {
    const e = easeInOut(t);
    camera.position.lerpVectors(p0, pos, e);
    controls.target.lerpVectors(t0, target, e);
    if (t >= 1) controls.enabled = true;
  });
}
function jumpTo([pos, target]) {
  camera.position.copy(pos);
  controls.target.copy(target);
  controls.update();
}
function updateLimits() {
  controls.maxDistance = view === 'board' ? boardDist() * 1.6 : showDist() * 1.8;
}
function setView(v) {
  if (v === view) return;
  view = v;
  board.visible = v === 'board';
  showWorld(v === 'board');
  show.visible = v === 'models';
  $('modelsHud').hidden = v !== 'models';
  $('cardsView').hidden = v !== 'cards';
  $('vignette').hidden = v === 'cards';
  labelRenderer.domElement.hidden = v !== 'models';
  for (const [id, name] of [['viewBoard', 'board'], ['viewModels', 'models'], ['viewCards', 'cards']]) {
    $(id).setAttribute('aria-pressed', String(v === name));
  }
  selectCell(null);
  updateLimits();
  if (v === 'board') jumpTo(presetBoard());
  if (v === 'models') jumpTo(presetShow());
  controls.enabled = v !== 'cards';
  if (v === 'cards') requestAnimationFrame(() => window.KartyPytan?.dopasuj($('questionSlot')));
}

// ---------------------------------------------------------------------------
// Interfejs
// ---------------------------------------------------------------------------
let highlighted = null;
function restoreGlow(m) {
  const g = m.material.userData.glow;
  m.material.emissive.set(g || 0x000000);
  m.material.emissiveIntensity = g ? 0.24 : 0;
}
function highlight(m) {
  if (highlighted) restoreGlow(highlighted);
  highlighted = m;
  if (m) { m.material.emissive.set('#FFD166'); m.material.emissiveIntensity = 0.28; }
}
let selectedCell = null;
let gameInfo = null;   // w trakcie gry: właściciel, budynek i czynsz pola
function selectCell(i) {
  selectedCell = i;
  if (i === null) { highlight(null); closeFieldInfo(); return; }
  highlight(tileTops[i]);
  openFieldInfo(i);
}
function selectDeck(face) {
  const deck = face.userData.deck;
  highlight(face);
  openDeckInfo(deck);
}

// ---------------------------------------------------------------------------
// Budynki na polach: budynek spada na pole, odbija się, a wokół lecą iskry w kolorze gracza
// ---------------------------------------------------------------------------
const BUILD_Z = -0.52;   // pas na budynki na polu
const BUILD_SCALE = 1.2; // budynki na polach większe, żeby było je widać z kamery gry
const dustGeo = new THREE.SphereGeometry(0.08, 10, 8);
const sparkGeo = new THREE.BoxGeometry(0.07, 0.07, 0.025);
const ringGeo = new THREE.RingGeometry(0.42, 0.56, 48);

function disposeTree(obj) {
  obj.traverse(o => { if (o.geometry && !o.userData.shared && o.geometry !== dustGeo && o.geometry !== sparkGeo && o.geometry !== ringGeo) o.geometry.dispose(); });
}
function burst(cg, color) {
  const group = new THREE.Group();
  group.position.set(0, TILE_H + 0.02, BUILD_Z);
  cg.add(group);
  const dustMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false });
  const sparkMat = new THREE.MeshBasicMaterial({ color: mix(color, '#ffffff', 0.15), transparent: true, depthWrite: false, toneMapped: false });
  const goldMatB = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, depthWrite: false, toneMapped: false });
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const parts = [];
  for (let k = 0; k < 14; k++) {   // kurz dookoła podstawy
    const a = (k / 14) * Math.PI * 2;
    const m = new THREE.Mesh(dustGeo, dustMat);
    parts.push({ m, v: new THREE.Vector3(Math.cos(a) * 1.1, 0.25, Math.sin(a) * 1.1), g: 0.3, dust: true });
    group.add(m);
  }
  for (let k = 0; k < 22; k++) {   // iskry w kolorze gracza i złote
    const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 0.8;
    const m = new THREE.Mesh(sparkGeo, k % 3 ? sparkMat : goldMatB);
    parts.push({ m, v: new THREE.Vector3(Math.cos(a) * r, 2.2 + Math.random() * 1.6, Math.sin(a) * r), g: 4.2, spin: 6 + Math.random() * 10 });
    group.add(m);
  }
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  return tween(reduceMotion ? 200 : 950, t => {
    const tt = t * 0.95;
    for (const pt of parts) {
      pt.m.position.set(pt.v.x * tt, Math.max(0, pt.v.y * tt - pt.g * tt * tt), pt.v.z * tt);
      if (pt.dust) pt.m.scale.setScalar(1 + 2.2 * t);
      else pt.m.rotation.set(pt.spin * t, pt.spin * t * 0.7, 0);
    }
    dustMat.opacity = 0.85 * (1 - t);
    sparkMat.opacity = goldMatB.opacity = 1 - t * t;
    ring.scale.setScalar(0.4 + 1.8 * t);
    ringMat.opacity = 0.9 * (1 - t);
  }).then(() => {
    cg.remove(group);
    for (const m of [dustMat, sparkMat, goldMatB, ringMat]) m.dispose();
  });
}
// Budynek spada z góry, ląduje z wyraźnym odbiciem
// Rusztowanie: stawia się przed budową (rośnie z pola), znika, gdy budynek wyląduje
const scaffoldMat = mat('#F2B72E', { roughness: 0.4, metalness: 0.35 });
const plankMat = mat('#C98B4E', { roughness: 0.8 });
const poleGeo = new THREE.CylinderGeometry(0.016, 0.016, 1, 8);
const plankGeo = new THREE.BoxGeometry(1, 0.018, 0.13);
function scaffold(size) {
  const g = new THREE.Group(), a = 0.44 * size, h = 0.95 * size;
  const pole = (x, y, z, len, rx, rz) => {
    const m = mesh(poleGeo, scaffoldMat, true, false);
    m.position.set(x, y, z); m.scale.y = len; m.rotation.set(rx, 0, rz);
    g.add(m);
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pole(sx * a, h / 2, sz * a, h, 0, 0);
  for (const y of [0.33, 0.66, 0.97]) {
    for (const s2 of [-1, 1]) { pole(0, y * h, s2 * a, 2 * a, 0, Math.PI / 2); pole(s2 * a, y * h, 0, 2 * a, Math.PI / 2, 0); }
  }
  pole(0, h / 2, a, Math.hypot(2 * a, h * 0.6), 0, Math.atan2(2 * a, h * 0.6));   // ukośne zastrzały
  pole(-a, h / 2, 0, Math.hypot(2 * a, h * 0.6), Math.atan2(2 * a, h * 0.6), 0);
  for (const y of [0.33, 0.66]) {
    const pl = mesh(plankGeo, plankMat, true, false);
    pl.scale.x = 2 * a + 0.1; pl.position.set(0, y * h + 0.02, a + 0.04);
    g.add(pl);
  }
  return g;
}
async function dropIn(obj, s, color, cg) {
  const y0 = TILE_H;
  obj.scale.setScalar(s);
  obj.rotation.y = -0.8;
  let sc = null;
  if (!reduceMotion) {
    sc = scaffold(Math.min(1.25, Math.max(0.8, s)));
    sc.position.set(obj.position.x, y0, obj.position.z);
    sc.scale.set(1, 0.001, 1);
    cg.add(sc);
    await tween(300, t => sc.scale.set(1, Math.max(0.001, easeOut3(t)), 1));
  }
  await tween(reduceMotion ? 80 : 430, t => {
    obj.position.y = y0 + 2.6 * (1 - t * t);
    obj.rotation.y = -0.8 * (1 - t);
  });
  obj.position.y = y0;
  burst(cg, color);
  await tween(reduceMotion ? 80 : 520, t => {
    const k = Math.sin(t * Math.PI * 3) * Math.exp(-4.5 * t) * 0.32;
    obj.scale.set(s * (1 + k * 0.55), s * (1 - k), s * (1 + k * 0.55));
    if (sc) sc.scale.set(1 + t * 0.15, Math.max(0.001, 1 - easeInOut(t)), 1 + t * 0.15);
  });
  obj.scale.setScalar(s);
  if (sc) cg.remove(sc);
}
// Stary budynek kurczy się i znika
async function shrinkOut(obj, cg) {
  const s0 = obj.scale.x;
  await tween(reduceMotion ? 60 : 260, t => {
    obj.scale.setScalar(s0 * (1 - t) * (1 + 0.25 * Math.sin(t * Math.PI)));
    obj.rotation.y = t * 1.6;
    obj.position.y = TILE_H + 0.25 * Math.sin(t * Math.PI);
  });
  cg.remove(obj);
  disposeTree(obj);
}
// Pionek się cieszy: podskok z pełnym obrotem i ugięciem przy lądowaniu (kupno pola, wygrana)
function pawnJoy(p) {
  const o = p.obj, y0 = o.position.y, r0 = o.rotation.y;
  if (reduceMotion || o.userData.busy) return Promise.resolve();
  o.userData.busy = true;
  return tween(720, t => {
    o.position.y = y0 + 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    o.rotation.y = r0 + Math.PI * 2 * easeInOut(t);
    const sq = t < 0.12 ? 1 - 0.5 * Math.sin(t / 0.12 * Math.PI) * 0.25 : t > 0.86 ? 1 - Math.sin((t - 0.86) / 0.14 * Math.PI) * 0.16 : 1;
    o.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  }).then(() => { o.position.y = y0; o.rotation.y = r0; o.scale.set(1, 1, 1); o.userData.busy = false; });
}
// Pionek jest smutny: przechyla się, kiwa i przygasa (bankructwo), potem znika
function pawnSad(p) {
  const o = p.obj;
  if (reduceMotion) return Promise.resolve();
  return tween(900, t => {
    const e = easeInOut(Math.min(1, t * 1.6));
    o.rotation.x = 0.38 * e + 0.06 * Math.sin(t * Math.PI * 5) * (1 - t);
    o.position.y = TILE_H - 0.05 * e;
    o.scale.setScalar(1 - 0.12 * e);
  });
}
function cellTarget(cell) {
  const p = cellPose(cell);
  const c = Math.cos(p.rotY), sn = Math.sin(p.rotY);
  return new THREE.Vector3(p.x + BUILD_Z * sn, 0, p.z + BUILD_Z * c);
}

// ---------------------------------------------------------------------------
// Menu gry: logowanie, ekran główny, nowa gra, ranking, zasady, profil, ustawienia
// ---------------------------------------------------------------------------
const store = {
  get(k, d) { try { const v = localStorage.getItem('wsiz-tour-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('wsiz-tour-' + k, JSON.stringify(v)); } catch (e) { /* bez pamięci */ } },
  del(k) { try { localStorage.removeItem('wsiz-tour-' + k); } catch (e) { /* bez pamięci */ } },
};
// Ikony: biblioteka Phosphor Icons (src/ui/icons.js). Pionki w kafelkach, menu i przyciski.
const PAWN_ICONS = { Sztandar: 'flag', 'Drukarka 3D': 'printer', 'Koparka kryptowalut': 'gpu', 'Ekspres do kawy': 'coffee', Robot: 'robot', Dron: 'drone', 'Biret absolwenta': 'cap', 'Rakieta startupu': 'rocket' };
const pawnSvg = (name, color) => icon(PAWN_ICONS[name], '', color);
const ico = (n, cls = '') => icon(n, cls);
const escHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const avatar = (pawn, color) => `<span class="m-avatar" style="--c:${PAWN_COLORS[color].hex}">${pawnSvg(PLAYERS[pawn].pawn, '#ffffff')}</span>`;
const chipHtml = (label, attrs, pressed, disabled = false) =>
  `<button type="button" class="chip" ${attrs} aria-pressed="${pressed}"${disabled ? ' disabled' : ''}>${label}</button>`;

let profile = store.get('profil', null);
// statystyki z gier sprzed zmiany skali (kwoty były w tysiącach): przelicz na nowe kwoty
if (profile?.stats?.wealth > 200000) { profile.stats.wealth = Math.round(profile.stats.wealth / 1000); store.set('profil', profile); }
const prefs = Object.assign({ theme: 'system', music: 60, effects: 80, scale: 1, spin: true, skin: 'diorama', gfx: 'auto', cine: true, time: 'dzien', promoMusic: 'kod', tips: true, tipsSeen: [], fps: false }, store.get('preferencje', {}));
if (!Array.isArray(prefs.tipsSeen)) prefs.tipsSeen = [];
// 14.10.2026 (decyzja autora): główna scena to makieta nad wodą; pokój ze stołem jest do wyboru w Ustawieniach
if (prefs.skinV !== 3) { prefs.skin = 'diorama'; prefs.skinV = 3; }
const savePrefs = () => store.set('preferencje', prefs);
const defaultSlots = () => [
  { kind: 'me' },
  { kind: 'bot', level: 'średni', pawn: 1, color: 1 },
  { kind: 'bot', level: 'średni', pawn: 2, color: 2 },
  { kind: 'empty', pawn: 3, color: 3 },
];
const setup = Object.assign({ mode: 'solo', teams: false, online: 'create', joinCode: '', semester: 8, timer: 0 }, store.get('nowa-gra-2', {}));
delete setup.code;   // kod party nadaje teraz serwer gry
let NET = null;                       // gra online: { mod, client, seat, lobby }; null = bez serwera
let netBusy = false, netError = '';   // łączenie z serwerem i ostatni błąd (pod przyciskiem nowej gry)
if (!Array.isArray(setup.slots) || setup.slots.length !== 4) setup.slots = defaultSlots();
const saveSetup = () => store.set('nowa-gra-2', setup);

// Motyw i rozmiar elementów
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const effectiveTheme = () => (prefs.theme === 'system' ? (darkMQ.matches ? 'dark' : 'light') : prefs.theme);
function applyTheme() {
  if (prefs.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = prefs.theme;
  const dark = effectiveTheme() === 'dark';
  $('btnTheme').innerHTML = ico(dark ? 'sun' : 'moon');
  $('btnTheme').setAttribute('aria-label', dark ? 'Włącz jasny motyw' : 'Włącz ciemny motyw');
}
darkMQ.addEventListener?.('change', applyTheme);
const applyScale = () => document.documentElement.style.setProperty('--ui-scale', String(prefs.scale));

// Stałe elementy z ikonami
$('btnSso').innerHTML = `${ico('key')}Zaloguj przez wirtualny dziekanat`;
$('meChev').innerHTML = ico('chev', 'm-chev');
{
  const [p, s] = $('meMenu').querySelectorAll('[data-go]');
  p.innerHTML = `${ico('user')}Profil`;
  s.innerHTML = `${ico('gear')}Ustawienia`;
}
$('btnExit').innerHTML = `${ico('door')}Wyjdź z gry`;
$('btnLogout').innerHTML = `${ico('logout')}Wyloguj się`;
$('btnGear').innerHTML = ico('gear');
$('btnPreview').innerHTML = `${ico('eye')}Obejrzyj planszę`;
$('btnMenu').innerHTML = `${ico('back')}Menu`;
$('btnPromoBoard').innerHTML = `${ico('film')}Prezentacja`;
$('btnStart').innerHTML = `${ico('play')}Rozpocznij grę`;
$('btnLobbyStart').innerHTML = `${ico('play')}Zacznij grę`;
document.querySelectorAll('.m-back').forEach(b => { b.innerHTML = `${ico('back')}Wróć`; });
$('homeNav').innerHTML = [
  { go: 'play', label: 'Graj', icon: 'play', main: true },
  { go: 'promo', label: 'Prezentacja gry', icon: 'film', promo: true },
  { go: 'ranking', label: 'Ranking', icon: 'trophy' },
  { go: 'rules', label: 'Zasady', icon: 'book' },
  { go: 'cards', label: 'Karty', icon: 'cards' },
  { go: 'settings', label: 'Ustawienia', icon: 'gear' },
].map(n => `<button class="m-btn ${n.main ? 'm-primary m-big' : n.promo ? 'm-promo-btn' : 'm-secondary'}" type="button" data-go="${n.go}">${ico(n.icon)}${n.label}</button>`).join('');

// Profil w lewym górnym rogu
function renderMe() {
  $('meAvatar').style.setProperty('--c', PAWN_COLORS[profile.color].hex);
  $('meAvatar').innerHTML = pawnSvg(PLAYERS[profile.pawn].pawn, '#ffffff');
  $('meNick').textContent = profile.nick;
  $('meSub').textContent = profile.guest ? 'Gość' : 'Student';
}
function closeDropdown() {
  $('meMenu').hidden = true;
  $('meBtn').setAttribute('aria-expanded', 'false');
}
$('meBtn').addEventListener('click', () => {
  const open = $('meMenu').hidden;
  $('meMenu').hidden = !open;
  $('meBtn').setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', e => { if (!e.target.closest('.m-profile')) closeDropdown(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });

// Przechodzenie między stronami menu
const PAGES = { home: 'pgHome', play: 'pgPlay', lobby: 'pgLobby', ranking: 'pgRanking', rules: 'pgRules', profile: 'pgProfile', settings: 'pgSettings' };
let exampleTimer = null;
function go(page) {
  closeDropdown();
  clearInterval(exampleTimer);
  if (page === 'cards') { closeMenu(); setView('cards'); return; }
  if (page === 'promo') { openPromo(); return; }
  for (const [k, id] of Object.entries(PAGES)) $(id).hidden = k !== page;
  if (page === 'play') renderPlay();
  if (page === 'lobby') renderLobby();
  if (page === 'ranking') renderRanking();
  if (page === 'rules') renderRules();
  if (page === 'profile') renderProfilePage();
  if (page === 'settings') renderSettingsPage();
  $('menu').scrollTop = 0;
}
$('menu').addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) go(b.dataset.go);
});

// Nowa gra: tryb, miejsca graczy, semestr, czas
const KIND_LABEL = { me: 'Ty', local: 'Gracz na tym komputerze', online: 'Gracz online', bot: 'Bot', empty: 'Puste miejsce' };
const KINDS = { solo: ['local', 'bot', 'empty'], online: ['online', 'local', 'bot', 'empty'] };
const TEAMS = [{ name: 'Drużyna A', color: '#00276F' }, { name: 'Drużyna B', color: '#5B6B8C' }];
const BOT_LEVELS = ['łatwy', 'średni', 'trudny'];
const TIMERS = [[15, '15 min'], [30, '30 min'], [60, '1 h'], [90, '90 min'], [0, 'Bez limitu']];
if (!TIMERS.some(([v]) => v === setup.timer)) setup.timer = 0;   // czas z dawnej listy (np. 45 min): bez limitu
const slotPawn = s => (s.kind === 'me' ? profile.pawn : s.pawn);
const slotColor = s => (s.kind === 'me' ? profile.color : s.color);
const filledSlots = () => setup.slots.filter(s => s.kind !== 'empty');
function setSlotColor(s, c) {
  if (s.kind === 'me') { profile.color = c; store.set('profil', profile); renderMe(); } else s.color = c;
}
// Każdy gracz ma inny kolor; pionki mogą się powtarzać
function fixColors() {
  const used = new Set();
  for (const s of filledSlots()) {
    let c = slotColor(s);
    if (used.has(c)) { c = PAWN_COLORS.findIndex((_, k) => !used.has(k)); setSlotColor(s, c); }
    used.add(c);
  }
}
function pickColor(i, c) {
  const s = setup.slots[i];
  const other = setup.slots.find(o => o !== s && o.kind !== 'empty' && slotColor(o) === c);
  if (other) setSlotColor(other, slotColor(s));   // zamiana kolorów
  setSlotColor(s, c);
}
const KIND_SHORT = { local: 'Gracz', bot: 'Bot', online: 'Online' };
const KIND_ADD = { bot: ['robot', 'Dodaj bota'], local: ['monitor', 'Gracz przy tym komputerze'], online: ['globe', 'Gracz online z kodem party'] };
// Karta gracza jak w Business Tour: pionek w 3D ze strzałkami, nazwa i opis pionka, kto gra, kolor.
// Puste miejsce to karta z przyciskami „Dodaj bota” i „Gracz przy tym komputerze” (online też „Gracz online”).
function slotHtml(s, i) {
  const name = { me: profile.nick, bot: `Bot ${i + 1}`, local: `Gracz ${i + 1}`, online: `Miejsce ${i + 1}`, empty: `Miejsce ${i + 1}` }[s.kind];
  const sub = { me: 'Ty', bot: `Bot · poziom ${s.level}`, local: 'Gra przy tym komputerze', online: 'Czeka na dołączenie kodem party', empty: 'Nikt tu nie gra' }[s.kind];
  const kinds = KINDS[setup.mode].filter(k => k !== 'empty');
  if (s.kind === 'empty') {
    return `<div class="m-seat is-empty">
    <div class="m-seat-top"><span class="m-avatar"></span><span class="m-slot-name"><b>${name}</b><small>${sub}</small></span></div>
    <div class="m-seat-add" role="group" aria-label="Kto zagra na miejscu ${i + 1}">${kinds
      .map(k => `<button type="button" class="m-add" data-kind="${i}" data-v="${k}">${icon(KIND_ADD[k][0])}${KIND_ADD[k][1]}</button>`).join('')}</div>
  </div>`;
  }
  const pawn = slotPawn(s), color = slotColor(s), n = PLAYERS.length;
  const prev = (pawn + n - 1) % n, next = (pawn + 1) % n;
  const team = setup.teams ? TEAMS[i % 2] : null;
  const who = s.kind === 'me' ? '' : `<div class="chips" role="group" aria-label="Kto gra na miejscu ${i + 1}">${kinds
    .map(k => chipHtml(KIND_SHORT[k], `data-kind="${i}" data-v="${k}"`, s.kind === k)).join('')}</div>`;
  const levels = s.kind === 'bot'
    ? `<div class="chips" role="group" aria-label="Poziom bota">${BOT_LEVELS.map(l => chipHtml(l, `data-level="${i}" data-v="${l}"`, s.level === l)).join('')}</div>` : '';
  return `<div class="m-seat" style="--c:${PAWN_COLORS[color].hex}">
    <div class="m-seat-top">${avatar(pawn, color)}<span class="m-slot-name"><b>${escHtml(name)}</b><small>${sub}</small></span>${s.kind === 'me' ? ''
      : `<button type="button" class="m-seat-x" data-kind="${i}" data-v="empty" aria-label="Zwolnij miejsce ${i + 1}" title="Zwolnij miejsce">${icon('close')}</button>`}</div>
    <div class="m-stage" data-stage="${i}">${team ? `<span class="m-team" style="--t:${team.color}">${team.name}</span>` : ''}
      <button type="button" class="m-arrow is-prev" data-pawn="${i}" data-v="${prev}" aria-label="Poprzedni pionek: ${PLAYERS[prev].pawn}">${icon('back')}</button>
      <button type="button" class="m-arrow is-next" data-pawn="${i}" data-v="${next}" aria-label="Następny pionek: ${PLAYERS[next].pawn}">${icon('next')}</button></div>
    <div class="m-seat-pawn"><b>${PLAYERS[pawn].pawn}</b><span class="m-dots" role="img" aria-label="Pionek ${pawn + 1} z ${n}">${PLAYERS.map((_, k) => `<i${k === pawn ? ' class="on"' : ''}></i>`).join('')}</span></div>
    <p class="m-seat-desc">${PAWN_DESC[pawn]}</p>
    ${who}${levels}
    <div class="m-seat-colors" role="group" aria-label="Kolor">${PAWN_COLORS.map((c, k) =>
      `<button type="button" class="swatch" style="--c:${c.hex}" data-color="${i}" data-v="${k}" aria-pressed="${k === color}" aria-label="${c.name}"></button>`).join('')}</div>
  </div>`;
}
// Pionki w 3D w kartach graczy (płótna zostają, zmienia się tylko pionek albo kolor)
function mountStages(root) {
  preview.init();
  for (const st of root.querySelectorAll('[data-stage]')) {
    const s = setup.slots[+st.dataset.stage], pawn = slotPawn(s), hex = PAWN_COLORS[slotColor(s)].hex;
    const cv = stageCanvas(`play-${st.dataset.stage}`);
    st.prepend(cv);
    preview.set(cv, `${pawn}|${hex}`, () => previewPawn(pawn, hex));
  }
}
function renderPlay() {
  const online = setup.mode === 'online';
  if (!online) for (const s of setup.slots) if (s.kind === 'online') s.kind = 'local';
  for (const s of setup.slots) if (s.kind === 'bot' && !s.level) s.level = 'średni';
  fixColors();
  const n = filledSlots().length;
  if (n !== 4) setup.teams = false;
  $('modeTabs').innerHTML = [['solo', 'Solo', 'monitor'], ['online', 'Online', 'globe']].map(([id, label, icon]) =>
    `<button type="button" role="tab" aria-selected="${setup.mode === id}" data-mode="${id}">${ico(icon)}${label}</button>`).join('');
  $('modeDesc').textContent = online
    ? 'Gra przez internet: 1 na 1 na 1 na 1 albo 2 na 2. Na każde miejsce możesz zaprosić gracza online, posadzić kogoś przy tym komputerze albo dodać bota.'
    : 'Gra na jednym komputerze, bez internetu. Gracze rzucają po kolei przy tym samym ekranie, a puste miejsca możesz zająć botami. Nikt z zewnątrz nie dołączy.';
  const watching = online && setup.online === 'watch';
  const joining = online && (setup.online === 'join' || watching);
  if (online) {
    $('onlineBox').innerHTML = `
      <div class="chips">${chipHtml('Stwórz party', 'data-online="create"', !joining)}${chipHtml('Dołącz kodem', 'data-online="join"', joining && !watching)}${chipHtml('Oglądaj grę', 'data-online="watch"', watching)}</div>
      <div class="row" style="margin-top: 12px">${joining
        ? `<input class="m-input" id="joinCode" maxlength="6" placeholder="Kod party, np. K7P3QX" aria-label="Kod party" autocomplete="off" style="max-width: 240px; text-transform: uppercase" value="${escHtml(setup.joinCode)}">
           <span class="m-hint">${watching ? 'Widz ogląda grę na żywo, ale nie gra i nie widzi kart graczy.' : 'Kod dostaniesz od osoby, która stworzyła party. Pionek wybierasz w profilu.'}</span>`
        : '<span class="m-hint">Ustaw miejsca graczy poniżej. Po kliknięciu „Stwórz party” dostaniesz kod dla znajomych.</span>'}</div>`;
  } else $('onlineBox').innerHTML = '';
  // dołączając do party, ustawienia gry wybiera gospodarz
  for (const el of [$('slots').closest('.m-card'), $('semChips').closest('.m-grid2')]) el.hidden = joining;
  $('teamChips').innerHTML = chipHtml(online ? '1 na 1 na 1 na 1' : 'Każdy na siebie', 'data-team="0"', !setup.teams)
    + chipHtml('2 na 2', 'data-team="1"', setup.teams, n !== 4);
  $('slots').innerHTML = setup.slots.map(slotHtml).join('');
  mountStages($('slots'));
  $('semChips').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8].map(k =>
    chipHtml(k === 8 ? 'Mieszane (1–7)' : `Semestr ${k}`, `data-sem="${k}"`, setup.semester === k)).join('');
  $('timeChips').innerHTML = TIMERS.map(([v, l]) => chipHtml(l, `data-time="${v}"`, setup.timer === v)).join('');
  const ok = joining ? setup.joinCode.length === 6 : online ? n === 4 : n >= 2;
  $('btnStart').disabled = !ok || netBusy;
  $('btnStart').innerHTML = `${ico(online ? 'globe' : 'play')}${watching ? 'Oglądaj grę' : joining ? 'Dołącz do party' : online ? 'Stwórz party' : 'Rozpocznij grę'}`;
  const sem = setup.semester === 8 ? 'pytania mieszane' : `semestr ${setup.semester}`;
  const time = TIMERS.find(([v]) => v === setup.timer)[1].toLowerCase();
  $('playHint').textContent = netError || (joining
    ? (ok ? `${watching ? 'Oglądasz' : 'Dołączasz'} jako ${profile.nick}` : 'Wpisz 6-znakowy kod party.')
    : ok ? `Graczy: ${n}${setup.teams ? ' (2 na 2)' : ''} · ${sem} · ${time}`
    : online ? 'W grze online potrzebne są 4 miejsca: gracze albo boty.' : 'Dodaj co najmniej jednego gracza albo bota.');
  saveSetup();
}
$('pgPlay').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.mode) setup.mode = d.mode;
  else if (d.team) setup.teams = d.team === '1';
  else if (d.sem) setup.semester = +d.sem;
  else if (d.time) setup.timer = +d.time;
  else if (d.kind) setup.slots[+d.kind].kind = d.v;
  else if (d.level) setup.slots[+d.level].level = d.v;
  else if (d.pawn) {
    const s = setup.slots[+d.pawn];
    if (s.kind === 'me') { profile.pawn = +d.v; store.set('profil', profile); renderMe(); } else s.pawn = +d.v;
  } else if (d.color) pickColor(+d.color, +d.v);
  else if (d.online) setup.online = d.online;
  else return;
  netError = '';
  // strzałka pionka po przerysowaniu kart zostaje pod klawiaturą (można przewijać pionki dalej)
  const keep = b.classList.contains('m-arrow') ? `.m-arrow.${b.classList.contains('is-prev') ? 'is-prev' : 'is-next'}[data-pawn="${d.pawn}"]` : '';
  renderPlay();
  if (keep) $('pgPlay').querySelector(keep)?.focus();
});
$('pgPlay').addEventListener('input', e => {
  if (e.target.id !== 'joinCode') return;
  setup.joinCode = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  e.target.value = setup.joinCode;
  netError = '';
  saveSetup();
  const ok = setup.joinCode.length === 6;
  $('btnStart').disabled = !ok || netBusy;
  $('playHint').textContent = ok ? `${setup.online === 'watch' ? 'Oglądasz' : 'Dołączasz'} jako ${profile.nick}` : 'Wpisz 6-znakowy kod party.';
});
$('pgPlay').addEventListener('keydown', e => { if (e.target.id === 'joinCode' && e.key === 'Enter' && !$('btnStart').disabled) $('btnStart').click(); });
$('btnStart').addEventListener('click', () => (setup.mode === 'online' ? openOnline() : startGame()));

// ---------------------------------------------------------------------------
// Party online: gospodarz tworzy pokój na serwerze gry, znajomi dołączają kodem.
// Kod do sieci (Socket.IO) wczytuje się dopiero tutaj, więc gra solo go nie pobiera.
// ---------------------------------------------------------------------------
const onlineModule = () => import('../net/online.ts');
const SEAT_KIND = { me: 'host', online: 'online', local: 'local', bot: 'bot' };
function onlineConfig() {
  return {
    seats: setup.slots.map(s => ({ kind: SEAT_KIND[s.kind], level: s.level, pawnIdx: slotPawn(s), colorIdx: slotColor(s) })),
    teams: setup.teams, semester: setup.semester, timer: setup.timer,
  };
}
async function openOnline() {
  saveSetup();
  netBusy = true; netError = '';
  $('btnStart').disabled = true;
  $('playHint').textContent = 'Łączę z serwerem gry…';
  let r, client = null, mod = null;
  try {
    mod = await onlineModule();
    leaveOnline();
    client = new mod.OnlineClient();
    r = setup.online === 'watch' ? await client.watch(setup.joinCode, profile.nick)
      : setup.online === 'join' ? await client.join(setup.joinCode, profile.nick, profile.pawn)
      : await client.create(profile.nick, onlineConfig());
  } catch (e) {
    console.error(e);
    r = { error: 'Nie udało się wczytać trybu online.' };
  }
  netBusy = false;
  if (r.error) {
    client?.close();
    netError = r.error === 'Brak połączenia z serwerem gry.'
      ? 'Brak połączenia z serwerem gry. Grę online trzeba otworzyć z adresu, na którym działa serwer (npm run server).'
      : r.error;
    renderPlay();
    return;
  }
  attachNet(mod, client, r);
}
function attachNet(mod, client, r) {
  const net = NET = { mod, client, seat: r.seat, lobby: r.lobby };
  client.onLobby = l => { if (NET !== net) return; net.lobby = l; renderWatchers(); if (!$('pgLobby').hidden) renderLobby(); };
  client.onStart = m => { if (NET === net) beginOnline(m); };
  client.onNote = text => { if (NET === net) toast(text); };
  client.onEmote = m => { if (NET === net) showEmote(m.player, m.k); };
  client.onClosed = text => {
    if (NET !== net) return;
    NET = null;
    netError = text;
    if (G?.online) { quitGame(); openMenu(); }
    if (menuOpen) go('play');
  };
  client.onLost = gone => {
    if (NET !== net) return;
    if (G?.online) lostScreen(gone ? 'gone' : 'trying');
    else toast(gone ? 'Nie da się wrócić do tego party.' : 'Zerwane połączenie z serwerem gry. Łączę ponownie…');
  };
  client.onBack = j => {
    if (NET !== net) return;
    net.lobby = j.lobby;
    lostScreen(null);
    toast('Połączenie wróciło.');
    if (j.game) beginOnline(j.game);   // odbudowa widoku: w czasie przerwy mogły przyjść ruchy
    else if (!$('pgLobby').hidden) renderLobby();
  };
  if (r.game) beginOnline(r.game);
  else go('lobby');
}
// Ekran zerwanego połączenia w grze online: gra łączy się sama; po 20 s bez połączenia gracz może spróbować
// jeszcze raz albo wyjść. W tym czasie za gracza decyduje bot, a miejsce czeka, dopóki trwa gra.
let lostTimer = 0;
function lostScreen(state) {
  const el = $('gLost');
  clearTimeout(lostTimer);
  if (!state) { el.hidden = true; return; }
  const gone = state === 'gone', slow = state === 'slow';
  $('gLostText').textContent = gone ? 'Nie da się wrócić na Twoje miejsce: gra mogła się już skończyć.'
    : slow ? 'Serwer gry dalej nie odpowiada. W tym czasie za Ciebie decyduje bot, a miejsce czeka, dopóki trwa gra.'
    : 'Łączę ponownie z serwerem gry…';
  $('gLostRetry').hidden = gone || !slow;
  $('gLostBtns').hidden = !gone && !slow;
  $('gLostSpin').hidden = gone || slow;
  el.hidden = false;
  if (state === 'trying') lostTimer = setTimeout(() => { if (!el.hidden) lostScreen('slow'); }, 20_000);
}
$('gLostRetry').addEventListener('click', () => { NET?.client.retry(); lostScreen('trying'); });
$('gLostQuit').addEventListener('click', () => { lostScreen(null); quitGame(); openMenu(); });
function leaveOnline() {
  if (!NET) return;
  const net = NET;
  NET = null;
  net.client.close();
}
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 5000);
}
const SEAT_SUB = { host: 'Gospodarz', online: 'Gracz online', local: 'Przy komputerze gospodarza', bot: 'Bot' };
function renderLobby() {
  if (!NET) { go('play'); return; }
  const { lobby, seat } = NET;
  const host = lobby.seats[seat]?.kind === 'host';
  $('lobbyCode').textContent = lobby.code;
  $('lobbyPill').textContent = lobby.teams ? '2 na 2' : 'Każdy na siebie';
  const sem = lobby.semester === 8 ? 'pytania mieszane' : `semestr ${lobby.semester}`;
  const time = (TIMERS.find(([v]) => v === lobby.timer) || [0, `${lobby.timer} min`])[1].toLowerCase();
  const watchers = lobby.watchers ? ` · widzowie: ${lobby.watchers}` : '';
  $('lobbyInfo').textContent = `${host ? 'Podaj ten kod znajomym, żeby dołączyli. Kodem można też oglądać grę. ' : ''}${sem[0].toUpperCase() + sem.slice(1)} · ${time}${watchers}`;
  $('lobbySeats').innerHTML = lobby.seats.map((s, i) => {
    const waiting = !s.filled;
    const sub = waiting ? 'Czeka na dołączenie kodem'
      : s.kind === 'bot' ? `Bot · poziom ${s.level}`
      : s.kind === 'online' && !s.connected ? 'Rozłączony, może wrócić' : SEAT_SUB[s.kind];
    const team = lobby.teams ? TEAMS[i % 2] : null;
    return `<div class="m-slot${waiting ? ' is-waiting' : ''}${i === seat ? ' is-you' : ''}">
      <div class="m-slot-top">${avatar(s.pawnIdx, s.colorIdx)}<span class="m-slot-name"><b>${escHtml(s.name)}${i === seat ? ' (Ty)' : ''}</b><small>${sub}</small></span>
      ${team ? `<span class="m-team" style="--t:${team.color}">${team.name}</span>` : ''}<span class="m-live${s.connected && s.filled ? '' : ' off'}" aria-hidden="true"></span></div>
    </div>`;
  }).join('');
  const missing = lobby.seats.filter(s => !s.filled).length;
  $('btnLobbyStart').hidden = !host;
  $('btnLobbyStart').disabled = !lobby.canStart;
  $('lobbyHint').textContent = seat < 0 ? 'Oglądasz tę grę jako widz. Zacznie się, gdy gospodarz ją uruchomi.'
    : !host ? 'Gospodarz zacznie grę, gdy wszyscy dołączą.'
    : lobby.canStart ? 'Wszyscy są gotowi.' : `Czekamy na graczy online: ${missing}`;
}
$('lobbyLeave').addEventListener('click', () => { leaveOnline(); go('play'); });
$('lobbyCopy').addEventListener('click', () => {
  if (!NET) return;
  navigator.clipboard?.writeText(NET.lobby.code).then(() => { $('lobbyCopy').textContent = 'Skopiowano'; setTimeout(() => { $('lobbyCopy').textContent = 'Kopiuj kod'; }, 1600); }, () => {});
});
$('btnLobbyStart').addEventListener('click', async () => {
  if (!NET) return;
  $('btnLobbyStart').disabled = true;
  const r = await NET.client.start();
  if (r.error) { $('lobbyHint').textContent = r.error; renderLobby(); }
});

// Ranking (do czasu serwera gry dane są przykładowe)
// Ranking: na razie tylko Twoje wyniki z gier w tej przeglądarce. Ranking wszystkich graczy pojawi się,
// gdy gra stanie na serwerze uczelni z logowaniem przez wirtualny dziekanat.
const fmtNum = v => (v == null ? '–' : v.toLocaleString('pl-PL'));
function myRankRow() {
  const st = profile?.stats || {};
  const games = st.games || 0, wins = st.wins || 0;
  return {
    nick: profile?.nick || 'Ty', pawn: profile?.pawn ?? 0, color: profile?.color ?? 0, games, wins,
    acc: st.q ? Math.round((100 * st.ok) / st.q) : null, best: st.best ?? null, wealth: st.wealth ?? null,
    rate: games ? Math.round((100 * wins) / games) : null,
  };
}
function renderRanking() {
  const r = myRankRow();
  const empty = !r.games;
  // trzy rekordy zamiast podium innych graczy
  const records = [
    ['Wygrane', fmtNum(r.wins), r.games ? `z ${fmtNum(r.games)} gier` : 'jeszcze bez gier'],
    ['Skuteczność', r.acc == null ? '–' : `${r.acc}%`, r.best == null ? 'dobrych odpowiedzi' : `najlepsza gra: ${r.best}%`],
    ['Najwyższy majątek', r.wealth == null ? '–' : money(r.wealth), 'w jednej grze'],
  ];
  $('podium').innerHTML = records.map(([t, v, sub], i) => `
    <div class="m-card m-podium-card"><span class="m-medal r${i + 1}">${i + 1}</span>${i === 0 ? avatar(r.pawn, r.color) : ''}<b>${t}</b><span class="m-big-num">${v}</span><small>${sub}</small></div>`).join('');
  const bar = p => (p == null ? '–' : `<span class="m-bar"><i style="width:${p}%"></i></span>${p}%`);
  $('rankTable').innerHTML = `
    <thead><tr><th>#</th><th>Gracz</th><th>Rozegrane</th><th>Wygrane</th><th>% wygranych</th><th>Dobre odpowiedzi</th><th>Najlepsza gra</th><th>Najwyższy majątek</th></tr></thead>
    <tbody><tr class="is-me">
      <td><span class="m-pos">1</span></td>
      <td><span class="m-player">${avatar(r.pawn, r.color)}${escHtml(r.nick)} (Ty)</span></td>
      <td>${fmtNum(r.games)}</td><td>${fmtNum(r.wins)}</td><td>${r.rate == null ? '–' : `${r.rate}%`}</td>
      <td>${bar(r.acc)}</td><td>${r.best == null ? '–' : `${r.best}%`}</td><td>${r.wealth == null ? '–' : money(r.wealth)}</td></tr></tbody>`;
  $('rankHint').innerHTML = empty
    ? 'Rozegraj pierwszą grę, a Twoje wyniki pojawią się tutaj. <button type="button" class="chip" data-go="play" style="margin-left: 6px">Graj</button>'
    : 'Wyniki liczą się po każdej grze na tym komputerze. Ranking wszystkich graczy pojawi się, gdy gra będzie na serwerze uczelni.';
}

// Zasady (wersja robocza) z przykładowym pytaniem, które nigdy nie padnie w grze
const EXAMPLE = { q: 'Ile to jest 7 × 8?', a: ['54', '56', '64', '48'], ok: 1 };
const RULES = [
  { t: 'Cel gry', b: '<p>Zbierz największy majątek: kupuj sale, buduj na nich i pobieraj czynsz od innych graczy. Wiedza się opłaca, bo dobre odpowiedzi pozwalają kupować i budować, a na polu START dają premię.</p>' },
  { t: 'Tura i kostki', b: '<ul><li>Rzucasz dwiema kostkami i idziesz o sumę oczek.</li><li>Dublet: rzucasz jeszcze raz.</li><li>Trzeci dublet z rzędu: idziesz do dziekanatu.</li></ul>' },
  { t: 'Pytania', wide: true, q: true, b: '<p>Przed grą wybierasz semestr od 1 do 7 albo pytania mieszane. Na każde pytanie masz minutę i 4 odpowiedzi do wyboru. Pytania przygotowują wykładowcy. Tutaj pokazujemy tylko przykład, który nie pada w grze:</p>' },
  { t: 'Kupowanie i budowanie', b: '<ul><li>Pierwsza wizyta na wolnej sali: po dobrej odpowiedzi kupujesz salę.</li><li>Każda kolejna wizyta na Twojej sali: po dobrej odpowiedzi budujesz najwyżej 2 poziomy. Kolejno: telefon, laptop, komputer, szafa rack i serwerownia.</li><li>Zła odpowiedź: kupisz albo zbudujesz na początku następnej tury, chyba że ktoś inny Cię uprzedzi.</li><li>Serwerownia chroni salę: nie da się jej zburzyć, odebrać ani wyłączyć.</li></ul>' },
  { t: 'Premia za START', b: '<p>Gra liczy Twoje odpowiedzi w każdym okrążeniu. Na polu START dostajesz zwykłą kwotę i premię równą procentowi dobrych odpowiedzi z tego okrążenia. Przykład: 250 zł i 50% dobrych odpowiedzi to razem 375 zł.</p>' },
  { t: 'Pieniądze i pola', b: '<ul><li>Na start masz 2000 zł.</li><li>Na cudzej sali płacisz czynsz. Monopol, czyli cała grupa sal w jednych rękach, podwaja czynsz za salę bez budynku.</li><li>Parkingi i pola specjalne kupujesz tak jak sale. Im więcej takich pól masz, tym wyższy czynsz.</li><li>Czesne i kary trafiają do puli na środku. Kto stanie na Stypendium rektorskim, zabiera całą pulę.</li></ul>' },
  { t: 'Dziekanat', b: '<ul><li>Stajesz na polu Dziekanat: dostajesz pytanie dziekanatu. Zła odpowiedź to 1 kolejka postoju.</li><li>Pole „Udaj się do dziekanatu” albo trzeci dublet: 2 kolejki. Wcześniej wyjdziesz, płacąc za warunek, rzucając dubletem po dobrej odpowiedzi albo kartą „Wyjście z dziekanatu”.</li></ul>' },
  { t: 'Szansa i karty', b: '<p>Na polu Szansa odpowiadasz na pytanie. Dobra odpowiedź daje kartę ułatwienia, zła kartę utrudnienia. Drugie pytanie może podwoić działanie karty.</p>' },
  { t: '2 na 2 i boty', b: '<ul><li>W drużynie nie płacisz czynszu partnerowi. Możesz rozbudować jego salę, ale sala i czynsz zostają jego.</li><li>Boty mają 3 poziomy: łatwy, średni i trudny. Im trudniejszy bot, tym częściej odpowiada dobrze i rozsądniej wydaje pieniądze.</li></ul>' },
  { t: 'Koniec gry', b: '<p>Gra trwa do końca albo do upływu ustawionego czasu. Liczy się majątek: gotówka, sale i budynki. Przy remisie wygrywa lepsza skuteczność, a gracz z najlepszą skutecznością dostaje tytuł „Prymus”. Wygrywasz od razu, gdy zbierzesz 3 monopole albo wszystkie 4 pola specjalne. Na koniec zobaczysz swoją skuteczność, ale nie pytania ani dobre odpowiedzi.</p>' },
];
const exampleHtml = () => `
  <div class="m-q">
    <div class="m-q-head"><span>Przykładowe pytanie · matematyka</span><span class="m-q-time"><i id="exBar"></i><span id="exTime">1:00</span></span></div>
    <p class="m-q-text">${EXAMPLE.q}</p>
    <div class="m-q-ans">${EXAMPLE.a.map((a, i) => `<button type="button" data-ans="${i}"><b>${'ABCD'[i]}</b>${a}</button>`).join('')}</div>
    <p class="m-q-res" id="exRes" aria-live="polite"></p>
  </div>`;
function startExample() {
  let left = 60;
  const tick = () => {
    $('exTime').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    $('exBar').style.setProperty('--left', `${(left / 60) * 100}%`);
  };
  tick();
  clearInterval(exampleTimer);
  exampleTimer = setInterval(() => {
    left -= 1;
    tick();
    if (left <= 0) { clearInterval(exampleTimer); answerExample(null); }
  }, 1000);
}
function answerExample(i) {
  clearInterval(exampleTimer);
  const btns = [...$('rules').querySelectorAll('[data-ans]')];
  btns.forEach((b, k) => {
    b.disabled = true;
    if (k === EXAMPLE.ok) b.classList.add('is-good');
    else if (k === i) b.classList.add('is-bad');
  });
  const good = `${'ABCD'[EXAMPLE.ok]}: ${EXAMPLE.a[EXAMPLE.ok]}`;
  $('exRes').innerHTML = (i === EXAMPLE.ok
    ? 'Dobrze! W grze dobra odpowiedź pozwala np. kupić salę.'
    : i === null ? `Czas minął. Dobra odpowiedź to ${good}.` : `Niestety źle. Dobra odpowiedź to ${good}.`)
    + ' <button type="button" class="chip" data-retry="1" style="margin-left: 6px">Jeszcze raz</button>';
}
function renderRules() {
  $('rules').innerHTML = RULES.map((r, i) =>
    `<section class="m-card m-rule${r.wide ? ' m-rule-wide' : ''}"><h3><span>${i + 1}</span>${r.t}</h3>${r.b}${r.q ? exampleHtml() : ''}</section>`).join('');
  startExample();
}
$('rules').addEventListener('click', e => {
  const a = e.target.closest('[data-ans]');
  if (a && !a.disabled) { answerExample(+a.dataset.ans); return; }
  if (e.target.closest('[data-retry]')) renderRules();
});

// Profil
// Odznaka osiągnięcia: zdobyta w kolorze uczelni ze złotą gwiazdką, niezdobyta szara z opisem, co zrobić
const achHtml = (a, got, date) => `<div class="m-ach${got ? ' is-got' : ''}">
  <span class="m-ach-ico" aria-hidden="true">${icon(a.icon || 'star')}</span>
  <span class="m-ach-txt"><b>${a.name}</b><small>${a.desc}${date ? ` · ${date.split('-').reverse().join('.')}` : ''}</small></span></div>`;
function renderProfilePage() {
  $('profNick').value = profile.nick;
  $('profErr').hidden = true;
  $('pawnPick').innerHTML = PLAYERS.map((p, i) =>
    `<button type="button" data-v="${i}" aria-pressed="${i === profile.pawn}">${avatar(i, profile.color)}${p.pawn}</button>`).join('');
  // duży pionek w 3D ze strzałkami, pod nim nazwa i opis
  const n = PLAYERS.length, pawn = profile.pawn, hex = PAWN_COLORS[profile.color].hex;
  const stage = $('profStage');
  stage.style.setProperty('--c', hex);
  stage.innerHTML = `
    <button type="button" class="m-arrow is-prev" data-v="${(pawn + n - 1) % n}" aria-label="Poprzedni pionek: ${PLAYERS[(pawn + n - 1) % n].pawn}">${icon('back')}</button>
    <button type="button" class="m-arrow is-next" data-v="${(pawn + 1) % n}" aria-label="Następny pionek: ${PLAYERS[(pawn + 1) % n].pawn}">${icon('next')}</button>`;
  preview.init();
  const cv = stageCanvas('profile');
  stage.prepend(cv);
  preview.set(cv, `${pawn}|${hex}`, () => previewPawn(pawn, hex));
  $('profPawnInfo').style.setProperty('--c', hex);
  $('profPawnInfo').innerHTML = `<b>${PLAYERS[pawn].pawn}</b><span class="m-dots" role="img" aria-label="Pionek ${pawn + 1} z ${n}">${PLAYERS.map((_, k) => `<i${k === pawn ? ' class="on"' : ''}></i>`).join('')}</span><p class="m-seat-desc">${PAWN_DESC[pawn]}</p>`;
  $('colorPick').innerHTML = PAWN_COLORS.map((c, i) =>
    `<button type="button" class="swatch" style="--c:${c.hex}" data-v="${i}" aria-pressed="${i === profile.color}" aria-label="${c.name}"></button>`).join('');
  const st = profile.stats || {};
  $('profStats').innerHTML = [[fmtNum(st.games || 0), 'rozegrane gry'], [fmtNum(st.wins || 0), 'wygrane'], [st.q ? `${Math.round((100 * st.ok) / st.q)}%` : '–', 'dobre odpowiedzi']]
    .map(([b, s]) => `<div class="m-stat"><b>${b}</b><span>${s}</span></div>`).join('');
  const have = profile.achievements || {};
  $('profAch').innerHTML = ACHIEVEMENTS.map(a => achHtml(a, !!have[a.id], have[a.id])).join('');
  $('profAchCount').textContent = `${Object.keys(have).length} z ${ACHIEVEMENTS.length}`;
}
$('pawnPick').addEventListener('click', e => {
  const b = e.target.closest('[data-v]');
  if (!b) return;
  profile.pawn = +b.dataset.v;
  store.set('profil', profile);
  renderMe(); renderProfilePage();
});
$('profStage').addEventListener('click', e => {
  const b = e.target.closest('[data-v]');
  if (!b) return;
  profile.pawn = +b.dataset.v;
  store.set('profil', profile);
  renderMe(); renderProfilePage();
  $('profStage').querySelector(b.classList.contains('is-prev') ? '.is-prev' : '.is-next')?.focus();
});
$('colorPick').addEventListener('click', e => {
  const b = e.target.closest('[data-v]');
  if (!b) return;
  const meIdx = setup.slots.findIndex(s => s.kind === 'me');
  pickColor(meIdx, +b.dataset.v);
  saveSetup();
  renderMe(); renderProfilePage();
});
$('profNick').addEventListener('change', e => {
  const v = e.target.value.trim();
  $('profErr').hidden = v.length >= 3;
  if (v.length < 3) return;
  profile.nick = v;
  store.set('profil', profile);
  renderMe();
});

// Ustawienia
function renderSettingsPage() {
  const chips = (items, cur, attr) => `<div class="chips">${items.map(([v, l]) => chipHtml(l, `${attr}="${v}"`, String(v) === String(cur))).join('')}</div>`;
  $('settingsBox').innerHTML = `
    <div class="m-set"><span>Motyw</span>${chips([['system', 'Systemowy'], ['light', 'Jasny'], ['dark', 'Ciemny']], prefs.theme, 'data-theme-set')}</div>
    <div class="m-set"><span>Muzyka<small>W menu, w grze i w prezentacji</small></span><div class="m-range"><input type="range" id="volMusic" min="0" max="100" step="5" value="${prefs.music}" aria-label="Głośność muzyki"><output id="volMusicOut">${prefs.music}%</output></div></div>
    <div class="m-set"><span>Efekty dźwiękowe<small>Np. rzut kostkami</small></span><div class="m-range"><input type="range" id="volFx" min="0" max="100" step="5" value="${prefs.effects}" aria-label="Głośność efektów"><output id="volFxOut">${prefs.effects}%</output></div></div>
    <div class="m-set"><span>Muzyka prezentacji</span>${chips([['kod', 'Nasza, z kodu gry'], ['alex', 'Epic Cinematic Trailer']], prefs.promoMusic, 'data-promo-music')}</div>
    <div class="m-set"><span>Autorzy muzyki<small>Licencje: assets/muzyka/AUTORZY.md</small></span><p class="m-credits">Prezentacja: utwór filmowy skomponowany w kodzie gry (Web Audio) albo do wyboru „Epic Cinematic Trailer | ELITE”, Alex-Productions (onsound.eu), licencja CC BY 3.0, źródło chosic.com.<br>Menu i gra: „Tropical Sun”, All Good Folks oraz „New Life”, Moire (Uppbeat), gdy pliki są w folderze gry. Bez nich gra muzyka napisana w kodzie.</p></div>
    <div class="m-set"><span>Rozmiar elementów</span>${chips([[0.9, 'Mały'], [1, 'Średni'], [1.15, 'Duży']], prefs.scale, 'data-scale')}</div>
    <div class="m-set"><span>Jakość grafiki<small id="gfxInfo">${gfx.describe()}</small></span>${chips(GFX_LEVELS, prefs.gfx, 'data-gfx')}</div>
    <div class="m-set"><span>Wygląd planszy</span>${chips(SKIN_NAMES, prefs.skin, 'data-skin')}</div>
    <div class="m-set"><span>Pora dnia<small>Makieta i czysta tektura; „Jak teraz” według zegara</small></span>${chips(TIME_NAMES, prefs.time, 'data-time')}</div>
    <div class="m-set"><span>Obracanie planszy w menu</span>${chips([[1, 'Włączone'], [0, 'Wyłączone']], prefs.spin ? 1 : 0, 'data-spin')}</div>
    <div class="m-set"><span>Najazdy kamery<small>Przy kupnie pola i hotelu</small></span>${chips([[1, 'Włączone'], [0, 'Wyłączone']], prefs.cine ? 1 : 0, 'data-cine')}</div>
    <div class="m-set"><span>Podpowiedzi w grze<small>Samouczek przy pierwszych grach${prefs.tipsSeen.length ? ` · pokazane: ${prefs.tipsSeen.length} z ${Object.keys(TIPS).length}` : ''}</small></span><div class="chips">${chipHtml('Włączone', 'data-tips="1"', prefs.tips)}${chipHtml('Wyłączone', 'data-tips="0"', !prefs.tips)}${chipHtml('Pokaż od nowa', 'data-tips-reset', false, !prefs.tipsSeen.length)}</div></div>
    <div class="m-set"><span>Licznik klatek<small>Płynność gry (FPS) w rogu ekranu</small></span>${chips([[1, 'Włączony'], [0, 'Wyłączony']], prefs.fps ? 1 : 0, 'data-fps')}</div>`;
}
$('settingsBox').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.themeSet) { prefs.theme = d.themeSet; applyTheme(); }
  else if (d.scale) { prefs.scale = +d.scale; applyScale(); }
  else if (d.skin) { prefs.skin = d.skin; applySkin(prefs.skin); if (audioStarted()) ambience(); }
  else if (d.time) { prefs.time = d.time; setWorldMood(timeNow(prefs.time)); }
  else if (d.promoMusic) prefs.promoMusic = d.promoMusic;
  else if (d.gfx) { prefs.gfx = d.gfx; gfx.set(d.gfx); }
  else if (d.spin !== undefined) { prefs.spin = d.spin === '1'; controls.autoRotate = menuOpen && prefs.spin && !reduceMotion; }
  else if (d.cine !== undefined) prefs.cine = d.cine === '1';
  else if (d.tips !== undefined) prefs.tips = d.tips === '1';
  else if (d.tipsReset !== undefined) { prefs.tipsSeen = []; prefs.tips = true; }
  else if (d.fps !== undefined) { prefs.fps = d.fps === '1'; fpsMeter(); }
  else return;
  savePrefs();
  renderSettingsPage();
});
$('settingsBox').addEventListener('input', e => {
  if (e.target.id === 'volMusic') { prefs.music = +e.target.value; $('volMusicOut').textContent = `${prefs.music}%`; gameMusic(); }
  if (e.target.id === 'volFx') { prefs.effects = +e.target.value; $('volFxOut').textContent = `${prefs.effects}%`; ambience(); }
  savePrefs();
});
$('btnTheme').addEventListener('click', () => {
  prefs.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
  savePrefs();
  applyTheme();
  if (!$('pgSettings').hidden) renderSettingsPage();
});

// Ekrany: logowanie, menu, wyjście z gry
let menuOpen = false;
function showScreen(name) {
  $('scrLogin').hidden = name !== 'login';
  $('scrMain').hidden = name !== 'main';
  $('scrBye').hidden = name !== 'bye';
  if (name === 'main') { renderMe(); go('home'); }
  if (name === 'login') $('ssoNote').hidden = true;
}
function openMenu() {
  menuOpen = true;
  if (view !== 'board') setView('board');
  selectCell(null);
  $('toast').hidden = true;
  document.body.classList.add('menu-open');
  $('menu').hidden = false;
  controls.enabled = false;
  controls.autoRotateSpeed = 0.6;
  controls.autoRotate = prefs.spin && !reduceMotion;   // plansza powoli obraca się w tle
  applyView();
  showScreen(profile ? 'main' : 'login');
}
function closeMenu(message) {
  menuOpen = false;
  preview.sleep();   // podgląd pionków nie jest potrzebny w grze
  closeDropdown();
  clearInterval(exampleTimer);
  document.body.classList.remove('menu-open');
  $('menu').hidden = true;
  controls.autoRotate = false;
  controls.enabled = true;
  applyView();
  flyTo(presetBoard());
  if (message) { $('toast').textContent = message; $('toast').hidden = false; setTimeout(() => { $('toast').hidden = true; }, 5000); }
}
$('btnSso').addEventListener('click', () => { $('ssoNote').hidden = false; $('nick').focus(); });
$('guestForm').addEventListener('submit', e => {
  e.preventDefault();
  const nick = $('nick').value.trim();
  if (nick.length < 3) { $('nickErr').hidden = false; $('nick').focus(); return; }
  $('nickErr').hidden = true;
  profile = { nick, guest: true, pawn: 0, color: 0 };
  store.set('profil', profile);
  showScreen('main');
});
$('btnLogout').addEventListener('click', () => {
  closeDropdown();
  profile = null;
  store.del('profil');
  $('nick').value = '';
  showScreen('login');
});
$('btnExit').addEventListener('click', () => {
  closeDropdown();
  $('byeTitle').textContent = `Do zobaczenia, ${profile.nick}!`;
  showScreen('bye');
});
$('btnBack').addEventListener('click', () => showScreen('main'));
$('btnPreview').addEventListener('click', () => closeMenu());
$('btnMenu').addEventListener('click', openMenu);
applyTheme();
applyScale();
applySkin(prefs.skin);
setWorldMood(timeNow(prefs.time));
// „Jak teraz”: co minutę sprawdzamy, czy nie zmieniła się pora dnia (nie w prezentacji)
setInterval(() => { if (prefs.time === 'auto' && !P.on && timeNow('auto') !== worldTime) setWorldMood(timeNow('auto')); }, 60_000);

$('viewBoard').addEventListener('click', () => setView('board'));
$('viewModels').addEventListener('click', () => setView('models'));
$('viewCards').addEventListener('click', () => setView('cards'));


// ---------------------------------------------------------------------------
// Karty „Wyjście z dziekanatu” (ilustracje wektorowe rysowane w kodzie)
// ---------------------------------------------------------------------------
const face = (x, y, s = 1, ink = '#3B2A20') => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="-26" cy="0" r="9" fill="${ink}"/><circle cx="26" cy="0" r="9" fill="${ink}"/>
    <circle cx="-23" cy="-3" r="3" fill="#fff"/><circle cx="29" cy="-3" r="3" fill="#fff"/>
    <path d="M-10 12 Q0 22 10 12" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="-46" cy="16" rx="12" ry="7" fill="#F4A6A0" opacity=".8"/><ellipse cx="46" cy="16" rx="12" ry="7" fill="#F4A6A0" opacity=".8"/>
  </g>`;
const sparkle = (x, y, r, fill) =>
  `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="${fill}"/>`;
const heart = (x, y, s, fill) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 10 C-18 -2 -12 -16 0 -6 C12 -16 18 -2 0 10 Z" fill="${fill}"/>`;
const bean = (x, y, rot, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><ellipse rx="18" ry="12" fill="#6B3F22"/><path d="M-14 0 C-5 -6 5 6 14 0" fill="none" stroke="#3B2415" stroke-width="3" stroke-linecap="round"/></g>`;
const ring = (cx, cy, n, r, pr, fill) => Array.from({ length: n }, (_, k) => {
  const a = (k / n) * Math.PI * 2 - Math.PI / 2;
  return `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${pr}" fill="${fill}"/>`;
}).join('');
function smoothClosed(pts) {
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const n = pts.length;
  const [sx, sy] = mid(pts[0], pts[1]);
  let d = `M${sx.toFixed(1)} ${sy.toFixed(1)}`;
  for (let k = 1; k <= n; k++) {
    const pt = pts[k % n], m = mid(pt, pts[(k + 1) % n]);
    d += ` Q${pt[0].toFixed(1)} ${pt[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return d + ' Z';
}

function artCoffee(id) {
  const cup = 'M205 330 L425 330 C425 425 405 495 340 498 L290 498 C225 495 205 425 205 330 Z';
  return `
    <ellipse cx="315" cy="532" rx="178" ry="20" fill="#000" opacity=".07"/>
    <g fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round">
      <path d="M270 292 C245 262 295 248 270 214"/><path d="M315 284 C290 250 340 236 315 196"/><path d="M360 292 C335 262 385 248 360 214"/>
    </g>
    <ellipse cx="315" cy="506" rx="172" ry="36" fill="#fff" stroke="#E6D5C3" stroke-width="4"/>
    <ellipse cx="315" cy="500" rx="112" ry="20" fill="#F1E2D2"/>
    <path d="M418 368 C488 352 492 452 404 452" fill="none" stroke="#E6D5C3" stroke-width="30" stroke-linecap="round"/>
    <path d="M418 368 C488 352 492 452 404 452" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round"/>
    <clipPath id="${id}-cup"><path d="${cup}"/></clipPath>
    <path d="${cup}" fill="#fff" stroke="#E6D5C3" stroke-width="4"/>
    <g clip-path="url(#${id}-cup)">
      <rect x="200" y="452" width="230" height="20" fill="#E8B07A"/>
      <rect x="200" y="330" width="46" height="170" fill="#000" opacity=".035"/>
    </g>
    <ellipse cx="315" cy="330" rx="110" ry="24" fill="#7A4A2A"/>
    <ellipse cx="315" cy="331" rx="96" ry="18" fill="#B97A4E"/>
    <path d="M315 344 C290 333 294 318 307 322 C311 323 314 327 315 330 C316 327 319 323 323 322 C336 318 340 333 315 344 Z" fill="#F7E6D3"/>
    <ellipse cx="315" cy="330" rx="110" ry="24" fill="none" stroke="#E6D5C3" stroke-width="4"/>
    ${face(315, 402)}
    ${bean(138, 478, -30)}${bean(494, 490, 25)}${bean(476, 236, 60, 0.8)}${bean(156, 250, -60, 0.7)}
    ${sparkle(118, 366, 16, '#E8B07A')}${sparkle(512, 360, 12, '#E8B07A')}${sparkle(214, 196, 10, '#fff')}${sparkle(420, 190, 13, '#fff')}`;
}

function artFlowers() {
  const daisy = (cx, cy) => Array.from({ length: 10 }, (_, k) =>
    `<ellipse cx="${cx}" cy="${cy - 26}" rx="10" ry="22" fill="#fff" stroke="#F2C6D6" stroke-width="2" transform="rotate(${k * 36} ${cx} ${cy})"/>`).join('');
  return `
    <ellipse cx="315" cy="566" rx="120" ry="16" fill="#000" opacity=".07"/>
    <g transform="translate(0 -40) translate(315 300) scale(1.12) translate(-315 -300)">
    <g stroke="#3F9E5A" stroke-width="8" stroke-linecap="round" fill="none">
      <path d="M315 470 L315 300"/><path d="M300 470 C280 400 240 370 215 330"/><path d="M330 470 C350 400 390 370 420 330"/>
      <path d="M308 470 C300 380 275 300 262 250"/><path d="M322 470 C330 380 360 300 372 246"/>
    </g>
    <path d="M300 425 C248 405 222 362 228 328 C272 344 296 382 300 425 Z" fill="#4CB36A"/>
    <path d="M330 425 C382 405 408 362 402 328 C358 344 334 382 330 425 Z" fill="#4CB36A"/>
    ${ring(262, 246, 5, 13, 11, '#8FB8F7')}<circle cx="262" cy="246" r="8" fill="#FFD166"/>
    ${ring(372, 242, 5, 13, 11, '#8FB8F7')}<circle cx="372" cy="242" r="8" fill="#FFD166"/>
    <path d="M182 332 C176 292 192 270 198 260 L211 286 L224 256 L237 286 L250 260 C256 270 264 300 252 332 C242 352 192 352 182 332 Z" fill="#FF7A8A"/>
    <path d="M211 286 L224 256 L237 286 C232 300 216 300 211 286 Z" fill="#FF9AA6"/>
    ${daisy(424, 322)}<circle cx="424" cy="322" r="20" fill="#FFD166"/>
    ${ring(315, 292, 6, 46, 40, '#F7A8C4')}
    ${ring(315, 292, 6, 40, 26, '#FBC4D8')}
    <circle cx="315" cy="292" r="44" fill="#FFD166"/>
    ${face(315, 294, 0.78, '#5A3A1A')}
    </g>
    <path d="M182 352 L448 352 L353 564 L277 564 Z" fill="#fff" stroke="#F2C6D6" stroke-width="4" stroke-linejoin="round"/>
    <path d="M182 352 L298 352 L292 564 L277 564 Z" fill="#FDEFF4"/>
    <g transform="translate(315 470)">
      <path d="M-6 6 L-32 64 L-15 57 L-4 74 Z" fill="#B83465"/>
      <path d="M6 6 L32 64 L15 57 L4 74 Z" fill="#B83465"/>
      <path d="M0 0 C-30 -42 -84 -22 -62 12 C-50 28 -20 16 0 0 Z" fill="#D6457A"/>
      <path d="M0 0 C30 -42 84 -22 62 12 C50 28 20 16 0 0 Z" fill="#D6457A"/>
      <circle r="15" fill="#E86A99"/>
    </g>
    ${heart(138, 246, 1.5, '#F7A8C4')}${heart(500, 430, 1.2, '#F7A8C4')}${heart(118, 470, 0.9, '#fff')}
    ${sparkle(488, 214, 14, '#fff')}${sparkle(160, 400, 11, '#fff')}`;
}

function artSweets(id, card) {
  const wob = [4, -4, 6, -2, 18, 0, -4, 20, 2, -3, 6, -4, 5, -2, 4, -5, 6, -3, 5, -2];
  const icing = smoothClosed(wob.map((w, k) => {
    const a = (k / wob.length) * Math.PI * 2;
    return [Math.cos(a) * (100 + w), Math.sin(a) * (100 + w)];
  }));
  const sprinkles = [[-62, -38, 20, '#FFD166'], [-22, -78, -35, '#7FD1FF'], [28, -72, 50, '#9FE0A8'], [70, -40, -15, '#fff'],
    [-84, 6, 70, '#7FD1FF'], [84, 12, 30, '#FFD166'], [-58, -72, -50, '#fff'], [62, -76, 10, '#9FE0A8'], [0, -90, 80, '#fff'],
    [-40, -50, 40, '#F76C8A'], [45, -45, -60, '#7FD1FF'], [-78, 42, -20, '#9FE0A8'], [78, 46, 60, '#fff']]
    .map(([x, y, r, c]) => `<rect x="-9" y="-3.5" width="18" height="7" rx="3.5" fill="${c}" transform="translate(${x} ${y}) rotate(${r})"/>`).join('');
  return `
    <ellipse cx="315" cy="566" rx="200" ry="18" fill="#000" opacity=".07"/>
    <g transform="translate(160 346)">
      <path d="M-62 20 L62 20 L48 124 L-48 124 Z" fill="#7FC8F8"/>
      <g stroke="#5AAEE6" stroke-width="6"><path d="M-36 20 L-28 124"/><path d="M-12 20 L-9 124"/><path d="M12 20 L9 124"/><path d="M36 20 L28 124"/></g>
      <ellipse cx="0" cy="12" rx="72" ry="30" fill="#FFF3F8"/>
      <ellipse cx="0" cy="-16" rx="56" ry="26" fill="#FFD9EA"/>
      <ellipse cx="0" cy="-40" rx="36" ry="20" fill="#FFF3F8"/>
      <path d="M6 -80 C10 -96 20 -100 28 -102" stroke="#3F9E5A" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="4" cy="-66" r="16" fill="#E5484D"/><circle cx="-1" cy="-71" r="4.5" fill="#fff" opacity=".7"/>
    </g>
    <g transform="translate(474 300) rotate(-22)">
      <path d="M-48 0 L-88 -32 L-80 0 L-88 32 Z" fill="#F7C948"/>
      <path d="M48 0 L88 -32 L80 0 L88 32 Z" fill="#F7C948"/>
      <clipPath id="${id}-candy"><ellipse rx="54" ry="38"/></clipPath>
      <ellipse rx="54" ry="38" fill="#F7C948"/>
      <g clip-path="url(#${id}-candy)" stroke="#F08A4B" stroke-width="12"><path d="M-80 -50 L-50 50"/><path d="M-40 -50 L-10 50"/><path d="M0 -50 L30 50"/><path d="M40 -50 L70 50"/></g>
      <ellipse cx="-18" cy="-16" rx="14" ry="7" fill="#fff" opacity=".55"/>
    </g>
    <g transform="translate(315 432)">
      <circle r="126" fill="#E3A868"/>
      <path d="M-100 40 C-60 110 60 110 100 40" fill="none" stroke="#C9874A" stroke-width="5" opacity=".5"/>
      <path d="${icing}" fill="#FF8FB1"/>
      <path d="${icing}" fill="none" stroke="#F27399" stroke-width="3"/>
      <ellipse cx="-40" cy="-62" rx="30" ry="12" fill="#fff" opacity=".35" transform="rotate(-25 -40 -62)"/>
      <circle r="36" fill="${card.light}"/>
      <circle r="36" fill="none" stroke="#C9874A" stroke-width="6"/>
      ${sprinkles}
      ${face(0, 68, 0.9, '#5A2A1A')}
    </g>
    ${sparkle(110, 470, 14, '#fff')}${sparkle(520, 460, 16, '#F7C948')}${sparkle(300, 196, 12, '#fff')}${heart(512, 196, 1.1, '#FF8FB1')}`;
}

function artPet() {
  const tail = 'M410 520 C500 520 520 430 470 400';
  return `
    <ellipse cx="315" cy="570" rx="176" ry="18" fill="#000" opacity=".07"/>
    <path d="${tail}" fill="none" stroke="#E08A3C" stroke-width="36" stroke-linecap="round"/>
    <path d="${tail}" fill="none" stroke="#F4A259" stroke-width="24" stroke-linecap="round"/>
    <ellipse cx="315" cy="482" rx="128" ry="86" fill="#F4A259"/>
    <ellipse cx="315" cy="500" rx="70" ry="58" fill="#FFE3C2"/>
    <ellipse cx="265" cy="554" rx="36" ry="20" fill="#F4A259"/><ellipse cx="365" cy="554" rx="36" ry="20" fill="#F4A259"/>
    <g stroke="#D9823A" stroke-width="3" stroke-linecap="round"><path d="M256 548 L256 562"/><path d="M272 548 L272 562"/><path d="M356 548 L356 562"/><path d="M372 548 L372 562"/></g>
    <path d="M198 300 C196 250 205 205 222 180 C250 200 272 222 285 245 Z" fill="#F4A259"/>
    <path d="M432 300 C434 250 425 205 408 180 C380 200 358 222 345 245 Z" fill="#F4A259"/>
    <path d="M214 285 C214 250 220 222 228 206 C245 220 258 236 266 250 Z" fill="#F7A8B8"/>
    <path d="M416 285 C416 250 410 222 402 206 C385 220 372 236 364 250 Z" fill="#F7A8B8"/>
    <ellipse cx="315" cy="332" rx="138" ry="112" fill="#F4A259"/>
    <g fill="#D9823A">
      <path d="M300 222 C302 240 306 252 315 258 C324 252 328 240 330 222 C322 226 308 226 300 222 Z"/>
      <path d="M262 230 C268 244 276 252 284 256 C282 244 278 236 270 228 Z"/>
      <path d="M368 230 C362 244 354 252 346 256 C348 244 352 236 360 228 Z"/>
    </g>
    <ellipse cx="288" cy="374" rx="36" ry="27" fill="#FFF3E6"/><ellipse cx="342" cy="374" rx="36" ry="27" fill="#FFF3E6"/>
    <path d="M305 352 L325 352 L315 364 Z" fill="#F07C8E" stroke="#F07C8E" stroke-width="6" stroke-linejoin="round"/>
    <path d="M315 364 L315 374 M315 374 C308 384 298 384 294 376 M315 374 C322 384 332 384 336 376" fill="none" stroke="#5A3A22" stroke-width="4" stroke-linecap="round"/>
    <circle cx="262" cy="324" r="24" fill="#2B2B3A"/><circle cx="368" cy="324" r="24" fill="#2B2B3A"/>
    <circle cx="270" cy="315" r="9" fill="#fff"/><circle cx="376" cy="315" r="9" fill="#fff"/>
    <circle cx="255" cy="333" r="4" fill="#fff"/><circle cx="361" cy="333" r="4" fill="#fff"/>
    <ellipse cx="224" cy="370" rx="18" ry="10" fill="#F4A6A0" opacity=".85"/><ellipse cx="406" cy="370" rx="18" ry="10" fill="#F4A6A0" opacity=".85"/>
    <g stroke="#5A3A22" stroke-width="3" stroke-linecap="round" opacity=".6"><path d="M250 374 L196 364"/><path d="M250 384 L198 392"/><path d="M380 374 L434 364"/><path d="M380 384 L432 392"/></g>
    <path d="M226 424 Q315 464 404 424" fill="none" stroke="#E5484D" stroke-width="14" stroke-linecap="round"/>
    ${heart(315, 462, 1.9, '#FFD166')}
    ${heart(136, 250, 1.5, '#8FB8F7')}${heart(502, 226, 1.1, '#8FB8F7')}${heart(120, 460, 0.9, '#fff')}
    ${sparkle(150, 480, 13, '#fff')}${sparkle(498, 476, 12, '#fff')}${sparkle(488, 330, 9, '#8FB8F7')}`;
}

// Każda karta ma inny kolor i ilustrację, ale ten sam napis i działanie
const EXIT_CARDS = [
  { motif: 'filiżanka kawy', color: '#8B5E3C', light: '#F6E7D8', art: artCoffee },
  { motif: 'bukiet kwiatów', color: '#D6457A', light: '#FCE4EC', art: artFlowers },
  { motif: 'słodycze', color: '#F08A4B', light: '#FFEBDD', art: artSweets },
  { motif: 'kotek', color: '#3E8EDE', light: '#E3F0FC', art: artPet },
];

function exitCardSVG(card, i, uid = i) {
  const id = `bc${uid}`;
  const art = 'x="40" y="136" width="550" height="500" rx="28"';
  return `<svg viewBox="0 0 630 880" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Karta Wyjście z dziekanatu, ${i + 1} z 4: ${card.motif}">
  <defs>
    <clipPath id="${id}-clip"><rect width="630" height="880" rx="36"/></clipPath>
    <clipPath id="${id}-art"><rect ${art}/></clipPath>
    <pattern id="${id}-dots" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="18" cy="18" r="3" fill="${card.color}" opacity=".13"/></pattern>
    <radialGradient id="${id}-glow" cx="50%" cy="46%" r="58%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <g clip-path="url(#${id}-clip)">
    <rect width="630" height="880" fill="#FFFDF9"/>
    <rect width="630" height="112" fill="${card.color}"/>
    <text x="285" y="58" class="svg-display" font-size="34" fill="#fff" text-anchor="middle" dominant-baseline="central" letter-spacing=".5">WYJŚCIE Z DZIEKANATU</text>
    <text x="574" y="58" class="svg-body" font-size="26" font-weight="700" fill="#fff" fill-opacity=".85" text-anchor="middle" dominant-baseline="central">${i + 1}/4</text>
    <rect ${art} fill="${card.light}"/>
    <rect ${art} fill="url(#${id}-dots)"/>
    <rect ${art} fill="url(#${id}-glow)"/>
    <g clip-path="url(#${id}-art)">${card.art(id, card)}</g>
    <rect x="40" y="664" width="550" height="184" rx="22" fill="${card.light}" stroke="${card.color}" stroke-width="3"/>
    <text x="315" y="722" class="svg-body" font-size="29" font-weight="700" fill="#1E2A47" text-anchor="middle" dominant-baseline="central">Możesz wykorzystać tę kartę,</text>
    <text x="315" y="764" class="svg-body" font-size="29" font-weight="700" fill="#1E2A47" text-anchor="middle" dominant-baseline="central">żeby wcześniej wyjść</text>
    <text x="315" y="806" class="svg-body" font-size="29" font-weight="700" fill="#1E2A47" text-anchor="middle" dominant-baseline="central">z dziekanatu.</text>
    <rect width="630" height="880" rx="36" fill="none" stroke="${card.color}" stroke-width="12"/>
  </g>
</svg>`;
}

// Tyły kart ułatwień i utrudnień
for (const [kind, name] of [['ulatwienia', 'Ułatwienia'], ['utrudnienia', 'Utrudnienia']]) {
  const slot = document.createElement('div');
  slot.className = 'card-slot';
  slot.innerHTML = `
    <div class="flip static"><span class="flip-inner"><span class="face front"><img class="face-img" src="${cardBackUrl(kind)}" alt="Tył karty: ${name}"></span></span></div>
    <p class="card-cap"><b>${name}</b> · tył karty</p>`;
  $('backsGrid').append(slot);
}

EXIT_CARDS.forEach((card, i) => {
  const slot = document.createElement('div');
  slot.className = 'card-slot';
  slot.innerHTML = `
    <button class="flip" type="button" aria-pressed="false" aria-label="Karta Wyjście z dziekanatu ${i + 1} z 4, kliknij, aby odwrócić">
      <span class="flip-inner"><span class="face front">${exitCardSVG(card, i)}</span><span class="face back"><img class="face-img" src="${cardBackUrl('ulatwienia')}" alt="Tył karty ułatwienia"></span></span>
    </button>
    <p class="card-cap"><b>Karta ${i + 1}</b> z 4</p>`;
  const btn = slot.querySelector('.flip');
  btn.addEventListener('click', () => {
    const on = !btn.classList.contains('flipped');
    btn.classList.toggle('flipped', on);
    btn.setAttribute('aria-pressed', String(on));
  });
  $('cardsGrid').append(slot);
});

// ---------------------------------------------------------------------------
// Karty ułatwień i utrudnień (propozycje do wyboru)
// tag: atak = bez ×2, nie działa na salę z hotelem, tarcza blokuje
// ---------------------------------------------------------------------------
const DECK_STYLE = {
  bonus: { label: 'UŁATWIENIE', color: '#2E9E8A', dark: '#1D6B5E', light: '#E2F4F0', x2: 'Dobra odpowiedź ×2' },
  penalty: { label: 'UTRUDNIENIE', color: '#D6534F', dark: '#9C2E2B', light: '#FBE7E6', x2: 'Zła odpowiedź ×2' },
};
// Ilustracje kart w polu 400 × 300, w tym samym stylu co karty „Wyjście z dziekanatu”
const INK = '#3B2A20';
const blush = (x, y) => `<ellipse cx="${x - 46}" cy="${y + 14}" rx="11" ry="6" fill="#F4A6A0" opacity=".75"/><ellipse cx="${x + 46}" cy="${y + 14}" rx="11" ry="6" fill="#F4A6A0" opacity=".75"/>`;
const faceSad = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})">
  <circle cx="${x - 26}" cy="${y}" r="8" fill="${INK}"/><circle cx="${x + 26}" cy="${y}" r="8" fill="${INK}"/>
  <path d="M${x - 38} ${y - 18} L${x - 18} ${y - 12} M${x + 38} ${y - 18} L${x + 18} ${y - 12}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M${x - 11} ${y + 22} Q${x} ${y + 12} ${x + 11} ${y + 22}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>${blush(x, y)}</g>`;
const faceShock = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})">
  <circle cx="${x - 26}" cy="${y}" r="11" fill="${INK}"/><circle cx="${x + 26}" cy="${y}" r="11" fill="${INK}"/>
  <circle cx="${x - 23}" cy="${y - 4}" r="4" fill="#fff"/><circle cx="${x + 29}" cy="${y - 4}" r="4" fill="#fff"/>
  <ellipse cx="${x}" cy="${y + 22}" rx="8" ry="10" fill="${INK}"/>${blush(x, y)}</g>`;
const faceSleep = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})">
  <path d="M${x - 36} ${y} Q${x - 26} ${y + 9} ${x - 16} ${y} M${x + 16} ${y} Q${x + 26} ${y + 9} ${x + 36} ${y}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="${x}" cy="${y + 20}" rx="6" ry="4" fill="${INK}"/>${blush(x, y)}</g>`;
const faceDizzy = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})">
  ${[-26, 26].map(dx => `<path d="M${x + dx} ${y} m-10 0 a10 10 0 1 1 10 10 a6 6 0 1 1 -6 -6" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`).join('')}
  <path d="M${x - 12} ${y + 22} Q${x - 6} ${y + 16} ${x} ${y + 22} T${x + 12} ${y + 22}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>${blush(x, y)}</g>`;
const sweat = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -14 C0 -14 -10 0 -10 6 A10 10 0 0 0 10 6 C10 0 0 -14 0 -14 Z" fill="#8FD0F5" stroke="#5AAEE6" stroke-width="2"/>`;
const groundShadow = (rx = 130) => `<ellipse cx="200" cy="284" rx="${rx}" ry="13" fill="#000" opacity=".08"/>`;
const vgrad = (id, c1, c2) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
const coin = (x, y, r = 22) => `<circle cx="${x}" cy="${y + 4}" r="${r}" fill="#C8952C"/><circle cx="${x}" cy="${y}" r="${r}" fill="#F7CD5B" stroke="#C8952C" stroke-width="3"/><circle cx="${x}" cy="${y}" r="${r * 0.62}" fill="none" stroke="#E0A93A" stroke-width="3"/>`;
const banknote = (x, y, w = 150, h = 84, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot})">
  <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="10" fill="#5DB37E"/><rect x="${-w / 2 + 9}" y="${-h / 2 + 9}" width="${w - 18}" height="${h - 18}" rx="6" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>
  <circle r="${h * 0.24}" fill="#fff" fill-opacity=".8"/></g>`;

function actionArt(name, id, st) {
  const c = st.color, dk = st.dark;
  const sp = (x, y, r, f = '#fff') => sparkle(x, y, r, f);
  switch (name) {
    case 'helmet': return `<defs>${vgrad(id + 'h', '#FFD86A', '#F2A93B')}</defs>${groundShadow()}
      <g transform="translate(268 96) rotate(8)">
        <rect width="100" height="136" rx="12" fill="#C69C6D"/><rect x="10" y="16" width="80" height="110" rx="6" fill="#fff"/>
        <rect x="30" y="-8" width="40" height="20" rx="6" fill="#8A93A8"/>
        <path d="M22 46 l8 8 l14 -16 M22 78 l8 8 l14 -16" fill="none" stroke="#2E9E8A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M24 104 l14 14 M38 104 l-14 14" stroke="#E5484D" stroke-width="5" stroke-linecap="round"/>
        <path d="M54 48 H78 M54 80 H78 M54 112 H78" stroke="#C9D0DC" stroke-width="5" stroke-linecap="round"/>
      </g>
      <path d="M58 206 Q58 92 162 86 Q266 92 266 206 Z" fill="url(#${id}h)"/>
      <path d="M150 88 Q162 84 174 88 V206 H150 Z" fill="#fff" opacity=".35"/>
      <path d="M86 130 Q110 104 140 98" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".5"/>
      <rect x="30" y="196" width="264" height="36" rx="18" fill="#E39A32"/><rect x="36" y="198" width="252" height="12" rx="6" fill="#FFD86A" opacity=".7"/>
      ${face(162, 158, 0.85)}${sp(40, 70, 14)}${sp(240, 40, 10, '#FFD86A')}`;
    case 'power': return `<defs>${vgrad(id + 'p', '#A9BDE3', '#6F86B8')}</defs>${groundShadow()}
      <path d="M78 176 C40 196 40 250 96 266 C150 280 120 300 160 300" fill="none" stroke="#6F86B8" stroke-width="14" stroke-linecap="round"/>
      <rect x="252" y="80" width="118" height="128" rx="24" fill="#fff" stroke="#D5DBE6" stroke-width="6"/>
      <circle cx="311" cy="144" r="36" fill="#EEF1F6"/><rect x="295" y="130" width="9" height="28" rx="4" fill="#5A6580"/><rect x="318" y="130" width="9" height="28" rx="4" fill="#5A6580"/>
      <rect x="196" y="118" width="38" height="13" rx="6" fill="#C9CFDA"/><rect x="196" y="160" width="38" height="13" rx="6" fill="#C9CFDA"/>
      <rect x="70" y="92" width="130" height="112" rx="30" fill="url(#${id}p)"/>
      <rect x="82" y="100" width="40" height="12" rx="6" fill="#fff" opacity=".4"/>
      ${faceSleep(135, 148, 0.85)}
      <text x="214" y="70" class="svg-display" font-size="34" fill="${dk}">z</text><text x="238" y="44" class="svg-display" font-size="26" fill="${dk}" opacity=".7">z</text>
      ${sp(48, 60, 12, '#FFD86A')}`;
    case 'gavel': return `<defs>${vgrad(id + 'g', '#B9825A', '#7A4F2E')}</defs>${groundShadow(150)}
      <g transform="translate(40 120) rotate(-6)">
        <rect width="92" height="122" rx="8" fill="#fff" stroke="#E2D6C2" stroke-width="4"/>
        <path d="M16 26 H76 M16 46 H76 M16 66 H60" stroke="#D9CDB8" stroke-width="5" stroke-linecap="round"/>
        <path d="M58 100 l-8 34 l14 -10 l12 12 l2 -36 Z" fill="#E5484D"/><circle cx="66" cy="96" r="20" fill="#F7CD5B" stroke="#C8952C" stroke-width="3"/>
      </g>
      <ellipse cx="236" cy="262" rx="104" ry="20" fill="#7A4F2E"/><rect x="132" y="240" width="208" height="22" fill="#A8744B"/><ellipse cx="236" cy="240" rx="104" ry="20" fill="#C08A5B"/>
      <g transform="rotate(-28 236 140)">
        <rect x="228" y="150" width="18" height="120" rx="9" fill="#C08A5B"/>
        <rect x="160" y="76" width="152" height="76" rx="18" fill="url(#${id}g)"/>
        <rect x="150" y="84" width="16" height="60" rx="6" fill="#F7CD5B"/><rect x="306" y="84" width="16" height="60" rx="6" fill="#F7CD5B"/>
        <rect x="176" y="84" width="60" height="10" rx="5" fill="#fff" opacity=".3"/>
        ${face(236, 116, 0.7)}
      </g>${sp(356, 60, 13, '#F7CD5B')}${sp(150, 40, 10)}`;
    case 'shieldRoom': return `<defs>${vgrad(id + 's', mix(c, '#ffffff', 0.25), dk)}</defs>${groundShadow(150)}
      <path d="M230 254 V140 L300 92 L370 140 V254 Z" fill="#fff" stroke="#D5DBE6" stroke-width="5" stroke-linejoin="round"/>
      <path d="M220 146 L300 86 L380 146" fill="none" stroke="${GOLD}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="250" y="160" width="34" height="30" rx="4" fill="#BFE3F7"/><rect x="316" y="160" width="34" height="30" rx="4" fill="#BFE3F7"/><rect x="284" y="206" width="32" height="48" rx="4" fill="#C08A5B"/>
      <path d="M150 44 L234 74 V148 C234 206 198 238 150 260 C102 238 66 206 66 148 V74 Z" fill="url(#${id}s)" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>
      <path d="M92 90 L150 70 V118 C120 120 100 110 92 90 Z" fill="#fff" opacity=".22"/>
      ${face(150, 156, 0.8)}${sp(54, 52, 13)}${sp(250, 52, 11, '#FFD86A')}${heart(372, 70, 1.1, '#fff')}`;
    case 'shieldPerson': return `<defs>${vgrad(id + 's', mix(c, '#ffffff', 0.25), dk)}</defs>${groundShadow()}
      <path d="M200 66 L292 98 V170 C292 226 252 258 200 280 C148 258 108 226 108 170 V98 Z" fill="url(#${id}s)" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>
      <path d="M136 112 L200 90 V140 C168 142 146 132 136 112 Z" fill="#fff" opacity=".22"/>
      <path d="M200 20 L272 50 L200 80 L128 50 Z" fill="#1E2A47"/><path d="M158 62 V86 C158 96 242 96 242 86 V62 L200 80 Z" fill="#2B3A5E"/>
      <path d="M272 50 V92" stroke="${GOLD}" stroke-width="4"/><circle cx="272" cy="96" r="8" fill="${GOLD}"/>
      ${face(200, 176, 0.85)}${sp(76, 80, 14)}${sp(330, 150, 11, '#FFD86A')}${heart(84, 220, 1.2, '#fff')}${heart(326, 236, 0.9, mix(c, '#ffffff', 0.5))}`;
    case 'grant': return `<defs>${vgrad(id + 'l', '#6FE0C2', '#2E9E8A')}<clipPath id="${id}f"><path d="M178 104 L118 232 Q110 254 134 256 H266 Q290 254 282 232 L222 104 Z"/></clipPath></defs>${groundShadow()}
      <path d="M178 104 L118 232 Q110 254 134 256 H266 Q290 254 282 232 L222 104 Z" fill="#fff" stroke="#D5DBE6" stroke-width="5"/>
      <g clip-path="url(#${id}f)"><rect x="100" y="168" width="200" height="100" fill="url(#${id}l)"/>
        <path d="M100 170 Q140 160 180 170 T260 170 T300 170 V180 H100 Z" fill="#fff" opacity=".35"/></g>
      <rect x="176" y="42" width="48" height="66" rx="6" fill="#fff" stroke="#D5DBE6" stroke-width="5"/><rect x="170" y="34" width="60" height="14" rx="7" fill="#C08A5B"/>
      <circle cx="166" cy="146" r="9" fill="#9BE8D3"/><circle cx="196" cy="124" r="6" fill="#9BE8D3"/><circle cx="214" cy="150" r="7" fill="#9BE8D3"/>
      ${face(200, 214, 0.7)}
      ${coin(330, 230, 24)}${coin(350, 196, 20)}
      <path d="M64 236 V120 M40 144 L64 118 L88 144" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      ${sp(110, 60, 12, '#FFD86A')}${sp(296, 70, 10)}`;
    case 'coins': return `<defs>${vgrad(id + 'c', '#FFE07E', '#F2B33B')}</defs>${groundShadow(160)}
      ${banknote(200, 100, 200, 100, -6)}
      ${[0, 1, 2].map(k => coin(78, 250 - k * 16, 30)).join('')}${[0, 1, 2, 3].map(k => coin(326, 250 - k * 16, 30)).join('')}
      <circle cx="200" cy="200" r="70" fill="#C8952C"/><circle cx="200" cy="192" r="70" fill="url(#${id}c)" stroke="#C8952C" stroke-width="6"/>
      <circle cx="200" cy="192" r="52" fill="none" stroke="#E0A93A" stroke-width="4"/>
      <path d="M156 160 Q170 140 194 136" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".6"/>
      ${face(200, 196, 0.78, '#7A4F12')}${sp(60, 70, 15, '#F7CD5B')}${sp(350, 60, 12, '#F7CD5B')}${sp(330, 140, 9)}`;
    case 'refund': return `${groundShadow()}
      ${banknote(200, 104, 150, 84, -8)}
      <rect x="96" y="124" width="208" height="140" rx="16" fill="#fff" stroke="#D5DBE6" stroke-width="5"/>
      <path d="M96 140 L200 206 L304 140" fill="none" stroke="#D5DBE6" stroke-width="5" stroke-linejoin="round"/>
      <path d="M100 262 L176 200 M300 262 L224 200" stroke="#E6EAF0" stroke-width="5"/>
      ${face(200, 226, 0.65)}
      <path d="M340 168 A64 64 0 0 0 300 60" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round"/>
      <path d="M286 48 L302 62 L284 76" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      ${sp(58, 80, 13, '#FFD86A')}${sp(70, 220, 10)}`;
    case 'people': return `<defs>${vgrad(id + 'm', mix(c, '#ffffff', 0.2), dk)}</defs>${groundShadow()}
      <rect x="72" y="122" width="40" height="66" rx="12" fill="#5A6580"/>
      <path d="M108 118 L254 64 V244 L108 190 Z" fill="url(#${id}m)"/>
      <ellipse cx="254" cy="154" rx="22" ry="90" fill="${dk}"/><ellipse cx="256" cy="154" rx="12" ry="74" fill="#fff" opacity=".25"/>
      <rect x="150" y="188" width="18" height="56" rx="8" fill="#5A6580" transform="rotate(-12 159 216)"/>
      ${face(180, 150, 0.6, '#fff')}
      <path d="M292 108 Q314 154 292 200 M318 86 Q350 154 318 222" fill="none" stroke="${GOLD}" stroke-width="8" stroke-linecap="round"/>
      ${coin(352, 64, 20)}${coin(364, 248, 18)}${coin(54, 70, 16)}`;
    case 'forward': return `${groundShadow(120)}
      <path d="M40 150 H96 M24 182 H86 M50 214 H100" stroke="#C9D0DC" stroke-width="8" stroke-linecap="round"/>
      <path d="M176 236 L160 270 M226 236 L250 268" stroke="#3B2A20" stroke-width="9" stroke-linecap="round"/>
      <ellipse cx="152" cy="274" rx="18" ry="8" fill="#3B2A20"/><ellipse cx="258" cy="272" rx="18" ry="8" fill="#3B2A20"/>
      <rect x="120" y="54" width="160" height="186" rx="18" fill="#fff" stroke="#D5DBE6" stroke-width="5"/>
      <path d="M120 72 A18 18 0 0 1 138 54 H262 A18 18 0 0 1 280 72 V104 H120 Z" fill="${c}"/>
      <rect x="152" y="40" width="12" height="30" rx="6" fill="#5A6580"/><rect x="236" y="40" width="12" height="30" rx="6" fill="#5A6580"/>
      <text x="200" y="150" class="svg-display" font-size="62" fill="${dk}" text-anchor="middle" dominant-baseline="central">+3</text>
      ${face(200, 204, 0.55)}
      <path d="M306 112 L346 152 L306 192 M338 112 L378 152 L338 192" fill="none" stroke="${GOLD}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'notes': return `<defs>${vgrad(id + 'n', '#FFFFFF', '#EEF3FB')}</defs>${groundShadow()}
      <g transform="rotate(-4 200 160)">
        <rect x="110" y="54" width="176" height="216" rx="14" fill="url(#${id}n)" stroke="#D5DBE6" stroke-width="5"/>
        ${[84, 118, 152, 186, 220].map(y => `<circle cx="110" cy="${y}" r="9" fill="none" stroke="#5A6580" stroke-width="5"/>`).join('')}
        ${[96, 120].map(y => `<path d="M140 ${y} H260" stroke="${c}" stroke-width="6" stroke-linecap="round" opacity=".55"/>`).join('')}
        ${face(198, 182, 0.75)}
      </g>
      <g transform="translate(268 40) rotate(10)"><rect width="88" height="84" rx="6" fill="#FFE27A"/><path d="M14 26 H70 M14 44 H62 M14 62 H54" stroke="#E0B04A" stroke-width="5" stroke-linecap="round"/></g>
      <g transform="translate(60 252) rotate(-40)"><rect width="150" height="22" rx="4" fill="#F7A23B"/><rect x="128" width="22" height="22" fill="#F4A6A0"/><path d="M0 0 L-24 11 L0 22 Z" fill="#F6DDB8"/><path d="M-16 7 L-24 11 L-16 15 Z" fill="#3B2A20"/></g>
      ${sp(66, 70, 13, '#FFD86A')}${sp(352, 170, 10)}`;
    case 'flood': return `${groundShadow(170)}
      ${[[140, 24], [220, 10], [300, 30]].map(([x, y]) => `<path transform="translate(${x} ${y})" d="M0 0 C0 0 -12 18 -12 26 A12 12 0 0 0 12 26 C12 18 0 0 0 0 Z" fill="#6EC6F0"/>`).join('')}
      <path d="M96 250 V130 L200 66 L304 130 V250 Z" fill="#fff" stroke="#D5DBE6" stroke-width="5" stroke-linejoin="round"/>
      <path d="M84 136 L200 60 L316 136" fill="none" stroke="#9AA6BC" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      ${faceSad(200, 150, 0.8)}
      <path d="M-40 214 Q-10 198 20 214 T80 214 T140 214 T200 214 T260 214 T320 214 T380 214 T440 214 V304 H-40 Z" fill="#6EC6F0" opacity=".85"/>
      <path d="M-40 234 Q-10 220 20 234 T80 234 T140 234 T200 234 T260 234 T320 234 T380 234 T440 234" fill="none" stroke="#fff" stroke-width="5" opacity=".6"/>
      <ellipse cx="324" cy="206" rx="30" ry="18" fill="#FFD43B"/><circle cx="342" cy="184" r="15" fill="#FFD43B"/><path d="M354 182 L372 186 L354 192 Z" fill="#F08A2C"/><circle cx="346" cy="180" r="3" fill="${INK}"/>`;
    case 'scissors': return `${groundShadow(160)}
      <g transform="translate(118 214) rotate(-8)"><path d="M-70 -44 H62 L54 -30 L66 -14 L54 2 L66 18 L54 34 L62 44 H-70 Z" fill="#5DB37E"/><circle cx="-6" r="20" fill="#fff" fill-opacity=".7"/>${faceSad(-6, -2, 0.4)}</g>
      <g transform="translate(282 214) rotate(8)"><path d="M70 -44 H-62 L-54 -30 L-66 -14 L-54 2 L-66 18 L-54 34 L-62 44 H70 Z" fill="#5DB37E"/><circle cx="6" r="20" fill="#fff" fill-opacity=".7"/>${faceSad(6, -2, 0.4)}</g>
      <g transform="translate(200 104)">
        <path d="M-8 0 L-20 -96 Q-12 -104 -2 -96 L8 0 Z" fill="#C9CFDA" transform="rotate(-18)"/>
        <path d="M8 0 L20 -96 Q12 -104 2 -96 L-8 0 Z" fill="#E3E7EE" transform="rotate(18)"/>
        <circle r="8" fill="#5A6580"/>
        <circle cx="-34" cy="46" r="26" fill="none" stroke="${c}" stroke-width="12"/><circle cx="34" cy="46" r="26" fill="none" stroke="${c}" stroke-width="12"/>
      </g>`;
    case 'swap': return `${groundShadow(140)}
      <rect x="114" y="60" width="172" height="196" rx="18" fill="#fff" stroke="#D5DBE6" stroke-width="5"/>
      <path d="M114 78 A18 18 0 0 1 132 60 H268 A18 18 0 0 1 286 78 V108 H114 Z" fill="${c}"/>
      <rect x="148" y="44" width="12" height="32" rx="6" fill="#5A6580"/><rect x="240" y="44" width="12" height="32" rx="6" fill="#5A6580"/>
      ${faceDizzy(200, 170, 0.85)}
      <path d="M78 120 A130 130 0 0 1 150 34" fill="none" stroke="${dk}" stroke-width="10" stroke-linecap="round"/><path d="M134 28 L152 34 L142 52" fill="none" stroke="${dk}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M322 200 A130 130 0 0 1 250 280" fill="none" stroke="${dk}" stroke-width="10" stroke-linecap="round"/><path d="M266 286 L248 280 L258 262" fill="none" stroke="${dk}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="330" y="96" class="svg-display" font-size="44" fill="${c}">?</text><text x="50" y="230" class="svg-display" font-size="34" fill="${c}" opacity=".7">?</text>`;
    case 'bulb': return `${groundShadow(110)}
      <circle cx="200" cy="124" r="78" fill="#E9EDF3" stroke="#C9D0DC" stroke-width="6"/>
      <path d="M152 92 Q166 70 192 64" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>
      <path d="M232 70 L218 96 L236 108 L222 136" fill="none" stroke="#9AA6BC" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M158 188 H242 L232 214 H168 Z" fill="#E9EDF3" stroke="#C9D0DC" stroke-width="5"/>
      ${[218, 238, 258].map(y => `<rect x="166" y="${y}" width="68" height="14" rx="7" fill="#9AA6BC"/>`).join('')}
      ${faceSad(200, 128, 0.8)}
      <rect x="300" y="196" width="66" height="36" rx="6" fill="none" stroke="#5A6580" stroke-width="5"/><rect x="366" y="206" width="8" height="16" rx="2" fill="#5A6580"/><rect x="306" y="202" width="12" height="24" rx="2" fill="#E5484D"/>
      <text x="44" y="110" class="svg-display" font-size="30" fill="#9AA6BC">?</text>`;
    case 'wrench': return `${groundShadow(150)}
      <path d="M150 34 H250 V250 l-10 12 l-10 -12 l-10 12 l-10 -12 l-10 12 l-10 -12 l-10 12 l-10 -12 l-10 12 l-10 -12 Z" fill="#fff" stroke="#D5DBE6" stroke-width="5" stroke-linejoin="round"/>
      ${faceShock(200, 84, 0.6)}
      ${[136, 160, 184].map(y => `<path d="M168 ${y} H210 M222 ${y} H234" stroke="#C9D0DC" stroke-width="6" stroke-linecap="round"/>`).join('')}
      <path d="M168 216 H234" stroke="${dk}" stroke-width="8" stroke-linecap="round"/>
      <g transform="translate(86 176) rotate(-40)">
        <rect x="-12" y="-6" width="24" height="104" rx="12" fill="#9AA6BC"/><circle cy="-20" r="32" fill="#9AA6BC"/><rect x="-11" y="-58" width="22" height="42" rx="3" fill="${st.light}"/>
      </g>
      ${coin(318, 210, 24)}${coin(342, 172, 20)}${coin(312, 136, 16)}`;
    case 'exam': return `${groundShadow(130)}
      <g transform="rotate(-5 200 150)">
        <rect x="116" y="34" width="168" height="226" rx="10" fill="#fff" stroke="#D5DBE6" stroke-width="5"/>
        ${[64, 86].map(y => `<path d="M140 ${y} H260" stroke="#C9D0DC" stroke-width="6" stroke-linecap="round"/>`).join('')}
        ${faceSad(200, 146, 0.75)}${sweat(256, 120, 1)}
      </g>
      <circle cx="270" cy="222" r="40" fill="#fff" stroke="#E5484D" stroke-width="7"/>
      <text x="270" y="226" class="svg-display" font-size="56" fill="#E5484D" text-anchor="middle" dominant-baseline="central">2</text>
      ${sp(70, 80, 10, '#F4A6A0')}`;
    case 'clock': return `<defs>${vgrad(id + 'k', '#FF8A86', '#D6534F')}</defs>${groundShadow(120)}
      <path d="M118 64 A40 40 0 0 1 176 40 Z" fill="${GOLD}"/><path d="M224 40 A40 40 0 0 1 282 64 Z" fill="${GOLD}"/>
      <path d="M188 38 H212" stroke="#5A6580" stroke-width="8" stroke-linecap="round"/>
      <circle cx="200" cy="154" r="98" fill="url(#${id}k)"/><circle cx="200" cy="154" r="78" fill="#fff"/>
      <path d="M200 92 V106 M200 202 V216 M138 154 H152 M248 154 H262" stroke="#C9D0DC" stroke-width="6" stroke-linecap="round"/>
      ${faceShock(200, 158, 0.75)}
      <path d="M140 246 L122 274 M260 246 L278 274" stroke="#D6534F" stroke-width="10" stroke-linecap="round"/>
      <path d="M78 110 L58 100 M74 154 H52 M78 198 L58 208 M322 110 L342 100 M326 154 H348 M322 198 L342 208" stroke="#9AA6BC" stroke-width="6" stroke-linecap="round"/>
      ${sweat(282, 92, 1.1)}`;
    case 'door': return `${groundShadow(150)}
      <rect x="110" y="20" width="180" height="262" rx="10" fill="#6B4528"/>
      <rect x="124" y="32" width="152" height="250" rx="6" fill="#9A6A42"/>
      <rect x="140" y="112" width="120" height="66" rx="6" fill="none" stroke="#7A4F2E" stroke-width="5"/><rect x="140" y="194" width="120" height="70" rx="6" fill="none" stroke="#7A4F2E" stroke-width="5"/>
      <rect x="140" y="46" width="120" height="40" rx="6" fill="#fff"/>
      <text x="200" y="67" class="svg-body" font-size="17" font-weight="800" fill="#1E2A47" text-anchor="middle" dominant-baseline="central" letter-spacing="1">DZIEKANAT</text>
      <circle cx="260" cy="190" r="9" fill="${GOLD}"/>
      ${faceSad(200, 146, 0.6)}
      ${[[60, 262], [86, 246], [52, 226], [78, 210]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="10" ry="6" fill="#C9D0DC"/>`).join('')}
      <path d="M318 250 H364 M330 236 L316 250 L330 264" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'hourglass': return `${groundShadow(110)}
      <rect x="120" y="22" width="160" height="22" rx="10" fill="#A8744B"/><rect x="120" y="262" width="160" height="22" rx="10" fill="#A8744B"/>
      <path d="M140 44 H260 C260 104 214 120 214 152 C214 184 260 200 260 262 H140 C140 200 186 184 186 152 C186 120 140 104 140 44 Z" fill="#EEF6FF" stroke="#C9D0DC" stroke-width="6"/>
      <path d="M160 70 H240 C232 100 210 112 200 126 C190 112 168 100 160 70 Z" fill="#F7CD5B"/>
      <path d="M200 132 V214" stroke="#F7CD5B" stroke-width="4" stroke-dasharray="6 6"/>
      <path d="M150 256 C158 222 242 222 250 256 Z" fill="#F7CD5B"/>
      ${faceSleep(200, 212, 0.45)}${sweat(250, 100, 0.9)}
      <text x="300" y="80" class="svg-display" font-size="30" fill="${dk}">z</text>`;
    case 'plagiarism': return `${groundShadow(160)}
      ${[[46, 70, -7], [168, 60, 5]].map(([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect width="130" height="170" rx="8" fill="#fff" stroke="#D5DBE6" stroke-width="5"/>${[34, 58, 82, 106, 130].map(yy => `<path d="M20 ${yy} H${yy === 130 ? 76 : 110}" stroke="#C9D0DC" stroke-width="6" stroke-linecap="round"/>`).join('')}</g>`).join('')}
      <g transform="translate(270 150)">
        <rect x="34" y="34" width="24" height="84" rx="12" fill="#5A6580" transform="rotate(-40 46 76)"/>
        <circle r="56" fill="#DDF1FF" fill-opacity=".85" stroke="${dk}" stroke-width="12"/>
        ${faceShock(0, 4, 0.55)}
      </g>
      <g transform="translate(108 250) rotate(-10)"><rect x="-62" y="-22" width="124" height="44" rx="8" fill="none" stroke="#E5484D" stroke-width="5"/>
        <text y="2" class="svg-display" font-size="26" fill="#E5484D" text-anchor="middle" dominant-baseline="central" letter-spacing="3">KOPIA</text></g>`;
  }
  return '';
}

// Zawijanie tekstu do szerokości (mierzone na canvasie)
const wrapCtx = document.createElement('canvas').getContext('2d');
function wrapSvgText(text, font, maxW) {
  wrapCtx.font = font;
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (line && wrapCtx.measureText(t).width > maxW) { lines.push(line); line = word; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function actionCardSVG(card, kind, idx) {
  const st = DECK_STYLE[kind];
  const id = `${kind}${idx}`;
  const tag = card.tag && TAGS[card.tag];
  const attack = card.tag === 'atak';
  const titleLines = wrapSvgText(card.name, `700 46px ${UI_FONT}`, 520);
  const titleSize = titleLines.length > 1 ? 40 : 46;
  const title = titleLines.map((l, k) => `<text x="315" y="${(titleLines.length > 1 ? 136 : 158) + k * 44}" class="svg-display" font-size="${titleSize}" fill="${st.dark}" text-anchor="middle" dominant-baseline="central">${esc(l)}</text>`).join('');
  const mainLines = wrapSvgText(card.text, `700 27px ${UI_FONT}`, 470);
  let y = 618;
  let body = mainLines.map(l => { const t = `<text x="315" y="${y}" class="svg-body" font-size="27" font-weight="700" fill="#1E2A47" text-anchor="middle" dominant-baseline="central">${esc(l)}</text>`; y += 34; return t; }).join('');
  y += 8;
  body += `<path d="M80 ${y} H550" stroke="${st.color}" stroke-opacity=".35" stroke-width="2"/>`;
  y += 28;
  if (card.x2) {
    const x2Lines = wrapSvgText(`${st.x2}: ${card.x2}`, `600 23px ${UI_FONT}`, 470);
    body += x2Lines.map((l, k) => { const t = `<text x="315" y="${y}" class="svg-body" font-size="23" font-weight="600" fill="${st.dark}" text-anchor="middle" dominant-baseline="central">${esc(l)}</text>`; y += 29; return t; }).join('');
  } else {
    body += `<text x="315" y="${y}" class="svg-body" font-size="23" font-weight="600" fill="#6B7280" text-anchor="middle" dominant-baseline="central">Bez działania ×2</text>`;
    y += 29;
  }
  if (attack) body += `<text x="315" y="${y + 2}" class="svg-body" font-size="20" fill="#6B7280" text-anchor="middle" dominant-baseline="central">Nie działa na salę z hotelem · tarcza blokuje</text>`;
  const art = 'x="40" y="222" width="550" height="352" rx="28"';
  return `<svg viewBox="0 0 630 880" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${st.label === 'UŁATWIENIE' ? 'Ułatwienie' : 'Utrudnienie'}: ${esc(card.name)}">
  <defs>
    <clipPath id="${id}-clip"><rect width="630" height="880" rx="36"/></clipPath>
    <pattern id="${id}-dots" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="18" cy="18" r="3" fill="${st.color}" opacity=".14"/></pattern>
    <radialGradient id="${id}-glow" cx="50%" cy="50%" r="58%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <g clip-path="url(#${id}-clip)">
    <rect width="630" height="880" fill="#FFFDF9"/>
    <rect width="630" height="100" fill="${st.color}"/>
    <text x="48" y="52" class="svg-display" font-size="32" fill="#fff" dominant-baseline="central" letter-spacing="1">${st.label}</text>
    ${tag ? `<rect x="${582 - tag.text.length * 16 - 24}" y="30" width="${tag.text.length * 16 + 24}" height="44" rx="22" fill="${tag.bg}"/>
    <text x="${582 - (tag.text.length * 16 + 24) / 2}" y="53" class="svg-body" font-size="22" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central" letter-spacing="1">${tag.text}</text>` : ''}
    ${title}
    <rect ${art} fill="${st.light}"/>
    <rect ${art} fill="url(#${id}-dots)"/>
    <rect ${art} fill="url(#${id}-glow)"/>
    <g transform="translate(115 248)">${actionArt(card.icon, id, st)}</g>
    <rect x="40" y="588" width="550" height="262" rx="22" fill="${st.light}" stroke="${st.color}" stroke-width="3"/>
    ${body}
    <rect width="630" height="880" rx="36" fill="none" stroke="${st.color}" stroke-width="12"/>
  </g>
</svg>`;
}

function addActionCards(list, kind, gridId) {
  const back = kind === 'bonus' ? 'ulatwienia' : 'utrudnienia';
  list.forEach((card, i) => {
    const slot = document.createElement('div');
    slot.className = 'card-slot';
    slot.innerHTML = `
      <button class="flip" type="button" aria-pressed="false" aria-label="Karta ${esc(card.name)}, kliknij, aby odwrócić">
        <span class="flip-inner"><span class="face front">${actionCardSVG(card, kind, i)}</span><span class="face back"><img class="face-img" src="${cardBackUrl(back)}" alt="Tył karty"></span></span>
      </button>
      <p class="card-cap"><b>${esc(card.name)}</b></p>`;
    const btn = slot.querySelector('.flip');
    btn.addEventListener('click', () => {
      const on = !btn.classList.contains('flipped');
      btn.classList.toggle('flipped', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    $(gridId).append(slot);
  });
}
addActionCards(BONUS_CARDS, 'bonus', 'bonusGrid');
addActionCards(PENALTY_CARDS, 'penalty', 'penaltyGrid');

// Karta z pytaniami: ten sam wygląd i dane co wersja do druku (druk/karty-pytan.js i .css).
// Karta ma wymiary w milimetrach, więc skalujemy ją do szerokości miejsca w siatce.
if (window.KartyPytan) {
  const { KARTY, SEMESTRY, SEMESTRY_KARTY, awers, rewers, id } = window.KartyPytan;
  const karta = KARTY[0];
  const slot = $('questionSlot');
  slot.innerHTML = `
    <button class="flip" type="button" aria-pressed="false" aria-label="Karta z pytaniami: ${id(karta)}, kliknij, aby odwrócić">
      <span class="flip-inner">
        <span class="face front"><span class="qc-fit">${awers(karta)}</span></span>
        <span class="face back"><span class="qc-fit">${rewers(karta)}</span></span>
      </span>
    </button>
    <p class="card-cap"><b>Pytanie nr ${karta.nr}</b> · ${karta.wykladowca}${karta.przyklad ? ' · dane przykładowe' : ''}</p>`;
  const btn = slot.querySelector('.flip');
  btn.addEventListener('click', () => {
    const on = !btn.classList.contains('flipped');
    btn.classList.toggle('flipped', on);
    btn.setAttribute('aria-pressed', String(on));
  });
  const skaluj = new ResizeObserver(entries => {
    for (const { target } of entries) {
      const card = target.firstElementChild;
      if (card.offsetWidth) target.style.setProperty('--s', target.clientWidth / card.offsetWidth);
    }
  });
  slot.querySelectorAll('.qc-fit').forEach(el => skaluj.observe(el));
  $('qcLegend').innerHTML = SEMESTRY_KARTY
    .map(n => `<li><i style="--c:${SEMESTRY[n].kolor}" aria-hidden="true"></i>${SEMESTRY[n].nazwa}</li>`).join('');
}

// ---------------------------------------------------------------------------
// Rozgrywka: tury, kostki, pytania, kupowanie i budowanie, karty, dziekanat, boty, koniec gry.
// Kwoty i ustawienia, których autor jeszcze nie ustalił, są w jednym miejscu (ECON i niżej).
// ---------------------------------------------------------------------------
const DICE_SOUND_FILE = '';        // np. 'assets/dzwieki/kostki.mp3' (własne nagranie albo CC0); puste = dźwięk z kodu
const MOVE_SPEED = 1;


// ---------------------------------------------------------------------------
// Akty własności: karta każdego pola do kupienia (sale, parkingi, pola specjalne).
// Motyw sali to propozycja do zmiany przez autora.
// ---------------------------------------------------------------------------
const DEED_THEME = {
  1: 'Laboratorium chemiczne', 2: 'Sala wykładowa', 6: 'Pracownia komputerowa', 7: 'Pracownia sieci',
  9: 'Pracownia projektowa', 11: 'Sala językowa', 13: 'Laboratorium robotyki', 14: 'Pracownia VR',
  15: 'Pracownia elektroniki', 17: 'Sala multimedialna', 19: 'Finanse uczelni', 21: 'Administracja',
  23: 'Gabinet rektora', 25: 'Pracownia grafiki', 27: 'Studio nagrań', 29: 'Sala e-sportowa',
  31: 'Sala konferencyjna', 3: 'Stacja 1 z 2', 18: 'Stacja 2 z 2',
  4: 'Pole specjalne 1 z 4', 12: 'Pole specjalne 2 z 4', 20: 'Pole specjalne 3 z 4', 28: 'Pole specjalne 4 z 4',
};
const gs = (rx = 120) => `<ellipse cx="200" cy="199" rx="${rx}" ry="10" fill="#000" opacity=".08"/>`;
const wood = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#C08A5B"/><rect x="${x}" y="${y}" width="${w}" height="5" rx="2.5" fill="#D9A777"/>`;
// Ilustracje w polu 400 × 210
function deedArt(i, id, c) {
  const sp = (x, y, r, f = '#fff') => sparkle(x, y, r, f);
  const l = mix(c, '#ffffff', 0.55);
  switch (i) {
    case 1: return `${gs(150)}${wood(30, 158, 340, 16)}
      <rect x="64" y="128" width="78" height="10" rx="4" fill="#A8744B"/>
      ${[[72, '#E5484D'], [94, '#2F7FF0'], [116, '#F2B72E']].map(([x, col]) => `<rect x="${x}" y="84" width="14" height="60" rx="7" fill="#fff" stroke="#C9D0DC" stroke-width="3"/><rect x="${x + 2}" y="116" width="10" height="26" rx="5" fill="${col}"/>`).join('')}
      <path d="M182 56 V88 L140 150 Q136 158 146 158 H254 Q264 158 260 150 L218 88 V56 Z" fill="#fff" stroke="#C9D0DC" stroke-width="4"/>
      <path d="M156 128 L144 150 Q140 158 148 158 H252 Q260 158 256 150 L244 128 Z" fill="#7FD8B0"/>
      <rect x="176" y="48" width="48" height="10" rx="5" fill="#C9D0DC"/>
      ${face(200, 132, 0.5)}
      <circle cx="306" cy="122" r="32" fill="#fff" stroke="#C9D0DC" stroke-width="4"/><path d="M276 128 A30 30 0 0 0 336 128 Z" fill="#B48CF0"/><rect x="298" y="70" width="16" height="24" fill="#fff" stroke="#C9D0DC" stroke-width="3"/>
      <circle cx="300" cy="56" r="6" fill="#B48CF0" opacity=".6"/><circle cx="314" cy="42" r="4" fill="#B48CF0" opacity=".5"/>${sp(240, 30, 10, '#FFD86A')}`;
    case 2: return `${gs(150)}
      <rect x="84" y="20" width="232" height="126" rx="8" fill="#A8744B"/><rect x="94" y="30" width="212" height="106" rx="4" fill="#2F5D4A"/>
      <text x="200" y="64" class="svg-display" font-size="28" fill="#fff" text-anchor="middle" opacity=".92">a² + b² = c²</text>
      <path d="M120 96 Q150 84 180 100 M206 96 H258" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6" fill="none"/>
      ${face(272, 112, 0.36, '#fff')}
      <rect x="110" y="146" width="40" height="6" rx="3" fill="#fff"/>
      ${wood(130, 160, 140, 14)}<rect x="160" y="128" width="54" height="32" rx="4" fill="${c}"/><rect x="166" y="120" width="48" height="10" rx="3" fill="${l}"/>${sp(330, 40, 11, '#FFD86A')}`;
    case 6: return `${gs(160)}${wood(30, 158, 340, 14)}
      ${[[90, 0.8], [200, 1], [310, 0.8]].map(([x, s]) => `<g transform="translate(${x} 104) scale(${s})"><rect x="-56" y="-48" width="112" height="78" rx="8" fill="#2B3A5E"/><rect x="-48" y="-40" width="96" height="62" rx="4" fill="${s === 1 ? '#CDEBFF' : '#9FC3E8'}"/><rect x="-8" y="30" width="16" height="16" fill="#5A6580"/><rect x="-26" y="44" width="52" height="8" rx="4" fill="#5A6580"/></g>`).join('')}
      ${face(200, 98, 0.5)}<rect x="160" y="160" width="80" height="10" rx="3" fill="#E3E7EE"/>${sp(200, 22, 10, '#FFD86A')}`;
    case 7: return `${gs(150)}
      <path d="M90 168 C90 120 130 140 150 120 M310 168 C310 120 270 140 250 120" fill="none" stroke="#F2B72E" stroke-width="6" stroke-linecap="round"/>
      <path d="M60 168 C70 110 120 110 160 112" fill="none" stroke="#2F7FF0" stroke-width="6" stroke-linecap="round"/>
      <rect x="124" y="86" width="152" height="66" rx="14" fill="#2B3A5E"/>
      ${[0, 1, 2, 3, 4].map(k => `<circle cx="${150 + k * 25}" cy="138" r="5" fill="${k % 2 ? '#7CF29A' : c}"/>`).join('')}
      <path d="M150 86 V44 M250 86 V44" stroke="#5A6580" stroke-width="7" stroke-linecap="round"/>
      ${face(200, 112, 0.42, '#fff')}
      <path d="M180 40 Q200 22 220 40 M168 28 Q200 0 232 28" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`;
    case 9: return `${gs(150)}
      <g transform="rotate(-8 200 110)"><rect x="96" y="34" width="208" height="134" rx="8" fill="#1F5FBF"/>
        <path d="M120 140 V70 H200 V110 H260 V140 Z" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>
        <path d="M200 70 L260 70 M120 100 H170" stroke="#fff" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>
        ${face(240, 92, 0.38, '#fff')}</g>
      <g transform="translate(300 150) rotate(-30)"><rect x="-90" y="-8" width="120" height="16" rx="3" fill="#F2B72E"/>${[0, 1, 2, 3, 4, 5].map(k => `<path d="M${-80 + k * 18} -8 V0" stroke="#8A6A1F" stroke-width="2"/>`).join('')}</g>
      <path d="M70 60 L90 140 M70 60 L50 140" stroke="#5A6580" stroke-width="5" stroke-linecap="round"/><circle cx="70" cy="58" r="8" fill="#5A6580"/>`;
    case 11: return `${gs(120)}
      <path d="M40 40 H180 A14 14 0 0 1 194 54 V104 A14 14 0 0 1 180 118 H90 L64 140 L70 118 H54 A14 14 0 0 1 40 104 V54 A14 14 0 0 1 54 40 Z" fill="${c}"/>
      <text x="117" y="80" class="svg-display" font-size="34" fill="#fff" text-anchor="middle" dominant-baseline="central">Hello!</text>
      <path d="M360 70 H230 A14 14 0 0 0 216 84 V126 A14 14 0 0 0 230 140 H320 L344 160 L338 140 H346 A14 14 0 0 0 360 126 Z" fill="#F2B72E"/>
      <text x="288" y="106" class="svg-display" font-size="32" fill="#fff" text-anchor="middle" dominant-baseline="central">¡Hola!</text>
      <path d="M150 196 V160 A50 50 0 0 1 250 160 V196" fill="none" stroke="#2B3A5E" stroke-width="9"/>
      <rect x="132" y="160" width="30" height="40" rx="12" fill="#2B3A5E"/><rect x="238" y="160" width="30" height="40" rx="12" fill="#2B3A5E"/>${face(200, 182, 0.32)}`;
    case 13: return `${gs(130)}
      <rect x="150" y="70" width="100" height="90" rx="20" fill="#C9D3E6"/><rect x="164" y="84" width="72" height="44" rx="12" fill="#2B3A5E"/>
      <circle cx="184" cy="104" r="7" fill="#7CF29A"/><circle cx="216" cy="104" r="7" fill="#7CF29A"/><path d="M190 118 Q200 124 210 118" stroke="#7CF29A" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M200 70 V46" stroke="#5A6580" stroke-width="5"/><circle cx="200" cy="42" r="8" fill="${c}"/>
      <rect x="166" y="160" width="20" height="32" rx="6" fill="#9AA6BC"/><rect x="214" y="160" width="20" height="32" rx="6" fill="#9AA6BC"/>
      <path d="M150 104 L112 84 L100 110" fill="none" stroke="#9AA6BC" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M250 104 L288 124 L300 98" fill="none" stroke="#9AA6BC" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <g transform="translate(330 60)"><circle r="24" fill="none" stroke="${c}" stroke-width="10" stroke-dasharray="9 7"/><circle r="9" fill="${c}"/></g>${sp(70, 50, 10, '#FFD86A')}`;
    case 14: return `${gs(130)}
      <path d="M110 92 Q100 40 200 40 Q300 40 290 92" fill="none" stroke="#2B3A5E" stroke-width="10"/>
      <rect x="100" y="76" width="200" height="86" rx="34" fill="${c}"/><rect x="118" y="92" width="164" height="54" rx="22" fill="#2B3A5E"/>
      <rect x="128" y="100" width="64" height="38" rx="16" fill="#8FD0F5"/><rect x="208" y="100" width="64" height="38" rx="16" fill="#8FD0F5"/>
      ${face(200, 120, 0.42, '#1E2A47')}
      <g transform="translate(330 70) rotate(15)" fill="none" stroke="#F2B72E" stroke-width="4"><rect x="-18" y="-18" width="36" height="36"/><path d="M-18 -18 L-8 -28 H28 V8 L18 18 M18 -18 L28 -28"/></g>${sp(60, 60, 12, '#FFD86A')}${sp(340, 150, 9)}`;
    case 15: return `${gs(150)}
      <rect x="80" y="70" width="240" height="110" rx="10" fill="#2F8F5B"/>
      <path d="M100 100 H160 V140 H220 M240 90 V120 H300 M110 160 H190" fill="none" stroke="#F2C14E" stroke-width="4"/>
      ${[[110, 100], [220, 140], [240, 90], [300, 120], [190, 160]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#F2C14E"/>`).join('')}
      <rect x="150" y="92" width="80" height="56" rx="6" fill="#2B3A5E"/>${[0, 1, 2, 3].map(k => `<rect x="${158 + k * 18}" y="84" width="6" height="10" fill="#9AA6BC"/><rect x="${158 + k * 18}" y="146" width="6" height="10" fill="#9AA6BC"/>`).join('')}
      ${face(190, 118, 0.38, '#fff')}
      <circle cx="292" cy="56" r="16" fill="#FFE27A"/><circle cx="292" cy="56" r="26" fill="#FFE27A" opacity=".3"/><rect x="286" y="70" width="12" height="16" fill="#9AA6BC"/>
      <g transform="translate(70 60) rotate(30)"><rect x="-6" y="0" width="12" height="70" rx="5" fill="${c}"/><path d="M-3 70 L0 92 L3 70 Z" fill="#9AA6BC"/></g>`;
    case 17: return `${gs(160)}
      <rect x="220" y="24" width="160" height="104" rx="6" fill="#fff" stroke="#C9D0DC" stroke-width="4"/><rect x="292" y="128" width="16" height="50" fill="#9AA6BC"/>
      <path d="M286 58 V94 L316 76 Z" fill="${c}"/>
      <path d="M104 102 L222 30 V124 Z" fill="#FFE27A" opacity=".35"/>
      <rect x="40" y="88" width="80" height="48" rx="12" fill="#2B3A5E"/><circle cx="110" cy="112" r="14" fill="#8FD0F5" stroke="#5A6580" stroke-width="4"/>
      ${face(68, 112, 0.32, '#fff')}${wood(30, 136, 110, 12)}${sp(200, 160, 10, '#FFD86A')}`;
    case 19: return `${gs(150)}
      <rect x="120" y="44" width="160" height="140" rx="14" fill="#5A6580"/><rect x="132" y="56" width="136" height="116" rx="8" fill="#7A879E"/>
      <circle cx="236" cy="114" r="24" fill="#C9D0DC" stroke="#3B4660" stroke-width="5"/><path d="M236 96 V132 M218 114 H254" stroke="#3B4660" stroke-width="4"/>
      <rect x="140" y="86" width="12" height="56" rx="5" fill="#C9D0DC"/>
      ${face(180, 112, 0.45, '#fff')}
      ${coin(70, 170, 20)}${coin(84, 150, 18)}${coin(330, 168, 22)}${banknote(330, 90, 90, 50, 12)}${sp(60, 50, 12, '#F7CD5B')}`;
    case 21: return `${gs(160)}${wood(40, 150, 320, 16)}
      ${[0, 1, 2, 3].map(k => `<rect x="${92 + k * 3}" y="${130 - k * 12}" width="100" height="12" rx="2" fill="${k % 2 ? '#F4F1EA' : '#fff'}" stroke="#D9CDB8" stroke-width="2"/>`).join('')}
      <rect x="250" y="70" width="42" height="56" rx="10" fill="${c}"/><rect x="236" y="124" width="70" height="20" rx="6" fill="#2B3A5E"/>
      ${face(271, 96, 0.34, '#fff')}<rect x="260" y="54" width="22" height="20" rx="8" fill="#5A6580"/>
      <g transform="translate(330 120) rotate(-30)"><rect x="-4" y="-40" width="8" height="60" rx="4" fill="#1E2A47"/><path d="M-4 20 L0 30 L4 20 Z" fill="#F2C14E"/></g>`;
    case 23: return `${gs(150)}
      <path d="M140 60 Q140 30 200 30 Q260 30 260 60 V150 H140 Z" fill="#8E2F3C"/><rect x="152" y="60" width="96" height="70" rx="12" fill="#B23A4A"/>
      <rect x="120" y="110" width="30" height="64" rx="10" fill="#8E2F3C"/><rect x="250" y="110" width="30" height="64" rx="10" fill="#8E2F3C"/><rect x="140" y="136" width="120" height="30" rx="8" fill="#B23A4A"/>
      <path d="M160 70 Q200 112 240 70" fill="none" stroke="${GOLD}" stroke-width="6" stroke-dasharray="2 8" stroke-linecap="round"/>
      <circle cx="200" cy="104" r="16" fill="${GOLD}" stroke="#B98A2A" stroke-width="3"/>
      ${face(200, 50, 0.3, '#fff')}
      <path d="M330 170 V100 M310 100 H350 L340 70 H320 Z" fill="${GOLD}" stroke="#B98A2A" stroke-width="3"/>${sp(70, 60, 12, '#F7CD5B')}${sp(330, 40, 9)}`;
    case 25: return `${gs(150)}
      <path d="M90 120 C80 60 170 40 220 60 C270 80 260 130 220 130 C200 130 200 150 210 160 C220 175 180 190 140 180 C110 172 94 150 90 120 Z" fill="#F4E1C1" stroke="#C69C6D" stroke-width="4"/>
      ${[[130, 86, '#E5484D'], [168, 70, '#F2B72E'], [206, 80, '#2F7FF0'], [122, 130, '#1FA463'], [226, 108, c]].map(([x, y, col]) => `<circle cx="${x}" cy="${y}" r="13" fill="${col}"/>`).join('')}
      ${face(170, 140, 0.36)}
      <g transform="translate(290 70) rotate(35)"><rect x="-6" y="0" width="12" height="100" rx="5" fill="#C08A5B"/><rect x="-7" y="-12" width="14" height="16" fill="#C9D0DC"/><path d="M-7 -12 Q0 -40 7 -12 Z" fill="${c}"/></g>${sp(320, 160, 10, '#FFD86A')}`;
    case 27: return `${gs(110)}
      <rect x="176" y="20" width="48" height="84" rx="24" fill="#5A6580"/>${[0, 1, 2, 3].map(k => `<path d="M180 ${36 + k * 16} H220" stroke="#3B4660" stroke-width="3"/>`).join('')}
      <path d="M160 70 Q160 124 200 124 Q240 124 240 70" fill="none" stroke="#2B3A5E" stroke-width="7"/><path d="M200 124 V178 M170 182 H230" stroke="#2B3A5E" stroke-width="8" stroke-linecap="round"/>
      ${face(200, 74, 0.32, '#fff')}
      <path d="M100 70 Q90 92 100 114 M76 56 Q58 92 76 128 M300 70 Q310 92 300 114 M324 56 Q342 92 324 128" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>
      ${iconGroup('music', 66, 160, 38, c)}${iconGroup('music', 322, 30, 32, '#F2B72E')}`;
    case 29: return `${gs(150)}
      <path d="M96 90 Q96 64 126 64 H274 Q304 64 304 90 L320 150 Q326 178 300 176 Q284 174 270 150 H130 Q116 174 100 176 Q74 178 80 150 Z" fill="${c}"/>
      <path d="M124 92 V122 M109 107 H139" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
      ${[[262, 92, '#F2B72E'], [282, 108, '#E5484D'], [242, 108, '#1FA463'], [262, 124, '#2F7FF0']].map(([x, y, col]) => `<circle cx="${x}" cy="${y}" r="8" fill="${col}"/>`).join('')}
      ${face(196, 112, 0.42, '#fff')}
      <path d="M330 30 H370 V44 Q370 70 350 74 Q330 70 330 44 Z" fill="${GOLD}"/><rect x="344" y="74" width="12" height="14" fill="${GOLD}"/><rect x="334" y="86" width="32" height="8" rx="3" fill="#B98A2A"/>
      <text x="56" y="44" class="svg-display" font-size="28" fill="${c}">GG</text>`;
    case 31: return `${gs(160)}
      <rect x="196" y="18" width="10" height="160" fill="#9AA6BC"/><rect x="136" y="24" width="130" height="104" rx="6" fill="#fff" stroke="#C9D0DC" stroke-width="4"/>
      ${[[152, 40], [176, 64], [200, 28], [224, 52]].map(([x, h]) => `<rect x="${x}" y="${116 - h}" width="18" height="${h}" rx="3" fill="${c}"/>`).join('')}
      ${face(232, 102, 0.3)}
      ${wood(40, 150, 320, 14)}<rect x="70" y="128" width="54" height="22" rx="3" fill="#2B3A5E"/><rect x="276" y="128" width="54" height="22" rx="3" fill="#2B3A5E"/>
      <circle cx="96" cy="118" r="10" fill="#F4C7A1"/><circle cx="304" cy="118" r="10" fill="#C9956B"/>${sp(340, 40, 10, '#FFD86A')}`;
    case 3: case 18: {
      const big = i === 18;
      const car = (x, col, sc = 1) => `<g transform="translate(${x} 150) scale(${sc})"><path d="M-60 0 V-22 Q-60 -30 -50 -32 L-34 -56 Q-30 -62 -22 -62 H24 Q32 -62 36 -56 L52 -32 Q62 -30 62 -22 V0 Z" fill="${col}"/><path d="M-26 -54 H-2 V-34 H-40 Z M6 -54 H22 L36 -34 H6 Z" fill="#CDEBFF"/><circle cx="-34" cy="2" r="14" fill="#2B3A5E"/><circle cx="34" cy="2" r="14" fill="#2B3A5E"/><circle cx="-34" cy="2" r="5" fill="#C9D0DC"/><circle cx="34" cy="2" r="5" fill="#C9D0DC"/></g>`;
      return `${gs(170)}<rect x="20" y="164" width="360" height="8" rx="4" fill="#C9D0DC"/>
        <rect x="${big ? 336 : 300}" y="36" width="8" height="128" fill="#9AA6BC"/><rect x="${big ? 312 : 276}" y="20" width="56" height="56" rx="10" fill="#1F5FBF"/><text x="${big ? 340 : 304}" y="50" class="svg-display" font-size="40" fill="#fff" text-anchor="middle" dominant-baseline="central">P</text>
        ${big ? `<g transform="translate(160 160)"><rect x="-120" y="-96" width="230" height="92" rx="16" fill="#F2B72E"/>${[0, 1, 2, 3].map(k => `<rect x="${-104 + k * 50}" y="-82" width="40" height="34" rx="6" fill="#CDEBFF"/>`).join('')}<rect x="-120" y="-36" width="230" height="10" fill="#E39A32"/><circle cx="-70" cy="-2" r="16" fill="#2B3A5E"/><circle cx="60" cy="-2" r="16" fill="#2B3A5E"/>${face(-6, -30, 0.4)}</g>` : `${car(170, '#2F7FF0')}${face(170, 124, 0.3)}`}
        ${sp(60, 50, 11, '#FFD86A')}`;
    }
    case 4: return `${gs(120)}
      <ellipse cx="200" cy="176" rx="110" ry="18" fill="#7A879E"/><ellipse cx="200" cy="170" rx="110" ry="18" fill="#9AA6BC"/>
      <path d="M170 40 H230 Q226 70 258 100 Q280 124 256 160 H144 Q120 124 142 100 Q174 70 170 40 Z" fill="#D9895B"/>
      <ellipse cx="200" cy="40" rx="30" ry="8" fill="#B86A3E"/><path d="M150 112 Q200 126 250 112 M146 136 Q200 150 254 136" stroke="#fff" stroke-width="4" opacity=".55" fill="none"/>
      ${face(200, 124, 0.45)}${sp(90, 60, 12, GOLD)}${sp(320, 50, 10, GOLD)}`;
    case 12: return `${gs(120)}
      <rect x="140" y="20" width="120" height="170" rx="12" fill="#2E3138"/>
      ${[0, 1, 2, 3, 4, 5].map(k => `<rect x="152" y="${32 + k * 26}" width="96" height="20" rx="4" fill="#454A52"/><circle cx="166" cy="${42 + k * 26}" r="4" fill="${k % 2 ? '#7CF29A' : GOLD}"/><rect x="180" y="${39 + k * 26}" width="40" height="6" rx="3" fill="${mix(GOLD, '#ffffff', 0.3)}"/>`).join('')}
      ${face(200, 112, 0.38, '#fff')}${sp(90, 60, 12, GOLD)}${sp(320, 140, 10, GOLD)}`;
    case 20: return `${gs(170)}
      <path d="M70 70 L200 20 L330 70 Z" fill="${GOLD}"/><circle cx="200" cy="52" r="10" fill="#5C1B2F"/>
      <rect x="76" y="70" width="248" height="14" fill="${GOLD}"/>
      ${[0, 1, 2, 3, 4].map(k => `<rect x="${96 + k * 48}" y="90" width="20" height="78" rx="3" fill="#F4E6C2"/>`).join('')}
      <rect x="64" y="168" width="272" height="12" fill="${GOLD}"/><rect x="52" y="180" width="296" height="12" fill="#B98A2A"/>
      ${sp(40, 40, 12, GOLD)}${sp(360, 40, 10, GOLD)}`;
    case 28: return `${gs(110)}
      <path d="M200 0 V60" stroke="${GOLD}" stroke-width="6"/>
      <path d="M100 96 Q200 170 300 96" fill="none" stroke="${GOLD}" stroke-width="8" stroke-linecap="round"/>
      <path d="M140 80 Q200 130 260 80" fill="none" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/>
      ${[[100, 96], [140, 80], [200, 126], [260, 80], [300, 96]].map(([x, y]) => `<rect x="${x - 6}" y="${y - 34}" width="12" height="30" fill="#fff"/><ellipse cx="${x}" cy="${y - 44}" rx="8" ry="12" fill="#FFD166"/><circle cx="${x}" cy="${y - 44}" r="18" fill="#FFD166" opacity=".25"/>`).join('')}
      <circle cx="200" cy="70" r="20" fill="${GOLD}"/>${face(200, 72, 0.26, '#5C1B2F')}
      ${[[150, 150], [250, 150], [200, 180]].map(([x, y]) => `<path d="M${x} ${y - 14} L${x + 9} ${y} L${x} ${y + 14} L${x - 9} ${y} Z" fill="#CDEBFF"/>`).join('')}${sp(60, 160, 10, GOLD)}${sp(340, 160, 10, GOLD)}`;
  }
  return '';
}
function deedStyle(i) {
  const f = FIELDS[i];
  if (f.type === 'room') { const c = GROUPS[f.group].color; return { c, top: c, bot: mix(c, '#000000', 0.25), light: mix(c, '#ffffff', 0.86), badge: GROUPS[f.group].name.toUpperCase() }; }
  if (f.type === 'station') return { c: '#1F5FBF', top: '#2F7FF0', bot: '#1A4E9E', light: '#E6F0FC', badge: 'PARKING' };
  return { c: '#9A3550', top: '#9A3550', bot: '#5C1B2F', light: '#F8EBEF', badge: 'SPECJALNE' };   // bordo ze złotem, jak pola specjalne na planszy
}
// Wiersze tabeli na karcie
function deedRows(i) {
  const f = FIELDS[i], price = priceOf(i);
  if (f.type === 'room') {
    const base = roundK(price * RENT_MULT[0]);
    return [
      ['Czynsz bez budynku', money(base)],
      ['Z monopolem (cała grupa)', money(base * 2)],
      ...BUILDINGS.map((b, k) => [`${k + 1}`, `${b.name}${k === 4 ? ' (hotel)' : ''}`, money(roundK(price * RENT_MULT[k + 1]))]),
    ];
  }
  if (f.type === 'station') return [
    ['Czynsz: 1 parking', money(ECON.stationRent[1])],
    ['Czynsz: oba parkingi', money(ECON.stationRent[2])],
    ['Bonus na swoim parkingu', money(ECON.stationBonus)],
  ];
  return [1, 2, 3, 4].map(n => [`Czynsz: ${n} ${n === 1 ? 'pole specjalne' : 'pola specjalne'}`, money(ECON.specialRent[n])]);
}
let deedUid = 0;
function deedSVG(i) {
  const f = FIELDS[i], st = deedStyle(i), price = priceOf(i);
  const id = `dd${++deedUid}`;
  const rows = deedRows(i);
  const rowH = f.type === 'room' ? 44 : 48;
  let y = 452;
  const table = rows.map(r => {
    const lvl = r.length === 3;
    const out = `${lvl ? `<circle cx="80" cy="${y}" r="14" fill="${st.c}"/><text x="80" y="${y + 1}" class="svg-body" font-size="17" font-weight="800" fill="#fff" text-anchor="middle" dominant-baseline="central">${r[0]}</text>` : ''}
      <text x="${lvl ? 104 : 62}" y="${y}" class="svg-body" font-size="${lvl ? 23 : 24}" font-weight="${lvl ? 600 : 700}" fill="#1E2A47" dominant-baseline="central">${esc(lvl ? r[1] : r[0])}</text>
      <text x="568" y="${y}" class="svg-body" font-size="24" font-weight="800" fill="${st.bot}" text-anchor="end" dominant-baseline="central">${r[lvl ? 2 : 1]}</text>
      <path d="M62 ${y + rowH / 2} H568" stroke="#E6EAF0" stroke-width="2"/>`;
    y += rowH;
    return out;
  }).join('');
  const foot = f.type === 'room'
    ? [`Budowa: ${money(levelCost(i, 1))} / poziom · serwerownia ${money(levelCost(i, 5))}`, `Sprzedaż do banku: połowa wartości (od ${money(price * ECON.sellRate)})`]
    : f.type === 'station'
      ? ['Na parkingu nie można budować', `Sprzedaż do banku: ${money(price * ECON.sellRate)}`]
      : ['Na polu specjalnym nie można budować', '4 pola specjalne u jednego gracza = wygrana'];
  return `<svg viewBox="0 0 630 880" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Akt własności: ${esc(f.name)}">
  <defs>
    <clipPath id="${id}-clip"><rect width="630" height="880" rx="36"/></clipPath>
    <clipPath id="${id}-art"><rect x="40" y="186" width="550" height="210" rx="24"/></clipPath>
    ${vgrad(id + '-hd', st.top, st.bot)}
    <pattern id="${id}-dots" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="17" cy="17" r="3" fill="${st.c}" opacity=".14"/></pattern>
  </defs>
  <g clip-path="url(#${id}-clip)">
    <rect width="630" height="880" fill="#FFFDF9"/>
    <rect width="630" height="170" fill="url(#${id}-hd)"/>
    <path d="M0 150 Q160 120 315 150 T630 150 V170 H0 Z" fill="#fff" opacity=".12"/>
    <text x="48" y="44" class="svg-body" font-size="19" font-weight="800" fill="#fff" fill-opacity=".8" letter-spacing="3">AKT WŁASNOŚCI · POLE ${i + 1}</text>
    <rect x="${582 - st.badge.length * 13 - 28}" y="24" width="${st.badge.length * 13 + 28}" height="38" rx="19" fill="#fff" fill-opacity=".22"/>
    <text x="${582 - (st.badge.length * 13 + 28) / 2}" y="44" class="svg-body" font-size="18" font-weight="800" fill="#fff" text-anchor="middle" dominant-baseline="central" letter-spacing="1.5">${st.badge}</text>
    <text x="315" y="96" class="svg-display" font-size="${f.name.length > 18 ? 40 : 52}" fill="#fff" text-anchor="middle" dominant-baseline="central">${esc(f.name)}</text>
    <text x="315" y="140" class="svg-body" font-size="22" font-weight="600" fill="#fff" fill-opacity=".85" text-anchor="middle" dominant-baseline="central">${esc(DEED_THEME[i] || '')}</text>
    <rect x="40" y="186" width="550" height="210" rx="24" fill="${st.light}"/>
    <rect x="40" y="186" width="550" height="210" rx="24" fill="url(#${id}-dots)"/>
    <g clip-path="url(#${id}-art)"><g transform="translate(115 186)">${deedArt(i, id, st.c)}</g></g>
    <rect x="215" y="378" width="200" height="46" rx="23" fill="${GOLD}" stroke="#fff" stroke-width="4"/>
    <text x="315" y="402" class="svg-body" font-size="22" font-weight="800" fill="#1E2A47" text-anchor="middle" dominant-baseline="central">CENA ${money(price).toUpperCase()}</text>
    ${table}
    <rect x="40" y="${Math.max(y + 4, 772)}" width="550" height="${Math.max(84, 852 - Math.max(y + 4, 772))}" rx="18" fill="${st.light}"/>
    <text x="315" y="${Math.max(y + 4, 772) + 26}" class="svg-body" font-size="18" font-weight="600" fill="#1E2A47" text-anchor="middle" dominant-baseline="central">${esc(foot[0])}</text>
    <text x="315" y="${Math.max(y + 4, 772) + 56}" class="svg-body" font-size="19" fill="#55607A" text-anchor="middle" dominant-baseline="central">${esc(foot[1])}</text>
    <rect width="630" height="880" rx="36" fill="none" stroke="${st.c}" stroke-width="12"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Okienko pola: akt własności, właściciel, czynsz teraz, wartość, sprzedaż, grupa
// ---------------------------------------------------------------------------
// Gracz, z którego perspektywy patrzy ekran (kamera, „Twoje pole”, panel kart)
function viewerPlayer() { return G ? G.players[G.view ?? 0] || null : null; }
let fieldPop = null;
function closeFieldInfo() {
  if (!fieldPop) return;
  fieldPop.remove();
  fieldPop = null;
  highlight(null);
}
function openPopup(html, plain, label) {
  if (fieldPop) fieldPop.remove();
  const bd = document.createElement('div');
  bd.className = 'fp-bd';
  bd.innerHTML = `<div class="m-card fp${plain ? ' fp-plain' : ''}" role="dialog" aria-modal="true" aria-label="${escHtml(label)}">
    <button class="fp-close" type="button" data-close aria-label="Zamknij">${icon('close')}</button>${html}</div>`;
  bd.addEventListener('click', e => { if (e.target === bd || e.target.closest('[data-close]')) closeFieldInfo(); });
  $('stage').append(bd);
  fieldPop = bd;
  bd.querySelector('.fp-close').focus({ preventScroll: true });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && fieldPop) closeFieldInfo(); });
const ownerDot = o => (o ? `<i style="--c:${o.owner.hex}"></i>` : '<i></i>');
function deedInfoHtml(i) {
  const f = FIELDS[i], st = deedStyle(i);
  const o = G ? G.own.get(i) : null;
  const me = viewerPlayer();
  const price = priceOf(i);
  let owner, stats = [], tags = [];
  if (!G) owner = `<div class="fp-owner">Podgląd poza grą. W trakcie gry zobaczysz tu właściciela i aktualny czynsz.</div>`;
  else if (!o) owner = `<div class="fp-owner">Wolne pole. Kupisz je, kiedy na nim staniesz i dobrze odpowiesz na pytanie.</div>`;
  else owner = `<div class="fp-owner" style="--c:${o.owner.hex}">Właściciel: <b>${escHtml(o.owner.name)}</b>${me && o.owner === me ? '<span class="fp-me">TWOJE POLE</span>' : me && sameTeam(o.owner, me) ? '<span class="fp-me">PARTNER</span>' : ''}</div>`;
  if (o) {
    const rent = rentOf(i);
    stats.push([o.off > 0 ? `Czynsz teraz (brak prądu jeszcze ${o.off})` : 'Czynsz teraz', money(rent), true]);
    if (f.type === 'room') stats.push(['Budynek', o.level ? `${BUILDINGS[o.level - 1].name} · ${o.level}/5` : 'bez budynku']);
    const val = fieldValue(i);
    stats.push(['Wartość pola', money(val)], ['Sprzedaż do banku', money(val * ECON.sellRate)]);
    if (f.type === 'room' && o.level < 5) stats.push([`Następny poziom: ${BUILDINGS[o.level].name.toLowerCase()}`, money(levelCost(i, o.level + 1))]);
    if (f.type === 'room' && hasMonopoly(o.owner, f.group)) tags.push(['MONOPOL', GOLD]);
    if (o.level === 5) tags.push(['HOTEL: NIE DO RUSZENIA', '#6A4BB0']);
    if (o.shield) tags.push([`TARCZA ×${o.shield}`, '#2F7FF0']);
    if (o.off > 0) tags.push([`BRAK PRĄDU: ${o.off}`, '#1E2A47']);
    if (o.owner.insured > 0) tags.push([`UBEZPIECZENIE: ${o.owner.insured}`, '#2F7FF0']);
  } else {
    const base = f.type === 'room' ? roundK(price * RENT_MULT[0]) : f.type === 'station' ? ECON.stationRent[1] : ECON.specialRent[1];
    stats.push(['Cena', money(price), true], ['Czynsz na start', money(base)], ['Sprzedaż do banku', money(price * ECON.sellRate)]);
    if (f.type === 'room') stats.push(['Budowa poziomu', money(levelCost(i, 1))]);
  }
  const mates = f.type === 'room' ? GROUP_CELLS[f.group] : Object.keys(FIELDS).map(Number).filter(k => FIELDS[k].type === f.type);
  const groupTitle = f.type === 'room' ? `${GROUPS[f.group].name}: cała grupa = monopol` : f.type === 'station' ? 'Parkingi' : 'Pola specjalne: wszystkie 4 = wygrana';
  const list = mates.map(k => {
    const ko = G ? G.own.get(k) : null;
    return `<li>${ownerDot(ko)}${escHtml(FIELDS[k].name)}<span>${ko ? escHtml(ko.owner.name) : G ? 'wolne' : `pole ${k + 1}`}</span></li>`;
  }).join('');
  return `<div class="fp-card">${deedSVG(i)}</div>
    <div class="fp-body" style="--c:${o ? o.owner.hex : st.c}">
      <h2>${escHtml(f.name)}</h2>
      <p class="fp-sub">${escHtml(DEED_THEME[i] || '')} · pole ${i + 1}</p>
      ${owner}
      ${tags.length ? `<div class="fp-tags">${tags.map(([t, c]) => `<span class="fp-tag" style="--t:${c}">${t}</span>`).join('')}</div>` : ''}
      <div class="fp-stats">${stats.map(([k, v, big]) => `<div class="fp-stat${big ? ' big' : ''}"><small>${k}</small><b>${v}</b></div>`).join('')}</div>
      <div class="fp-group"><h3>${groupTitle}</h3><ul>${list}</ul></div>
    </div>`;
}
function plainInfoHtml(i) {
  const f = FIELDS[i];
  const title = CORNER_INFO[i] ? CORNER_INFO[i][0].split(' · ')[1] : f ? f.name : `Pole ${i + 1}`;
  let text;
  if (i === START_CELL) text = `Za przejście przez START dostajesz <b>${money(ECON.startPay)}</b> i premię: procent dobrych odpowiedzi z tego okrążenia.`;
  else if (i === JAIL_CELL) text = `Stajesz tu zwykłym rzutem: pytanie dziekanatu, zła odpowiedź to 1 kolejka postoju. Trafiasz tu z pola 25 albo z karty: 2 kolejki, a wyjście kosztuje <b>${money(ECON.bail)}</b>, rzut z dubletem albo karta wyjścia.`;
  else if (i === POOL_CELL) text = `Zabierasz całą pulę ze środka planszy.${G ? ` Teraz w puli jest <b>${money(G.pool)}</b>.` : ''}`;
  else if (i === GOTO_CELL) text = 'Idziesz od razu do dziekanatu na 2 kolejki.';
  else if (f && f.type === 'tax') text = `Płacisz <b>${money(ECON.tax)}</b> do puli na środku planszy.`;
  else if (f && f.type === 'chance') text = 'Pytanie: dobra odpowiedź to karta ułatwienia, zła to karta utrudnienia. Potem drugie pytanie decyduje o działaniu ×2.';
  else text = 'Funkcję pola dopiszemy później.';
  const img = tileTops[i].material.map.image.toDataURL('image/png');
  return `<div class="fp-card"><img src="${img}" alt=""></div>
    <div class="fp-body"><h2>${escHtml(title)}</h2><p class="fp-sub">Pole ${i + 1}</p><p class="fp-text">${text}</p></div>`;
}
function openFieldInfo(i) {
  if (tileTops[i]) highlight(tileTops[i]);
  const f = FIELDS[i];
  if (f && buyable(i)) openPopup(deedInfoHtml(i), false, `Pole ${i + 1}: ${f.name}`);
  else openPopup(plainInfoHtml(i), true, `Pole ${i + 1}`);
}
function openDeckInfo(deck) {
  const kind = deck === DECKS[0] ? 'bonus' : 'penalty';
  const left = G ? G.deckLeft[kind] : null;
  openPopup(`<div class="fp-card"><img src="${cardBackUrl(kind === 'bonus' ? 'ulatwienia' : 'utrudnienia')}" alt=""></div>
    <div class="fp-body"><h2>Stos: ${deck.name}</h2><p class="fp-sub">${left != null ? `W stosie: ${left} ${left === 1 ? 'karta' : left < 5 && left > 1 ? 'karty' : 'kart'}` : 'Karty z pola Szansa'}</p>
    <p class="fp-text">${kind === 'bonus' ? 'Kartę ułatwienia dostajesz za dobrą odpowiedź na polu Szansa.' : 'Kartę utrudnienia dostajesz za złą odpowiedź na polu Szansa.'} Wszystkie karty są w zakładce „Karty”.</p></div>`, true, `Stos kart: ${deck.name}`);
}
const DEED_CELLS = Object.keys(FIELDS).map(Number).filter(buyable);
// Zakładka „Karty”: wszystkie akty własności
for (const i of DEED_CELLS) {
  const slot = document.createElement('div');
  slot.className = 'card-slot';
  slot.innerHTML = `<button class="flip deed-btn" type="button" aria-label="Akt własności: ${escHtml(FIELDS[i].name)}"><span class="flip-inner"><span class="face front">${deedSVG(i)}</span></span></button>
    <p class="card-cap"><b>${escHtml(FIELDS[i].name)}</b> · pole ${i + 1}</p>`;
  slot.querySelector('button').addEventListener('click', () => openFieldInfo(i));
  $('deedGrid').append(slot);
}
const pct = R.pct;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random() * n);
const pickOne = a => a[rnd(a.length)];
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Rozgrywka w przeglądarce: zasady liczy silnik (src/core/engine.ts), a ten plik odtwarza jego zdarzenia
// (animacje, okna, panel) i odsyła decyzje gracza. G to widok gry: stan z ostatniego odtworzonego zdarzenia
// i obiekty 3D graczy. Gracze mają te same pola co w silniku, a właściciel pola to obiekt gracza.
let G = null;                       // widok rozgrywki; null = gra nie trwa
const isBot = p => p.kind === 'bot';
const isLocalHuman = p => p.kind === 'me' || p.kind === 'local';   // decyduje ktoś przy tym komputerze
const sameTeam = (a, b) => R.sameTeam(G.snap, a.idx, b.idx);
// Tekst z silnika jest zwykłym tekstem (bez HTML, bo nazwy graczy wpisują ludzie); **tak** = pogrubienie
const fmt = t => escHtml(t ?? '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const PLAYER_FIELDS = ['cash', 'pos', 'out', 'jail', 'noCard', 'skip', 'insured', 'cards', 'pending', 'lap', 'total'];
function applySnap(snap) {
  G.snap = snap;
  snap.players.forEach((sp, k) => { const p = G.players[k]; for (const key of PLAYER_FIELDS) p[key] = sp[key]; });
  G.own = new Map(Object.entries(snap.own).map(([i, o]) => [+i, { ...o, owner: G.players[o.owner] }]));
  G.pool = snap.pool; G.turn = snap.turn; G.over = snap.over; G.timeUp = snap.timeUp; G.deckLeft = snap.deckLeft;
}

// ---------------------------------------------------------------------------
// Dźwięki: syntezowane w przeglądarce (Web Audio), bez plików (src/audio/)
// ---------------------------------------------------------------------------
function sfx(name) { playSfx(name, (prefs.effects ?? 80) / 100, DICE_SOUND_FILE); }

// ---------------------------------------------------------------------------
// Kostki 3D
// ---------------------------------------------------------------------------
const DIE = 0.62;
const PIPS = {
  1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
};
function dieTexture(n) {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = n === 1 ? '#D6534F' : '#23262D';
  for (const [x, y] of PIPS[n]) { g.beginPath(); g.arc(x * 256, y * 256, n === 1 ? 36 : 24, 0, Math.PI * 2); g.fill(); }
  return tex(c);
}
// Kolejność ścian w bryle: +X, -X, +Y, -Y, +Z, -Z. Przeciwległe ściany sumują się do 7.
const dieMats = [3, 4, 1, 6, 2, 5].map(n => new THREE.MeshStandardMaterial({ map: dieTexture(n), roughness: 0.32 }));
const dieGeo = new RoundedBoxGeometry(DIE, DIE, DIE, 4, 0.07);
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const FACE_UP = {   // obrót, po którym dana liczba oczek jest na górze
  1: new THREE.Quaternion(),
  6: new THREE.Quaternion().setFromAxisAngle(AX, Math.PI),
  2: new THREE.Quaternion().setFromAxisAngle(AX, -Math.PI / 2),
  5: new THREE.Quaternion().setFromAxisAngle(AX, Math.PI / 2),
  3: new THREE.Quaternion().setFromAxisAngle(AZ, Math.PI / 2),
  4: new THREE.Quaternion().setFromAxisAngle(AZ, -Math.PI / 2),
};
const dice = [0, 1].map(() => {
  const m = mesh(dieGeo, dieMats, true, false);
  m.visible = false;
  board.add(m);
  return m;
});
// Rzut w grze: prawdziwa fizyka (src/render/dice.js), gdy biblioteka już się wczytała; seed z numeru zdarzenia
// daje ten sam lot u wszystkich graczy online. Wynik a, b jest z silnika: kość pokazuje go po wylądowaniu.
const diceFix = [new THREE.Quaternion(), new THREE.Quaternion()];
function throwDicePhysics(a, b, seed) {
  if (!diceReady() || reduceMotion) return null;
  const from = new THREE.Vector2(camera.position.x, camera.position.z);
  if (from.lengthSq() < 1e-6) from.set(1, 1);
  from.normalize();
  const sim = simulateThrow({
    floorY: CENTER_Y, half: INNER / 2, die: DIE, round: 0.07, from: [from.x, from.y], seed,
    obstacles: DECKS.map(d => ({ x: d.x, z: d.z, hx: CARD_W / 2 + 0.03, hy: 0.09, hz: CARD_L / 2 + 0.03 })),
  });
  if (!sim) return null;
  // „nadruk”: obrót siatki w bryle, po którym na ściance, która wylądowała na górze, są wylosowane oczka
  [a, b].forEach((v, k) => {
    const landed = new THREE.Vector3(...FACE_AXES[sim.faces[k]][0]);
    const want = new THREE.Vector3(...FACE_AXES.find(([, n]) => n === v)[0]);
    diceFix[k].setFromUnitVectors(want, landed);
  });
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), f = sim.frames;
  dice.forEach(d => { d.visible = true; });
  // dźwięk: krótkie potrząśnięcie w dłoni, potem stuknięcie przy każdym uderzeniu kości
  const ac = (prefs.effects ?? 80) > 0 ? audio() : null;
  if (ac) {
    const vol = (prefs.effects ?? 80) / 100, t0 = ac.currentTime + 0.02;
    for (let k = 0; k < 5; k++) click(ac, t0 + k * 0.04, 2600 + Math.random() * 1200, 0.14 * vol, 0.03);
    for (const imp of sim.impacts.slice(0, 14)) knock(ac, t0 + 0.2 + imp.t, (0.25 + 0.6 * imp.v) * vol, curSkin === 'pokoj');
  }
  return sleep(200).then(() => tween(sim.count * sim.dt * 1000, t => {
    const x = t * (sim.count - 1), i = Math.floor(x), u = x - i, j = Math.min(i + 1, sim.count - 1);
    dice.forEach((d, k) => {
      const A = i * 14 + k * 7, B = j * 14 + k * 7;
      d.position.set(f[A] + (f[B] - f[A]) * u, f[A + 1] + (f[B + 1] - f[A + 1]) * u, f[A + 2] + (f[B + 2] - f[A + 2]) * u);
      qa.set(f[A + 3], f[A + 4], f[A + 5], f[A + 6]); qb.set(f[B + 3], f[B + 4], f[B + 5], f[B + 6]);
      d.quaternion.slerpQuaternions(qa, qb, u).multiply(diceFix[k]);
    });
  }));
}
function throwDice(a, b, slow = 1, opts = {}) {
  if (opts.physics) { const p = throwDicePhysics(a, b, opts.seed ?? Math.floor(Math.random() * 2 ** 31)); if (p) return p; }
  const lands = [
    new THREE.Vector3(-1.0 + (Math.random() - 0.5) * 0.5, CENTER_Y + DIE / 2, 1.2 + (Math.random() - 0.5) * 0.5),
    new THREE.Vector3(0.15 + (Math.random() - 0.5) * 0.5, CENTER_Y + DIE / 2, 1.75 + (Math.random() - 0.5) * 0.4),
  ];
  const jobs = [a, b].map((v, k) => {
    const d = dice[k];
    d.visible = true;
    const end = lands[k];
    const start = end.clone().add(new THREE.Vector3(-2.4 - Math.random(), 3.2, -2.4 - Math.random()));
    const qf = new THREE.Quaternion().setFromAxisAngle(AY, Math.random() * Math.PI * 2).multiply(FACE_UP[v]);
    const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const turns = Math.PI * (4 + Math.random() * 2);
    const spin = new THREE.Quaternion();
    return tween(reduceMotion ? 200 : (1250 + k * 90) * slow, t => {
      const e = 1 - Math.pow(1 - t, 2.2);
      d.position.lerpVectors(start, end, e);
      d.position.y = end.y + (start.y - end.y) * Math.pow(1 - t, 2) * Math.abs(Math.cos(t * Math.PI * 2.5));
      spin.setFromAxisAngle(axis, turns * (1 - e));
      d.quaternion.copy(qf).multiply(spin);
    });
  });
  sfx('dice');
  return Promise.all(jobs);
}

// ---------------------------------------------------------------------------
// Pionki na planszy
// ---------------------------------------------------------------------------
const PAWN_SPOTS = [[-0.27, 0.2], [0.27, 0.2], [-0.27, 0.62], [0.27, 0.62]];
const PAWN_SCALE = 1.18;  // pionki w grze większe niż w menu (skok pionka zmienia skalę zewnętrznej grupy)
function gamePawn(sp) {
  const outer = new THREE.Group(), model = PLAYERS[sp.pawnIdx].make(sp.hex);
  model.scale.multiplyScalar(PAWN_SCALE);
  outer.add(model);
  return outer;
}
const CORNER_SPOTS = [[-0.42, 0.05], [0.42, 0.05], [-0.42, 0.55], [0.42, 0.55]];
function spotPos(cell, k) {
  const p = cellPose(cell);
  const [ox, oz] = (p.corner ? CORNER_SPOTS : PAWN_SPOTS)[k];
  const c = Math.cos(p.rotY), s = Math.sin(p.rotY);
  return new THREE.Vector3(p.x + ox * c + oz * s, TILE_H, p.z - ox * s + oz * c);
}
function placePawn(p) {
  p.obj.position.copy(spotPos(p.pos, p.idx));
  p.obj.rotation.y = cellPose(p.pos).rotY;
}
function turnTo(p, rotY) {
  let d = rotY - p.obj.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return p.obj.rotation.y + d;
}
function hop(p, from, to, height = 0.42, dur = 230) {
  const a = spotPos(from, p.idx), b = spotPos(to, p.idx);
  const r0 = p.obj.rotation.y, r1 = turnTo(p, cellPose(to).rotY);
  sfx('hop');
  return tween(reduceMotion ? 60 : dur / MOVE_SPEED, t => {
    p.obj.position.lerpVectors(a, b, t);
    p.obj.position.y = TILE_H + height * Math.sin(Math.PI * t);
    p.obj.rotation.y = r0 + (r1 - r0) * t;
    const sq = 1 - 0.12 * Math.sin(Math.PI * t);
    p.obj.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  }).then(() => p.obj.scale.set(1, 1, 1));
}

// ---------------------------------------------------------------------------
// Znaczniki na polach: pasek w kolorze właściciela, tarcza i brak prądu
// ---------------------------------------------------------------------------
function iconSprite(kind) {
  const [c, g] = makeCanvas(128, 128);
  // ikony z biblioteki (src/ui/icons.js) na krążku, żeby były czytelne nad każdym polem
  const shield = kind === 'shield';
  g.fillStyle = shield ? '#FFFFFF' : '#2E3138';
  g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  if (shield) drawIcon(g, 'shield', 64, 64, 92, '#2F7FF0');
  else drawIcon(g, 'noPower', 64, 64, 80, '#F2B72E');
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), depthTest: false, transparent: true }));
  s.scale.setScalar(0.5);
  s.renderOrder = 5;
  return s;
}
// Ramka wokół pola w kolorze właściciela
function ownerFrame(i, hex) {
  const geo = tileTops[i].geometry.parameters;
  const w = geo.width, d = geo.height, t = 0.075;
  const m = new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });
  const g = new THREE.Group();
  for (const [x, z, sx, sz] of [[0, -d / 2 + t / 2, w, t], [0, d / 2 - t / 2, w, t], [-w / 2 + t / 2, 0, t, d - 2 * t], [w / 2 - t / 2, 0, t, d - 2 * t]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.012, sz), m);
    b.position.set(x, 0, z);
    g.add(b);
  }
  g.position.y = TILE_H + 0.008;
  return g;
}
// Chorągiewka właściciela na zewnętrznym rogu pola
function ownerFlag(hex) {
  const g = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 10), goldMat);
  pole.position.y = 0.31;
  const knob = mesh(new THREE.SphereGeometry(0.03, 12, 8), goldMat);
  knob.position.y = 0.63;
  const base = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.03, 18), mat(hex, { roughness: 0.4 }));
  base.position.y = 0.015;
  const geo = new THREE.PlaneGeometry(0.3, 0.19, 10, 2);
  geo.translate(0.15, 0, 0);
  const flag = mesh(geo, new THREE.MeshStandardMaterial({ color: hex, side: THREE.DoubleSide, roughness: 0.6 }));
  flag.position.set(0.018, 0.5, 0);
  const entry = { geo, base: Float32Array.from(geo.attributes.position.array), width: 0.3 };
  flags.push(entry);
  g.userData.flagEntry = entry;
  g.userData.flagMat = flag.material;
  g.userData.baseMat = base.material;
  g.add(pole, knob, base, flag);
  return g;
}
function dropFlag(g) {
  const k = flags.indexOf(g.userData.flagEntry);
  if (k >= 0) flags.splice(k, 1);
}
function setGlow(i, hex) {
  const m = tileTops[i].material;
  m.userData.glow = hex || null;
  if (highlighted !== tileTops[i]) restoreGlow(tileTops[i]);
}
function popIn(obj, s = 1, dur = 480) {
  obj.scale.setScalar(0.001);
  return tween(reduceMotion ? 60 : dur, t => {
    const e = 1 - Math.pow(1 - t, 3);
    obj.scale.setScalar(Math.max(0.001, s * (e + Math.sin(t * Math.PI) * 0.25)));
  }).then(() => obj.scale.setScalar(s));
}
function refreshMarks(i) {
  const o = G.own.get(i);
  const cg = cellGroups[i];
  const m = G.marks.get(i) || {};
  G.marks.set(i, m);
  if (!o) {
    for (const k of Object.keys(m)) { if (m[k]) { if (k === 'flag') dropFlag(m[k]); cg.remove(m[k]); } delete m[k]; }
    setGlow(i, null);
    return;
  }
  const isNew = !m.frame;
  if (m.frame && m.frame.userData.hex !== o.owner.hex) { cg.remove(m.frame); m.frame = null; }
  if (!m.frame) { m.frame = ownerFrame(i, o.owner.hex); m.frame.userData.hex = o.owner.hex; cg.add(m.frame); popIn(m.frame, 1, 360); }
  if (!m.flag) {
    m.flag = ownerFlag(o.owner.hex);
    const geo = tileTops[i].geometry.parameters;
    m.flag.position.set(-geo.width / 2 + 0.14, TILE_H, geo.height / 2 - 0.14);
    cg.add(m.flag);
    popIn(m.flag, 1, 520);
  }
  m.flag.userData.flagMat.color.set(o.owner.hex);
  m.flag.userData.baseMat.color.set(o.owner.hex);
  setGlow(i, o.owner.hex);
  if (isNew) burst(cg, o.owner.hex);
  renderHands();
  for (const [key, on, x] of [['shield', o.shield > 0, -0.28], ['off', o.off > 0, 0.28]]) {
    if (on && !m[key]) { m[key] = iconSprite(key); m[key].position.set(x, 1.35, BUILD_Z); cg.add(m[key]); }
    if (!on && m[key]) { cg.remove(m[key]); delete m[key]; }
  }
}
function focusCell(i) {
  const t = cellTarget(i);
  return flyTo([t.clone().add(boardDir().multiplyScalar(boardDist() * 0.45)), t], 550);
}
const backToBoard = () => flyTo(presetBoard(), 650);
// Budynek na polu: stary znika, nowy spada z góry
async function showLevel(i, focus = true) {
  const o = G.own.get(i);
  const cg = cellGroups[i];
  const m = G.marks.get(i) || {};
  G.marks.set(i, m);
  if (focus && !G) focusCell(i);
  if (m.building) { const old = m.building; m.building = null; await shrinkOut(old, cg); }
  if (o && o.level > 0) {
    const def = BUILDINGS[o.level - 1];
    const obj = def.make(o.owner.hex);
    obj.position.set(0, TILE_H + 2.6, BUILD_Z);
    cg.add(obj);
    m.building = obj;
    sfx('build');
    await dropIn(obj, def.board * BUILD_SCALE, o.owner.hex, cg);
  }
  refreshMarks(i);
  if (focus && !G) { await sleep(450); backToBoard(); }
}

// ---------------------------------------------------------------------------
// Warstwa gry: duże komunikaty, okna wyboru, okno pytania
// ---------------------------------------------------------------------------
const layer = $('gLayer');
function banner(title, sub = '', color = '', ms = 1700) {
  layer.querySelectorAll('.g-banner-wrap').forEach(el => el.remove());
  const wrap = document.createElement('div');
  wrap.className = 'g-banner-wrap';
  wrap.setAttribute('role', 'status');
  wrap.innerHTML = `<div class="g-banner"${color ? ` style="--bc:${color}"` : ''}><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
  layer.append(wrap);
  return new Promise(r => setTimeout(() => {
    wrap.firstElementChild.classList.add('out');
    setTimeout(() => { wrap.remove(); r(); }, 240);
  }, ms));
}
// menu: okno w trakcie gry ma własny przycisk Menu (okno zasłania przycisk w panelu), bez niego tylko pauza i koniec gry
function openModal(html, cls = '', menu = true) {
  const bd = document.createElement('div');
  bd.className = 'g-backdrop';
  bd.innerHTML = `<div class="m-card g-modal ${cls}" role="dialog" aria-modal="true">${html}</div>${menu && G && !G.over ? '<button type="button" class="m-btn m-secondary g-bd-menu" data-menu>Menu</button>' : ''}`;
  const mb = bd.querySelector('[data-menu]');
  if (mb) {
    mb.addEventListener('click', e => { e.stopPropagation(); pause(); });
    // na komputerze dokładnie w miejscu przycisku Menu z panelu (u góry); na telefonie panel jest na dole, więc róg ekranu
    const r = $('gMenuBtn').getBoundingClientRect(), st = stage.getBoundingClientRect(), z = prefs.scale || 1;
    if (r.width && r.top - st.top < 120) Object.assign(mb.style, { left: `${(r.left - st.left) / z}px`, top: `${(r.top - st.top) / z}px`, width: `${r.width / z}px`, height: `${r.height / z}px`, right: 'auto' });
  }
  layer.append(bd);
  return bd;
}
// Okno z przyciskami: gracz przy tym komputerze klika, a przy decyzji bota okno tylko pokazuje, co wybrał
function chooseModal(d, pick) {
  const label = o => (o.cell != null ? fieldLabel(o.cell) : fmt(o.label));
  const bd = openModal(`<h2>${fmt(d.title)}</h2>${d.text ? `<p>${fmt(d.text)}</p>` : ''}
    <div class="g-opts${d.two ? ' two' : ''}">${d.options.map((o, k) =>
      `<button type="button" class="m-btn ${o.primary ? 'm-primary' : 'm-secondary'}" data-k="${k}"${o.disabled ? ' disabled' : ''}>${label(o)}</button>`).join('')}</div>`);
  if (pick) {
    bd.addEventListener('click', e => {
      const b = e.target.closest('[data-k]');
      if (b && !b.disabled) pick(d.options[+b.dataset.k].value, bd);
    });
    requestAnimationFrame(() => bd.querySelector('.m-btn:not(:disabled)')?.focus());
  }
  return bd;
}
const fieldLabel = i => {
  const o = G.own.get(i);
  const lvl = o && FIELDS[i].type === 'room' ? (o.level ? ` · ${BUILDINGS[o.level - 1].name.toLowerCase()}` : ' · bez budynku') : '';
  return `${escHtml(fname(i))}${o ? ` <small>(${escHtml(o.owner.name)}${lvl}${o.shield ? ' · tarcza' : ''})</small>` : ''}`;
};

let qBackUrl = null;
function questionBackUrl() {   // tył karty z pytaniem: granat, logo i znak zapytania
  if (!qBackUrl) {
    const [c, g] = makeCanvas(420, 588);
    const grad = g.createLinearGradient(0, 0, 0, 588);
    grad.addColorStop(0, '#0B348F'); grad.addColorStop(1, UNI_NAVY);
    g.fillStyle = grad; g.fillRect(0, 0, 420, 588);
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 10; g.strokeRect(22, 22, 376, 544);
    g.lineWidth = 3; g.strokeRect(38, 38, 344, 512);
    if (!drawLogoInk(g, 210, 210, 92, '#FFFFFF')) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(210, 210, 70, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#FFFFFF'; g.font = `700 150px ${UI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('?', 210, 420);
    qBackUrl = c.toDataURL('image/jpeg', 0.9);
  }
  return qBackUrl;
}
async function shuffleAnim(title) {
  const url = questionBackUrl();
  const bd = openModal(`<h2>${title}</h2><p>Talia się skończyła. Pytania dostają nową, losową kolejność.</p>
    <div class="g-shuffle" aria-hidden="true">${'<img alt="" src="' + url + '">'.repeat(4)}</div>`);
  sfx('card');
  await sleep(1300); sfx('card');
  await sleep(900);
  bd.remove();
}

// Okno pytania z minutnikiem. Odpowiedź sprawdza silnik (przeglądarka nie zna dobrej odpowiedzi);
// wynik przychodzi w zdarzeniu „answered”.
function questionModal(d, p, pick) {
  const q = d.question, gone = d.gone;
  const cat = q.dziekanat ? 'Pytanie dziekanatu' : q.sem ? `Semestr ${q.sem}${q.przedmiot ? ` · ${escHtml(q.przedmiot)}` : ''}` : 'Pytanie';
  const catColor = q.dziekanat ? '#B8862B' : window.KartyPytan?.SEMESTRY?.[q.sem]?.kolor || '#2F7FF0';
  const bd = openModal(`
    <div class="g-q-head"><span class="g-cat" style="--c:${catColor}">${cat}</span>
      <span class="g-time"><i></i><span class="g-tleft">1:00</span></span></div>
    <p class="g-ctx">${avatar(p.pawnIdx, p.colorIdx).replace('m-avatar', 'm-avatar g-mini')} <b>${escHtml(p.name)}</b>${d.context ? ` · ${fmt(d.context)}` : ''}</p>
    <p class="g-qtext">${escHtml(q.q)}</p>
    ${gone.length ? '<p class="g-note">Notatki od kolegi: 2 złe odpowiedzi znikają.</p>' : ''}
    <div class="g-ans">${q.a.map((a, k) => `<button type="button" data-a="${k}"${gone.includes(k) ? ' class="is-gone" disabled' : ''}><b>${'ABCD'[k]}</b>${escHtml(a)}</button>`).join('')}</div>
    <p class="g-res" aria-live="polite">${pick ? '' : `${escHtml(p.name)} się zastanawia…`}</p>`, 'wide');
  const timeEl = bd.querySelector('.g-time');
  let left = d.seconds;
  const show = () => {
    timeEl.querySelector('.g-tleft').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    timeEl.style.setProperty('--left', `${(left / d.seconds) * 100}%`);
    timeEl.classList.toggle('is-low', left <= 10);
  };
  show();
  const ui = { id: d.id, kind: 'answer', bd, timer: null, done: false };
  const finish = k => { if (ui.done) return; ui.done = true; clearInterval(ui.timer); pick?.(k); };
  ui.timer = setInterval(() => {
    if (!G || G.paused) return;
    left = Math.max(0, left - 1); show();
    if (left <= 0) { clearInterval(ui.timer); if (pick) finish(null); }
  }, 1000);
  if (pick) {
    bd.addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (b && !b.disabled) finish(+b.dataset.a);
    });
  }
  return ui;
}
async function showAnswer(ev) {
  sfx(ev.correct ? 'good' : 'bad');
  const ui = openUi && openUi.kind === 'answer' ? openUi : null;
  if (!ui) return;
  clearInterval(ui.timer);
  ui.bd.querySelectorAll('[data-a]').forEach((b, k) => {
    b.disabled = true;
    if (k === ev.picked) b.classList.add(ev.correct ? 'is-good' : 'is-bad');
  });
  ui.bd.querySelector('.g-res').textContent = ev.correct ? 'Dobrze!' : ev.picked === null ? 'Czas minął.' : 'Niestety źle.';
  await sleep(1300);
  ui.bd.remove();
  if (openUi === ui) openUi = null;
}

// ---------------------------------------------------------------------------
// Pieniądze
// ---------------------------------------------------------------------------
// Wartości z zasad gry (src/core/rules.ts), liczone na stanie z ostatniego zdarzenia
const fieldValue = i => R.fieldValue(G.snap, i);
const wealth = p => R.wealth(G.snap, p.idx);
const hasMonopoly = (p, group) => R.hasMonopoly(G.snap, p.idx, group);
const rentOf = i => R.rentOf(G.snap, i);

// ---------------------------------------------------------------------------
// Karty ułatwień i utrudnień
// ---------------------------------------------------------------------------
// Karta unosi się ze stosu na planszy
function liftCard(kind) {
  const deck = DECKS[kind === 'bonus' ? 0 : 1];
  const card = mesh(cardGeo, cardEdgeMats[0], true, false);
  const face = mesh(cardFaceGeo, deckFaces[kind === 'bonus' ? 0 : 1].material, false, false);
  face.position.y = 0.0075;
  card.add(face);
  card.position.set(deck.x, CENTER_Y + 0.2, deck.z);
  card.rotation.y = deck.rotY;
  board.add(card);
  sfx('card');
  // karta wyskakuje ze stosu, obraca się w locie i błyska folią
  const pose = (o, t) => {
    const e = easeOut3(Math.max(0, t));
    o.position.set(deck.x, CENTER_Y + 0.2 + 2.8 * e, deck.z);
    o.rotation.set(-1.25 * e, deck.rotY + Math.PI * 2 * e, 0.25 * Math.sin(Math.PI * Math.max(0, t)));
    o.scale.setScalar(1 + 0.45 * e);
  };
  // rozmycie ruchu: trzy półprzezroczyste kopie karty o chwilę z tyłu; znikają, gdy obrót zwalnia
  const ghosts = reduceMotion ? [] : [0.035, 0.07, 0.105].map((lag, k) => {
    const em = cardEdgeMats[0].clone(), fm = face.material.clone();
    for (const m of [em, fm]) { m.transparent = true; m.depthWrite = false; m.opacity = 0; }
    const o = mesh(cardGeo, em, false, false), f = mesh(cardFaceGeo, fm, false, false);
    f.position.y = 0.0075;
    o.add(f);
    o.renderOrder = 2;
    board.add(o);
    return { o, lag, mats: [em, fm], base: 0.34 - k * 0.09 };
  });
  return tween(reduceMotion ? 100 : 760, t => {
    pose(card, t);
    const speed = Math.min(1, 3 * (1 - t) ** 2);   // pochodna easeOut3: szybki obrót na początku lotu
    for (const g of ghosts) {
      pose(g.o, t - g.lag);
      for (const m of g.mats) m.opacity = g.base * speed;
    }
  }).then(() => {
    board.remove(card);
    for (const g of ghosts) { board.remove(g.o); g.mats.forEach(m => m.dispose()); }
  });
}
let cardUid = 0;
function cardSvg(card) {
  cardUid += 1;
  return card.exit != null ? exitCardSVG(EXIT_CARDS[card.exit], card.exit, `g${cardUid}`) : actionCardSVG(card, card.kind, `g${cardUid}`);
}
function cardModal(d, p, pick) {
  const card = d.card;
  const back = cardBackUrl(card.kind === 'bonus' ? 'ulatwienia' : 'utrudnienia');
  const bd = openModal(`<h2>${card.kind === 'bonus' ? 'Ułatwienie' : 'Utrudnienie'} dla: ${escHtml(p.name)}</h2>
    <div class="g-card-show"><div class="flip static flipped"><span class="flip-inner"><span class="face front">${cardSvg(card)}</span><span class="face back"><img class="face-img" src="${back}" alt=""></span></span></div></div>
    ${pick ? '<div class="g-opts"><button type="button" class="m-btn m-primary" data-ok>Dalej</button></div>' : ''}`);
  setTimeout(() => { bd.querySelector('.flip')?.classList.remove('flipped'); sfx('card'); }, 250);
  if (pick) bd.querySelector('[data-ok]').addEventListener('click', () => pick(null, bd));
  return bd;
}

// ---------------------------------------------------------------------------
// Dziekanat
// ---------------------------------------------------------------------------
async function animateJail(p, title, sub) {
  const a = p.obj.position.clone(), b = spotPos(JAIL_CELL, p.idx);
  const r0 = p.obj.rotation.y, r1 = turnTo(p, cellPose(JAIL_CELL).rotY);
  shake(0.18, 450);
  await banner(fmt(title), fmt(sub), '#D6534F', 1500);
  await tween(reduceMotion ? 100 : 900, t => {
    p.obj.position.lerpVectors(a, b, easeInOut(t));
    p.obj.position.y = TILE_H + 2.6 * Math.sin(Math.PI * t);
    p.obj.rotation.y = r0 + (r1 - r0) * t;
  });
  sfx('bad');
}

// ---------------------------------------------------------------------------
// Ruch i pola
// ---------------------------------------------------------------------------
function rollButton(onRoll) {
  const b = $('gRoll');
  b.hidden = false;
  b.innerHTML = `${diceIco}Rzuć kostkami`;
  b.onclick = () => { b.hidden = true; b.onclick = null; $('gTip').hidden = true; audio(); onRoll(); };
  b.focus();
}
const diceIco = icon('dice');

// ---------------------------------------------------------------------------
// Odtwarzanie zdarzeń silnika: po kolei, z animacjami; pauza zatrzymuje kolejkę
// ---------------------------------------------------------------------------
let openUi = null;   // okno bieżącej decyzji: { id, kind, bd, d }
const moneyEnd = x => (typeof x === 'number' ? G.players[x] : x === 'pool' ? 'pool' : x && x.cell != null ? cellTarget(x.cell).setY(0.4) : null);
// Statystyki do ekranu końca gry: majątek po każdej turze (wykres) i to, co zrobił gracz „Ty” (osiągnięcia)
function trackStats(g, ev) {
  g.hist ??= [];
  g.mine ??= { monopoly: false, hotel: false, doubles: 0, jailEscapes: 0, inJail: false };
  if (ev.type === 'turn' || !g.hist.length) g.hist.push(g.players.map(p => (p.out ? 0 : wealth(p))));
  collectMoment(g, ev);
  const me = g.players.find(p => p.kind === 'me');
  if (!me) return;
  const p = ev.player != null ? g.players[ev.player] : null, m = g.mine;
  if (ev.type === 'bought' && p === me && ev.monopoly) m.monopoly = true;
  if (ev.type === 'hotel' && g.own.get(ev.cell)?.owner === me) m.hotel = true;
  if (ev.type === 'dice' && p === me && ev.a === ev.b) m.doubles += 1;
  if (me.jail > 0) m.inJail = true;
  else if (m.inJail && !me.out) { m.inJail = false; m.jailEscapes += 1; }
}
// Najlepsze momenty do powtórki po grze (wybór w src/ui/moments.js)
function collectMoment(g, ev) {
  g.moments ??= [];
  const add = (cell, title, sub, color, score) => g.moments.push({ seq: g.moments.length, cell, title: escHtml(title), sub: escHtml(sub), color, score });
  const pl = k => g.players[k];
  if (ev.type === 'bought' && ev.monopoly) { const p = pl(ev.player); add(ev.cell, `Monopol: ${p.name}`, `${FIELDS[ev.cell].name} i cała jej grupa`, p.hex, 80); }
  else if (ev.type === 'hotel') { const o = g.own.get(ev.cell)?.owner; if (o) add(ev.cell, `Serwerownia: ${o.name}`, FIELDS[ev.cell].name, o.hex, 90); }
  else if (ev.type === 'money' && typeof ev.from === 'number' && typeof ev.to === 'number' && ev.amount >= 40) {
    const a = pl(ev.from), b = pl(ev.to);
    add(a.pos, `${money(ev.amount)} dla gracza ${b.name}`, `Płaci ${a.name}`, b.hex, rentScore(ev.amount));
  } else if (ev.type === 'poolTaken' && ev.amount >= 50) { const p = pl(ev.player); add(p.pos, `Pula: ${money(ev.amount)}`, `Zgarnia ${p.name}`, p.hex, poolScore(ev.amount)); }
  else if (ev.type === 'bankrupt') { const p = pl(ev.player); add(p.pos, `Bankructwo: ${p.name}`, FIELDS[p.pos].name, p.hex, 85); }
  else if (ev.type === 'jail') { const p = pl(ev.player); add(JAIL_CELL, `Dziekanat: ${p.name}`, 'Pionek trafia do dziekanatu', p.hex, 30); }
}
// Powtórka: okno wyniku się chowa, kamera przelatuje nad polami najlepszych momentów z podpisem, potem wraca
async function playMoments(g, bd) {
  const list = pickMoments(g.moments || []);
  if (!list.length || G !== g) return;
  bd.style.display = 'none';
  document.body.classList.add('replay-mode');
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'm-btn m-secondary g-replay-skip';
  skip.textContent = 'Pomiń';
  let stop = false;
  skip.addEventListener('click', () => { stop = true; skip.disabled = true; });
  layer.append(skip);
  const back = [camera.position.clone(), controls.target.clone()];
  const dir0 = back[0].clone().sub(back[1]).normalize();
  cineActive = true;
  try {
    for (const [k, m] of list.entries()) {
      if (stop || G !== g) break;
      const t = cellTarget(m.cell).setY(0.3);
      const dir = dir0.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), k % 2 ? 0.35 : -0.35);
      await flyTo([t.clone().add(dir.multiplyScalar(boardDist() * 0.5)), t], 900);
      if (stop || G !== g) break;
      await banner(m.title, `${m.sub} · ${k + 1} z ${list.length}`, m.color, 1900);
    }
  } finally {
    cineActive = false;
    skip.remove();
  }
  if (G !== g) return;
  await flyTo(back, 800);
  document.body.classList.remove('replay-mode');
  bd.style.display = '';
}
async function pump(g) {
  if (g.pumping) return;
  g.pumping = true;
  try {
    while (G === g && g.queue.length) {
      while (G === g && g.paused) await sleep(150);
      if (G !== g) return;
      const ev = g.queue.shift();
      applySnap(ev.snap);
      renderHud();
      trackStats(g, ev);
      if (ev.type === 'bought' && isLocalHuman(g.players[ev.player])) tip('bought');
      try { await playEvent(ev); } catch (e) { console.error(e); }
    }
  } finally { g.pumping = false; }
}
async function playEvent(ev) {
  const p = ev.player != null ? G.players[ev.player] : null;
  switch (ev.type) {
    case 'notice': return banner(fmt(ev.title), fmt(ev.sub), ev.color || '', ev.ms ?? 1700);
    case 'status': setStatus(ev.text); return;
    case 'turn': if (isLocalHuman(p)) setViewer(p); return;
    case 'dice': await throwDice(ev.a, ev.b, 1, { physics: true, seed: ev.seq * 7919 + ev.a * 13 + ev.b }); shake(0.07, 260); return;
    case 'step': return hop(p, ev.from, ev.to);
    case 'landed': fxRing(p.obj.position, p.hex, 0.9); return;
    case 'jail': return animateJail(p, ev.title, ev.sub);
    case 'money':
      sfx('coin');
      fxTransfer(moneyEnd(ev.from), moneyEnd(ev.to), ev.amount);
      if (ev.from?.cell === START_CELL) fxRing(cellTarget(START_CELL), GOLD, 1.5);
      return;
    case 'poolTaken': if (ev.amount) fxConfetti(POOL_AT.clone(), [GOLD, '#FFFFFF', p.hex], 120, 0.8); return;
    case 'bought':
      refreshMarks(ev.cell);
      pawnJoy(p);
      fxRing(cellTarget(ev.cell), p.hex, 1.4);
      fxText(cellTarget(ev.cell).setY(1.6), 'KUPIONE', '#FFFFFF', 0.75);
      if (ev.monopoly) fxMonopoly(p, FIELDS[ev.cell].group);
      return cineCell(ev.cell);
    case 'level': case 'owner': return showLevel(ev.cell, false);
    case 'marks': refreshMarks(ev.cell); return;
    case 'hotel': {
      const o = G.own.get(ev.cell);
      fxConfetti(cellTarget(ev.cell).setY(0.8), [o ? o.owner.hex : GOLD, GOLD, '#FFFFFF'], 110, 0.7);
      shake(0.1, 350);
      return cineCell(ev.cell);
    }
    case 'cardDrawn': return liftCard(ev.kind);
    case 'shuffle': return shuffleAnim(ev.deck === 'dziekanat' ? 'Tasowanie pytań dziekanatu' : 'Tasowanie pytań');
    case 'decision': showDecision(ev.decision); return;
    case 'decided': return closeDecision(ev);
    case 'answered': return showAnswer(ev);
    case 'bankrupt': shake(0.25, 600); fxRing(p.obj.position, '#5B6475', 2); return pawnSad(p).then(() => shrinkOut(p.obj, board));
    case 'over': return showEnd(ev.result);
  }
}
// Najazd kamery na kupione pole (i na hotel): kamera podjeżdża z tego samego kierunku, chwilę patrzy
// z bliska (ostrość na polu, reszta planszy miękko rozmyta) i wraca tam, gdzie była. Wyłączane w Ustawieniach.
let cineActive = false;
async function cineCell(cell) {
  if (!prefs.cine || reduceMotion || view !== 'board' || P.on || !G || menuOpen) return;
  const g = G, back = [camera.position.clone(), controls.target.clone()];
  const t = cellTarget(cell).setY(0.3);
  const dir = camera.position.clone().sub(controls.target).normalize();
  cineActive = true;
  try {
    await flyTo([t.clone().add(dir.multiplyScalar(boardDist() * 0.4)), t], 650);
    await sleep(750);
    if (G !== g) return;
    await flyTo(back, 650);
  } finally { cineActive = false; }
}

// Decyzja: gracz przy tym komputerze dostaje przyciski; przy bocie okno pokazuje, co bot robi
function showDecision(d) {
  const g = G, p = g.players[d.player], mine = isLocalHuman(p);
  const submit = v => { if (G === g) g.driver.submit(d.id, v); };
  const done = (v, bd) => { bd.remove(); if (openUi?.id === d.id) openUi = null; submit(v); };
  if (mine && photo) exitPhoto();   // decyzja gracza: tryb zdjęć się zamyka (gra online nie czeka)
  if (d.kind === 'roll') {
    if (mine) { rollButton(() => submit(null)); tip(prefs.tipsSeen.includes('roll') ? 'menu' : 'roll'); }
  } else if (d.kind === 'choose') {
    openUi = { id: d.id, kind: 'choose', d, bd: chooseModal(d, mine ? done : null) };
    if (mine && /^Wolne pole/.test(d.title)) tipIn(openUi.bd, 'buy');
  } else if (d.kind === 'answer') {
    openUi = questionModal(d, p, mine ? k => submit(k) : null);
    if (mine) tipIn(openUi.bd, 'answer');
  } else if (d.kind === 'ack') {
    openUi = { id: d.id, kind: 'ack', d, bd: cardModal(d, p, mine ? done : null) };
    if (mine) tipIn(openUi.bd, 'card');
  }
  g.driver.ready(d.id);
}

// ---------------------------------------------------------------------------
// Samouczek: src/ui/tips.js (podpowiedzi przy pierwszych grach)
const tips = createTips({ prefs, save: savePrefs, layer, el: { box: $('gTip'), title: $('gTipTitle'), text: $('gTipText'), ok: $('gTipOk'), off: $('gTipOff') } });
const tip = id => tips.show(id), tipIn = (bd, id) => tips.inside(bd, id);

// ---------------------------------------------------------------------------
// Tryb zdjęć: panele znikają, kamerę można swobodnie obracać, przybliżać i przesuwać, a zdjęcie zapisuje się
// w 4K (3840 pikseli szerokości). W grze z komputerem gra stoi; online toczy się dalej.
// ---------------------------------------------------------------------------
let photo = null;   // zapamiętana kamera i ograniczenia sprzed trybu zdjęć
function enterPhoto(g) {
  if (photo) return;
  photo = { g, pos: camera.position.clone(), target: controls.target.clone(), minD: controls.minDistance, maxD: controls.maxDistance, polar: controls.maxPolarAngle, pan: controls.enablePan, zoom: controls.enableZoom };
  document.body.classList.add('photo-mode');
  $('gTip').hidden = true;
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  Object.assign(controls, { enabled: true, enablePan: true, enableZoom: true, minDistance: 1.5, maxDistance: 150, maxPolarAngle: 1.5 });
  $('photoHint').textContent = matchMedia('(pointer: coarse)').matches
    ? 'Przesuń palcem, żeby obrócić kamerę. Dwoma palcami przybliżasz i przesuwasz.'
    : 'Przeciągnij, żeby obrócić kamerę. Kółkiem myszy przybliżasz, a prawym przyciskiem przesuwasz.';
  $('photoBar').hidden = false;
  $('photoShot').focus();
}
function exitPhoto(resume = true) {
  if (!photo) return;
  const p = photo;
  photo = null;
  document.body.classList.remove('photo-mode');
  $('photoBar').hidden = true;
  Object.assign(controls, { enablePan: p.pan, enableZoom: p.zoom, minDistance: p.minD, maxDistance: p.maxD, maxPolarAngle: p.polar });
  applyView();
  if (!resume) return;
  flyTo([p.pos, p.target]);
  if (G === p.g && !p.g.online && !p.g.over) { p.g.paused = false; p.g.driver.pause(false); }
}
$('photoShot').addEventListener('click', async () => {
  const b = $('photoShot');
  b.disabled = true;
  try {
    const blob = await gfx.capture(3840);
    if (!blob) throw new Error('pusty obraz');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wsiz-tour-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    sfx('shutter');
    const f = $('photoFlash');
    f.classList.remove('is-on'); void f.offsetWidth; f.classList.add('is-on');
  } catch { toast('Nie udało się zapisać zdjęcia. Spróbuj niższej jakości grafiki w Ustawieniach.'); }
  b.disabled = false;
});
$('photoExit').addEventListener('click', () => exitPhoto());
// Escape: wyjście z trybu zdjęć; w grze otwiera i zamyka pauzę (także gdy otwarte jest okno decyzji)
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (photo) { exitPhoto(); return; }
  if (!G || G.over || menuOpen || !document.body.classList.contains('in-game')) return;
  const open = layer.querySelector('.g-pause [data-p="back"]');
  if (open) open.click();
  else pause();
});
async function closeDecision(ev) {
  $('gRoll').hidden = true;
  const ui = openUi;
  if (!ui || ui.id !== ev.id) return;
  if (ui.kind === 'answer') { clearInterval(ui.timer); return; }   // wynik pokaże zdarzenie „answered”
  openUi = null;
  if (ui.kind === 'choose') {
    const k = ui.d.options.findIndex(o => o.value === ev.value);
    ui.bd.querySelector(`[data-k="${k}"]`)?.classList.add('m-primary');
    await sleep(450);
  }
  ui.bd.remove();
}

// ---------------------------------------------------------------------------
// Panel gry (HUD)
// ---------------------------------------------------------------------------
function setStatus(text) {
  const el = $('gStatus');
  el.hidden = !text;
  el.textContent = text;
}
// ---------------------------------------------------------------------------
// Karty graczy: na planszy w rogu gracza (widać tył i liczbę), a u gracza w panelu „Twoje karty”
// ---------------------------------------------------------------------------
const cornerOf = p => p.slot;   // miejsce w menu = róg planszy
const findCard = (icon, kind) => {
  const list = kind === 'penalty' ? PENALTY_CARDS : BONUS_CARDS;
  return { ...list.find(c => c.icon === icon), kind };
};
// Karty, które gracz trzyma, i działające na niego efekty kart
function playerCards(p) {
  const out = p.cards.map(c => ({ card: c, note: 'do użycia' }));
  let shields = 0, off = 0;
  for (const [, o] of G.own) if (o.owner === p) { shields += o.shield || 0; if (o.off > 0) off += 1; }
  const tury = n => `${n} ${n === 1 ? 'tura' : n < 5 ? 'tury' : 'tur'}`;
  if (p.insured > 0) out.push({ card: findCard('shieldPerson', 'bonus'), note: tury(p.insured) });
  if (shields) out.push({ card: findCard('shieldRoom', 'bonus'), note: `tarcze: ${shields}` });
  if (p.skip > 0) out.push({ card: findCard('hourglass', 'penalty'), note: `traci: ${p.skip}` });
  if (off) out.push({ card: findCard('bulb', 'penalty'), note: `bez prądu: ${off}` });
  return out;
}
// Pieniądze i karty graczy leżą na stole obok planszy, w rogu gracza: paczki banknotów (po 100 zł),
// monety (po 10 zł) i karty ułatwień i utrudnień tyłem do góry. Każdy widzi, kto ile ma.
const NOTE = 100 * K, COIN = 10 * K;
const BUNDLE_W = 0.86, BUNDLE_D = 0.43, BUNDLE_H = 0.062;
const PILES = [[-1.35, 0], [-0.45, 0], [0.45, 0], [1.35, 0]];
function noteTexture() {
  const [c, g] = makeCanvas(512, 256);
  const bg = g.createLinearGradient(0, 0, 512, 256);
  bg.addColorStop(0, '#9ED9B4'); bg.addColorStop(1, '#5FB487');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 6; g.strokeRect(14, 14, 484, 228);
  g.strokeStyle = 'rgba(20,80,50,.35)'; g.lineWidth = 2;
  for (let k = 0; k < 18; k++) { g.beginPath(); g.arc(120, 128, 20 + k * 6, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(120, 128, 62, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1F6B45'; g.font = `700 54px ${UI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('100', 120, 120); g.font = `700 26px ${UI_FONT}`; g.fillText('zł', 120, 160);
  g.font = `700 70px ${UI_FONT}`; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillText('100', 390, 128);
  // banderola paczki: kremowy papier ze złotymi brzegami
  g.fillStyle = '#F6EED9'; g.fillRect(232, 0, 52, 256);
  g.fillStyle = GOLD; g.fillRect(232, 0, 4, 256); g.fillRect(280, 0, 4, 256);
  return tex(c);
}
const bundleTop = new THREE.MeshStandardMaterial({ map: noteTexture(), roughness: 0.75 });
const bundleSide = (() => {
  const [c, g] = makeCanvas(64, 16);
  for (let y = 0; y < 16; y++) { g.fillStyle = y % 2 ? '#E9F5EC' : '#B9DEC6'; g.fillRect(0, y, 64, 1); }
  g.fillStyle = '#F6EED9'; g.fillRect(27, 0, 10, 16);
  return new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.8 });
})();
const bundleGeo = new THREE.BoxGeometry(BUNDLE_W, BUNDLE_H, BUNDLE_D);
const bundleMats = [bundleSide, bundleSide, bundleTop, bundleSide, bundleSide, bundleSide];
const coinGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.045, 20);
const coinMat = mat(GOLD, { metalness: 0.75, roughness: 0.28 });
const miniCardGeo = new THREE.BoxGeometry(CARD_W * 0.36, 0.012, CARD_L * 0.36);
const miniFaceGeo = new THREE.PlaneGeometry(CARD_W * 0.36 - 0.02, CARD_L * 0.36 - 0.02);
const stashes = new Map();     // gracz -> { grp, bundles, coins, cards, cardSig }
let handSig = '';
function stashOf(p) {
  if (stashes.has(p)) return stashes.get(p);
  // gracz z rogu k ma swoje miejsce przy boku planszy, który zaczyna się w jego rogu
  const k = cornerOf(p), [sx, sz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][k];
  const grp = new THREE.Group();
  grp.position.set(sx * STASH_AT, -BASE_H, sz * STASH_AT);
  grp.rotation.y = -k * Math.PI / 2;    // lokalne x biegnie wzdłuż boku, z patrzy na zewnątrz
  const cards = new THREE.Group();
  cards.position.set(-2.75, 0, 0);
  grp.add(cards);
  board.add(grp);
  const st = { grp, bundles: [], coins: [], cards, cardSig: '' };
  stashes.set(p, st);
  return st;
}
const bundleSpot = j => { const [x, z] = PILES[j % 4]; return new THREE.Vector3(x, BUNDLE_H / 2 + Math.floor(j / 4) * BUNDLE_H, z); };
const coinSpot = j => new THREE.Vector3(2.25, 0.0225 + j * 0.045, 0);
// Nowe paczki spadają na stos, a zabrane podskakują i znikają
function dropOn(obj, at, delay) {
  obj.position.copy(at).add(new THREE.Vector3(0, 1.4, 0));
  obj.visible = false;
  return sleep(delay).then(() => {
    obj.visible = true;
    return tween(reduceMotion ? 60 : 380, t => {
      const e = t < 0.75 ? (t / 0.75) ** 2 : 1 - 0.18 * Math.sin(((t - 0.75) / 0.25) * Math.PI);
      obj.position.y = at.y + 1.4 * (1 - e);
    });
  });
}
function liftOff(obj, parent, delay) {
  const y0 = obj.position.y;
  return sleep(delay).then(() => tween(reduceMotion ? 60 : 320, t => {
    obj.position.y = y0 + 1.2 * t;
    obj.scale.setScalar(1 - t);
  })).then(() => parent.remove(obj));
}
function renderStash(p) {
  const st = stashOf(p);
  const cash = p.out ? 0 : Math.max(0, p.cash);
  const nb = Math.min(60, Math.floor(cash / NOTE)), nc = Math.floor((cash % NOTE) / COIN);
  let d = 0;
  while (st.bundles.length < nb) {
    const j = st.bundles.length, b = new THREE.Mesh(bundleGeo, bundleMats);
    b.castShadow = true; b.receiveShadow = true;
    b.rotation.y = (Math.sin(j * 12.9898) * 0.5) * 0.08;
    st.grp.add(b); st.bundles.push(b);
    dropOn(b, bundleSpot(j), (d++) * 45);
  }
  d = 0;
  while (st.bundles.length > nb) liftOff(st.bundles.pop(), st.grp, (d++) * 35);
  while (st.coins.length < nc) {
    const j = st.coins.length, c = new THREE.Mesh(coinGeo, coinMat);
    c.castShadow = true;
    st.grp.add(c); st.coins.push(c);
    dropOn(c, coinSpot(j), j * 30);
  }
  while (st.coins.length > nc) liftOff(st.coins.pop(), st.grp, 0);
  // karty: tyłem do góry, wachlarzem
  const list = p.demo ? p.demoCards : p.out ? [] : playerCards(p).slice(0, 7);
  const sig = list.map(x => x.card.kind[0]).join('');
  if (sig !== st.cardSig) {
    st.cardSig = sig;
    st.cards.clear();
    list.forEach((x, j) => {
      const card = mesh(miniCardGeo, cardEdgeMats[0], true, true);
      const face = mesh(miniFaceGeo, deckFaces[x.card.kind === 'bonus' ? 0 : 1].material, false, false);
      face.rotation.x = -Math.PI / 2; face.position.y = 0.0065;
      card.add(face);
      const off = j - (list.length - 1) / 2;
      card.position.set(off * 0.27, 0.008 + j * 0.013, Math.abs(off) * 0.05);
      card.rotation.y = -off * 0.12;
      st.cards.add(card);
    });
  }
}
function clearHands() {
  for (const st of stashes.values()) board.remove(st.grp);   // bryły paczek i monet są wspólne, nie zwalniamy ich
  stashes.clear();
  handSig = '';
}
function renderHands() {
  if (!G) return;
  for (const p of G.players) renderStash(p);
}

// ---------------------------------------------------------------------------
// Efekty w grze: lecące paczki banknotów i monety, kwoty nad pionkami, fale na polach,
// konfetti przy monopolu i wygranej, drżenie kamery przy mocnych zdarzeniach
// ---------------------------------------------------------------------------
const fxLayer = new THREE.Group();   // efekty chwilowe (w studiu prezentacji są ukryte)
scene.add(fxLayer);
const BANK_AT = new THREE.Vector3(0, 9, 0);     // bank: pieniądze spadają z nieba i tam odlatują
const POOL_AT = new THREE.Vector3(0, 0.3, 0);   // pula leży na środku planszy
function moneyPoint(x) {
  if (x === 'pool') return POOL_AT.clone();
  if (x instanceof THREE.Vector3) return x.clone();
  if (x && x.idx !== undefined) {
    const st = stashOf(x);
    st.grp.updateWorldMatrix(true, false);
    return st.grp.localToWorld(new THREE.Vector3(0, 0.5, 0));
  }
  return BANK_AT.clone();
}
function fxTransfer(from, to, amount) {
  if (amount <= 0) return;
  const a = moneyPoint(from), b = moneyPoint(to);
  const big = amount >= NOTE;
  const n = Math.max(2, Math.min(9, Math.round(amount / NOTE)));
  const h = 2.2 + a.distanceTo(b) * 0.2;
  for (let k = 0; k < n; k++) {
    const obj = big ? new THREE.Mesh(bundleGeo, bundleMats) : new THREE.Mesh(coinGeo, coinMat);
    obj.castShadow = true;
    obj.visible = false;
    fxLayer.add(obj);
    const spin = (Math.random() - 0.5) * 9;
    const jit = new THREE.Vector3((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9);
    sleep(k * 75).then(() => {
      obj.visible = true;
      return tween(reduceMotion ? 150 : 760, t => {
        const e = easeInOut(t);
        obj.position.lerpVectors(a, b, e).addScaledVector(jit, Math.sin(Math.PI * t));
        obj.position.y += h * Math.sin(Math.PI * t);
        obj.rotation.set(spin * t * 0.35, spin * t, spin * t * 0.2);
        obj.scale.setScalar(Math.max(0.01, Math.min(1, t / 0.12, (1 - t) / 0.12)));
      });
    }).then(() => fxLayer.remove(obj));
  }
}
function textSprite(text, color, size) {
  const [c, g] = makeCanvas(640, 140);
  g.font = `700 84px ${UI_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 18; g.strokeStyle = 'rgba(8,18,44,.82)';
  g.strokeText(text, 320, 74);
  g.fillStyle = color; g.fillText(text, 320, 74);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthTest: false, depthWrite: false }));
  sp.renderOrder = 20;
  sp.scale.set(size * 4.57, size, 1);
  return sp;
}
// Emotki w grze online: napis nad pionkiem gracza (wszyscy w pokoju widzą to samo)
const EMOTES = ['Brawo', 'Ups', 'Hej', 'Szybciej', 'Dobra gra'];
function showEmote(player, k) {
  const p = G?.players[player];
  if (!p || p.out || !EMOTES[k]) return;
  fxText(p.obj.position.clone().add(V3(0, 1.7, 0)), EMOTES[k], p.hex, 0.62);
  sfx('click');
}
// Licznik widzów gry online (u widza z napisem, że ogląda)
function renderWatchers() {
  const el = $('gWatch'), n = NET?.lobby?.watchers || 0;
  el.hidden = !G?.online || (!n && !G.spectator);
  el.innerHTML = G?.spectator ? `Oglądasz <small>widzowie: ${n}</small>` : `Widzowie <small>${n}</small>`;
}
function renderEmotes() {
  const box = $('gEmotes');
  box.hidden = !G?.online || !!G.spectator;
  if (box.hidden || box.childElementCount) return;
  box.innerHTML = EMOTES.map((e, k) => `<button type="button" class="chip" data-emote="${k}">${e}</button>`).join('');
}
$('gEmotes').addEventListener('click', e => {
  const b = e.target.closest('[data-emote]');
  if (!b || !NET?.client || b.disabled) return;
  NET.client.emote(+b.dataset.emote);
  $('gEmotes').querySelectorAll('button').forEach(x => { x.disabled = true; });
  setTimeout(() => $('gEmotes').querySelectorAll('button').forEach(x => { x.disabled = false; }), 1600);
});
function fxText(pos, text, color = '#FFFFFF', size = 0.8) {
  const sp = textSprite(text, color, size);
  sp.position.copy(pos);
  fxLayer.add(sp);
  const y0 = pos.y;
  return tween(reduceMotion ? 900 : 1800, t => {
    sp.position.y = y0 + 1.4 * easeOut3(t);
    const pop = t < 0.12 ? 0.5 + 0.7 * Math.sin((t / 0.12) * Math.PI * 0.5) : 1 + 0.2 * Math.max(0, 1 - (t - 0.12) * 8);
    sp.scale.set(size * 4.57 * pop, size * pop, 1);
    sp.material.opacity = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
  }).then(() => { fxLayer.remove(sp); sp.material.map.dispose(); sp.material.dispose(); });
}
function fxRing(pos, color, scale = 1) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(ringGeo, m);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(pos).setY(TILE_H + 0.03);
  fxLayer.add(ring);
  return tween(reduceMotion ? 200 : 800, t => {
    ring.scale.setScalar(scale * (0.6 + 3.2 * easeOut3(t)));
    m.opacity = 0.95 * (1 - t);
  }).then(() => { fxLayer.remove(ring); m.dispose(); });
}
const confGeo = new THREE.PlaneGeometry(0.24, 0.14);
function fxConfetti(pos, colors = [GOLD, '#FFFFFF', '#2F7FF0', '#E5484D', '#1FA463', '#F2B72E'], n = 150, power = 1) {
  if (reduceMotion) return Promise.resolve();
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
  const im = new THREE.InstancedMesh(confGeo, m, n);
  im.frustumCulled = false;
  const col = new THREE.Color(), parts = [];
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, sp = (1.2 + Math.random() * 3.2) * power;
    parts.push({ vx: Math.cos(a) * sp, vy: (5 + Math.random() * 6) * power, vz: Math.sin(a) * sp, rx: Math.random() * 9, ry: Math.random() * 9, ph: Math.random() * 6 });
    im.setColorAt(k, col.set(colors[k % colors.length]));
  }
  im.position.copy(pos);
  fxLayer.add(im);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const dur = 3000;
  return tween(dur, t => {
    const s = (t * dur) / 1000, drag = (1 - Math.exp(-s * 2.2)) / 2.2;
    const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
    for (let k = 0; k < n; k++) {
      const pt = parts[k];
      p.set(pt.vx * drag + 0.25 * Math.sin(s * 4 + pt.ph), pt.vy * drag - 1.5 * s, pt.vz * drag + 0.25 * Math.cos(s * 3.5 + pt.ph));
      e.set(pt.rx * s, pt.ry * s, 0);
      q.setFromEuler(e);
      m4.compose(p, q, sc.setScalar(fade));
      im.setMatrixAt(k, m4);
    }
    im.instanceMatrix.needsUpdate = true;
  }).then(() => { fxLayer.remove(im); im.dispose(); m.dispose(); });
}
// Drżenie kamery: dodawane tylko na czas rysowania klatki
let shakeUntil = 0, shakeDur = 1, shakeAmp = 0;
const shakeOff = new THREE.Vector3();
function shake(amp = 0.15, dur = 350) {
  if (reduceMotion) return;
  shakeAmp = amp; shakeDur = dur; shakeUntil = performance.now() + dur;
}
function shakeOffset(now) {
  if (now >= shakeUntil) return null;
  const k = ((shakeUntil - now) / shakeDur) * shakeAmp;
  return shakeOff.set((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k);
}
function fxMonopoly(p, group) {
  const cells = GROUP_CELLS[group];
  cells.forEach((i, k) => sleep(k * 180).then(() => { burst(cellGroups[i], p.hex); fxRing(cellTarget(i), p.hex, 1.3); }));
  const c = cells.reduce((v, i) => v.add(cellTarget(i)), new THREE.Vector3()).multiplyScalar(1 / cells.length);
  fxConfetti(c.setY(0.6), [p.hex, GOLD, '#FFFFFF'], 130, 0.8);
  fxText(c.clone().setY(2.6), 'MONOPOL', GOLD, 1.1);
  shake(0.12, 400);
  sfx('fanfare');
}
// Zmiana gotówki: kwota leci nad pionkiem, a karta gracza w panelu mruga na zielono albo czerwono
function cashFx(p, delta) {
  if (!delta) return;
  const up = delta > 0;
  fxText(p.obj.position.clone().add(new THREE.Vector3(0, 1.9, 0)), `${up ? '+' : '−'}${money(Math.abs(delta))}`, up ? '#5BE39A' : '#FF7A75', 0.62);
}
// Panel „Twoje karty” na dole ekranu: akty własności i karty ułatwień i utrudnień gracza
let handPanelSig = '';
let handClosed = true;
function renderHandPanel() {
  const el = $('gHand');
  if (!G) { el.innerHTML = ''; handPanelSig = ''; return; }
  const me = viewerPlayer();
  if (!me) return;
  const deeds = DEED_CELLS.filter(i => G.own.get(i)?.owner === me);
  const cards = playerCards(me);
  const sig = [me.idx, handClosed, deeds.join(','), cards.map(x => `${x.card.name}:${x.note}`).join(',')].join('|');
  if (sig === handPanelSig) return;
  handPanelSig = sig;
  el.classList.toggle('is-closed', handClosed);
  el.style.setProperty('--c', me.hex);
  el.innerHTML = `<div class="g-hand-head"><b>Twoje karty</b><span>${escHtml(me.name)} · pola: ${deeds.length} · karty: ${cards.length}</span>
      <button type="button" data-toggle aria-expanded="${!handClosed}">${handClosed ? 'Pokaż' : 'Zwiń'}</button></div>
    <div class="g-hand-row"><h4>Akty własności</h4><div class="g-thumbs">${deeds.length ? deeds.map(i => `<button class="g-thumb" type="button" data-deed="${i}" aria-label="${escHtml(FIELDS[i].name)}">${deedSVG(i)}<small>${escHtml(FIELDS[i].name)}</small></button>`).join('') : '<span class="g-empty">Nie masz jeszcze pól.</span>'}</div></div>
    <div class="g-hand-row"><h4>Ułatwienia i utrudnienia</h4><div class="g-thumbs">${cards.length ? cards.map((x, k) => `<button class="g-thumb" type="button" data-card="${k}" aria-label="${escHtml(x.card.name)}">${cardSvg(x.card)}<small>${escHtml(x.note)}</small></button>`).join('') : '<span class="g-empty">Brak kart i efektów.</span>'}</div></div>`;
  el.querySelector('[data-toggle]').addEventListener('click', () => { handClosed = !handClosed; renderHandPanel(); });
  el.querySelectorAll('[data-deed]').forEach(b => b.addEventListener('click', () => openFieldInfo(+b.dataset.deed)));
  el.querySelectorAll('[data-card]').forEach(b => b.addEventListener('click', () => {
    const x = cards[+b.dataset.card];
    const kind = x.card.kind === 'bonus' ? 'Ułatwienie' : 'Utrudnienie';
    openPopup(`<div class="fp-card">${cardSvg(x.card)}</div><div class="fp-body"><h2>${escHtml(x.card.name)}</h2><p class="fp-sub">${kind} · ${escHtml(x.note)}</p><p class="fp-text">${escHtml(x.card.text || 'Użyjesz jej, żeby wcześniej wyjść z dziekanatu.')}</p></div>`, true, x.card.name);
  }));
}
// Ekran patrzy z perspektywy gracza: jego róg planszy jest na dole
function setViewer(p) {
  if (!G || !p) return;
  G.view = p.idx;
  handPanelSig = '';
  renderHandPanel();
}

// Liczniki pieniędzy przewijają się do nowej kwoty
function countMoney(el, from, to) {
  const tok = (el._tok = (el._tok || 0) + 1), t0 = performance.now(), dur = reduceMotion ? 1 : 750;
  const step = now => {
    if (el._tok !== tok) return;
    const t = Math.min(1, (now - t0) / dur);
    el.textContent = money(from + (to - from) * easeOut3(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// Karty graczy budujemy raz, a potem zmieniamy tylko to, co się zmieniło (dzięki temu działają animacje)
function renderPlayers() {
  const box = $('gPlayers');
  // róg ekranu karty gracza = róg przy jego pieniądzach na placu (jak w Business Tour); Twój róg jest na dole po lewej
  const pos = p => ['bl', 'tl', 'tr', 'br'][(cornerOf(p) - viewCorner + 4) % 4];
  const sig = G.players.map(p => `${p.idx}:${p.name}:${p.hex}:${pos(p)}`).join('|');
  if (box.dataset.sig !== sig) {
    box.dataset.sig = sig;
    box.innerHTML = G.players.map((p, k) => `<div class="g-player" data-k="${k}" data-pos="${pos(p)}" style="--c:${p.hex}">
      <span class="g-turn" aria-hidden="true"></span>
      ${avatar(p.pawnIdx, p.colorIdx)}
      <span class="g-pname"><b>${escHtml(p.name)}</b><small></small></span>
      <span class="g-money"><span class="g-cash">${money(p.cash)}</span><span class="g-pmeta"></span></span>
      <span class="g-badges"></span>
    </div>`).join('');
    G.players.forEach(p => { p.hudCash = p.cash; });
  }
  G.players.forEach((p, k) => {
    const el = box.querySelector(`[data-k="${k}"]`);
    const badges = [];
    if (p.jail > 0) badges.push(`dziekanat (${p.jail})`);
    if (p.skip > 0) badges.push(`traci kolejkę (${p.skip})`);
    const exits = p.cards.filter(c => c.icon === 'exit').length;
    if (exits) badges.push(`wyjście ×${exits}`);
    if (p.cards.some(c => c.icon === 'notes')) badges.push('notatki');
    if (p.insured > 0) badges.push(`ubezpieczenie ${p.insured}`);
    if (p.pending) badges.push(p.pending.type === 'buy' ? 'kupno w następnej turze' : 'budowa w następnej turze');
    const sub = p.out ? 'poza grą' : [G.teams ? TEAMS[p.team].name : '', isBot(p) ? `bot · ${p.level}` : p.kind === 'me' ? 'Ty' : p.kind === 'remote' ? 'online' : 'gracz'].filter(Boolean).join(' · ');
    const fields = DEED_CELLS.filter(i => G.own.get(i)?.owner === p).length;
    el.classList.toggle('is-turn', k === G.turn && !G.over);
    el.querySelector('.g-turn').textContent = k === G.turn && !G.over ? (p.kind === 'me' ? 'Twój ruch' : 'Ruch') : '';
    el.classList.toggle('is-out', p.out);
    el.querySelector('small').textContent = sub;
    el.querySelector('.g-pmeta').textContent = `pola ${fields} · karty ${playerCards(p).length}`;
    const bh = badges.map(b => `<span class="g-badge">${b}</span>`).join('');
    const bEl = el.querySelector('.g-badges');
    if (bEl.innerHTML !== bh) bEl.innerHTML = bh;
    if (p.cash !== p.hudCash) {
      const delta = p.cash - p.hudCash;
      countMoney(el.querySelector('.g-cash'), p.hudCash, p.cash);
      p.hudCash = p.cash;
      const chip = document.createElement('span');
      chip.className = `g-delta ${delta > 0 ? 'up' : 'down'}`;
      chip.textContent = `${delta > 0 ? '+' : '−'}${money(Math.abs(delta))}`;
      el.appendChild(chip);
      setTimeout(() => chip.remove(), 1700);
      el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth;
      el.classList.add(delta > 0 ? 'flash-up' : 'flash-down');
      clearTimeout(el._flash);
      el._flash = setTimeout(() => el.classList.remove('flash-up', 'flash-down'), 950);   // potem wraca pulsowanie tury
      cashFx(p, delta);
    }
  });
}
function renderHud() {
  if (!G) return;
  renderPlayers();
  $('gPool').innerHTML = `<small>Pula</small>${money(G.pool)}`;
  renderHands();
  renderHandPanel();
  const t = $('gTimer');
  t.hidden = !timeLeft() && !G.timeUp;
  if (!t.hidden) {
    const s = Math.max(0, Math.ceil(timeLeft() / 1000));
    t.innerHTML = `<small>Czas</small>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}
gameInfo = i => {
  if (!G || !buyable(i)) return null;
  const o = G.own.get(i), f = FIELDS[i];
  if (!o) return `Wolne · cena ${money(priceOf(i))}`;
  const parts = [`Właściciel: ${o.owner.name}`];
  if (f.type === 'room') parts.push(o.level ? `${BUILDINGS[o.level - 1].name.toLowerCase()} (poziom ${o.level})` : 'bez budynku');
  parts.push(`czynsz ${money(rentOf(i))}`);
  if (o.shield) parts.push('tarcza');
  if (o.off) parts.push(`bez prądu: ${o.off}`);
  return parts.join(' · ');
};

// ---------------------------------------------------------------------------
// Start, pauza, koniec gry
// ---------------------------------------------------------------------------
const timeLeft = () => G?.driver?.timeLeft ?? 0;
// Widok nowej gry: pionki na planszy, panel graczy, kamera. Gra przy jednym komputerze i online.
function beginGame(players, snap, { teams, semester, view, online = false }) {
  quitGame(true);
  // ile animowanych części było przed grą: po końcu gry części jej pionków znikają z listy animacji
  const anim = { flags: flags.length, steams: steams.length, coins: coins.length, parts: liveParts.length };
  const g = G = {
    players: players.map(sp => ({ ...structuredClone(sp), obj: gamePawn(sp) })),
    own: new Map(), marks: new Map(), pool: 0, turn: 0, over: false, paused: false, teams,
    semester, timeUp: false, deckLeft: { bonus: 0, penalty: 0 }, snap: null,
    queue: [], pumping: false, driver: null, online, seq: 0, anim,
  };
  applySnap(snap);
  for (const p of g.players) { board.add(p.obj); placePawn(p); }
  renderEmotes();
  $('gPlayers').dataset.sig = '';
  g.view = view;
  viewCorner = cornerOf(g.players[g.view]);
  document.body.classList.add('in-game');
  layer.innerHTML = '';
  openUi = null;
  setStatus('');
  closeMenu();
  controls.enableZoom = false;   // w grze kamerę można tylko obracać
  loadDicePhysics();             // fizyka kości wczytuje się w tle (osobny plik)
  return g;
}
function startGame() {
  saveSetup();
  leaveOnline();
  const slots = setup.slots.map((s, i) => ({ s, i })).filter(({ s }) => s.kind !== 'empty');
  const players = slots.map(({ s, i }) => {
    const pawnIdx = slotPawn(s), colorIdx = slotColor(s);
    return {
      slot: i, kind: s.kind === 'online' ? 'local' : s.kind, level: s.level || 'średni',
      name: s.kind === 'me' ? profile.nick : s.kind === 'bot' ? `Bot ${i + 1}` : `Gracz ${i + 1}`,
      pawnIdx, colorIdx, hex: PAWN_COLORS[colorIdx].hex,
    };
  });
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const engine = new GameEngine({ players, teams: setup.teams, semester: setup.semester, seed, timeLimitMin: setup.timer },
    buildBank(window.BAZA_PYTAN, setup.semester));
  const view = (engine.state.players.find(x => x.kind !== 'bot') || engine.state.players[0]).idx;
  const g = beginGame(engine.state.players, engine.publicState(), { teams: engine.state.teams, semester: setup.semester, view });
  g.driver = new LocalDriver(engine, { timeLimitMs: setup.timer * 60000, onTick: () => { if (G === g) renderHud(); } });
  engine.on(ev => { if (G !== g) return; g.queue.push(ev); pump(g); });
  renderHud();
  g.driver.start().catch(e => console.error(e));
}
// Gra online: stan przychodzi z serwera. Gracze przy tym komputerze decydują, pozostali ludzie są „zdalni”.
// Ta sama funkcja odbudowuje widok po powrocie połączenia (albo po odświeżeniu strony).
function beginOnline(m) {
  const net = NET;
  if (!net) return;
  if (m.snap.over) { leaveOnline(); toast('Ta gra już się skończyła.'); return; }
  const kindOf = sp => (m.mine.includes(sp.idx) ? (sp.idx === m.you ? 'me' : 'local') : sp.kind === 'bot' ? 'bot' : 'remote');
  const spectator = m.you < 0;   // widz: patrzy z perspektywy gospodarza, nic nie decyduje
  const g = beginGame(m.snap.players.map(sp => ({ ...sp, kind: kindOf(sp) })), m.snap, { teams: m.teams, semester: m.semester, view: spectator ? 0 : m.you, online: true });
  g.seq = m.seq;
  g.spectator = spectator;
  document.body.classList.toggle('spectator', spectator);
  renderEmotes();
  renderWatchers();
  g.host = net.lobby.seats[net.seat]?.kind === 'host';
  g.driver = new net.mod.OnlineDriver(net.client, m.timeLeft, () => { if (G === g) renderHud(); });
  net.client.onEvent = ev => {
    if (G !== g || ev.seq <= g.seq) return;   // zdarzenia sprzed stanu, od którego zaczynamy, już są w tym stanie
    g.seq = ev.seq;
    g.queue.push(ev);
    pump(g);
  };
  for (const i of g.own.keys()) placeBuilding(i);
  renderHud();
  if (m.pending) { g.queue.push({ type: 'decision', decision: m.pending, snap: m.snap, seq: m.seq }); pump(g); }
}
// Budynek i znaczniki pola od razu, bez animacji (odbudowa widoku gry online)
function placeBuilding(i) {
  const o = G.own.get(i);
  const m = G.marks.get(i) || {};
  G.marks.set(i, m);
  if (o?.level > 0 && !m.building) {
    const def = BUILDINGS[o.level - 1];
    m.building = def.make(o.owner.hex);
    m.building.position.set(0, TILE_H, BUILD_Z);
    m.building.scale.setScalar(def.board * BUILD_SCALE);
    cellGroups[i].add(m.building);
  }
  refreshMarks(i);
}
// keep = widok zaraz zastąpi nowa gra (połączenie z serwerem zostaje)
function quitGame(keep = false) {
  if (!G) return;
  const g = G;
  G = null;
  g.over = true;
  g.queue.length = 0;
  if (!keep) {
    g.driver?.stop();
    if (g.online) NET = null;
  }
  layer.innerHTML = '';
  openUi = null;
  $('gRoll').hidden = true;
  $('gTip').hidden = true;
  exitPhoto(false);
  setStatus('');
  document.body.classList.remove('in-game', 'replay-mode', 'spectator');
  lostScreen(null);
  $('gWatch').hidden = true;
  applyView();
  for (const p of g.players) { board.remove(p.obj); disposeTree(p.obj); }
  for (const [i, m] of g.marks) for (const [k, obj] of Object.entries(m)) if (obj) { if (k === 'flag') dropFlag(obj); cellGroups[i].remove(obj); disposeTree(obj); }
  for (const t of tileTops) t.material.userData.glow = null;
  clearHands();
  viewCorner = 0;
  controls.enableZoom = true;
  flags.length = g.anim.flags; steams.length = g.anim.steams; coins.length = g.anim.coins; liveParts.length = g.anim.parts;
  dice.forEach(d => { d.visible = false; });
  selectCell(null);
}
function pause() {
  if (!G || G.over || layer.querySelector('.g-pause')) return;
  const g = G;
  // gra online nie stoi dla innych graczy: menu tylko przykrywa planszę
  if (!g.online) { g.paused = true; g.driver.pause(true); }
  const bd = openModal(g.spectator
    ? `<h2>Oglądasz grę</h2><p>Jesteś widzem: gra toczy się dalej, a gracze nie widzą, że menu jest otwarte.</p>
    <div class="g-opts">
      <button type="button" class="m-btn m-primary" data-p="back">Wróć do gry</button>
      <button type="button" class="m-btn m-secondary" data-p="photo">Tryb zdjęć</button>
      <button type="button" class="m-btn m-secondary" data-p="quit">Przestań oglądać</button>
    </div>`
    : g.online
    ? `<h2>Menu gry</h2><p>Gra online toczy się dalej, a inni gracze nie czekają.${g.host ? '' : ' Grę może zakończyć gospodarz.'}</p>
    <div class="g-opts">
      <button type="button" class="m-btn m-primary" data-p="back">Wróć do gry</button>
      <button type="button" class="m-btn m-secondary" data-p="photo">Tryb zdjęć</button>
      ${g.host ? '<button type="button" class="m-btn m-secondary" data-p="end">Zakończ grę dla wszystkich i policz wynik</button>' : ''}
      <button type="button" class="m-btn m-secondary" data-p="quit">Wyjdź do menu (dalej zagra za Ciebie bot)</button>
    </div>`
    : `<h2>Pauza</h2><p>Gra czeka. Czas gry też stoi.</p>
    <div class="g-opts">
      <button type="button" class="m-btn m-primary" data-p="back">Wróć do gry</button>
      <button type="button" class="m-btn m-secondary" data-p="photo">Tryb zdjęć</button>
      <button type="button" class="m-btn m-secondary" data-p="end">Zakończ grę i policz wynik</button>
      <button type="button" class="m-btn m-secondary" data-p="quit">Wyjdź do menu (bez wyniku)</button>
    </div>`, 'g-pause', false);
  bd.style.zIndex = 5;
  bd.addEventListener('click', e => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    bd.remove();
    if (G !== g) return;
    if (b.dataset.p === 'photo') { enterPhoto(g); return; }   // gra z komputerem stoi do końca trybu zdjęć
    if (!g.online) { g.paused = false; g.driver.pause(false); }
    if (b.dataset.p === 'end') endManual();
    if (b.dataset.p === 'quit') { quitGame(); openMenu(); }
  });
}
// Koniec na życzenie gracza: zaległe animacje nie mają już znaczenia, od razu liczymy wynik
function endManual() {
  const g = G;
  if (!g || g.over) return;
  g.queue.length = 0;
  layer.querySelectorAll('.g-backdrop, .g-banner-wrap').forEach(el => el.remove());
  openUi = null;
  $('gRoll').hidden = true;
  g.driver.endNow();
}
$('gMenuBtn').addEventListener('click', pause);
document.addEventListener('keydown', e => {
  if (!G || e.key !== ' ' || photo || $('gRoll').hidden || layer.querySelector('.g-backdrop')) return;
  e.preventDefault();
  $('gRoll').click();
});
const REASONS = {
  time: 'Koniec czasu. Wygrywa największy majątek.',
  bankruptcy: 'Pozostali gracze zbankrutowali.',
  specials: 'Zebrane wszystkie 4 pola specjalne: wygrana od razu!',
  monopolies: '3 monopole: wygrana od razu!',
  manual: 'Gra zakończona. Wygrywa największy majątek.',
};
function showEnd(result) {
  const g = G;
  if (!g) return;
  g.driver.stop();
  if (g.online) NET = null;
  $('gRoll').hidden = true;
  setStatus('');
  const rows = result.rows.map(r => ({ p: g.players[r.player], wealth: r.wealth, acc: r.acc }));
  const win = new Set(result.winners.map(k => g.players[k]));
  const winners = result.winners.map(k => g.players[k]);
  // statystyki gracza „Ty” zapisują się w profilu (ranking i profil)
  const me = g.players.find(p => p.kind === 'me');
  if (me && profile) {
    const st = Object.assign({ games: 0, wins: 0, q: 0, ok: 0, best: null, wealth: null }, profile.stats);
    st.games += 1;
    if (win.has(me)) st.wins += 1;
    st.q += me.total.q; st.ok += me.total.ok;
    const a = pct(me.total.ok, me.total.q);
    if (a != null) st.best = Math.max(st.best ?? 0, a);
    st.wealth = Math.max(st.wealth ?? 0, rows.find(r => r.p === me).wealth);
    profile.stats = st;
    // osiągnięcia: nowe zapisują się z datą w profilu
    const m = g.mine || {}, mine = rows.find(r => r.p === me);
    profile.achievements ??= {};
    const fresh = unlock({
      won: win.has(me), monopoly: !!m.monopoly, hotel: !!m.hotel, doubles: m.doubles || 0, jailEscapes: m.jailEscapes || 0,
      acc: pct(me.total.ok, me.total.q) ?? 0, answered: me.total.q, wealth: mine.wealth, bankrupt: !!me.out,
    }, st, profile.achievements);
    const today = new Date().toISOString().slice(0, 10);
    for (const a of fresh) profile.achievements[a.id] = today;
    g.freshAch = fresh;
    store.set('profil', profile);
  }
  layer.innerHTML = '';
  openUi = null;
  sfx('fanfare');
  winners.forEach((p, k) => sleep(200 + k * 250).then(() => pawnJoy(p)).then(() => sleep(900)).then(() => pawnJoy(p)));
  for (let k = 0; k < 3; k++) sleep(k * 650).then(() => fxConfetti(new THREE.Vector3((Math.random() - 0.5) * 6, 0.5, (Math.random() - 0.5) * 6), [...winners.map(p => p.hex), GOLD, '#FFFFFF'], 180, 1.1));
  const title = result.teams ? `Wygrywa ${TEAMS[winners[0].team].name}` : `Wygrywa ${escHtml(winners[0].name)}`;
  const bd = openModal(`
    <div class="g-end-head">${winners.map(p => avatar(p.pawnIdx, p.colorIdx)).join('')}<div><h2>${title}!</h2><p>${REASONS[result.reason]}</p></div></div>
    <div class="m-table-wrap"><table class="m-table g-end">
      <thead><tr><th>#</th><th>Gracz</th><th>Majątek</th><th>Dobre odpowiedzi</th></tr></thead>
      <tbody>${rows.map((r, k) => `<tr${win.has(r.p) ? ' class="is-me"' : ''}>
        <td><span class="m-pos">${k + 1}</span></td>
        <td><span class="m-player">${avatar(r.p.pawnIdx, r.p.colorIdx)}${escHtml(r.p.name)}${win.has(r.p) ? '<span class="g-title">Wygrana</span>' : ''}${result.prymus === r.p.idx ? '<span class="g-title prymus">Prymus</span>' : ''}</span></td>
        <td>${r.p.out ? 'bankrut' : money(r.wealth)}</td>
        <td>${r.acc == null ? '–' : `<span class="m-bar"><i style="width:${r.acc}%"></i></span>${r.acc}%`}</td></tr>`).join('')}</tbody>
    </table></div>
    ${g.hist?.length > 1 ? `<div class="g-wealth-wrap"><h3>Majątek w czasie gry</h3>${wealthChartSvg(g.hist, g.players.map(p => ({ name: p.name, color: p.hex, out: p.out })))}</div>` : ''}
    ${g.freshAch?.length ? `<div class="g-ach"><h3>Nowe osiągnięcia</h3><div class="m-achv">${g.freshAch.map(a => achHtml(a, true)).join('')}</div></div>` : ''}
    <p class="g-ctx">Majątek to gotówka oraz sale i budynki. „Prymus” ma najwyższy procent dobrych odpowiedzi. Pytań i odpowiedzi nie pokazujemy.</p>
    ${pickMoments(g.moments || []).length ? `<div class="g-opts"><button type="button" class="m-btn m-secondary" data-e="moments">Najlepsze momenty (${pickMoments(g.moments).length})</button></div>` : ''}
    <div class="g-opts two"><button type="button" class="m-btn m-primary" data-e="again">${g.online ? 'Nowa gra' : 'Zagraj jeszcze raz'}</button><button type="button" class="m-btn m-secondary" data-e="menu">Wróć do menu</button></div>`, 'wide', false);
  bd.addEventListener('click', e => {
    const b = e.target.closest('[data-e]');
    if (!b) return;
    if (b.dataset.e === 'moments') { playMoments(g, bd); return; }
    if (b.dataset.e === 'again' && !g.online) startGame();
    else { quitGame(); openMenu(); if (b.dataset.e === 'again') go('play'); }
  });
}

// ---------------------------------------------------------------------------
// Prezentacja: kinowy zwiastun gry. Kamera jedzie po prawdziwej planszy 3D,
// napisy wchodzą jak w reklamach, a muzyka jest generowana w kodzie (Web Audio).
// ---------------------------------------------------------------------------
const promoEl = $('promo');
const prStage = $('prStage');
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const easeSine = t => 0.5 - 0.5 * Math.cos(Math.PI * t);
const easeOut3 = t => 1 - Math.pow(1 - t, 3);
const linear = t => t;
const P = { on: false, idx: -1, time: 0, paused: false, muted: false, dip: null, objs: [], fired: new Set(), music: null, saved: null, building: null, sceneEl: null };
const PROMO_COLOR = '#2F7FF0';
const BUILD_CELL = 2;          // Sala 05: na niej rosną budynki
const Q = Math.PI / 4;         // kierunek kamery od strony pola START
// Ujęcia kamery: funkcja u (0..1) zwraca [pozycja kamery, punkt, na który patrzy]
const shot = (p0, t0, p1, t1, ease = easeSine) => u => { const e = ease(u); return [p0.clone().lerp(p1, e), t0.clone().lerp(t1, e)]; };
const orbit = (target, r0, r1, h0, h1, a0, a1, ease = easeSine) => u => {
  const e = ease(u), a = a0 + (a1 - a0) * e, r = r0 + (r1 - r0) * e;
  return [V3(target.x + r * Math.cos(a), target.y + h0 + (h1 - h0) * e, target.z + r * Math.sin(a)), target.clone()];
};
const line = (html, d) => `<span class="pr-line"><span style="--d:${d}s">${html}</span></span>`;
const fadeP = (cls, html, d) => `<p class="${cls} pr-fade" style="--d:${d}s">${html}</p>`;
const logoHtml = d => `<div class="pr-logo-wrap pr-fade" style="--d:${d}s"><img class="pr-logo" src="assets/logo-wsiz.png" alt=""></div>`;
const BUILD_AT = V3(1.6, 0.6, 5.0);
const MONO_AT = cellTarget(6).add(cellTarget(7)).multiplyScalar(0.5);   // grupa 2 (Sala 10 i 11): monopol w prezentacji   // punkt obok Sali 05: budynek wypada po prawej od napisów
const pIco = n => icon(n === 'prev' ? 'back' : n);   // przyciski prezentacji: te same ikony co w menu

// ---------------------------------------------------------------------------
// Studio: pionek pokazany jak produkt w reklamie (jasne tło bez krawędzi, matowa podłoga,
// reflektor z góry, poświata w kolorze gracza za pionkiem, obrót na talerzu)
// ---------------------------------------------------------------------------
const studio = new THREE.Group();
const STUDIO_TINT = [];
const STUDIO = { obj: null, saved: null, halo: null, pool: null, floor: null };
studio.visible = false;
scene.add(studio);
{
  const floor = mesh(new THREE.CircleGeometry(80, 96), new THREE.MeshStandardMaterial({ color: '#E9EEF6', roughness: 0.92, metalness: 0 }), false, true);
  floor.rotation.x = -Math.PI / 2;
  studio.add(floor);
  const [c, g] = makeCanvas(256, 256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 126);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const glow = new THREE.CanvasTexture(c);
  // kolorowa plama światła na podłodze i poświata za pionkiem (kolor gracza ustawia setStudio)
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: glow, transparent: true, opacity: 0.32, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(1.8, 0.004, 0);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
  halo.scale.setScalar(6.4);
  studio.add(pool, halo);
  Object.assign(STUDIO, { halo, pool, floor });
  STUDIO_TINT.push(pool.material, halo.material);
  const key = new THREE.SpotLight('#FFFFFF', 560, 40, Math.PI / 6, 0.75, 1.4);
  key.position.set(4.2, 9, 3.6);
  key.target.position.set(1.8, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  studio.add(key, key.target);
  const rimL = new THREE.DirectionalLight('#9CBCFF', 2.2);
  rimL.position.set(-6, 3.5, -5);
  const rimR = new THREE.DirectionalLight('#FFE2B8', 1.4);
  rimR.position.set(6, 2.8, -4);
  const front = new THREE.DirectionalLight('#FFFFFF', 1.1);
  front.position.set(0, 2, 8);
  studio.add(rimL, rimR, front);
}
const studioBgs = [];
function setStudio(k) {
  if (STUDIO.obj) { studio.remove(STUDIO.obj); STUDIO.obj = null; }
  const on = k !== null && k !== undefined;
  if (on && !STUDIO.saved) {
    const hemi = scene.children.find(o => o.isHemisphereLight);
    STUDIO.saved = { hemi, hemiI: hemi.intensity, sun: sun.intensity, env: scene.environmentIntensity, fog: scene.fog, bg: scene.background };
    hemi.intensity = 0.32; sun.intensity = 0; scene.environmentIntensity = 0.5;
    scene.fog = new THREE.Fog('#EBEFF6', 6, 19);   // podłoga przechodzi w tło, bez widocznej krawędzi
    board.visible = false; world.visible = false; fxLayer.visible = false; studio.visible = true;
  } else if (!on && STUDIO.saved) {
    const s = STUDIO.saved;
    s.hemi.intensity = s.hemiI; sun.intensity = s.sun; scene.environmentIntensity = s.env;
    scene.fog = s.fog; scene.background = s.bg;
    board.visible = true; showWorld(true); fxLayer.visible = true; studio.visible = false;
    STUDIO.saved = null;
  }
  if (on) {
    const o = PLAYERS[k].make(PAWN_COLORS[k].hex);
    o.scale.setScalar(2.4);
    o.position.x = camera.aspect < 0.9 ? STUDIO_AT.x : 1.8;   // pionek po prawej, napis po lewej (na pionowym ekranie na środku)
    STUDIO.pool.position.x = o.position.x;
    o.rotation.y = Q + 0.9;
    studio.add(o);
    STUDIO.obj = o;
    for (const m of STUDIO_TINT) m.color.set(PAWN_COLORS[k].hex);
    // tło i mgła lekko w kolorze gracza: podłoga przechodzi w tło bez widocznego pasa horyzontu
    const hex = PAWN_COLORS[k].hex, tint = a => '#' + new THREE.Color('#EEF2F8').lerp(new THREE.Color(hex), a).getHexString();
    studioBgs[k] ||= gradientTexture(tint(0.06), tint(0.2));
    scene.background = studioBgs[k];
    scene.fog.color.set(tint(0.13));
    STUDIO.floor.material.color.set(tint(0.1));
  }
}
// pionek kręci się na talerzu, a poświata stoi zawsze za nim (na linii kamera–pionek)
const studioSpin = (t, dt) => {
  if (!STUDIO.obj) return;
  STUDIO.obj.rotation.y += dt * 0.55;
  const d = STUDIO.obj.position.clone().sub(camera.position).setY(0).normalize();
  STUDIO.halo.position.set(STUDIO.obj.position.x + d.x * 3, 1.9, d.z * 3);
};
const STUDIO_AT = V3(0.9, 1.25, 0);
// Napisy: zwykłe wejście od dołu, wejście z rozmyciem (Apple) i wielkie hasła (Nike)
const bline = (html, d) => `<span class="pr-line blur"><span style="--d:${d}s">${html}</span></span>`;
const product = (no, name, desc, k) => `<div class="pr-scene product">
  <p class="pr-prod-no pr-fade" style="--d:.15s; --c:${PAWN_COLORS[k].hex}"><i></i>${no}</p>
  <h2 class="pr-prod-name">${bline(name, 0.25)}</h2>
  <p class="pr-prod-desc pr-fade" style="--d:.7s">${desc}</p>
  <i class="pr-prod-line pr-fade" style="--d:.9s; --c:${PAWN_COLORS[k].hex}"></i></div>`;
function slam(text, gold = false) {
  const box = P.sceneEl?.querySelector('.pr-words');
  if (!box) return;
  box.innerHTML = `<span class="pr-nike${gold ? ' gold' : ''}">${text}</span>`;
  const fl = $('prFlash');
  fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
}
const MANIFEST = ['Ucz się', 'Graj', 'Kupuj', 'Buduj', 'Blokuj', 'Wygrywaj'];
// Scena „Po grze”: przykładowy wykres majątku (wymyślona gra, tylko do pokazania wykresu) i trzy osiągnięcia
const PROMO_HIST = Array.from({ length: 16 }, (_, t) => [
  2000 + t * 190 + 120 * Math.sin(t * 0.9), 2000 + t * 70 - (t > 9 ? (t - 9) * 160 : 0),
  2000 + 160 * Math.sin(t * 0.6) + t * 30, 2000 - t * 70,
].map(v => Math.max(0, Math.round(v))));
function shutterFlash() {
  const fl = $('prFlash');
  fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  sfx('shutter');
}

// ---------------------------------------------------------------------------
// Sceny zwiastuna
// ---------------------------------------------------------------------------
const SCENES = [
  {
    name: 'Otwarcie', dur: 4600, black: true, energy: 0,
    cam: shot(V3(0.04, 36, 0.026), V3(0, 0, 0), V3(0.04, 34, 0.026), V3(0, 0, 0), linear),
    html: () => `<div class="pr-scene at-center">
      <h2 class="pr-h md">${bline('Uczelnia,', 0.35)}${bline('<span class="pr-dim">jakiej jeszcze nie znasz</span>', 1.4)}</h2></div>`,
  },
  {
    name: 'Logo', dur: 5400, black: true, energy: 0,
    cam: shot(V3(0.04, 34, 0.026), V3(0, 0, 0), V3(0.04, 31, 0.026), V3(0, 0, 0), linear),
    events: [[250, () => P.music?.impact()]],
    html: () => `<div class="pr-scene at-center">
      ${logoHtml(0.2)}
      ${fadeP('pr-eyebrow', 'Wyższa Szkoła Informatyki i Zarządzania w Bielsku-Białej', 0.8)}
      <h2 class="pr-h xl pr-word">${bline('<span class="pr-silver">WSiZ Tour</span>', 1.1)}</h2>
      ${fadeP('pr-sub', 'Gra planszowa o Twojej uczelni', 2.2)}</div>`,
  },
  {
    name: 'Kampus nad wodą', dur: 7600, energy: 1,
    cam: orbit(V3(0, -2, -2), 86, 50, 50, 26, Q + 1.25, Q + 0.1),
    html: () => `<div class="pr-scene at-top-left">
      ${fadeP('pr-eyebrow', 'Kampus nad wodą', 0.5)}
      <h2 class="pr-h md">${bline('Uniwersytet z jednej strony,', 0.7)}${bline('<span class="pr-silver">wakacje z drugiej</span>', 1.2)}</h2>
      ${fadeP('pr-sub', 'Na plaży stoją parasole, po wodzie pływają żaglówki, a na falochronie stoi latarnia. Za planszą czeka gmach z wieżą zegarową, boisko i dziedziniec. Tu zawsze coś się dzieje.', 1.9)}</div>`,
  },
  {
    name: 'Woda', dur: 7200, cut: 'soft', energy: 1,
    cam: shot(V3(-21, 2.4, 27.5), V3(-11, -1.1, 20.5), V3(-4, 2.1, 29.5), V3(4, -1.3, 21.5), linear),
    events: [[1200, () => ripples.disturb(-7, 21.5, 0.08, 0.8)], [3400, () => ripples.disturb(1, 23, 0.1, 0.8)]],
    html: () => `<div class="pr-scene at-top-left">
      ${fadeP('pr-eyebrow', 'Woda', 0.4)}
      <h2 class="pr-h md">${bline('Fale, które', 0.6)}${bline('<span class="pr-silver">liczy fizyka</span>', 1.0)}</h2>
      ${fadeP('pr-sub', 'Przez wodę widać dno, a fale je zniekształcają. Łodzie zostawiają za sobą klin fal, ryby robią kręgi. Każda klatka liczy równanie falowe.', 1.7)}</div>`,
  },
  {
    name: 'Sztandar', dur: 3900, energy: 1, studio: 0, light: true,
    cam: orbit(STUDIO_AT, 8.2, 6.8, 0.9, 0.35, Q + 0.55, Q + 0.2),
    events: [[150, () => P.music?.thump()]], tick: studioSpin,
    html: () => product('Pionek 01', 'Sztandar', 'Dla tych, którzy prowadzą. Na złotym maszcie powiewa logo uczelni.', 0),
  },
  {
    name: 'Drukarka 3D', dur: 3300, cut: 'soft', energy: 1, studio: 1, light: true,
    cam: orbit(STUDIO_AT, 7.4, 6.6, 2.0, 1.2, Q - 0.35, Q - 0.05),
    events: [[80, () => P.music?.thump()]], tick: studioSpin,
    html: () => product('Pionek 02', 'Drukarka 3D', 'Dla tych, którzy budują. Drukuje warstwa po warstwie w kolorze gracza.', 1),
  },
  {
    name: 'Koparka', dur: 3300, cut: 'soft', energy: 1, studio: 2, light: true,
    cam: orbit(STUDIO_AT, 7.6, 6.6, 0.5, 0.8, Q + 0.3, Q + 0.65),
    events: [[80, () => P.music?.thump()]], tick: studioSpin,
    html: () => product('Pionek 03', 'Koparka', 'Dla tych, którzy liczą. Kopie kryptowaluty, nawet gdy inni śpią.', 2),
  },
  {
    name: 'Ekspres', dur: 3600, cut: 'soft', energy: 1, studio: 3, light: true,
    cam: orbit(STUDIO_AT, 7.2, 6.2, 1.4, 0.9, Q - 0.1, Q + 0.25),
    events: [[80, () => P.music?.thump()]], tick: studioSpin,
    html: () => product('Pionek 04', 'Ekspres', 'Dla tych, którzy nie śpią przed sesją. Para leci naprawdę.', 3),
  },
  {
    name: 'Plansza', dur: 7000, energy: 2,
    cam: shot(V3(6.2, 1.5, 9.6), V3(4.6, 1.25, 5.0), V3(-5.0, 1.5, 9.6), V3(-6.6, 1.25, 5.0), linear),
    html: () => `<div class="pr-scene at-top-left">
      ${fadeP('pr-eyebrow', 'Plansza', 0.3)}
      <div class="pr-fade" style="--d:.4s"><div class="pr-count"><span class="pr-silver" data-count="32" data-at="400">0</span><small>pola</small></div></div>
      ${fadeP('pr-sub', 'Są tu sale, pracownie, parkingi, sala senatu i sala balowa. Jest też dziekanat, który nie zapomina.', 1.2)}</div>`,
  },
  {
    name: 'Kostki', dur: 5600, energy: 2,
    cam: shot(V3(4.0, 3.6, 6.0), V3(-0.5, 0.3, 1.5), V3(2.4, 2.2, 4.4), V3(-0.4, 0.25, 1.5)),
    events: [[200, () => slam('Rzuć')], [450, () => throwDice(6, 6, 2.1)], [3300, () => { slam('Dublet', true); P.music?.impact(); }]],
    html: () => '<div class="pr-scene at-left-words"><div class="pr-words"></div></div>',
  },
  {
    name: 'Pytania', dur: 8600, energy: 2, blur: true,
    cam: orbit(V3(0, 0, 0), 16, 15, 10, 9, Q - 0.35, Q + 0.25),
    events: [[5300, () => {
      P.sceneEl?.querySelector('[data-k="1"]')?.classList.add('is-good');
      P.sceneEl?.querySelector('.pr-q-res')?.classList.add('on');
      P.music?.chime();
    }]],
    html: () => `<div class="pr-scene split">
      <div>
        ${fadeP('pr-eyebrow', 'Pytania', 0.3)}
        <h2 class="pr-h">${bline('Odpowiedz,', 0.4)}${bline('<span class="pr-silver">zanim minie</span>', 0.7)}${bline('<span class="pr-silver">minuta</span>', 0.9)}</h2>
        ${fadeP('pr-sub', 'Masz cztery odpowiedzi i 60 sekund. Pytania pochodzą z Twojego semestru i od Twoich wykładowców.', 1.4)}
      </div>
      <div class="pr-q" style="--d:1.1s">
        <div class="pr-q-head"><span>Przykładowe pytanie</span><span class="pr-q-bar"><i></i></span></div>
        <p class="pr-q-text">${EXAMPLE.q}</p>
        <div class="pr-q-ans">${EXAMPLE.a.map((a, k) => `<span data-k="${k}"><b>${'ABCD'[k]}</b>${a}</span>`).join('')}</div>
        <p class="pr-q-res">Dobra odpowiedź. Sala jest Twoja.</p>
      </div></div>`,
  },
  {
    name: 'Budowa', dur: 10000, energy: 2,
    cam: orbit(BUILD_AT, 3.7, 3.2, 1.5, 1.2, 1.35, 0.8),
    events: [700, 2200, 3700, 5200, 6700].map((at, k) => [at, () => promoBuild(k + 1)]),
    html: () => `<div class="pr-scene at-top-left">
      <h2 class="pr-h">${bline('Kupuj', 0.3)}${bline('Buduj', 1.8)}${bline('<span class="pr-silver">Rośnij</span>', 4.8)}</h2>
      ${fadeP('pr-sub', 'Najpierw stawiasz telefon, potem laptop, komputer i szafę rack. Na końcu budujesz serwerownię, której nikt już nie ruszy.', 5.4)}
      <div class="pr-level" aria-hidden="true"></div></div>`,
  },
  {
    name: 'Czynsz', dur: 7200, energy: 3,
    cam: shot(V3(-14, 10, 14), V3(-4.2, 0, 4.2), V3(-11.5, 8.5, 16), V3(-4, 0, 4.4)),   // stoły graczy 1 i 2 (przy dwóch bokach planszy)
    events: [700, 2200, 3700, 5200].map((at, k) => [at, () => {
      const [a, b] = k % 2 ? [DEMO.players[0], DEMO.players[1]] : [DEMO.players[1], DEMO.players[0]];
      if (a && b) demoPay(a, b, [320, 480, 260, 640][k] * K);
      P.music?.chime();
    }]),
    html: () => `<div class="pr-scene at-top">
      <h2 class="pr-h md">${bline('Cudze pole?', 0.3)}${bline('<span class="pr-gold">Płacisz czynsz</span>', 0.7)}</h2>
      ${fadeP('pr-sub', 'Pieniądze lecą prosto do właściciela. Im wyższy budynek, tym większy czynsz.', 1.3)}</div>`,
  },
  {
    name: 'Monopol', dur: 7000, energy: 3,
    cam: orbit(MONO_AT, 9.5, 8.5, 6.5, 5.5, Q + 0.9, Q + 0.3),
    events: [[900, () => { if (DEMO.players[0]) fxMonopoly(DEMO.players[0], 2); }], [2600, () => fxConfetti(MONO_AT.clone().setY(0.6), [PAWN_COLORS[0].hex, GOLD, '#FFFFFF'], 160, 1)]],
    html: () => `<div class="pr-scene at-top-right">
      ${fadeP('pr-eyebrow', 'Monopol', 0.2)}
      <h2 class="pr-h">${bline('Cała grupa', 0.3)}${bline('<span class="pr-gold">to czynsz ×2</span>', 0.7)}</h2>
      ${fadeP('pr-sub', 'Zbierz trzy monopole albo cztery pola specjalne, a wygrasz od razu.', 1.4)}</div>`,
  },
  {
    name: 'Karty', dur: 7600, energy: 2, blur: true,
    cam: orbit(V3(0, 0, 0), 15, 14, 11, 10, Q + 0.3, Q - 0.2),
    html: () => {
      const cards = [
        exitCardSVG(EXIT_CARDS[0], 0, 'pr0'),
        actionCardSVG(BONUS_CARDS[6], 'bonus', 'pr1'),
        actionCardSVG(BONUS_CARDS[0], 'bonus', 'pr2'),
        actionCardSVG(PENALTY_CARDS[0], 'penalty', 'pr3'),
        actionCardSVG(BONUS_CARDS[4], 'bonus', 'pr4'),
      ];
      return `<div class="pr-scene at-top">
        <h2 class="pr-h md">${bline('Karty, które', 0.3)}${bline('<span class="pr-silver">zmieniają wszystko</span>', 0.6)}</h2>
        ${fadeP('pr-sub', 'W talii są ułatwienia, utrudnienia, tarcze i ataki. Druga dobra odpowiedź podwaja efekt.', 1.2)}
        <div class="pr-fan" aria-hidden="true">${cards.map((svg, k) =>
          `<div class="pr-card" style="--x:calc(${k - 2} * clamp(64px, 8.6vw, 128px)); --y:${Math.abs(k - 2) * 16}px; --r:${(k - 2) * 9}deg; --d:${1.0 + k * 0.12}s">${svg}</div>`).join('')}</div></div>`;
    },
  },
  {
    name: 'Manifest', dur: 5600, energy: 3, dark: true,
    cam: u => { const a = Q + 0.2 + u * 1.6; return [V3(13 * Math.cos(a), 3.2, 13 * Math.sin(a)), V3(0, 0.4, 0)]; },
    events: MANIFEST.map((w, k) => [250 + k * 625, () => {
      slam(w, k === MANIFEST.length - 1);
      if (k === MANIFEST.length - 1) P.music?.impact(); else P.music?.thump();
    }]),
    html: () => '<div class="pr-scene at-center dark"><div class="pr-words"></div></div>',
  },
  {
    name: 'Liczby', dur: 7000, energy: 3, blur: true,
    cam: u => { const a = 0.6 + 0.6 * easeSine(u); return [V3(0.4 * Math.cos(a), 25 - 3 * u, 0.4 * Math.sin(a)), V3(0, 0, 0)]; },
    html: () => `<div class="pr-scene at-center">
      ${fadeP('pr-eyebrow', 'WSiZ Tour w liczbach', 0.2)}
      <div class="pr-specs">${[
        [2000, 'zł', 'na start dla każdego gracza'],
        [60, 's', 'na każdą odpowiedź'],
        [32, '', 'pola, od dziekanatu po salę balową'],
        [7, '', 'semestrów pytań albo wszystkie naraz'],
      ].map(([n, unit, s], k) => `<div class="pr-spec" style="--d:${0.4 + k * 0.15}s"><b><span class="pr-silver" data-count="${n}" data-at="${500 + k * 150}">0</span>${unit ? `<small>${unit}</small>` : ''}</b><span>${s}</span></div>`).join('')}</div></div>`,
  },
  {
    name: 'Hasło', dur: 6600, energy: 3,
    cam: shot(V3(7.4, 1.6, 7.4), V3(5.0, 0.3, 5.0), V3(16, 9.5, 16), V3(0, 3.6, 0)),
    events: [[300, () => { P.music?.impact(); moneyRain(22); }], [2600, () => moneyRain(14)]],
    html: () => `<div class="pr-scene at-top">
      <h2 class="pr-h xl">${bline('Wiedza', 0.3)}${bline('<span class="pr-gold">się opłaca.</span>', 0.7)}</h2></div>`,
  },
  {
    name: 'Po grze', dur: 7000, energy: 2, blur: true,
    cam: orbit(V3(0, 0, 0), 17, 16, 12, 11, Q - 0.2, Q + 0.35),
    events: [[2600, () => P.music?.chime()]],
    html: () => `<div class="pr-scene split">
      <div>
        ${fadeP('pr-eyebrow', 'Po grze', 0.3)}
        <h2 class="pr-h">${bline('Zobacz, jak', 0.4)}${bline('<span class="pr-silver">rosła fortuna</span>', 0.7)}</h2>
        ${fadeP('pr-sub', 'Wykres majątku pokazuje całą grę. Najlepsze momenty kamera powtórzy jeszcze raz, a w profilu zbierasz osiągnięcia.', 1.3)}
      </div>
      <div class="pr-after pr-fade" style="--d:1s">
        ${wealthChartSvg(PROMO_HIST, PAWN_COLORS.slice(0, 4).map((c, k) => ({ name: `Gracz ${k + 1}`, color: c.hex })))}
        <div class="m-achv">${['monopoly', 'hotel', 'scholar'].map((id, k) => `<div class="pr-ach" style="--k:${k}">${achHtml(ACHIEVEMENTS.find(a => a.id === id), true)}</div>`).join('')}</div>
      </div></div>`,
  },
  {
    name: 'Online', dur: 6800, energy: 2, blur: true,
    cam: u => { const a = Q + 0.9 - u * 0.5; return [V3(15 * Math.cos(a), 11.5, 15 * Math.sin(a)), V3(0, -0.4, 0)]; },
    events: [[700, () => P.music?.chime()]],
    html: () => `<div class="pr-scene at-center">
      ${fadeP('pr-eyebrow', 'Gra online', 0.2)}
      <h2 class="pr-h">${bline('Podaj kod.', 0.3)}${bline('<span class="pr-silver">Grajcie razem.</span>', 0.65)}</h2>
      <div class="pr-code pr-fade" style="--d:.9s">${'WSIZ24'.split('').map((ch, k) => `<b style="--k:${k}">${ch}</b>`).join('')}</div>
      ${fadeP('pr-sub', 'Stwórz party i wyślij znajomym kod. Serwer pilnuje rzutów, pieniędzy i czasu, a za gracza, który wyjdzie, dokończy bot.', 1.4)}</div>`,
  },
  {
    name: 'Wszędzie', dur: 7400, energy: 2, blur: true, mirror: true,
    cam: u => { const a = Q - 0.25 + u * 0.7; return [V3(17 * Math.cos(a), 13.5 - 1.5 * u, 17 * Math.sin(a)), V3(0, -0.4, 0)]; },
    events: [[900, () => P.music?.chime()]],
    html: () => `<div class="pr-scene at-center pr-devices">
      ${fadeP('pr-eyebrow', 'Komputer · tablet · telefon', 0.2)}
      <h2 class="pr-h">${bline('Graj, gdzie chcesz', 0.3)}${bline('<span class="pr-silver">i kiedy chcesz.</span>', 0.65)}</h2>
      <div class="pr-dev-row">
        <div class="pr-laptop pr-fade" style="--d:.9s"><div class="pr-scr"><canvas data-mirror width="640" height="400"></canvas>
          <i class="pr-ui-players"><b></b><b></b><b></b><b></b></i><i class="pr-ui-chip"></i><i class="pr-ui-hand"></i><i class="pr-ui-roll">Rzuć kostkami</i></div><div class="pr-lap-base"></div></div>
        <div class="pr-tablet pr-fade" style="--d:1.05s"><div class="pr-scr"><canvas data-mirror data-zoom="1.15" width="300" height="400"></canvas>
          <i class="pr-ui-row"><b></b><b></b><b></b><b></b></i><i class="pr-ui-bottom"></i></div></div>
        <div class="pr-phone pr-fade" style="--d:1.2s"><div class="pr-scr"><canvas data-mirror data-zoom="1.3" width="200" height="433"></canvas>
          <i class="pr-ui-row"><b></b><b></b><b></b><b></b></i><i class="pr-ui-roll sm">Rzuć</i><i class="pr-ui-bottom"></i></div></div>
      </div>
      ${fadeP('pr-sub', 'Gra działa w przeglądarce i nie trzeba jej instalować. Na komputerze, tablecie i telefonie to ta sama rozgrywka.', 1.5)}</div>`,
  },
  {
    name: 'Zdjęcie 4K', dur: 6400, cut: 'soft', energy: 2,
    cam: shot(V3(8.6, 1.5, 9.8), V3(4.4, 0.25, 5.2), V3(6.6, 1.15, 10.6), V3(3.3, 0.2, 5.6), linear),
    events: [[2700, shutterFlash]],
    html: () => `<div class="pr-scene at-top-left">
      <div class="pr-viewfinder pr-fade" style="--d:.2s" aria-hidden="true"><i></i><i></i><i></i><i></i><span>4K</span></div>
      ${fadeP('pr-eyebrow', 'Tryb zdjęć', 0.4)}
      <h2 class="pr-h md">${bline('Zatrzymaj grę.', 0.6)}${bline('<span class="pr-silver">Zrób zdjęcie w 4K.</span>', 1.0)}</h2>
      ${fadeP('pr-sub', 'Panele znikają, kamera lata swobodnie, a zdjęcie zapisuje się w szerokości 3840 pikseli.', 1.6)}</div>`,
  },
  {
    name: 'Zagraj', dur: 7000, energy: 1, hold: true, blur: true, night: true,
    events: [[400, () => fireworksShow(7)], [4800, () => fireworksShow(5, 700)]],
    cam: () => { const a = Q + 0.4 + P.time / 22000; return [V3(19 * Math.cos(a), 9.5, 19 * Math.sin(a)), V3(0, 0, 0)]; },
    html: () => `<div class="pr-scene at-center">
      ${logoHtml(0.2)}
      <h2 class="pr-h xl pr-word">${bline('<span class="pr-silver">WSiZ Tour</span>', 0.5)}</h2>
      ${fadeP('pr-sub', 'Zagraj w swoją uczelnię.', 1.1)}
      <div class="pr-cta pr-fade" style="--d:1.6s">
        <button type="button" class="is-main" data-cta="play">${pIco('play')}Zagraj teraz</button>
        <button type="button" class="is-ghost" data-cta="replay">Obejrzyj jeszcze raz</button>
      </div>
      ${fadeP('pr-legal', 'Wyższa Szkoła Informatyki i Zarządzania w Bielsku-Białej', 2.2)}
      ${fadeP('pr-legal pr-credit', prefs.promoMusic === 'alex' ? 'Muzyka: „Epic Cinematic Trailer | ELITE”, Alex-Productions (onsound.eu), CC BY 3.0' : 'Muzyka skomponowana w kodzie gry', 2.4)}</div>`,
  },
];

// ---------------------------------------------------------------------------
// Obiekty w scenach: budynki, pionki
// ---------------------------------------------------------------------------
function promoBuild(level) {
  const cg = cellGroups[BUILD_CELL];
  const prev = P.building;
  if (prev) { P.objs = P.objs.filter(([, o]) => o !== prev); shrinkOut(prev, cg); }
  const def = BUILDINGS[level - 1];
  const obj = def.make(PROMO_COLOR);
  obj.position.set(0, TILE_H + 2.6, BUILD_Z);
  cg.add(obj);
  P.objs.push([cg, obj]);
  P.building = obj;
  dropIn(obj, def.board, PROMO_COLOR, cg);
  P.music?.thump();
  const el = P.sceneEl?.querySelector('.pr-level');
  if (el) {
    el.innerHTML = `<b class="pr-grad">0${level}</b><span>${def.name}${level === 5 ? ' · hotel' : ''}</span>`;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }
}
function cleanupScene() {
  setStudio(null);
  for (const [parent, obj] of P.objs) { parent.remove(obj); disposeTree(obj); }
  P.objs = [];
  P.building = null;
  dice.forEach(d => { d.visible = false; });
}


// ---------------------------------------------------------------------------
// Żywa plansza w prezentacji: trwa gra czterech graczy. Sale mają właścicieli i budynki,
// pieniądze leżą na stole, pionki skaczą po planszy, a czynsz przelatuje między graczami.
// ---------------------------------------------------------------------------
const DEMO_OWN = [[6, 0, 2], [7, 0, 1], [9, 0, 0], [13, 1, 3], [14, 1, 0], [15, 1, 1], [20, 2, 0], [21, 2, 4], [23, 2, 2], [18, 3, 0], [27, 3, 1], [29, 3, 5], [31, 3, 2]];
const DEMO = { players: [], marks: [], next: 0, turn: 0 };
function demoStart() {
  const cards = n => Array.from({ length: n }, (_, j) => ({ card: { kind: j % 3 === 2 ? 'penalty' : 'bonus' } }));
  DEMO.players = [0, 1, 2, 3].map(k => {
    const p = { idx: k, slot: k, demo: true, hex: PAWN_COLORS[k].hex, out: false, cash: [2360, 1740, 3180, 1150][k] * K, demoCards: cards([2, 1, 3, 1][k]), pos: [5, 11, 19, 26][k] };
    p.obj = PLAYERS[k].make(p.hex);
    p.obj.position.copy(spotPos(p.pos, k));
    p.obj.rotation.y = cellPose(p.pos).rotY;
    board.add(p.obj);
    return p;
  });
  for (const [i, k, lvl] of DEMO_OWN) {
    const hex = PAWN_COLORS[k].hex, cg = cellGroups[i];
    const frame = ownerFrame(i, hex);
    const flag = ownerFlag(hex);
    const geo = tileTops[i].geometry.parameters;
    flag.position.set(-geo.width / 2 + 0.14, TILE_H, geo.height / 2 - 0.14);
    cg.add(frame, flag);
    DEMO.marks.push([cg, frame], [cg, flag]);
    setGlow(i, hex);
    if (lvl > 0) {
      const def = BUILDINGS[lvl - 1], b = def.make(hex);
      b.scale.setScalar(def.board);
      b.position.set(0, TILE_H, BUILD_Z);
      cg.add(b);
      DEMO.marks.push([cg, b]);
    }
  }
  for (const p of DEMO.players) renderStash(p);
  DEMO.next = performance.now() + 1800;
}
function demoStop() {
  if (!DEMO.players.length) return;
  for (const p of DEMO.players) { board.remove(p.obj); disposeTree(p.obj); }
  for (const [cg, obj] of DEMO.marks) { if (obj.userData.flagEntry) dropFlag(obj); cg.remove(obj); }
  for (const [i] of DEMO_OWN) setGlow(i, null);
  DEMO.players = []; DEMO.marks = [];
  clearHands();
}
const demoOwner = i => { const d = DEMO_OWN.find(([c]) => c === i); return d ? DEMO.players[d[1]] : null; };
async function demoMove(p, n) {
  for (let s = 0; s < n; s++) {
    const from = p.pos, to = (p.pos + 1) % TOTAL;
    const a = spotPos(from, p.idx), b = spotPos(to, p.idx);
    const r0 = p.obj.rotation.y;
    let r1 = cellPose(to).rotY, d = r1 - r0;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    r1 = r0 + d;
    p.pos = to;
    await tween(reduceMotion ? 60 : 260, t => {
      p.obj.position.lerpVectors(a, b, t);
      p.obj.position.y = TILE_H + 0.42 * Math.sin(Math.PI * t);
      p.obj.rotation.y = r0 + (r1 - r0) * t;
    });
    if (!DEMO.players.length) return;
  }
  fxRing(p.obj.position, p.hex, 0.9);
  const owner = demoOwner(p.pos);
  if (owner && owner !== p) demoPay(p, owner, (60 + Math.floor(Math.random() * 6) * 40) * K);
}
function demoPay(a, b, amount) {
  a.cash -= amount; b.cash += amount;
  fxTransfer(a, b, amount);
  fxText(a.obj.position.clone().add(V3(0, 1.9, 0)), `−${money(amount)}`, '#FF7A75', 0.62);
  setTimeout(() => { if (DEMO.players.length) { renderStash(a); renderStash(b); } }, 500);
}
function demoTick(now) {
  if (!DEMO.players.length || P.paused || studio.visible || now < DEMO.next) return;
  DEMO.next = now + 1300;
  const p = DEMO.players[DEMO.turn++ % 4];
  demoMove(p, 1 + Math.floor(Math.random() * 3));
}
// Fajerwerki nad wyspą: rakieta wznosi się, a potem rozbłyska kula iskier
const sparkDot = (() => {
  const [c, g] = makeCanvas(64, 64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
function fxFirework(pos, color) {
  if (reduceMotion) return;
  const rocket = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkDot, color: '#FFE7B0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  rocket.scale.setScalar(0.7);
  fxLayer.add(rocket);
  const from = V3(pos.x * 0.85, GROUND_Y, pos.z * 0.85);
  tween(700, t => { rocket.position.lerpVectors(from, pos, easeOut3(t)); }).then(() => {
    fxLayer.remove(rocket); rocket.material.dispose();
    const n = 70, posA = new Float32Array(n * 3), vel = [];
    for (let k = 0; k < n; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = 5 + Math.random() * 2.5;
      vel.push([r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp]);
    }
    // iskry jako małe sprite'y (WebGPU nie rysuje punktów większych niż 1 piksel)
    const m = new THREE.SpriteMaterial({ map: sparkDot, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const pts = new THREE.Group(), sparks = [];
    for (let k = 0; k < n; k++) { const sp = new THREE.Sprite(m); sp.scale.setScalar(0.3); sparks.push(sp); pts.add(sp); }
    pts.position.copy(pos);
    fxLayer.add(pts);
    P.music?.thump();
    tween(1700, t => {
      const s = t * 1.7, drag = (1 - Math.exp(-s * 2.4)) / 2.4;
      for (let k = 0; k < n; k++) {
        posA[k * 3] = vel[k][0] * drag; posA[k * 3 + 1] = vel[k][1] * drag - 1.2 * s * s; posA[k * 3 + 2] = vel[k][2] * drag;
      }
      const sz = 0.3 * (1 - t * 0.5);
      for (let k = 0; k < n; k++) { sparks[k].position.fromArray(posA, k * 3); sparks[k].scale.setScalar(sz); }
      m.opacity = 1 - t * t;
    }).then(() => { fxLayer.remove(pts); m.dispose(); });
  });
}
function fireworksShow(count = 6, gap = 520) {
  const cols = [GOLD, '#FFFFFF', '#2F7FF0', '#E5484D', '#1FA463', '#F2B72E'];
  for (let k = 0; k < count; k++) {
    sleep(k * gap).then(() => {
      if (!P.on) return;
      const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 14;
      fxFirework(V3(r * Math.cos(a), 12 + Math.random() * 8, r * Math.sin(a)), cols[k % cols.length]);
    });
  }
}
// Deszcz pieniędzy: paczki banknotów spadają z nieba na planszę
function moneyRain(n = 18) {
  for (let k = 0; k < n; k++) sleep(k * 110).then(() => {
    if (!P.on) return;
    const a = Math.random() * Math.PI * 2, r = Math.random() * 6;
    fxTransfer(V3(r * Math.cos(a) * 1.5, 14, r * Math.sin(a) * 1.5), V3(r * Math.cos(a), 0.3, r * Math.sin(a)), NOTE);
  });
}
// Muzyka: src/audio/music.js (podkład „game” do menu i gry, utwór „promo” do prezentacji)
// Podkład w menu i w grze. Startuje po pierwszym kliknięciu albo klawiszu (wcześniej przeglądarka nie pozwala grać),
// cichnie na czas prezentacji (tam gra jej własny utwór) i znika, gdy suwak „Muzyka” jest na zero.
let bgm = null;
function gameMusic() {
  const want = (prefs.music ?? 60) > 0 && !P.on;
  if (want && !bgm) bgm = createMusic('game', { level: () => ((prefs.music ?? 60) / 100) * 0.55 });
  else if (!want && bgm) { bgm.stop(); bgm = null; }
  else bgm?.volume();
}
addEventListener('pointerdown', gameMusic, { once: true });
// ciche kliknięcie przycisków menu i paneli (bez przycisku rzutu, ten ma własny dźwięk kości)
document.addEventListener('click', e => { if (e.target.closest('.m-btn, .chip, .g-thumb, .m-tile') && !e.target.closest('#gRoll')) sfx('click'); });
// Tło dźwiękowe: na makiecie fale, wiatr i czasem mewy, w pokoju tykanie zegara i ptaki za oknem.
// Głośność z suwaka „Efekty dźwiękowe”; cisza w prezentacji (tam gra jej muzyka).
let amb = null;
function ambience() {
  const a = audio();
  if (!a) return;
  const want = (prefs.effects ?? 80) > 0 && !P.on && (curSkin === 'diorama' || curSkin === 'pokoj');
  if (!want) { if (amb) amb.out.gain.setTargetAtTime(0, a.currentTime, 0.4); return; }
  if (!amb) amb = createAmbience(a);
  amb.kind = curSkin;
  amb.out.gain.setTargetAtTime(((prefs.effects ?? 80) / 100) * 0.22, a.currentTime, 0.8);
  amb.surf.gain.setTargetAtTime(curSkin === 'diorama' ? 1 : 0, a.currentTime, 0.6);
}
// createAmbience: src/audio/ambience.js
addEventListener('pointerdown', () => ambience(), { once: true });
addEventListener('keydown', gameMusic, { once: true });

// ---------------------------------------------------------------------------
// Silnik prezentacji: czas sceny, kamera, zdarzenia, przejścia przez czerń
// ---------------------------------------------------------------------------
let promoBg = null;
function enterScene(i) {
  cleanupScene();
  P.idx = i;
  P.time = 0;
  P.fired = new Set();
  const sc = SCENES[i];
  prStage.querySelectorAll('.pr-scene').forEach(el => { if (!el.classList.contains('out')) el.classList.add('out'); setTimeout(() => el.remove(), 650); });
  prStage.insertAdjacentHTML('beforeend', sc.html());
  P.sceneEl = prStage.lastElementChild;
  $('prBlur').classList.toggle('on', !!sc.blur);
  $('prBlack').classList.toggle('off', !sc.black);
  promoEl.classList.toggle('is-light', !!sc.light);
  if (!!sc.night !== worldNight) setWorldMood(!!sc.night);   // dzień jak w grze, noc tylko w finale z fajerwerkami
  P.music?.setEnergy(sc.energy);
  if (sc.studio !== undefined) setStudio(sc.studio);
  sc.enter?.();
  renderProg();
}
function goTo(i) {
  if (!P.on || i < 0 || i >= SCENES.length || P.dip) return;
  const soft = SCENES[i].cut === 'soft' && i === P.idx + 1;
  P.music?.whoosh();
  if (soft) { enterScene(i); return; }
  P.sceneEl?.classList.add('out');
  P.dip = { phase: 'in', t: 0, to: i };
}
function promoTick(dt) {
  // czas rzeczywisty, żeby kamera szła równo z animacjami napisów (CSS) także przy niskiej liczbie klatek
  const now = performance.now();
  const ms = Math.min(250, now - (P.last ?? now));
  P.last = now;
  demoTick(now);
  if (P.dip) {
    P.dip.t += ms;
    const dip = $('prDip');
    if (P.dip.phase === 'in') {
      dip.style.opacity = Math.min(1, P.dip.t / 340);
      if (P.dip.t >= 340) { enterScene(P.dip.to); P.dip = { phase: 'out', t: 0 }; }
    } else {
      dip.style.opacity = Math.max(0, 1 - P.dip.t / 560);
      if (P.dip.t >= 560) { P.dip = null; dip.style.opacity = 0; }
    }
  }
  if (P.idx < 0) return;
  const sc = SCENES[P.idx];
  if (!P.paused) P.time += ms;
  const u = Math.min(1, P.time / sc.dur);
  const [pos, tgt] = sc.cam(u);
  if (sc.studio !== undefined && camera.aspect < 0.9) { pos.y -= 0.5; tgt.y -= 0.5; }   // telefon: pionek wyżej, nad napisem
  camera.position.copy(pos);
  controls.target.copy(tgt);
  if (P.paused) return;
  for (const [at, fn] of sc.events || []) if (P.time >= at && !P.fired.has(at)) { P.fired.add(at); fn(); }
  sc.tick?.(P.time, dt);
  P.sceneEl?.querySelectorAll('[data-count]').forEach(el => {
    const k = Math.min(1, Math.max(0, (P.time - +el.dataset.at) / 1600));
    el.textContent = Math.round(+el.dataset.count * easeOut3(k)).toLocaleString('pl-PL');
  });
  updateProg(u);
  if (P.time >= sc.dur && !sc.hold && !P.dip) goTo(P.idx + 1);
}
// Ekrany urządzeń w scenie „Wszędzie”: wycinek środka klatki w proporcjach ekranu (telefon trochę bliżej)
function mirrorDevices() {
  const src = renderer.domElement, W = src.width, H = src.height;
  for (const c of P.sceneEl?.querySelectorAll('canvas[data-mirror]') || []) {
    const g = c.getContext('2d'), ar = c.width / c.height, zoom = +c.dataset.zoom || 1;
    let sw = W, sh = W / ar;
    if (sh > H) { sh = H; sw = H * ar; }
    sw /= zoom; sh /= zoom;
    g.drawImage(src, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  }
}
function renderProg() {
  const prog = $('prProg');
  if (!prog.children.length) {
    prog.innerHTML = SCENES.map((s, k) => `<button type="button" data-scene="${k}" aria-label="Scena ${k + 1}: ${s.name}" title="${s.name}"><i><b></b></i></button>`).join('');
  }
  [...prog.children].forEach((b, k) => {
    b.querySelector('b').style.width = k < P.idx ? '100%' : '0%';
    b.setAttribute('aria-current', String(k === P.idx));
  });
}
function updateProg(u) {
  const b = $('prProg').children[P.idx]?.querySelector('b');
  if (b) b.style.width = `${u * 100}%`;
}
function setPaused(on) {
  P.paused = on;
  promoEl.classList.toggle('is-paused', on);
  $('prPlay').innerHTML = pIco(on ? 'play' : 'pause');
  $('prPlay').setAttribute('aria-label', on ? 'Odtwarzaj' : 'Pauza');
  P.music?.volume();
}
function setMuted(on) {
  P.muted = on;
  $('prSound').innerHTML = pIco(on ? 'mute' : 'sound');
  $('prSound').setAttribute('aria-label', on ? 'Włącz muzykę' : 'Wycisz muzykę');
  P.music?.volume();
}
function openPromo(fromLink = false) {
  if (P.on) return;
  P.on = true;
  gameMusic();   // podkład z menu cichnie, prezentacja ma swój utwór
  if (audioStarted()) ambience();
  P.saved = {
    bg: scene.background, minD: controls.minDistance, maxD: controls.maxDistance, polar: controls.maxPolarAngle,
    anim: { flags: flags.length, steams: steams.length, coins: coins.length, parts: liveParts.length },
  };
  if (!G) demoStart();
  closeDropdown();
  clearInterval(exampleTimer);
  selectCell(null);
  promoBg ||= gradientTexture('#0B1A40', '#010309');
  P.saved.skin = curSkin;
  applySkin('diorama');
  scene.background = promoBg;
  setWorldMood(false);
  controls.enabled = false;
  controls.autoRotate = false;
  controls.minDistance = 0.5;
  controls.maxDistance = 200;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  document.body.classList.add('promo-open');
  promoEl.hidden = false;
  promoEl.classList.remove('cinema', 'idle');
  prStage.innerHTML = '';
  $('prBlack').classList.remove('off');
  $('prDip').style.opacity = 0;
  $('prProg').innerHTML = '';
  setPaused(false);
  setMuted(P.muted);
  P.idx = -1;
  jumpTo([V3(0.04, 36, 0.026), V3(0, 0, 0)]);
  $('prStart').hidden = !fromLink;
  $('prUi').hidden = fromLink;
  if (fromLink) { $('prStartBtn').focus(); return; }
  beginPromo();
}
function beginPromo() {
  $('prStart').hidden = true;
  $('prUi').hidden = false;
  promoEl.classList.add('cinema');
  P.last = performance.now();
  P.music?.stop();
  P.music = createMusic('promo', { level: () => (P.muted || P.paused ? 0 : ((prefs.music ?? 60) / 100) * 0.8), hold: () => P.paused, useFile: prefs.promoMusic === 'alex' });
  enterScene(0);
  idlePing();
}
function closePromo(goPlay = false) {
  if (!P.on) return;
  P.on = false;
  if (audioStarted()) setTimeout(ambience, 300);
  P.idx = -1;
  P.dip = null;
  cleanupScene();
  demoStop();
  P.music?.stop();
  P.music = null;
  gameMusic();
  prStage.innerHTML = '';
  promoEl.hidden = true;
  promoEl.classList.remove('cinema', 'is-light');
  document.body.classList.remove('promo-open');
  scene.background = P.saved.bg;
  setWorldMood(timeNow(prefs.time));
  applySkin(P.saved.skin);
  controls.minDistance = P.saved.minD;
  controls.maxDistance = P.saved.maxD;
  controls.maxPolarAngle = P.saved.polar;
  flags.length = P.saved.anim.flags; steams.length = P.saved.anim.steams; coins.length = P.saved.anim.coins; liveParts.length = P.saved.anim.parts;
  jumpTo(presetBoard());
  controls.enabled = !menuOpen;
  controls.autoRotate = menuOpen && prefs.spin && !reduceMotion;
  if (new URLSearchParams(location.search).has('prezentacja')) {
    const url = new URL(location.href);
    url.searchParams.delete('prezentacja');
    history.replaceState(null, '', url);
  }
  if (goPlay && profile && menuOpen) go('play');
}
let idleTimer = null;
function idlePing() {
  promoEl.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => promoEl.classList.add('idle'), 2600);
}
$('prClose').innerHTML = pIco('close');
$('prPrev').innerHTML = pIco('prev');
$('prNext').innerHTML = pIco('next');
$('prClose').addEventListener('click', () => closePromo());
$('prPrev').addEventListener('click', () => goTo(Math.max(0, P.idx - 1)));
$('prNext').addEventListener('click', () => goTo(P.idx + 1));
$('prPlay').addEventListener('click', () => setPaused(!P.paused));
$('prSound').addEventListener('click', () => setMuted(!P.muted));
$('prStartBtn').addEventListener('click', beginPromo);
$('prStart').querySelector('.pr-play').innerHTML = pIco('play');
$('prProg').addEventListener('click', e => { const b = e.target.closest('[data-scene]'); if (b) goTo(+b.dataset.scene); });
prStage.addEventListener('click', e => {
  const b = e.target.closest('[data-cta]');
  if (!b) return;
  if (b.dataset.cta === 'replay') goTo(0);
  else closePromo(true);
});
promoEl.addEventListener('pointermove', idlePing);
document.addEventListener('keydown', e => {
  if (!P.on || !$('prStart').hidden) return;
  if (e.key === 'Escape') closePromo();
  else if (e.key === 'ArrowRight') goTo(P.idx + 1);
  else if (e.key === 'ArrowLeft') goTo(Math.max(0, P.idx - 1));
  else if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); setPaused(!P.paused); }
  else return;
  idlePing();
});
$('btnPromoLogin').innerHTML = `${ico('film')}Zobacz prezentację gry`;
$('btnPromoLogin').addEventListener('click', () => openPromo());
$('btnPromoBoard').addEventListener('click', () => openPromo());

// Klikanie pól
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downAt = null;
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([...tileTops, ...deckFaces], false)[0];
  return hit ? hit.object : null;
}
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || view !== 'board') return;
  const dx = e.clientX - downAt[0], dy = e.clientY - downAt[1];
  downAt = null;
  if (dx * dx + dy * dy > 36) return;
  const hit = pick(e);
  if (hit && hit.userData.deck) selectDeck(hit);
  else selectCell(hit ? hit.userData.cell : null);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || e.buttons || view !== 'board') return;
  renderer.domElement.style.cursor = pick(e) !== null ? 'pointer' : 'grab';
});

// ---------------------------------------------------------------------------
// Pętla
// ---------------------------------------------------------------------------
function measureSafe(w, h) {
  Object.assign(safe, { l: 0, r: 0, t: 0, b: Math.round(Math.min(h * 0.16, 128)), fit: false });   // poza grą: dolny panel pokazu
  if (!document.body.classList.contains('in-game') || menuOpen) return;
  Object.assign(safe, { b: 0, fit: true, avoid: [] });
  const s = stage.getBoundingClientRect(), gap = 14;
  if (!matchMedia('(max-width: 1100px)').matches) {
    // jak w Business Tour: plansza (romb) wypełnia ekran, a karty graczy, opis ruchu, pula z menu i szuflada kart
    // leżą w wolnych trójkątach przy rogach ekranu; plansza ich nie zasłania
    const add = r => { if (r.width && r.height) safe.avoid.push([r.left - s.left - gap, r.top - s.top - gap, r.right - s.left + gap, r.bottom - s.top + gap]); };
    $('gPlayers').querySelectorAll('.g-player').forEach(el => add(el.getBoundingClientRect()));
    add($('gSide').querySelector('.g-tr').getBoundingClientRect());
    add($('gStatus').getBoundingClientRect());
    if (!$('gEmotes').hidden) add($('gEmotes').getBoundingClientRect());
    // szuflada rośnie w górę nad planszę tylko po otwarciu: liczy się miejsce zamkniętej szuflady (sam nagłówek przy dole)
    const hand = $('gHand').getBoundingClientRect(), head = $('gHand').querySelector('.g-hand-head')?.getBoundingClientRect();
    if (hand.height) add({ left: hand.left, right: hand.right, bottom: hand.bottom, top: hand.bottom - Math.min(hand.height, (head?.height || 30) + 26), width: hand.width, height: 1 });
    Object.assign(safe, { l: 8, r: 8, t: 8, b: 8 });
    return;
  }
  for (const el of [$('gPlayers'), $('gSide')]) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.width < w * 0.45) {
      // kolumna z boku planszy
      if (r.left + r.width / 2 < s.left + w / 2) safe.l = Math.max(safe.l, r.right - s.left + gap);
      else safe.r = Math.max(safe.r, s.right - r.left + gap);
    } else if (r.top + r.height / 2 < s.top + h / 2) safe.t = Math.max(safe.t, r.bottom - s.top + gap);
    else safe.b = Math.max(safe.b, s.bottom - r.top + gap);
  }
  safe.t = Math.max(safe.t, 12);
  safe.b = Math.max(safe.b, 58);   // pasek z opisem ruchu
}
// Ustawia środek obrazu na środku wolnego miejsca
function applyView() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  if (photo) { camera.clearViewOffset(); camera.updateProjectionMatrix(); return; }   // tryb zdjęć: obraz bez paneli, środek na środku
  measureSafe(w, h);
  for (const k of ['l', 'r', 't', 'b']) stage.style.setProperty(`--s${k}`, `${Math.round(safe[k])}px`);
  setViewOffset();
  updateLimits();
}
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  applyView();
  // w grze po zmianie rozmiaru okna kamera zostaje w tym samym kierunku, zmienia się tylko odległość
  if (G && safe.fit && view === 'board' && !P.on && controls.enabled && !photo) {
    const d = camera.position.clone().sub(controls.target).setLength(boardDist());
    camera.position.copy(controls.target).add(d);
  }
}
resize();
new ResizeObserver(resize).observe(stage);
const panelWatch = new ResizeObserver(() => applyView());
panelWatch.observe($('gPlayers'));
panelWatch.observe($('gSide'));
jumpTo(presetBoard());

// ?rtonly (tylko paczka testowa): gra rysuje do tekstury zamiast na ekran. Programowy WebGPU w testach
// gubi kartę graficzną przy pokazywaniu klatki na ekranie, a tak można odczytać obraz i sprawdzić shadery.
const testTarget = __TEST_HOOKS__ && new URLSearchParams(location.search).has('rtonly')
  ? new THREE.RenderTarget(1, 1, { colorSpace: THREE.SRGBColorSpace, type: THREE.UnsignedByteType, samples: 4 }) : null;
const focusDir = new THREE.Vector3(), focusPt = new THREE.Vector3();
const FOCUS_AREA = [[11, 11], [-11, 11], [11, -11], [-11, -11]];   // narożniki stołu z planszą, pieniędzmi i kartami
const timer = new THREE.Timer();
timer.connect(document);   // karta w tle nie daje potem jednego wielkiego skoku czasu
// Płynność: gdy przez dłuższą chwilę klatki są wolne, gra rysuje w trochę mniejszej rozdzielczości;
// gdy znów jest płynnie, wraca do pełnej jakości. Działa sama, bez ustawień.
// Jakość grafiki (src/render/graphics.js): gęstość pikseli, cienie i efekty; w trybie Automatyczna
// dopasowuje się do płynności (gdy klatki są wolne, najpierw spada rozdzielczość, potem efekty)
gfx = new Graphics(renderer, scene, camera, { sun, mobile: lowEnd, onResize: () => resize() });
gfx.set(GFX_LEVELS.some(([v]) => v === prefs.gfx) ? prefs.gfx : 'auto');
// pora dnia ustawiona przy starcie (zanim powstał gfx): poświata i korekcja kolorów
gfx.setNight(TIMES[worldTime].lights);
gfx.setGrade(TIMES[worldTime].grade);
// Licznik klatek (Ustawienia): średnia z ostatnich pół sekundy
const fps = { n: 0, t0: performance.now(), el: $('fpsMeter') };
function fpsMeter() { fps.el.hidden = !prefs.fps; fps.n = 0; fps.t0 = performance.now(); }
fpsMeter();
function frame() {
  timer.update();
  const raw = timer.getDelta(), dt = Math.min(raw, 0.05);
  gfx.frame(raw * 1000);
  if (prefs.fps) {
    fps.n++;
    const now = performance.now();
    if (now - fps.t0 >= 500) { fps.el.textContent = `${Math.round((fps.n * 1000) / (now - fps.t0))} FPS · ${gfx.describe()}`; fps.n = 0; fps.t0 = now; }
  }
  const t = timer.getElapsed();
  runTweens(performance.now());
  if (P.on) promoTick(dt);
  sky.position.copy(camera.position);
  if (!reduceMotion) {
    worldTick(t, dt);
    animateParts(sceneParts, t, dt);
    if (view === 'models') turntables.forEach(o => { o.rotation.y += dt * 0.45; });
    if (G) for (const p of G.players) {   // pionki lekko „oddychają”, gdy stoją
      const m = p.obj.children[0];
      if (m) m.scale.y = PAWN_SCALE * (1 + 0.014 * Math.sin(t * 2.3 + p.idx * 1.7));
    }
  }
  // podgląd pionków w kartach graczy i w profilu (tylko gdy menu jest otwarte)
  if (menuOpen) preview.render(dt, o => { if (!reduceMotion) animateParts(o.userData.anim, t, dt); });
  controls.update();
  // Bliska płaszczyzna odcięcia rośnie z odległością kamery od celu (dokładniejsza głębia):
  // cienkie warstwy (napisy na polach, plac, cienie, opaska) nie migają nawet przy dalekich ujęciach
  const near = Math.min(2, Math.max(0.1, camera.position.distanceTo(controls.target) * 0.03));
  if (Math.abs(near - camera.near) > 0.005) { camera.near = near; camera.updateProjectionMatrix(); }
  const sh = shakeOffset(performance.now());
  if (sh) camera.position.add(sh);
  // głębia ostrości: ostrość na punkcie, na który patrzy kamera (plansza albo pole przy najeździe);
  // w menu i w prezentacji bez rozmycia (menu ma własne rozmycie tła)
  {
    const look = camera.getWorldDirection(focusDir);
    const d = Math.max(1, focusPt.copy(controls.target).sub(camera.position).dot(look));
    let dead = 1.2, range = 6;   // najazd na pole: ostre tylko pole, reszta planszy miękko rozmyta
    if (photo) { dead = 2.5; range = 14; }   // tryb zdjęć: ostry punkt, na który patrzy kamera, tło miękko rozmyte
    else if (!cineActive) {
      // zwykły widok: cała plansza i stół z pieniędzmi i kartami graczy są zawsze w pełni ostre,
      // rozmywa się dopiero dalsze tło (krzesła, ściany pokoju)
      dead = 0;
      for (const [x, z] of FOCUS_AREA) dead = Math.max(dead, Math.abs(focusPt.set(x, 0, z).sub(camera.position).dot(look) - d));
      dead += 1.5; range = 28;
    }
    gfx.setFocus(d, range, menuOpen || P.on || view !== 'board' ? 0 : 1, dead);
  }
  if (__TEST_HOOKS__ && testTarget) {   // testy WebGPU bez karty graficznej: klatka w pamięci
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (testTarget.width !== sz.x || testTarget.height !== sz.y) testTarget.setSize(sz.x, sz.y);
    renderer.setRenderTarget(testTarget);
  }
  gfx.render();
  if (__TEST_HOOKS__ && testTarget) renderer.setRenderTarget(null);
  if (P.on && SCENES[P.idx]?.mirror) mirrorDevices();
  if (sh) camera.position.sub(sh);
  if (view === 'models') labelRenderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
$('loader').hidden = true;
// Gra startuje od menu (logowanie, a potem ekran główny)
openMenu();
// Link z ?prezentacja otwiera od razu zwiastun gry
if (new URLSearchParams(location.search).has('prezentacja')) openPromo(true);
// Po odświeżeniu strony w trakcie gry online wracamy na swoje miejsce (kod party i token są w pamięci przeglądarki)
{
  const saved = store.get('online', null);
  if (profile && saved?.code && saved?.token && Date.now() - saved.at < 3 * 3600_000) {
    onlineModule().then(async mod => {
      const client = new mod.OnlineClient();
      const r = await client.resume(saved.code, saved.token);
      if (r.error) client.close();
      else if (!G && !P.on) attachNet(mod, client, r);
      else client.close();
    }).catch(e => console.error(e));
  }
}

// Testy automatyczne (Playwright) dostają dostęp do sceny i prezentacji. W paczce na serwer tego kodu nie ma.
if (__TEST_HOOKS__) {
  window.__t = { THREE, testTarget, camera, controls, scene, renderer, setView, setStudio, setWorldMood, applySkin, demoStart, demoStop, throwDice, fxConfetti, fxText, fxFirework, fxMonopoly, fxRing, V3, P, SCENES, goTo: i => goTo(i), enterScene, setPaused, STUDIO_AT, cellTarget, MONO_AT, BUILD_AT, showWorld, board, world, studio, DEMO, Q, GOLD, G: () => G, presetBoard, presetShow, jumpTo, applyView, createMusic, bgmOn: () => !!bgm, dropNet: () => NET?.client.socket.io.engine.close(), liftCard, gfx, quality: { get ratio() { return gfx.ratio; }, get max() { return gfx.targetRatio(); } } };
}
