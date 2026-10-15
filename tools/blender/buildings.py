# Budynki v2 (poziomy pola): 1 telefon, 2 laptop, 3 komputer, 4 szafa rack, 5 serwerownia (hotel).
# Wymiary jak w starych budynkach z kodu (gra ustawia skalę na polu i w widoku Modele).
# Materiały player* gra zamienia na kolor właściciela pola, „screen” na obraz ekranu, „keys” na klawiaturę.
import math
import sys

import bpy  # najpierw bpy: dopiero on udostępnia bmesh i mathutils

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import (box, bake_ao, count, cyl, export, group, material, merge_by_material, no_ao, quad, reset, root,
                    sphere, std_materials, torus, tube)

reset()
M = std_materials()
M['fan_blade'] = material('fan_blade', '#E9EEF6', rough=0.42)
PI = math.pi


# ---------------------------------------------------------------------------
# 1. Telefon na stojaku: szklany front z wyspą na aparat, przyciski, wyspa aparatów z tyłu
# ---------------------------------------------------------------------------
def phone():
    r = root('phone')
    box('stand', (0.24, 0.022, 0.2), (0, 0.011, 0), M['player_light'], r, r=0.008)
    box('lip', (0.24, 0.035, 0.02), (0, 0.035, 0.075), M['player_light'], r, r=0.006)
    box('pad', (0.2, 0.006, 0.026), (0, 0.025, 0.055), M['rubber'], r, r=0.002)
    t = group('tilt', r, (0, 0.024, 0.05), (-0.32, 0, 0))
    box('body', (0.2, 0.4, 0.024), (0, 0.2, 0), M['player'], t, r=0.011, seg=4)
    box('glass', (0.19, 0.39, 0.002), (0, 0.2, 0.0118), M['rubber'], t, r=0.0009)
    quad('screen', 0.178, 0.37, (0, 0.2, 0.0131), M['screen'], t)
    box('island', (0.044, 0.011, 0.001), (0, 0.371, 0.0135), M['rubber'], t, r=0.0005)
    for y, h in ((0.31, 0.06), (0.24, 0.035), (0.19, 0.035)):
        box(f'btn{y}', (0.004, h, 0.008), (0.101 if y > 0.3 else -0.101, y, 0), M['player_dark'], t, r=0.0015)
    box('campad', (0.08, 0.08, 0.006), (-0.045, 0.33, -0.014), M['player_dark'], t, r=0.006)
    for dx, dy in ((-0.017, 0.017), (0.017, -0.017)):
        cyl(f'lensring{dx}', 0.0145, 0.0145, 0.006, (-0.045 + dx, 0.33 + dy, -0.019), M['steel'], t, rot=(PI / 2, 0, 0), seg=28, r=0.0015)
        cyl(f'lens{dx}', 0.0105, 0.0105, 0.004, (-0.045 + dx, 0.33 + dy, -0.0215), M['rubber'], t, rot=(PI / 2, 0, 0), seg=24)
    cyl('flash', 0.005, 0.005, 0.002, (-0.028, 0.313, -0.0175), M['led_white'], t, rot=(PI / 2, 0, 0), seg=12)
    b = group('bracegrp', r, (0, 0.1, -0.05), (0.45, 0, 0))
    box('brace', (0.06, 0.2, 0.02), (0, 0, 0), M['player_light'], b, r=0.006)
    return r


# ---------------------------------------------------------------------------
# 2. Laptop: klawiatura, gładzik, zawias, ramka ekranu z kamerką, świecące logo na klapie
# ---------------------------------------------------------------------------
def laptop():
    r = root('laptop')
    box('base', (0.62, 0.03, 0.42), (0, 0.015, 0), M['player'], r, r=0.013, seg=4)
    box('deck', (0.56, 0.003, 0.215), (0, 0.0298, -0.06), M['rubber'], r, r=0.002)
    quad('keys', 0.54, 0.19, (0, 0.0316, -0.06), M['keys'], r, rot=(-PI / 2, 0, 0))
    box('trackpad', (0.17, 0.002, 0.09), (0, 0.0305, 0.125), M['player_light'], r, r=0.003)
    for x in (-0.288, 0.288):
        box(f'grille{x}', (0.02, 0.002, 0.18), (x, 0.0302, -0.06), M['player_dark'], r, r=0.001)
    cyl('hinge', 0.011, 0.011, 0.46, (0, 0.03, -0.2), M['dark_metal'], r, rot=(0, 0, PI / 2), seg=20)
    h = group('lidgrp', r, (0, 0.03, -0.2), (-1.83, 0, 0))
    box('lid', (0.62, 0.016, 0.41), (0, 0.008, 0.205), M['player'], h, r=0.006)
    box('bezel', (0.6, 0.002, 0.39), (0, -0.0005, 0.205), M['rubber'], h, r=0.001)
    quad('screen', 0.56, 0.34, (0, -0.0018, 0.215), M['screen'], h, rot=(PI / 2, 0, 0))
    cyl('webcam', 0.004, 0.004, 0.001, (0, -0.0017, 0.398), M['dark_metal'], h, seg=12)
    cyl('logo', 0.045, 0.045, 0.0012, (0, 0.0166, 0.21), M['player_glow'], h, seg=40)
    return r


