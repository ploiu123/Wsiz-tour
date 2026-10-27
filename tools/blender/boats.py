# Łodzie na wodzie makiety: jacht i motorówka. Wymiary jak w starych łodziach z kodu (jacht 3 x 1,05, maszt 3,7,
# motorówka 2,7 x 1,15), więc gra podmienia je bez zmiany tras. Dziób w stronę +Z gry, linia wody na wysokości 0.
#
# Kadłub to powierzchnia z przekrojów (wręgów): szerokość, wysokość burty i głębokość dna zmieniają się wzdłuż łodzi.
# Pasy na kadłubie (dno, pas przy linii wody, burta, pas pod pokładem) to osobne części tej samej powierzchni,
# więc granice kolorów są równe. Materiały „boat_stripe” (pasy) i „boat_sail” (grot) gra barwi na kolor łodzi.
import math
import sys

import bpy  # najpierw bpy: dopiero on udostępnia bmesh i mathutils
import bmesh

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import (_bm_to_mesh, _obj, bake_ao, bevel, box, count, cyl, export, group, material, merge_by_material,
                    reset, root, smooth, sphere, std_materials, to_b, torus, tube)

reset()
M = std_materials()
PI = math.pi
gelcoat = material('gelcoat', '#F7F9FC', rough=0.22, coat=0.8, coat_rough=0.08)
bottom = material('boat_bottom', '#1E2A47', rough=0.55)
stripe = material('boat_stripe', '#E5484D', rough=0.28, coat=0.7, coat_rough=0.1)
sail_col = material('boat_sail', '#E5484D', rough=0.8)
sail_white = material('sail_white', '#F3F0E8', rough=0.82)
teak = material('teak', '#B98852', rough=0.72)
nonskid = material('nonskid', '#E9ECF1', rough=0.7)
wire = material('rig_wire', '#8F99A7', metal=0.8, rough=0.3)
lead = material('lead', '#2B2F36', rough=0.55)
glass_dark = material('boat_glass', '#1B2738', rough=0.06, coat=1.0)
screen_glass = material('windshield', '#CFE3F5', rough=0.04, alpha=0.35, ior=1.5)
cushion = material('cushion', '#E6D8C0', rough=0.85)
engine = material('engine', '#1F2329', rough=0.35, coat=0.6)
fender = material('fender', '#2F7FF0', rough=0.4)


