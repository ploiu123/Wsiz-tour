// Kości z prawdziwą fizyką (Rapier): rzut liczy się w ułamku sekundy przed pokazaniem (480 kroków po 1/120 s),
// a potem kości odtwarzają zapisany lot. Wynik zawsze pochodzi z silnika gry albo z serwera: po symulacji
// sprawdzamy, która ścianka wylądowała na górze, i obracamy siatkę kości wewnątrz bryły fizycznej tak,
// żeby na tej ściance były wylosowane oczka (fizyka się nie zmienia, zmienia się tylko „nadruk”).
// To samo ziarno daje ten sam lot u wszystkich graczy online (Rapier jest deterministyczny).
// Biblioteka (ok. 1 MB) wczytuje się w tle dopiero w grze; do tego czasu kości lecą po prostej animacji.

let R = null;
let loading = null;

export function loadDicePhysics() {
  loading ??= import('@dimforge/rapier3d-compat')
    .then(async m => { const lib = m.default ?? m; await lib.init(); R = lib; return lib; })
    .catch(err => { console.warn('Fizyka kości niedostępna, zostaje animacja', err); return null; });
  return loading;
}
export const diceReady = () => !!R;

// Ścianki w kolejności z gry: lokalna oś bryły → liczba oczek (przeciwległe sumują się do 7)
/** @type {[[number, number, number], number][]} */
export const FACE_AXES = [
  [[1, 0, 0], 3], [[-1, 0, 0], 4], [[0, 1, 0], 1], [[0, -1, 0], 6], [[0, 0, 1], 2], [[0, 0, -1], 5],
];