# ---------------------------------------------------------------------------
# 3. Komputer: monitor z cienką ramką, obudowa ze szklanym bokiem i podświetlanym wnętrzem
#    (karta graficzna, pamięć RAM, chłodzenie wodne, wentylator), klawiatura, mysz na podkładce
# ---------------------------------------------------------------------------
def computer():
    r = root('computer')
    mx = -0.12
    box('monitor', (0.8, 0.5, 0.04), (mx, 0.49, -0.1), M['player'], r, r=0.014)
    box('mbezel', (0.784, 0.484, 0.002), (mx, 0.49, -0.0795), M['rubber'], r, r=0.006)
    quad('screen', 0.74, 0.44, (mx, 0.494, -0.0782), M['screen'], r)
    box('chinlogo', (0.06, 0.006, 0.001), (mx, 0.256, -0.0784), M['player_glow'], r, r=0.0008)
    box('neck', (0.06, 0.25, 0.03), (mx, 0.15, -0.135), M['player_dark'], r, r=0.008)
    box('foot', (0.3, 0.018, 0.18), (mx, 0.009, -0.12), M['player_dark'], r, r=0.008)
    # obudowa (pusta w środku), szklany bok od strony +X
    x0, x1, z0, z1, H = 0.36, 0.56, -0.29, 0.13, 0.5
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    box('caseL', (0.012, H, z1 - z0), (x0 + 0.006, H / 2, cz), M['player'], r, r=0.004)
    box('caseT', (x1 - x0, 0.012, z1 - z0), (cx, H - 0.006, cz), M['player'], r, r=0.004)
    box('caseB', (x1 - x0, 0.012, z1 - z0), (cx, 0.016, cz), M['player'], r, r=0.004)
    box('caseF', (x1 - x0, H, 0.014), (cx, H / 2, z1 - 0.007), M['player'], r, r=0.006)
    box('caseK', (x1 - x0, H, 0.012), (cx, H / 2, z0 + 0.006), M['player_dark'], r, r=0.004)
    for z in (z0 + 0.006, z1 - 0.007):
        box(f'edge{z}', (0.012, H, 0.012), (x1 - 0.006, H / 2, z), M['player'], r, r=0.004)
    box('sideglass', (0.004, H - 0.03, z1 - z0 - 0.026), (x1 - 0.004, H / 2, cz), M['glass'], r, r=0.001)
    for fx in (x0 + 0.03, x1 - 0.03):
        for fz in (z0 + 0.04, z1 - 0.04):
            cyl(f'cfoot{fx}{fz}', 0.014, 0.016, 0.01, (fx, 0.005, fz), M['rubber'], r, seg=16)
    box('frontled', (0.012, 0.38, 0.003), (0.41, 0.27, z1 + 0.0015), M['player_glow'], r)
    cyl('power', 0.013, 0.013, 0.004, (0.5, 0.44, z1 + 0.001), M['led_white'], r, rot=(PI / 2, 0, 0), seg=20)
    # wnętrze
    box('mobo', (0.004, 0.42, 0.34), (x0 + 0.016, 0.26, cz - 0.01), M['pcb'], r)
    box('psu', (0.18, 0.07, 0.38), (cx + 0.004, 0.057, cz), M['player_dark'], r, r=0.004)
    box('gpu', (0.13, 0.034, 0.26), (x0 + 0.085, 0.2, cz + 0.01), M['dark_metal'], r, r=0.004)
    box('gpurgb', (0.002, 0.008, 0.22), (x0 + 0.151, 0.205, cz + 0.01), M['player_glow'], r)
    for k in range(4):
        box(f'ram{k}', (0.03, 0.08, 0.006), (x0 + 0.035, 0.36, -0.035 + k * 0.013), M['dark_metal'], r, r=0.001)
        box(f'ramrgb{k}', (0.006, 0.008, 0.006), (x0 + 0.052, 0.401, -0.035 + k * 0.013), M['player_glow'], r)
    cyl('pump', 0.03, 0.03, 0.018, (x0 + 0.03, 0.34, -0.13), M['dark_metal'], r, rot=(0, 0, -PI / 2), seg=32, r=0.004)
    torus('pumpring', 0.024, 0.0025, (x0 + 0.04, 0.34, -0.13), M['player_glow'], r, rot=(0, 0, -PI / 2), seg=32, mseg=6)
    tube('hose1', [(x0 + 0.04, 0.34, -0.115), (x0 + 0.08, 0.42, -0.06), (x0 + 0.1, 0.475, 0.02)], 0.006, M['rubber'], r)
    tube('hose2', [(x0 + 0.04, 0.33, -0.145), (x0 + 0.09, 0.44, -0.2), (x0 + 0.1, 0.475, -0.24)], 0.006, M['rubber'], r)
    box('radiator', (0.1, 0.02, 0.32), (x0 + 0.1, 0.475, cz), M['dark_metal'], r, r=0.003)
    for k, z in enumerate((cz - 0.1, cz, cz + 0.1)):
        torus(f'topfan{k}', 0.042, 0.003, (x0 + 0.1, 0.462, z), M['player_glow'], r, seg=32, mseg=6)
    torus('rearring', 0.045, 0.0035, (cx, 0.38, z0 + 0.016), M['player_glow'], r, rot=(PI / 2, 0, 0), seg=32, mseg=6)
    # klawiatura, mysz, podkładka
    box('kbd', (0.52, 0.024, 0.15), (mx, 0.012, 0.2), M['player_light'], r, r=0.008)
    quad('keys', 0.48, 0.12, (mx, 0.0246, 0.2), M['keys'], r, rot=(-PI / 2, 0, 0))
    box('mousepad', (0.2, 0.004, 0.16), (0.3, 0.002, 0.22), M['rubber'], r, r=0.004)
    sphere('mouse', 0.04, (0.3, 0.02, 0.22), M['player_light'], r, scale=(0.85, 0.5, 1.4))
    cyl('wheel', 0.008, 0.008, 0.006, (0.3, 0.039, 0.195), M['rubber'], r, rot=(0, 0, PI / 2), seg=16)
    return r


