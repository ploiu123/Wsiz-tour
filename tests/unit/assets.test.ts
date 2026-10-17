import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

// Modele z Blendera (npm run assets): gra szuka w nich konkretnych nazw, więc je sprawdzamy
const read = async (file: string): Promise<Document> => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  return io.read(file);
};
const roots = (doc: Document) => doc.getRoot().listScenes()[0].listChildren();
const names = (doc: Document) => doc.getRoot().listNodes().map(n => n.getName());
const materials = (doc: Document) => doc.getRoot().listMaterials().map(m => m.getName());

describe('modele z Blendera', () => {
  it('pionki: osiem modeli, materiały gracza, ruchome części i cień kontaktowy', async () => {
    const doc = await read('assets/models/pawns.glb');
    expect(roots(doc).map(n => n.getName()).sort()).toEqual(['banner', 'cap', 'drone', 'espresso', 'miner', 'printer', 'robot', 'rocket']);
    expect(materials(doc)).toEqual(expect.arrayContaining(['player', 'player_band', 'player_glow', 'gold', 'glass']));
    const n = names(doc);
    for (const part of ['coin', 'print', 'carriage', 'fan_0', 'fan_5', 'flame']) expect(n).toContain(part);
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) expect(prim.getAttribute('COLOR_0'), mesh.getName()).toBeTruthy();
    }
    expect(statSync('assets/models/pawns.glb').size).toBeLessThan(1.4e6);
  }, 30_000);

  it('budynki: pięć poziomów, ekrany z mapowaniem obrazu, materiały gracza', async () => {
    const doc = await read('assets/models/buildings.glb');
    expect(roots(doc).map(n => n.getName()).sort()).toEqual(['computer', 'laptop', 'phone', 'rack', 'serverroom']);
    expect(materials(doc)).toEqual(expect.arrayContaining(['player', 'player_dark', 'player_light', 'player_glow', 'screen', 'keys']));
    const screens = doc.getRoot().listMeshes().flatMap(m => m.listPrimitives()).filter(p => p.getMaterial()?.getName() === 'screen');
    expect(screens.length).toBeGreaterThanOrEqual(4);
    for (const p of screens) expect(p.getAttribute('TEXCOORD_0')).toBeTruthy();
    expect(statSync('assets/models/buildings.glb').size).toBeLessThan(1.2e6);
  }, 30_000);

  it('makieta i ikony pól: drzewa, palma, krzew, samochód, Szansa i Parking', async () => {
    const nature = await read('assets/models/nature.glb');
    expect(roots(nature).map(n => n.getName()).sort()).toEqual(
      ['bush', 'car', 'palm', 'tree_birch', 'tree_pine', 'tree_round_a', 'tree_round_b', 'tree_round_c']);
    expect(materials(nature)).toContain('player');   // kolor samochodu podmienia gra
    const icons = await read('assets/models/icons.glb');
    expect(roots(icons).map(n => n.getName()).sort()).toEqual(['icon_chance', 'icon_parking']);
    expect(statSync('assets/models/nature.glb').size + statSync('assets/models/icons.glb').size).toBeLessThan(0.8e6);
  }, 30_000);
});
