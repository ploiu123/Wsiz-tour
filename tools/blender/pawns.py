# Pionki v2: sztandar uczelni, drukarka 3D, koparka kryptowalut, ekspres do kawy.
# Wymiary jak w starych pionkach z kodu (podstawa o promieniu 0,226), więc pasują do pól planszy.
# Uruchomienie: npm run assets (albo tools/blender/.venv/bin/python tools/blender/pawns.py wyjście.glb)
import math
import sys

import bpy  # najpierw bpy: dopiero on udostępnia bmesh i mathutils
import bmesh
from mathutils import Vector

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import (box, bake_ao, count, cyl, export, group, lathe, material, merge_by_material, no_ao, reset,
                    root, smooth, sphere, std_materials, text, torus, tube, _obj, _bm_to_mesh)

reset()
M = std_materials()
M['coffee'] = material('coffee', '#3B2416', rough=0.12)
M['crema'] = material('crema', '#B9834F', rough=0.5)
M['fan_blade'] = material('fan_blade', '#E9EEF6', rough=0.42)
PI = math.pi
Y0 = 0.078   # wysokość blatu podstawy: tu stoją części pionka


def pawn_base(r):
    # lakierowany granatowy krążek uczelni z zaokrąglonym brzegiem, pas w kolorze gracza,
    # szczotkowana płytka ze srebrnym rantem i złotą inkrustacją
    cyl('base', 0.212, 0.226, 0.05, (0, 0.025, 0), M['navy'], r, seg=64, r=0.012, bseg=4)
    cyl('band', 0.2145, 0.2145, 0.014, (0, 0.057, 0), M['player_band'], r, seg=64, r=0.002, bseg=2)
    cyl('plate', 0.197, 0.205, 0.014, (0, 0.071, 0), M['plate'], r, seg=64, r=0.004, bseg=2)
    torus('rim', 0.201, 0.0055, (0, 0.0775, 0), M['brushed'], r, seg=64)
    torus('inlay', 0.168, 0.0026, (0, 0.0782, 0), M['gold'], r, seg=64, mseg=8)


def fan(name, radius, pos, mat, parent, rot, blades=7):
    # wirnik wentylatora: łopatki z lekkim skrętem; leży w płaszczyźnie XZ gry, obrót przez `rot`
    bm = bmesh.new()
    hub = radius * 0.32
    for i in range(blades):
        a0 = 2 * PI * i / blades
        span = 2 * PI / blades * 0.62
        ring = []
        steps = 4
        for s in range(steps + 1):
            a = a0 + span * s / steps
            lift = 0.0045 * (s / steps - 0.5)   # skręt łopatki
            ring.append((a, lift))
        verts_in = [bm.verts.new((hub * math.cos(a), hub * math.sin(a), lift)) for a, lift in ring]
        verts_out = [bm.verts.new((radius * math.cos(a + 0.18), radius * math.sin(a + 0.18), lift * 1.6)) for a, lift in ring]
        for s in range(steps):
            bm.faces.new((verts_in[s], verts_in[s + 1], verts_out[s + 1], verts_out[s]))
    o = _obj(name, _bm_to_mesh(name, bm), mat, pos, rot, parent)
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.0016
    smooth(o, 60)
    return o