function seeded(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// obrót kwaternionem [x, y, z, w] wektora v
function rotate(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz, iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
// Która lokalna oś patrzy w górę i jak bardzo (1 = kość leży płasko)
export function upFace(q) {
  let best = 0, dot = -2;
  FACE_AXES.forEach(([a], k) => { const y = rotate(q, a)[1]; if (y > dot) { dot = y; best = k; } });
  return { face: best, dot };
}

/**
 * Symulacja rzutu dwiema kośćmi.
 * @param {{ floorY: number, half: number, die: number, round: number, from: [number, number],
 *   obstacles: { x: number, z: number, hx: number, hy: number, hz: number }[], seed: number }} o
 *   from: kierunek (x, z) od środka planszy do gracza; kości lecą od jego strony w głąb planszy
 * @returns {null | { dt: number, frames: Float32Array, count: number, faces: number[], impacts: { t: number, v: number }[] }}
 */
export function simulateThrow(o) {
  if (!R) return null;
  const rand = seeded(o.seed);
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = runOnce(o, rand);
    if (res) return res;
  }
  return null;
}

const G = 62;          // grawitacja w jednostkach planszy (wolniej niż w rzeczywistości, żeby rzut było widać)
const DT = 1 / 120;
const MAX_STEPS = 600;

function runOnce(o, rand) {
  const world = new R.World({ x: 0, y: -G, z: 0 });
  world.timestep = DT;
  const { floorY, half, die, round } = o;
  // podłoga (środek planszy) i niewidoczne ściany wokół środka planszy
  const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
  world.createCollider(R.ColliderDesc.cuboid(half + 2, 0.5, half + 2).setTranslation(0, floorY - 0.5, 0).setFriction(0.6).setRestitution(0.3), ground);
  for (const [x, z, hx, hz] of [[half + 0.25, 0, 0.25, half + 0.5], [-half - 0.25, 0, 0.25, half + 0.5], [0, half + 0.25, half + 0.5, 0.25], [0, -half - 0.25, half + 0.5, 0.25]]) {
    world.createCollider(R.ColliderDesc.cuboid(hx, 3, hz).setTranslation(x, floorY + 3, z).setFriction(0.2).setRestitution(0.45), ground);
  }
  for (const b of o.obstacles) {
    world.createCollider(R.ColliderDesc.cuboid(b.hx, b.hy, b.hz).setTranslation(b.x, floorY + b.hy, b.z).setFriction(0.5).setRestitution(0.25), ground);
  }
  // kości: start nad krawędzią środka od strony gracza, lot w głąb planszy z obrotem
  const [fx, fz] = o.from, sx = -fz, sz = fx;          // bok (prostopadle do kierunku rzutu)
  const bodies = [0, 1].map(k => {
    const side = (k ? 1 : -1) * (0.45 + rand() * 0.3), back = half * (0.55 + rand() * 0.2);
    const desc = R.RigidBodyDesc.dynamic()
      .setTranslation(fx * back + sx * side, floorY + 1.6 + rand() * 0.9, fz * back + sz * side)
      .setRotation(randomQuat(rand))
      .setLinearDamping(0.15).setAngularDamping(0.35).setCcdEnabled(true);
    const body = world.createRigidBody(desc);
    const h = die / 2 - round;
    world.createCollider(R.ColliderDesc.roundCuboid(h, h, h, round).setDensity(1.2).setFriction(0.45).setRestitution(0.38), body);
    const speed = 7.5 + rand() * 2.5, drift = (rand() - 0.5) * 2.2;
    body.setLinvel({ x: -fx * speed + sx * drift, y: 1.5 + rand() * 2, z: -fz * speed + sz * drift }, true);
    body.setAngvel({ x: (rand() - 0.5) * 30, y: (rand() - 0.5) * 18, z: (rand() - 0.5) * 30 }, true);
    return body;
  });
  const frames = new Float32Array(MAX_STEPS * 14);
  const impacts = [];
  const lastV = bodies.map(() => 0);
  let count = 0, still = 0;
  for (let step = 0; step < MAX_STEPS; step++) {
    world.step();
    bodies.forEach((b, k) => {
      const p = b.translation(), q = b.rotation(), v = b.linvel(), off = count * 14 + k * 7;
      frames[off] = p.x; frames[off + 1] = p.y; frames[off + 2] = p.z;
      frames[off + 3] = q.x; frames[off + 4] = q.y; frames[off + 5] = q.z; frames[off + 6] = q.w;
      // uderzenie: nagła zmiana prędkości (do stukotu kości)
      const sp = Math.hypot(v.x, v.y, v.z), dv = lastV[k] - sp;
      if (dv > 1.2 && step > 2) impacts.push({ t: step * DT, v: Math.min(1, dv / 8) });
      lastV[k] = sp;
    });
    count++;
    const calm = bodies.every(b => { const v = b.linvel(), w = b.angvel(); return Math.hypot(v.x, v.y, v.z) < 0.05 && Math.hypot(w.x, w.y, w.z) < 0.1; });
    still = calm ? still + 1 : 0;
    if (still > 18) break;
  }
  const faces = [], ok = bodies.every(b => {
    const q = b.rotation(), p = b.translation(), up = upFace([q.x, q.y, q.z, q.w]);
    faces.push(up.face);
    // kość leży płasko na planszy (nie oparta o stos kart ani o drugą kość) i w środku planszy
    return up.dot > 0.985 && Math.abs(p.y - (floorY + die / 2)) < 0.05 && Math.abs(p.x) < half - 0.3 && Math.abs(p.z) < half - 0.3;
  });
  world.free();
  if (!ok || still <= 18) return null;
  // za blisko siebie po wylądowaniu wygląda jak sklejone: spróbuj jeszcze raz
  const a = (count - 1) * 14;
  if (Math.hypot(frames[a] - frames[a + 7], frames[a + 2] - frames[a + 9]) < die * 1.15) return null;
  return { dt: DT, frames: frames.subarray(0, count * 14), count, faces, impacts };
}

function randomQuat(rand) {
  const u1 = rand(), u2 = rand() * Math.PI * 2, u3 = rand() * Math.PI * 2;
  const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
  return { x: a * Math.sin(u2), y: a * Math.cos(u2), z: b * Math.sin(u3), w: b * Math.cos(u3) };
}