# ---------------------------------------------------------------------------
# 4. Szafa rack: rama, osiem serwerów z kratkami, dyskami, diodami i uchwytami, szklane drzwi
# ---------------------------------------------------------------------------
def rack_parts(r, detail=True):
    # detail=False: prostsza szafa do serwerowni (z daleka nie widać dysków i kratek, a model jest lżejszy)
    W, H, D = 0.4, 0.86, 0.42
    box('frame', (W, H, D), (0, H / 2 + 0.03, 0), M['player'], r, r=0.01)
    box('top', (W + 0.01, 0.03, D + 0.01), (0, H + 0.045, 0), M['player_light'], r, r=0.008)
    box('inner', (W - 0.04, H - 0.05, 0.004), (0, H / 2 + 0.03, D / 2 + 0.002), M['rubber'], r)
    for x in (-1, 1):
        for k in range(6):   # kratki wentylacyjne na bokach
            box(f'vent{x}{k}', (0.003, 0.012, D - 0.12), (x * (W / 2 + 0.001), 0.2 + k * 0.1, 0), M['player_dark'], r, r=0.002)
    for fx, fz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        cyl(f'leg{fx}{fz}', 0.018, 0.02, 0.03, (fx * (W / 2 - 0.03), 0.015, fz * (D / 2 - 0.03)), M['rubber'], r, seg=16)
    for k in range(8):
        y = 0.1 + k * 0.1
        z = D / 2 + 0.008
        box(f'unit{k}', (W - 0.05, 0.075, 0.016), (0, y, z), M['player_dark'], r, r=0.003)
        if not detail:
            box(f'uled{k}', (0.12, 0.012, 0.002), (-0.06, y, z + 0.009), M['player_glow'], r)
            cyl(f'udot{k}', 0.008, 0.008, 0.002, (0.13, y, z + 0.009), M['led_green'] if k % 3 else M['led_white'], r, rot=(PI / 2, 0, 0), seg=10)
            continue
        for j in range(4):   # dyski
            box(f'drive{k}{j}', (0.045, 0.05, 0.003), (-0.1 + j * 0.05, y, z + 0.009), M['player_light'], r)
            cyl(f'dled{k}{j}', 0.0035, 0.0035, 0.002, (-0.1 + j * 0.05 + 0.014, y - 0.017, z + 0.011), M['led_green'] if (k + j) % 3 else M['led_white'],
                r, rot=(PI / 2, 0, 0), seg=8)
        for g in range(5):   # kratka
            box(f'grill{k}{g}', (0.05, 0.004, 0.002), (0.12, y - 0.024 + g * 0.012, z + 0.009), M['rubber'], r)
        for x in (-1, 1):   # uchwyty
            box(f'handle{k}{x}', (0.008, 0.05, 0.012), (x * (W / 2 - 0.035), y, z + 0.012), M['steel'], r, r=0.002, seg=2)
    box('door', (W - 0.02, H - 0.04, 0.005), (0, H / 2 + 0.03, D / 2 + 0.036), M['glass'], r, r=0.002)
    for x in (-1, 1):
        box(f'doorframe{x}', (0.014, H - 0.04, 0.008), (x * (W / 2 - 0.017), H / 2 + 0.03, D / 2 + 0.036), M['player'], r, r=0.003)
    for y in (0.06, H + 0.0):
        box(f'doorframey{y}', (W - 0.02, 0.014, 0.008), (0, y, D / 2 + 0.036), M['player'], r, r=0.003)
    cyl('doorhandle', 0.006, 0.006, 0.16, (W / 2 - 0.04, H / 2 + 0.03, D / 2 + 0.05), M['steel'], r, seg=12, r=0.002)