# ---------------------------------------------------------------------------
# 1. Sztandar uczelni: złote drzewce z pierścieniami, grot, sznur z chwostem (flagę dodaje gra)
# ---------------------------------------------------------------------------
def banner():
    r = root('banner')
    pawn_base(r)
    px = -0.1
    cyl('foot1', 0.062, 0.07, 0.022, (px, Y0 + 0.011, 0), M['gold_dark'], r, r=0.006)
    cyl('foot2', 0.04, 0.05, 0.03, (px, Y0 + 0.037, 0), M['gold'], r, r=0.006)
    torus('footring', 0.044, 0.004, (px, Y0 + 0.025, 0), M['gold'], r, mseg=8)
    cyl('pole', 0.0145, 0.0155, 0.84, (px, Y0 + 0.052 + 0.42, 0), M['gold'], r, seg=24)
    for y in (0.3, 0.52, 0.93):
        torus(f'ring{y}', 0.0175, 0.0045, (px, y, 0), M['gold_dark'], r, seg=24, mseg=8)
    sphere('knob', 0.032, (px, 0.968, 0), M['gold'], r)
    torus('collar', 0.02, 0.006, (px, 0.94, 0), M['gold'], r, seg=24, mseg=10)
    lathe('spear', [(0.0, 0.99), (0.009, 0.993), (0.026, 1.025), (0.012, 1.07), (0.0, 1.1)], (px, 0, 0), M['gold'], r, seg=6)
    # sznur z chwostem z tyłu drzewca
    tube('cord', [(px, 0.935, -0.012), (px - 0.03, 0.88, -0.03), (px - 0.035, 0.8, -0.022), (px - 0.03, 0.74, -0.018)],
         0.0035, M['gold_dark'], r)
    lathe('tassel', [(0.0, 0.64), (0.012, 0.643), (0.017, 0.665), (0.014, 0.7), (0.008, 0.72), (0.006, 0.735), (0.0, 0.742)],
          (px - 0.03, 0, -0.018), M['gold'], r, seg=16)
    for k in range(10):   # frędzle chwostu
        a = 2 * PI * k / 10
        cyl(f'fringe{k}', 0.0024, 0.0024, 0.05, (px - 0.03 + 0.013 * math.cos(a), 0.62, -0.018 + 0.013 * math.sin(a)),
            M['gold_dark'], r, seg=6)
    return r, ()


# ---------------------------------------------------------------------------
# 2. Drukarka 3D: obudowa z ekranem, rama z profili, stół, głowica ze świecącym hotendem,
#    szpula z filamentem i rurką, wydruk (wazon), który w grze rośnie
# ---------------------------------------------------------------------------
def printer():
    r = root('printer')
    pawn_base(r)
    W, H = 0.3, 0.4
    yb = Y0 + 0.07   # góra obudowy
    box('housing', (W, 0.07, W), (0, Y0 + 0.035, 0), M['player'], r, r=0.014)
    box('lcdframe', (0.11, 0.04, 0.008), (-0.06, Y0 + 0.036, W / 2 + 0.002), M['dark_metal'], r, r=0.003)
    box('lcd', (0.092, 0.028, 0.003), (-0.06, Y0 + 0.036, W / 2 + 0.0065), M['led_cyan'], r)
    cyl('knob', 0.013, 0.013, 0.012, (0.065, Y0 + 0.036, W / 2 + 0.005), M['brushed'], r, rot=(PI / 2, 0, 0), r=0.003)
    for x, z in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        box(f'post{x}{z}', (0.026, H, 0.026), (x * (W / 2 - 0.013), yb + H / 2, z * (W / 2 - 0.013)), M['dark_metal'], r, r=0.004)
    yt = yb + H
    for z in (-1, 1):
        box(f'topz{z}', (W, 0.026, 0.026), (0, yt, z * (W / 2 - 0.013)), M['player'], r, r=0.006)
    for x in (-1, 1):
        box(f'topx{x}', (0.026, 0.026, W - 0.05), (x * (W / 2 - 0.013), yt, 0), M['player'], r, r=0.006)
    # stół z wydrukiem
    box('carrier', (0.04, 0.03, W - 0.06), (0, yb + 0.018, 0), M['brushed'], r, r=0.004)
    box('bed', (W - 0.07, 0.012, W - 0.07), (0, yb + 0.04, 0), M['dark_metal'], r, r=0.004)
    ybed = yb + 0.046
    pts = []
    n = 18
    for k in range(n + 1):
        y = 0.11 * k / n
        rad = 0.034 + 0.012 * math.sin(y * 34 + 0.6) - 0.004 * (y / 0.11)
        pts.append((rad, y))
        if 0 < k < n:
            pts.append((rad - 0.0016, y + 0.0015))   # warstwy wydruku
    pts = [(0.0, 0.0)] + pts + [(0.0, 0.11)]
    g = group('print', r, (0.02, ybed, 0.01))
    lathe('print_body', pts, (0, 0, 0), M['player_light'], g, seg=40)
    # prowadnice i głowica
    yg = yb + 0.26
    for z in (-0.022, 0.022):
        cyl(f'rod{z}', 0.0055, 0.0055, W - 0.03, (0, yg, z), M['steel'], r, rot=(0, 0, PI / 2), seg=16)
    c = group('carriage', r, (0.02, yg, 0))
    box('head', (0.07, 0.07, 0.07), (0, 0.002, 0.004), M['player_light'], c, r=0.01)
    cyl('fanring', 0.022, 0.022, 0.006, (0, 0.006, 0.041), M['dark_metal'], c, rot=(PI / 2, 0, 0), r=0.002)
    fan('head_fan', 0.018, (0, 0.006, 0.0445), M['fan_blade'], c, (PI / 2, 0, 0), blades=5)
    box('heatblock', (0.026, 0.018, 0.02), (0, -0.044, 0.004), M['brushed'], c, r=0.002)
    lathe('nozzle', [(0.0, -0.074), (0.004, -0.074), (0.011, -0.06), (0.011, -0.053), (0.0, -0.053)], (0, 0, 0.004), M['gold'], c, seg=6)
    torus('hotend', 0.012, 0.0028, (0, -0.064, 0.004), M['led_orange'], c, seg=24, mseg=8)
    # szpula na górze i rurka do głowicy
    box('holder', (0.02, 0.07, 0.02), (0, yt + 0.045, -0.02), M['dark_metal'], r, r=0.003)
    ys = yt + 0.1
    for x in (-0.03, 0.03):
        cyl(f'flange{x}', 0.078, 0.078, 0.008, (x, ys, -0.02), M['rubber'], r, rot=(0, 0, PI / 2), seg=48, r=0.002)
    cyl('filament', 0.066, 0.066, 0.052, (0, ys, -0.02), M['player'], r, rot=(0, 0, PI / 2), seg=48, r=0.006)
    cyl('hub', 0.026, 0.026, 0.07, (0, ys, -0.02), M['brushed'], r, rot=(0, 0, PI / 2), seg=24)
    tube('bowden', [(0.0, ys - 0.06, 0.02), (0.05, yt + 0.0, 0.08), (0.03, yg + 0.07, 0.04)], 0.005, M['glass'], r)
    return r, ('print', 'carriage')