class Hull:
    # Kadłub z przekrojów: u od rufy (0) do dziobu (1), th od stępki (0) do linii pokładu (pi/2).
    # x = w * sin(th)^p, y = dno + (burta - dno) * (1 - cos th): p < 1 daje okrągłe dno jachtu, p > 1 ostre V motorówki.
    def __init__(self, L, shape, p):
        self.L, self.shape, self.p = L, shape, p

    def sec(self, u):
        w, top, keel = self.shape(u)
        return max(w, 0.004), top, keel

    def z(self, u):
        return -self.L / 2 + u * self.L

    def point(self, u, th, side):
        w, top, keel = self.sec(u)
        return (side * w * math.sin(th) ** self.p, keel + (top - keel) * (1 - math.cos(th)), self.z(u))

    def th_at(self, u, y):
        # kąt przekroju, na którym burta ma wysokość y (pasy kolorów są na stałej wysokości)
        w, top, keel = self.sec(u)
        k = (y - keel) / max(top - keel, 1e-6)
        return math.acos(1 - min(max(k, 0.0), 1.0))

    def band(self, name, y0, y1, mat, parent, rows=48, cols=6, out=0.0):
        # pas kadłuba między wysokościami y0 i y1 (obie burty); out: lekko na zewnątrz (pas na burcie)
        bm = bmesh.new()
        us = [0.5 - 0.5 * math.cos(PI * i / rows) for i in range(rows + 1)]   # gęściej przy rufie i dziobie
        for side in (-1, 1):
            grid = []
            for u in us:
                t0, t1 = self.th_at(u, y0), self.th_at(u, y1)
                row = []
                for j in range(cols + 1):
                    x, y, z = self.point(u, t0 + (t1 - t0) * j / cols, side)
                    row.append(bm.verts.new(to_b((x * (1 + out), y, z))))
                grid.append(row)
            for i in range(rows):
                for j in range(cols):
                    a, b, c, d = grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]
                    if len({a.co.to_tuple(5), b.co.to_tuple(5), c.co.to_tuple(5), d.co.to_tuple(5)}) >= 3:
                        f = bm.faces.new((a, b, c, d) if side > 0 else (a, d, c, b))
                        f.smooth = True
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        o = _obj(name, _bm_to_mesh(name, bm), mat, (0, 0, 0), (0, 0, 0), parent)
        smooth(o, 70)
        return o

    def transom(self, name, mat, parent, cols=16):
        # płaska rufa: przekrój u = 0 zamknięty jedną ścianą
        bm = bmesh.new()
        pts = [self.point(0, PI / 2 * (1 - j / cols), -1) for j in range(cols)] + \
              [self.point(0, PI / 2 * j / cols, 1) for j in range(cols + 1)]
        vs = [bm.verts.new(to_b(p)) for p in pts]
        bm.faces.new(vs)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        for f in bm.faces:   # rufa patrzy do tyłu (-Z gry, czyli +Y Blendera)
            f.normal_update()
            if f.normal.y < 0:
                f.normal_flip()
        return _obj(name, _bm_to_mesh(name, bm), mat, (0, 0, 0), (0, 0, 0), parent)

    def deck(self, name, mat, parent, crown=0.025, inset=0.97, rows=40, cols=8, u1=1.0):
        # pokład: lekko wypukły w poprzek, od rufy do dziobu
        bm = bmesh.new()
        grid = []
        for i in range(rows + 1):
            u = u1 * (0.5 - 0.5 * math.cos(PI * i / rows))
            w, top, keel = self.sec(u)
            row = []
            for j in range(cols + 1):
                s = -1 + 2 * j / cols
                row.append(bm.verts.new(to_b((s * w * inset, top + crown * (1 - s * s) * min(1, w * 4), self.z(u)))))
            grid.append(row)
        for i in range(rows):
            for j in range(cols):
                f = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
                f.smooth = True
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        o = _obj(name, _bm_to_mesh(name, bm), mat, (0, 0, 0), (0, 0, 0), parent)
        smooth(o, 60)
        return o

    def sheer(self, u, side, inset=1.0, lift=0.0):
        w, top, keel = self.sec(u)
        return (side * w * inset, top + lift, self.z(u))


def prism(name, profile, w_back, w_front, mat, parent, pos=(0, 0, 0), r=0.03):
    # bryła z bocznego profilu [(z, y), ...] wyciągnięta w poprzek; szerokość zmienia się od tyłu (w_back) do przodu
    zs = [z for z, _ in profile]
    z0, z1 = min(zs), max(zs)
    bm = bmesh.new()
    rows = []
    for side in (-1, 1):
        row = []
        for z, y in profile:
            k = (z - z0) / max(z1 - z0, 1e-6)
            row.append(bm.verts.new(to_b((side * (w_back + (w_front - w_back) * k) / 2, y, z))))
        rows.append(row)
    n = len(profile)
    bm.faces.new(rows[0])
    bm.faces.new(list(reversed(rows[1])))
    for i in range(n):
        a, b = rows[0][i], rows[0][(i + 1) % n]
        c, d = rows[1][(i + 1) % n], rows[1][i]
        bm.faces.new((a, b, c, d))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _obj(name, _bm_to_mesh(name, bm), mat, pos, (0, 0, 0), parent)
    if r > 0:
        bevel(o, r, 3, 30)
    return o