def rack():
    r = root('rack')
    rack_parts(r)
    return r


# ---------------------------------------------------------------------------
# 5. Serwerownia (hotel): podłoga techniczna z płyt, ściany, trzy szafy, korytko kablowe,
#    klimatyzacja i ekran z wykresem na ścianie
# ---------------------------------------------------------------------------
def server_room():
    r = root('serverroom')
    box('slab', (1.3, 0.035, 0.95), (0, 0.0175, 0), M['player_dark'], r, r=0.006)
    n, m = 8, 6
    for i in range(n):
        for j in range(m):
            box(f'tile{i}_{j}', (1.3 / n - 0.008, 0.014, 0.95 / m - 0.008), (-0.65 + (i + 0.5) * 1.3 / n, 0.042, -0.475 + (j + 0.5) * 0.95 / m),
                M['player_light'] if (i + j) % 5 else M['brushed'], r)
    box('back', (1.3, 0.62, 0.05), (0, 0.36, -0.45), M['player'], r, r=0.008)
    box('side', (0.05, 0.62, 0.95), (-0.625, 0.36, 0), M['player'], r, r=0.008)
    box('band', (1.32, 0.05, 0.06), (0, 0.695, -0.45), M['player_dark'], r, r=0.006)
    box('band2', (0.06, 0.05, 0.97), (-0.625, 0.695, 0), M['player_dark'], r, r=0.006)
    for k in range(3):
        g = group(f'rackgrp{k}', r, (-0.3 + k * 0.33, 0.049, -0.18))
        g.scale = (0.62, 0.62, 0.62)
        rack_parts(g, detail=False)
    box('tray', (1.0, 0.03, 0.08), (0.03, 0.66, -0.18), M['dark_metal'], r, r=0.004)
    for k in range(6):
        tube(f'cable{k}', [(-0.3 + k * 0.12, 0.66, -0.16), (-0.28 + k * 0.12, 0.62, -0.1), (-0.27 + k * 0.12, 0.6, -0.05)],
             0.004, M['rubber'] if k % 2 else M['player_glow'], r)
    box('ac', (0.3, 0.12, 0.08), (0.35, 0.55, -0.4), M['player_light'], r, r=0.02)
    for k in range(4):
        box(f'louver{k}', (0.24, 0.006, 0.012), (0.35, 0.505 + k * 0.004, -0.356 + k * 0.002), M['player_dark'], r, r=0.002)
    cyl('acled', 0.004, 0.004, 0.002, (0.47, 0.58, -0.359), M['led_cyan'], r, rot=(PI / 2, 0, 0), seg=10)
    box('tvframe', (0.012, 0.2, 0.32), (-0.594, 0.42, 0.12), M['rubber'], r, r=0.004)
    quad('screen', 0.3, 0.18, (-0.5875, 0.42, 0.12), M['screen'], r, rot=(0, PI / 2, 0))
    return r


roots = [phone(), laptop(), computer(), rack(), server_room()]
bake_ao(roots, distance=0.14, samples=48, max_edge=0.09)
for r in roots:
    merge_by_material(r)
no_ao([o for r in roots for o in r.children_recursive if o.type == 'MESH' and o.data.materials
       and o.data.materials[0].name in ('glass', 'player_glow', 'led_cyan', 'led_orange', 'led_white', 'led_green', 'screen')])
v, t = count(roots)
print(f'budynki: {v} wierzchołków, {t} trójkątów')
export(sys.argv[-1] if sys.argv[-1].endswith('.glb') else '/tmp/buildings.glb', roots)
