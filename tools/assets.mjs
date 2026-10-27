// npm run assets: modele gry z Blendera (skrypty w tools/blender) do assets/models/*.glb.
// 1. Blender (bpy, w tools/blender/.venv) buduje model, wypala cienie kontaktowe i zapisuje surowy GLB.
// 2. glTF Transform łączy powtórzenia, kwantyzuje wierzchołki i kompresuje meshopt (plik kilka razy mniejszy).
// Gotowe pliki GLB są w repozytorium, więc do uruchomienia gry Blender nie jest potrzebny.
// Pierwsze uruchomienie: python3 -m venv tools/blender/.venv && tools/blender/.venv/bin/pip install bpy==5.0.1
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const PY = 'tools/blender/.venv/bin/python';
const MODELS = (process.argv.slice(2).length ? process.argv.slice(2) : ['pawns', 'buildings', 'icons', 'nature', 'boats']);
if (!existsSync(PY)) {
  console.error('Brak Blendera. Najpierw: python3 -m venv tools/blender/.venv && tools/blender/.venv/bin/pip install bpy==5.0.1');
  process.exit(1);
}
mkdirSync('assets/models', { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'wsiz-assets-'));
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

try {
  for (const name of MODELS) {
    const raw = join(tmp, `${name}.glb`), out = `assets/models/${name}.glb`;
    const t0 = Date.now();
    const log = execFileSync(PY, [`tools/blender/${name}.py`, raw], { encoding: 'utf8', maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'pipe'] });
    const summary = log.split('\n').filter(l => /wierzchołków/.test(l)).join(' ');
    const doc = await io.read(raw);
    await doc.transform(dedup(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(out, doc);
    const kb = n => `${Math.round(statSync(n).size / 1024)} KB`;
    console.log(`${out}: ${kb(raw)} → ${kb(out)} (${summary.trim()}, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
