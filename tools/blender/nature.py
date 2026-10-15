# Makieta v2: drzewa, krzew, palma i samochód. Rozmiary jak w starych modelach z kodu (drzewo ok. 3 jednostki,
# palma 3,6, samochód 1 x 2), więc gra podmienia je bez zmiany rozstawienia na makiecie.
# Korony drzew to kilka nieregularnych brył (szum zamiast gładkiej kuli), z cieniem kontaktowym wypalonym w Cycles.
import math
import random
import sys

import bpy  # najpierw bpy: dopiero on udostępnia bmesh i mathutils
import bmesh
from mathutils import Vector, noise

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import (_bm_to_mesh, _obj, bake_ao, box, count, cyl, export, group, lathe, material, merge_by_material,
                    no_ao, reset, root, smooth, sphere, std_materials, to_b, torus, tube)

reset()
M = std_materials()
PI = math.pi
leaf = [material('leaf_a', '#5DB850', rough=0.75), material('leaf_b', '#4FA845', rough=0.75), material('leaf_c', '#3E9440', rough=0.78)]
pine = material('pine', '#2F7D45', rough=0.8)
bark = material('bark', '#8A5A3B', rough=0.9)
birch = material('birch', '#ECE8E0', rough=0.8)
palm_bark = material('palm_bark', '#9C7148', rough=0.9)
frond = material('frond', '#3FA34D', rough=0.7)
nut = material('nut', '#6B4A2F', rough=0.6)
tyre = material('tyre', '#1E2127', rough=0.9)
glass_dark = material('car_glass', '#1D2A3A', rough=0.08, coat=1.0)
red_light = material('tail_light', '#FF3B30', emit='#FF3B30', emit_strength=2.0)


def blob(name, radius, pos, mat, parent, seed, rough=0.28, subdiv=3, squash=1.0):
    # nieregularna bryła korony: kula z przesuniętymi wierzchołkami (szum), gładko cieniowana
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in bm.verts:
        d = v.co.normalized()
        n = noise.noise(d * 1.6 + off) * 0.6 + noise.noise(d * 4.2 + off) * 0.25
        v.co = d * radius * (1 + rough * n)
        v.co.z *= squash
    o = _obj(name, _bm_to_mesh(name, bm), mat, pos, (0, 0, 0), parent)
    smooth(o, 80)
    return o


def round_tree(name, seed, mats):
    rnd = random.Random(seed)
    r = root(name)
    cyl('trunk', 0.11, 0.17, 1.5, (0, 0.75, 0), bark, r, seg=10, r=0.02)
    for k in range(3):   # gałęzie pod koroną
        a = rnd.uniform(0, 2 * PI) + k * 2.1
        tube(f'branch{k}', [(0, 1.1 + k * 0.12, 0), (0.25 * math.cos(a), 1.45 + k * 0.1, 0.25 * math.sin(a)),
                            (0.5 * math.cos(a), 1.75 + k * 0.08, 0.5 * math.sin(a))], 0.045, bark, r)
    blob('crown0', 0.95, (0, 2.05, 0), mats[0], r, seed, squash=0.92)
    for k in range(5):
        a = k * 2 * PI / 5 + rnd.uniform(-0.3, 0.3)
        rr = rnd.uniform(0.45, 0.62)
        blob(f'crown{k + 1}', rnd.uniform(0.5, 0.68), (rr * math.cos(a), rnd.uniform(1.65, 2.35), rr * math.sin(a)),
             mats[(k + 1) % len(mats)], r, seed + k + 1, subdiv=2)
    blob('crowntop', 0.55, (0.1, 2.75, -0.05), mats[1 % len(mats)], r, seed + 9, subdiv=2)
    return r


