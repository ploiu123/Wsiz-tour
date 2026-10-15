// Modele z Blendera (assets/models/*.glb, robi je npm run assets). Wczytują się w tle przy starcie gry;
// każdy pionek i budynek to kopia modelu z biblioteki (siatki wspólne, materiały gracza podmienione).
// Gdy pliku nie ma albo się nie wczyta, gra zostaje przy modelach z kodu.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const FILES = ['assets/models/pawns.glb', 'assets/models/buildings.glb', 'assets/models/icons.glb', 'assets/models/nature.glb'];
const lib = new Map();   // nazwa modelu (korzeń w pliku GLB) → obiekt
let loading = null;

export function loadModels() {
  loading ??= (async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    await Promise.all(FILES.map(async url => {
      try {
        const gltf = await loader.loadAsync(url);
        for (const o of [...gltf.scene.children]) {
          o.traverse(m => { if (m.isMesh) m.userData.shared = true; });   // siatki wspólne dla wszystkich kopii
          lib.set(o.name, o);
        }
      } catch (err) {
        console.warn('Model niedostępny, zostaje model z kodu:', url, err?.message || err);
      }
    }));
    return lib.size;
  })();
  return loading;
}

export const hasModel = name => lib.has(name);

/**
 * Kopia modelu. `swap(materialName, mesh)` zwraca materiał na miejsce materiału z pliku
 * (kolor gracza, ekran, klawiatura) albo nic, wtedy zostaje materiał z pliku.
 * @param {string} name
 * @param {(name: string, mesh: any) => any} swap
 */
export function cloneModel(name, swap) {
  const src = lib.get(name);
  if (!src) return null;
  const o = src.clone(true);
  o.position.set(0, 0, 0);
  o.rotation.set(0, 0, 0);
  o.traverse(m => {
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = false;
    const rep = swap(m.material.name, m);
    if (rep) m.material = rep;
  });
  return o;
}