# ---------------------------------------------------------------------------
# 3. Koparka kryptowalut: otwarta rama, trzy karty graficzne z wentylatorami i paskami RGB,
#    złota moneta z literą W
# ---------------------------------------------------------------------------
def miner():
    r = root('miner')
    pawn_base(r)
    box('plate', (0.36, 0.022, 0.26), (0, Y0 + 0.011, 0), M['dark_metal'], r, r=0.005)
    yp = Y0 + 0.022
    for x in (-0.17, 0.17):
        for z in (-0.115, 0.115):
            box(f'post{x}{z}', (0.018, 0.27, 0.018), (x, yp + 0.135, z), M['player'], r, r=0.004)
    for z in (-0.115, 0.115):
        box(f'rail{z}', (0.36, 0.018, 0.018), (0, yp + 0.27, z), M['player'], r, r=0.005)
    box('riser', (0.3, 0.012, 0.03), (0, yp + 0.006, -0.07), M['pcb'], r, r=0.002)
    # trzy karty graficzne w rzędzie, wentylatorami do przodu (widać je z kamery gry)
    k = 0
    for x in (-0.108, 0.0, 0.108):
        yc = yp + 0.012 + 0.1
        box(f'shroud{x}', (0.1, 0.19, 0.042), (x, yc, -0.03), M['player'], r, r=0.008)
        box(f'back{x}', (0.094, 0.18, 0.004), (x, yc, -0.0535), M['dark_metal'], r, r=0.001)
        box(f'bracket{x}', (0.004, 0.19, 0.046), (x - 0.051, yc, -0.03), M['brushed'], r, r=0.001)
        box(f'rgb{x}', (0.086, 0.004, 0.03), (x, yc + 0.096, -0.03), M['player_glow'], r)
        box(f'face{x}', (0.09, 0.18, 0.004), (x, yc, -0.008), M['dark_metal'], r, r=0.002)
        for dy in (-0.045, 0.045):
            torus(f'housing{x}{dy}', 0.038, 0.0045, (x, yc + dy, -0.004), M['dark_metal'], r, rot=(PI / 2, 0, 0), seg=32, mseg=8)
            torus(f'ledring{x}{dy}', 0.042, 0.0018, (x, yc + dy, -0.005), M['player_glow'], r, rot=(PI / 2, 0, 0), seg=32, mseg=6)
            fan(f'fan_{k}', 0.034, (x, yc + dy, -0.003), M['fan_blade'], r, (PI / 2, 0, 0))
            cyl(f'hub{x}{dy}', 0.011, 0.011, 0.008, (x, yc + dy, -0.001), M['rubber'], r, rot=(PI / 2, 0, 0), seg=20, r=0.002)
            k += 1
    # kable zasilania od kart do tylnej szyny
    for x in (-0.108, 0.0, 0.108):
        tube(f'cable{x}', [(x + 0.02, yp + 0.21, -0.045), (x + 0.03, yp + 0.25, -0.08), (x + 0.05, yp + 0.262, -0.112)], 0.004, M['rubber'], r)
    coin = group('coin', r, (0, 0.52, 0))
    cyl('disc', 0.1, 0.1, 0.024, (0, 0, 0), M['gold'], coin, rot=(PI / 2, 0, 0), seg=64, r=0.004)
    for s in (-1, 1):
        torus(f'coinrim{s}', 0.088, 0.0055, (0, 0, s * 0.012), M['gold_dark'], coin, rot=(PI / 2, 0, 0), seg=64, mseg=8)
        t = text(f'coinW{s}', 'W', 0.11, (0, -0.002, s * 0.0135), M['gold_dark'], coin, depth=0.005, rot=(0, 0 if s > 0 else PI, 0))
        for i in range(24):   # ząbki na rancie
            a = 2 * PI * i / 24
            box(f'tick{s}{i}', (0.004, 0.012, 0.003), (0.075 * math.cos(a), 0.075 * math.sin(a), s * 0.0125), M['gold_dark'], coin,
                rot=(0, 0, a - PI / 2))
    return r, ('coin', 'fan_')