def pine_tree(name, seed):
    rnd = random.Random(seed)
    r = root(name)
    cyl('trunk', 0.08, 0.14, 1.2, (0, 0.6, 0), bark, r, seg=10, r=0.015)
    for k in range(5):   # piętra gałęzi: każde to stożek z opadającym, postrzępionym brzegiem
        y = 0.75 + k * 0.48
        rad = 1.05 - k * 0.19
        pts = [(0.0, y + 0.85 - k * 0.04)]
        pts += [(rad * 0.35, y + 0.45), (rad * 0.8, y + 0.12), (rad, y - 0.02), (rad * 0.92, y - 0.08), (0.0, y - 0.02)]
        o = lathe(f'tier{k}', pts, (0, 0, 0), pine, r, seg=14, rot=(0, rnd.uniform(0, PI), 0))
        me = o.data
        for v in me.vertices:   # postrzępiony brzeg: końce gałęzi raz niżej, raz wyżej
            d = math.hypot(v.co.x, v.co.y)
            if d > rad * 0.6:
                a = math.atan2(v.co.y, v.co.x)
                v.co.z -= 0.08 * (0.5 + 0.5 * math.sin(a * 7 + k)) * (d / rad)
    return r


def birch_tree(name, seed):
    rnd = random.Random(seed)
    r = root(name)
    cyl('trunk', 0.07, 0.11, 2.4, (0, 1.2, 0), birch, r, seg=10, r=0.015)
    for k in range(7):   # czarne paski na korze brzozy
        box(f'mark{k}', (0.06, 0.03, 0.02), (0.06 * math.cos(k * 2.4), 0.4 + k * 0.28, 0.06 * math.sin(k * 2.4) + 0.05), M['rubber'], r,
            rot=(0, k * 2.4, 0))
    for k in range(4):
        a = k * PI / 2 + rnd.uniform(-0.4, 0.4)
        blob(f'crown{k}', rnd.uniform(0.42, 0.55), (0.3 * math.cos(a), 2.2 + k * 0.22, 0.3 * math.sin(a)), leaf[k % 2], r, seed + k, subdiv=2, squash=1.2)
    blob('crowntop', 0.4, (0, 3.05, 0), leaf[0], r, seed + 7, subdiv=2, squash=1.25)
    return r


def frond_mesh(name, length, pos, rot, parent, droop=0.55):
    # liść palmy: środkowy nerw łukiem w dół i listki po obu stronach (zygzak)
    bm = bmesh.new()
    n = 10
    prev = None
    for i in range(n + 1):
        t = i / n
        x = t * length
        y = -droop * length * t * t
        w = 0.32 * math.sin(PI * min(1, t * 1.15)) * (1 - 0.3 * t)
        c = bm.verts.new((x, 0, y))
        l = bm.verts.new((x + 0.08, w, y - 0.04 * t))
        rr = bm.verts.new((x + 0.08, -w, y - 0.04 * t))
        if prev:
            pc, pl, pr = prev
            bm.faces.new((pc, c, l, pl))
            bm.faces.new((pc, pr, rr, c))
        prev = (c, l, rr)
    o = _obj(name, _bm_to_mesh(name, bm), frond, pos, rot, parent)
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.012
    smooth(o, 70)
    return o


def palm_tree(name, seed, h=3.6):
    rnd = random.Random(seed)
    r = root(name)
    pts = []
    for k in range(9):   # pień wygięty łukiem, z pierścieniami
        t = k / 8
        pts.append((0.55 * t * t, h * t, 0))
    tube('trunk', pts, 0.13, palm_bark, r)
    for k in range(1, 8):
        t = k / 8
        torus(f'ring{k}', 0.135 - 0.01 * t, 0.018, (0.55 * t * t, h * t, 0), palm_bark, r, rot=(0, 0, -0.18 * t), seg=16, mseg=6)
    top = (0.55, h, 0)
    for k in range(9):
        a = k * 2 * PI / 9 + rnd.uniform(-0.15, 0.15)
        frond_mesh(f'frond{k}', rnd.uniform(1.6, 2.0), top, (0, a, rnd.uniform(-0.25, 0.15)), r, droop=rnd.uniform(0.45, 0.65))
    for k in range(4):
        sphere(f'nut{k}', 0.1, (top[0] + 0.14 * math.cos(k * 1.6), h - 0.12, 0.14 * math.sin(k * 1.6)), nut, r)
    return r


