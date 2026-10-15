# Wypukłe ikony pól planszy: Szansa (znak zapytania na krążku pół na pół) i Parking (znak P).
# Leżą na polu dokładnie nad nadrukowaną ikoną (ten sam środek i rozmiar), więc pole wygląda jak tłoczone.
# Rozmiary w jednostkach gry: pole ma 1,1 szerokości nadruku, krążek Szansy ma promień 0,23.
import math
import sys

import bpy  # najpierw bpy: dopiero on udostępnia bmesh i mathutils
import bmesh

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import (_bm_to_mesh, _obj, bake_ao, box, count, cyl, export, material, merge_by_material, no_ao, reset,
                    root, text)

reset()
PI = math.pi
green = material('chance_green', '#2E9E8A', rough=0.35, coat=0.8, coat_rough=0.15)
red = material('chance_red', '#D6534F', rough=0.35, coat=0.8, coat_rough=0.15)
white = material('icon_white', '#FFFFFF', rough=0.3, coat=0.6)
blue = material('parking_blue', '#1F5FBF', rough=0.32, coat=0.8, coat_rough=0.15)


def half_disc(name, radius, h, side, mat, parent, seg=40):
    # połówka krążka (side = -1 lewa, 1 prawa), z zaokrągloną krawędzią
    bm = bmesh.new()
    a0 = PI / 2 if side < 0 else -PI / 2
    pts = [(radius * math.cos(a0 + PI * k / seg), radius * math.sin(a0 + PI * k / seg)) for k in range(seg + 1)]
    bottom = [bm.verts.new((x, y, 0)) for x, y in pts]
    top = [bm.verts.new((x, y, h)) for x, y in pts]
    bm.faces.new(bottom[::-1])
    bm.faces.new(top)
    n = len(pts)
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((bottom[k], bottom[j], top[j], top[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _obj(name, _bm_to_mesh(name, bm), mat, (0, 0, 0), (0, 0, 0), parent)
    mod = o.modifiers.new('bevel', 'BEVEL')
    mod.width = 0.006
    mod.segments = 3
    mod.limit_method = 'ANGLE'
    return o


def glyph(name, ch, size, y, mat, parent, depth=0.012):
    # znak leży płasko (czytany z góry, góra znaku w stronę -Z gry, jak na nadruku pola)
    return text(name, ch, size, (0, y + depth * 0.2, 0), mat, parent, depth=depth, rot=(-PI / 2, 0, 0))


def chance():
    r = root('icon_chance')
    h = 0.016
    half_disc('left', 0.23, h, -1, green, r)
    half_disc('right', 0.23, h, 1, red, r)
    t = glyph('mark', '?', 0.34, h, white, r)
    t.modifiers.new('round', 'BEVEL').width = 0.002
    return r


def parking():
    r = root('icon_parking')
    box('frame', (0.493, 0.014, 0.493), (0, 0.007, 0), white, r, r=0.03, seg=4)
    box('sign', (0.435, 0.008, 0.435), (0, 0.016, 0), blue, r, r=0.03, seg=4)
    t = glyph('letter', 'P', 0.36, 0.02, white, r)
    t.modifiers.new('round', 'BEVEL').width = 0.002
    return r


roots = [chance(), parking()]
bake_ao(roots, distance=0.05, samples=32, ground=True, max_edge=0.08)
for r in roots:
    merge_by_material(r)
v, t = count(roots)
print(f'ikony: {v} wierzchołków, {t} trójkątów')
export(sys.argv[-1] if sys.argv[-1].endswith('.glb') else '/tmp/icons.glb', roots)