def sail(name, tack, head, clew, depth, mat, parent, nu=14, nv=10, side=1):
    # żagiel z wybrzuszeniem (profil skrzydła): największa głębokość ok. 40% cięciwy, ku górze trochę mniejsza
    bm = bmesh.new()
    grid = []
    for i in range(nu + 1):
        s = i / nu
        luff = [tack[k] + (head[k] - tack[k]) * s for k in range(3)]
        leech = [clew[k] + (head[k] - clew[k]) * s for k in range(3)]
        chord = math.dist(luff, leech)
        row = []
        for j in range(nv + 1):
            t = j / nv
            p = [luff[k] + (leech[k] - luff[k]) * t for k in range(3)]
            bulge = depth * chord * (2.7 * t * (1 - t) ** 1.35) * (1 - 0.35 * s)
            p[0] += side * bulge
            row.append(bm.verts.new(to_b(p)))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            a, b, c, d = grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]
            if i == nu - 1:
                f = bm.faces.new((a, b, c)) if b.co != c.co else None
                if d.co != c.co and a.co != d.co:
                    bm.faces.new((a, c, d))
            else:
                f = bm.faces.new((a, b, c, d))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    o = _obj(name, _bm_to_mesh(name, bm), mat, (0, 0, 0), (0, 0, 0), parent)
    for f in o.data.polygons:
        f.use_smooth = True
    return o


def rail(name, pts, radius, parent, mat=None):
    return tube(name, pts, radius, mat or M['steel'], parent, seg=6, res=8)


def straight(name, a, b, radius, parent, mat=None):
    return tube(name, [a, b], radius, mat or wire, parent, seg=4, res=1)