def bush(name, seed):
    rnd = random.Random(seed)
    r = root(name)
    for k in range(4):
        a = k * PI / 2 + rnd.uniform(-0.4, 0.4)
        blob(f'b{k}', rnd.uniform(0.35, 0.48), (0.3 * math.cos(a), 0.32, 0.3 * math.sin(a)), leaf[k % 3], r, seed + k, subdiv=2, squash=0.8)
    blob('btop', 0.38, (0, 0.55, 0), leaf[1], r, seed + 5, subdiv=2, squash=0.8)
    return r


def car():
    # samochód 1 x 2: karoseria w kolorze (gra podmienia materiał player), szyby, koła z felgami, światła
    r = root('car')
    box('body', (1.0, 0.36, 2.0), (0, 0.38, 0), M['player'], r, r=0.12, seg=4)
    box('hood', (0.96, 0.08, 0.6), (0, 0.58, 0.62), M['player'], r, r=0.04, seg=3)
    box('cabin', (0.88, 0.38, 1.1), (0, 0.74, -0.12), M['player'], r, r=0.12, seg=4)
    box('windshield', (0.8, 0.3, 0.02), (0, 0.76, 0.42), glass_dark, r, rot=(-0.45, 0, 0), r=0.008)
    box('rear', (0.8, 0.28, 0.02), (0, 0.76, -0.67), glass_dark, r, rot=(0.4, 0, 0), r=0.008)
    for x in (-1, 1):
        box(f'side{x}', (0.02, 0.24, 0.92), (x * 0.441, 0.78, -0.12), glass_dark, r, r=0.006)
        box(f'mirror{x}', (0.1, 0.06, 0.05), (x * 0.52, 0.66, 0.32), M['player'], r, r=0.015)
    for x in (-1, 1):
        cyl(f'head{x}', 0.065, 0.065, 0.03, (x * 0.32, 0.45, 1.0), M['led_white'], r, rot=(PI / 2, 0, 0), seg=16)
        box(f'tail{x}', (0.18, 0.07, 0.03), (x * 0.33, 0.47, -1.0), red_light, r, r=0.01)
    box('grille', (0.4, 0.07, 0.02), (0, 0.38, 1.005), M['rubber'], r, r=0.01)
    for x, z in ((-0.47, -0.62), (0.47, -0.62), (-0.47, 0.62), (0.47, 0.62)):
        cyl(f'tyre{x}{z}', 0.19, 0.19, 0.14, (x, 0.19, z), tyre, r, rot=(0, 0, PI / 2), seg=24, r=0.04)
        cyl(f'rim{x}{z}', 0.1, 0.1, 0.15, (x, 0.19, z), M['steel'], r, rot=(0, 0, PI / 2), seg=16, r=0.01)
    return r


roots = [round_tree('tree_round_a', 3, leaf), round_tree('tree_round_b', 11, [leaf[1], leaf[2], leaf[0]]),
         round_tree('tree_round_c', 23, [leaf[2], leaf[0], leaf[1]]), pine_tree('tree_pine', 5), birch_tree('tree_birch', 8),
         palm_tree('palm', 4), bush('bush', 6), car()]
bake_ao(roots, distance=0.35, samples=48, max_edge=0.22)
for r in roots:
    merge_by_material(r)
no_ao([o for r in roots for o in r.children_recursive if o.type == 'MESH' and o.data.materials
       and o.data.materials[0].name in ('led_white', 'tail_light')])
v, t = count(roots)
print(f'makieta: {v} wierzchołków, {t} trójkątów')
export(sys.argv[-1] if sys.argv[-1].endswith('.glb') else '/tmp/nature.glb', roots)