# ---------------------------------------------------------------------------
# 4. Ekspres do kawy: obudowa w kolorze gracza, szczotkowana stal, manometr pod szkłem,
#    kolba z gumowym uchwytem, dysza pary, kratka ociekacza, szklana filiżanka z kawą i pianką
# ---------------------------------------------------------------------------
def espresso():
    r = root('espresso')
    pawn_base(r)
    for x in (-0.12, 0.12):
        for z in (-0.12, 0.12):
            cyl(f'footrb{x}{z}', 0.012, 0.012, 0.01, (x, Y0 + 0.005, z), M['rubber'], r, seg=16)
    box('chassis', (0.3, 0.045, 0.3), (0, Y0 + 0.01 + 0.0225, 0), M['brushed'], r, r=0.01)
    yc = Y0 + 0.055
    box('body', (0.3, 0.27, 0.2), (0, yc + 0.135, -0.05), M['player'], r, r=0.03)
    box('recess', (0.2, 0.13, 0.01), (0, yc + 0.07, 0.052), M['dark_metal'], r, r=0.004)
    box('panel', (0.25, 0.1, 0.008), (0, yc + 0.2, 0.052), M['brushed'], r, r=0.004)
    box('warmer', (0.27, 0.01, 0.18), (0, yc + 0.275, -0.05), M['brushed'], r, r=0.003)
    # reling na górze
    ytop = yc + 0.3
    loop = [(-0.125, ytop, -0.13), (0.125, ytop, -0.13), (0.125, ytop, 0.03), (-0.125, ytop, 0.03), (-0.125, ytop, -0.13)]
    for a, b in zip(loop, loop[1:]):
        L = math.dist(a, b)
        mid = tuple((p + q) / 2 for p, q in zip(a, b))
        rot = (0, 0, PI / 2) if abs(a[0] - b[0]) > 0.01 else (PI / 2, 0, 0)
        cyl(f'rail{mid}', 0.0042, 0.0042, L, mid, M['steel'], r, rot=rot, seg=12)
    for x, z in ((-0.125, -0.13), (0.125, -0.13), (-0.125, 0.03), (0.125, 0.03)):
        cyl(f'railpost{x}{z}', 0.0042, 0.0042, 0.026, (x, ytop - 0.013, z), M['steel'], r, seg=12)
    # manometr i przyciski
    gx, gy, gz = 0.07, yc + 0.205, 0.058
    cyl('gauge_bezel', 0.032, 0.032, 0.012, (gx, gy, gz), M['steel'], r, rot=(PI / 2, 0, 0), r=0.004)
    cyl('gauge_face', 0.026, 0.026, 0.002, (gx, gy, gz + 0.0065), M['ceramic'], r, rot=(PI / 2, 0, 0))
    for i in range(9):
        a = -2.3 + 4.6 * i / 8
        box(f'gtick{i}', (0.002, 0.006, 0.001), (gx + 0.02 * math.sin(a), gy + 0.02 * math.cos(a), gz + 0.008), M['rubber'], r, rot=(0, 0, -a))
    box('needle', (0.0025, 0.022, 0.0015), (gx + 0.005, gy + 0.008, gz + 0.0085), M['led_orange'], r, rot=(0, 0, -0.6))
    sphere('gauge_glass', 0.027, (gx, gy, gz + 0.008), M['glass'], r, scale=(1, 1, 0.32))
    for i, x in enumerate((-0.03, -0.075)):
        cyl(f'btn{i}', 0.011, 0.011, 0.01, (x, gy, gz + 0.002), M['steel'], r, rot=(PI / 2, 0, 0), r=0.003)
        torus(f'btnled{i}', 0.0135, 0.0018, (x, gy, gz), M['player_glow'], r, rot=(PI / 2, 0, 0), seg=24, mseg=6)
    # grupa zaparzająca i kolba
    cyl('grouphead', 0.038, 0.034, 0.03, (0, yc + 0.135, 0.085), M['brushed'], r, r=0.005)
    box('neck', (0.05, 0.03, 0.04), (0, yc + 0.14, 0.06), M['brushed'], r, r=0.006)
    cyl('basket', 0.034, 0.03, 0.026, (0, yc + 0.108, 0.085), M['steel'], r, r=0.004)
    tube('handle', [(0, yc + 0.108, 0.115), (0, yc + 0.104, 0.17), (0, yc + 0.098, 0.225)], 0.011, M['rubber'], r)
    cyl('spout', 0.008, 0.01, 0.014, (0, yc + 0.088, 0.085), M['steel'], r)
    # dysza pary z boku
    tube('wand', [(0.15, yc + 0.2, 0.0), (0.18, yc + 0.19, 0.03), (0.188, yc + 0.12, 0.05), (0.186, yc + 0.07, 0.055)], 0.0048, M['steel'], r)
    cyl('wandgrip', 0.009, 0.009, 0.04, (0.184, yc + 0.165, 0.042), M['rubber'], r, rot=(0.25, 0, -0.1), r=0.003)
    cyl('steamknob', 0.016, 0.016, 0.014, (0.155, yc + 0.235, -0.02), M['rubber'], r, rot=(0, 0, PI / 2), r=0.004)
    # ociekacz z kratką
    box('tray', (0.23, 0.012, 0.1), (0, yc + 0.006, 0.1), M['steel'], r, r=0.004)
    for i in range(8):
        box(f'slot{i}', (0.006, 0.002, 0.075), (-0.084 + i * 0.024, yc + 0.0125, 0.1), M['dark_metal'], r)
    # spodek, szklana filiżanka, kawa i pianka
    ys = yc + 0.0125
    lathe('saucer', [(0.0, 0.0), (0.044, 0.0), (0.05, 0.004), (0.053, 0.009), (0.049, 0.0095), (0.03, 0.0045), (0.0, 0.0045)],
          (0, ys, 0.1), M['ceramic'], r, seg=48, close_bottom=False)
    yg = ys + 0.0045
    lathe('cup', [(0.0, 0.0), (0.024, 0.0), (0.029, 0.004), (0.033, 0.05), (0.034, 0.056), (0.031, 0.056), (0.029, 0.008), (0.0, 0.008)],
          (0, yg, 0.1), M['glass'], r, seg=48)
    cyl('coffee', 0.0285, 0.0255, 0.03, (0, yg + 0.024, 0.1), M['coffee'], r, seg=40)
    cyl('crema', 0.029, 0.029, 0.004, (0, yg + 0.041, 0.1), M['crema'], r, seg=40)
    return r, ()


models = [banner(), printer(), miner(), espresso()]
roots = [m[0] for m in models]
bake_ao(roots, distance=0.09, samples=64)
for r, keep in models:
    merge_by_material(r, keep)
# świecące i szklane części nie mają cienia kontaktowego
no_ao([o for r in roots for o in r.children_recursive if o.type == 'MESH' and o.data.materials
       and o.data.materials[0].name in ('glass', 'player_glow', 'led_cyan', 'led_orange', 'led_white', 'screen')])
v, t = count(roots)
print(f'pionki: {v} wierzchołków, {t} trójkątów')
export(sys.argv[-1] if sys.argv[-1].endswith('.glb') else '/tmp/pawns.glb', roots)