# ---------------------------------------------------------------------------
# Jacht
# ---------------------------------------------------------------------------
def sailboat():
    r = root('sailboat')
    L, B, H, D = 3.0, 1.05, 0.42, 0.24

    def shape(u):
        w = (B / 2) * (0.84 + 0.16 * math.sin(u / 0.45 * PI / 2) if u < 0.45 else math.cos((u - 0.45) / 0.55 * PI / 2) ** 0.85)
        top = H * (1 + 0.24 * u * u) - 0.02 * math.sin(PI * u)          # lekko wklęsła linia pokładu, wyżej na dziobie
        keel = -D * (0.32 + 0.68 * math.sin(PI * min(1, u ** 0.8))) * (1 - u ** 3)
        return w, top, keel

    h = Hull(L, shape, 0.9)
    # pasy kadłuba: dno (farba przeciwporostowa), pas przy linii wody, biała burta, pas pod pokładem
    h.band('bottom', -1, 0.0, bottom, r)
    h.band('boot', 0.0, 0.045, stripe, r)
    h.band('topside', 0.045, 0.36, gelcoat, r)
    h.band('sheer_stripe', 0.36, 0.395, stripe, r)
    h.band('topside_hi', 0.395, 2, gelcoat, r)
    h.transom('transom', gelcoat, r)
    h.deck('deck', teak, r)
    for s in (-1, 1):   # listwa odbojowa na krawędzi pokładu
        rail(f'toerail{s}', [h.sheer(u, s, 1.005, 0.012) for u in (0.0, 0.25, 0.5, 0.75, 0.93, 1.0)], 0.014, r, teak)
    # kabina (nadbudówka) ze skośnym przodem, okna i luk
    dy = lambda z: shape((z + L / 2) / L)[1]
    cz0, cz1 = -0.42, 0.62
    cabin = prism('cabin', [(cz0, dy(cz0) - 0.02), (cz0, dy(cz0) + 0.2), (cz1 - 0.22, dy(cz0) + 0.2), (cz1, dy(cz1) + 0.02),
                            (cz1, dy(cz1) - 0.03)], 0.66, 0.48, gelcoat, r, r=0.035)
    for s in (-1, 1):
        for k, (z, ln) in enumerate(((-0.2, 0.26), (0.16, 0.28))):
            hw = 0.33 - 0.09 * (z - cz0) / (cz1 - cz0)
            box(f'window{s}{k}', (0.012, 0.055, ln), (s * (hw + 0.004), dy(cz0) + 0.115, z), glass_dark, r,
                rot=(0, -s * 0.086, 0), r=0.006)
    box('hatch', (0.3, 0.035, 0.3), (0, dy(cz0) + 0.215, 0.24), gelcoat, r, r=0.012)
    box('hatch_glass', (0.24, 0.01, 0.24), (0, dy(cz0) + 0.234, 0.24), glass_dark, r, r=0.004)
    # kokpit: ławki, koamingi, koło sterowe na kolumnie, kabestany
    yk = dy(-0.9)
    for s in (-1, 1):
        box(f'bench{s}', (0.2, 0.07, 0.78), (s * 0.27, yk + 0.035, -0.86), gelcoat, r, r=0.02)
        box(f'cushion{s}', (0.18, 0.035, 0.74), (s * 0.27, yk + 0.085, -0.86), cushion, r, r=0.014)
        box(f'coaming{s}', (0.035, 0.11, 0.86), (s * 0.4, yk + 0.055, -0.84), gelcoat, r, r=0.012)
        cyl(f'winch{s}', 0.035, 0.045, 0.06, (s * 0.4, yk + 0.14, -0.55), M['steel'], r, seg=20, r=0.008)
    cyl('pedestal', 0.025, 0.035, 0.24, (0, yk + 0.12, -1.18), M['steel'], r, seg=16)
    torus('wheel', 0.15, 0.011, (0, yk + 0.27, -1.2), M['steel'], r, rot=(PI / 2, 0, 0), seg=40, mseg=8)
    for k in range(6):
        a = k * PI / 3
        straight(f'spoke{k}', (0, yk + 0.27, -1.2), (0.15 * math.cos(a), yk + 0.27 + 0.15 * math.sin(a), -1.2), 0.006, r, M['steel'])
    # kil z bulbem i ster (widać je przez przejrzystą wodę)
    prism('keel', [(-0.12, -0.12), (0.34, -0.12), (0.2, -0.74), (-0.1, -0.74)], 0.06, 0.05, lead, r, r=0.015)
    sphere('bulb', 1.0, (0, -0.76, 0.06), lead, r, scale=(0.075, 0.07, 0.3), seg=24, rings=12)
    prism('rudder', [(-1.12, -0.05), (-0.98, -0.05), (-1.0, -0.52), (-1.1, -0.5)], 0.035, 0.03, lead, r, r=0.01)
    # maszt z salingami, bom i olinowanie; grot i bom wychylone do wiatru (zawietrzna po +x)
    mz, mast_h = 0.42, 3.7
    dmast = dy(mz)
    top_y = dmast + mast_h
    cyl('mast', 0.026, 0.04, mast_h, (0, dmast + mast_h / 2, mz), M['steel'], r, seg=16)
    cyl('masthead', 0.02, 0.02, 0.06, (0, top_y + 0.03, mz), M['led_white'], r, seg=10)
    spr_y = dmast + mast_h * 0.56
    for s in (-1, 1):
        straight(f'spreader{s}', (0, spr_y, mz), (s * 0.34, spr_y + 0.03, mz - 0.03), 0.012, r, M['steel'])
        chain = (s * shape((mz + L / 2) / L)[0] * 0.92, dmast + 0.01, mz - 0.04)
        straight(f'shroud_lo{s}', chain, (s * 0.34, spr_y + 0.03, mz - 0.03), 0.0045, r)
        straight(f'shroud_hi{s}', (s * 0.34, spr_y + 0.03, mz - 0.03), (0, top_y - 0.08, mz), 0.0045, r)
    bow_z, bow_y = L / 2 - 0.04, shape(0.985)[1]
    straight('forestay', (0, bow_y + 0.02, bow_z), (0, top_y - 0.4, mz + 0.02), 0.005, r)
    straight('backstay', (0, shape(0.01)[1] + 0.02, -L / 2 + 0.05), (0, top_y - 0.02, mz - 0.02), 0.005, r)
    yaw = -0.3
    rig = group('mainrig', r, pos=(0, 0, mz), rot=(0, yaw, 0))
    boom_y = dmast + 0.62
    cyl('boom', 0.026, 0.026, 1.5, (0, boom_y, -0.76), M['steel'], rig, rot=(PI / 2, 0, 0), seg=14)
    sail('mainsail', (0, boom_y + 0.04, -0.05), (0, top_y - 0.06, -0.02), (0, boom_y + 0.04, -1.46), 0.16, sail_col, rig, side=1)
    sail('jib', (0, bow_y + 0.06, bow_z - 0.08), (0, top_y - 0.48, mz + 0.03), (0.3, dmast + 0.42, mz - 0.32), 0.14, sail_white, r, side=1)
    # relingi: słupki, linki, kosz dziobowy i rufowy
    us = (0.1, 0.27, 0.44, 0.6, 0.76, 0.88)
    for s in (-1, 1):
        for k, u in enumerate(us):
            x, y, z = h.sheer(u, s, 0.9)
            cyl(f'stanchion{s}{k}', 0.007, 0.007, 0.26, (x, y + 0.13, z), M['steel'], r, seg=8)
        rail(f'lifeline{s}', [(*h.sheer(u, s, 0.9)[:1], h.sheer(u, s)[1] + 0.25, h.sheer(u, s)[2]) for u in us], 0.004, r, wire)
    rail('pulpit', [h.sheer(0.86, -1, 0.85, 0.25), (0, shape(0.97)[1] + 0.27, h.z(0.97)), h.sheer(0.86, 1, 0.85, 0.25)], 0.009, r)
    rail('pushpit', [h.sheer(0.1, -1, 0.9, 0.25), (-0.28, shape(0.0)[1] + 0.27, h.z(0.005)), (0.28, shape(0.0)[1] + 0.27, h.z(0.005)),
                     h.sheer(0.1, 1, 0.9, 0.25)], 0.009, r)
    for s in (-1, 1):   # odbijacze przy burcie
        cyl(f'fender{s}', 0.045, 0.045, 0.2, (s * shape(0.55)[0] * 1.03, 0.2, h.z(0.55)), fender, r, seg=16, r=0.03)
    return r


# ---------------------------------------------------------------------------
# Motorówka
# ---------------------------------------------------------------------------
def motorboat():
    r = root('motorboat')
    L, B, H, D = 2.7, 1.15, 0.36, 0.2

    def shape(u):
        w = (B / 2) * (0.93 + 0.07 * math.sin(u / 0.5 * PI / 2) if u < 0.5 else math.cos((u - 0.5) / 0.5 * PI / 2) ** 0.72)
        top = H * (1 + 0.32 * u * u)
        keel = -D * (1 - u ** 2.4)
        return w, top, keel

    h = Hull(L, shape, 1.7)   # ostre V dna (ślizg)
    h.band('bottom', -1, 0.02, bottom, r)
    h.band('topside', 0.02, 0.17, gelcoat, r)
    h.band('stripe', 0.17, 0.25, stripe, r)
    h.band('topside_hi', 0.25, 2, gelcoat, r)
    h.transom('transom', gelcoat, r)
    h.deck('deck', nonskid, r, crown=0.03)
    for s in (-1, 1):
        rail(f'rubrail{s}', [h.sheer(u, s, 1.01, -0.01) for u in (0.0, 0.3, 0.6, 0.85, 0.97, 1.0)], 0.02, r, M['rubber'])
        for k, f in enumerate((0.35, 0.7)):   # listwy ślizgowe na dnie
            pts = []
            for u in (0.05, 0.4, 0.75, 0.92):
                th = h.th_at(u, shape(u)[2] + (0.02 - shape(u)[2]) * f * 0.6)
                pts.append(h.point(u, th, s))
            rail(f'strake{s}{k}', pts, 0.01, r, bottom)
    y0 = shape(0.5)[1]
    # konsola z szybą, deską i kołem sterowym
    box('console', (0.48, 0.36, 0.42), (0, y0 + 0.18, 0.14), gelcoat, r, r=0.07, seg=4)
    box('dash', (0.4, 0.04, 0.14), (0, y0 + 0.37, 0.02), M['rubber'], r, rot=(0.5, 0, 0), r=0.015)
    box('windshield', (0.5, 0.24, 0.016), (0, y0 + 0.47, 0.3), screen_glass, r, rot=(-0.55, 0, 0), r=0.01)
    torus('helm', 0.075, 0.009, (0, y0 + 0.36, -0.07), M['rubber'], r, rot=(PI / 2 - 0.5, 0, 0), seg=28, mseg=8)
    # siedzenia
    box('helm_seat', (0.36, 0.12, 0.3), (0, y0 + 0.16, -0.35), cushion, r, r=0.045)
    box('helm_base', (0.3, 0.12, 0.26), (0, y0 + 0.05, -0.35), gelcoat, r, r=0.03)
    box('bench', (0.9, 0.14, 0.32), (0, y0 + 0.08, -0.92), cushion, r, r=0.05)
    box('bench_back', (0.9, 0.26, 0.09), (0, y0 + 0.22, -1.1), cushion, r, rot=(-0.12, 0, 0), r=0.04)
    box('bow_seat', (0.5, 0.08, 0.36), (0, shape(0.78)[1] + 0.05, h.z(0.78)), cushion, r, r=0.035)
    # reling dziobowy i knagi
    rail('bowrail', [h.sheer(0.6, -1, 0.9, 0.2), h.sheer(0.86, -1, 0.75, 0.22), (0, shape(0.985)[1] + 0.22, h.z(0.985)),
                     h.sheer(0.86, 1, 0.75, 0.22), h.sheer(0.6, 1, 0.9, 0.2)], 0.009, r)
    for z in (h.z(0.95), h.z(0.04)):
        box(f'cleat{z:.2f}', (0.1, 0.03, 0.03), (0, shape((z + L / 2) / L)[1] + 0.03, z), M['steel'], r, r=0.01)
    # silnik za burtą: osłona, kolumna, płyta i śruba
    ez = -L / 2 - 0.15
    box('cowl', (0.26, 0.32, 0.3), (0, y0 + 0.1, ez), engine, r, r=0.08, seg=4)
    box('cowl_stripe', (0.265, 0.03, 0.305), (0, y0 + 0.04, ez), stripe, r, r=0.012)
    box('leg', (0.07, 0.5, 0.13), (0, y0 - 0.32, ez - 0.01), engine, r, r=0.025)
    box('plate', (0.2, 0.012, 0.22), (0, y0 - 0.5, ez - 0.02), engine, r, r=0.004)
    cyl('hub', 0.03, 0.03, 0.09, (0, y0 - 0.56, ez - 0.1), M['dark_metal'], r, rot=(PI / 2, 0, 0), seg=14)
    for k in range(3):
        a = k * 2 * PI / 3
        box(f'blade{k}', (0.022, 0.1, 0.008), (0.05 * math.sin(a), y0 - 0.56 + 0.05 * math.cos(a), ez - 0.13), M['dark_metal'], r,
            rot=(0, 0.5, -a), r=0.004)
    return r


roots = [sailboat(), motorboat()]
bake_ao(roots, distance=0.3, samples=48, ground=False, max_edge=0.14)
for r in roots:
    merge_by_material(r)
v, t = count(roots)
print(f'łodzie: {v} wierzchołków, {t} trójkątów')
export(sys.argv[-1] if sys.argv[-1].endswith('.glb') else '/tmp/boats.glb', roots)
