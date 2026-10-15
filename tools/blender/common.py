# Wspólne narzędzia do modeli gry robionych w Blenderze (bpy 5.0, bez okna programu).
#
# Modele opisujemy w układzie gry (Three.js): oś Y w górę, Z do kamery, jednostki jak w grze
# (podstawa pionka ma promień ok. 0,22). Blender ma oś Z w górę, więc funkcje same przeliczają
# położenie: (x, y, z) w grze = (x, -z, y) w Blenderze. Eksport glTF zamienia to z powrotem.
#
# Każdy model to pusty obiekt (korzeń) z częściami. Na koniec:
#   1. modyfikatory (fazowanie krawędzi) zostają nałożone na siatki,
#   2. Cycles wypala cienie kontaktowe (AO) do kolorów wierzchołków (gra mnoży przez nie kolor),
#   3. części z tym samym materiałem łączą się w jedną siatkę (mniej wywołań rysowania),
#      a części animowane w grze (nazwy w `keep`) zostają osobno,
#   4. eksport GLB; potem tools/assets.mjs kompresuje go (meshopt).
#
# Materiały o nazwach player* gra podmienia na swoje, w kolorze gracza. Materiał „screen” dostaje
# w grze obraz ekranu, a „keys” klawiaturę. Pozostałe (złoto, stal, szkło, guma) zostają z pliku.

import math
import bpy  # najpierw bpy: dopiero on udostępnia bmesh i mathutils
import bmesh
from mathutils import Matrix, Quaternion, Vector


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    world = bpy.data.worlds.new('world')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)


def to_b(p):
    x, y, z = p
    return Vector((x, -z, y))


def quat(rot):
    # obrót w układzie gry (kolejność XYZ jak w Three.js) jako kwaternion w Blenderze
    rx, ry, rz = rot
    return Quaternion((1, 0, 0), rx) @ Quaternion((0, 0, 1), ry) @ Quaternion((0, 1, 0), -rz)


def hexrgb(h, a=1.0):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, a)


_mats = {}


def material(name, color='#FFFFFF', metal=0.0, rough=0.5, coat=0.0, coat_rough=0.1, emit=None, emit_strength=1.0,
             alpha=1.0, ior=1.45):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = hexrgb(color)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['IOR'].default_value = ior
    if coat:
        bsdf.inputs['Coat Weight'].default_value = coat
        bsdf.inputs['Coat Roughness'].default_value = coat_rough
    if emit:
        bsdf.inputs['Emission Color'].default_value = hexrgb(emit)
        bsdf.inputs['Emission Strength'].default_value = emit_strength
    if alpha < 1:
        bsdf.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    m.diffuse_color = hexrgb(color, alpha)
    _mats[name] = m
    return m


def textured(m):
    # eksport glTF zapisuje mapowanie obrazu (UV) tylko przy materiale z teksturą: dajemy maleńki obrazek,
    # a gra i tak podmienia ten materiał na swój (obraz ekranu, klawiatura)
    img = bpy.data.images.new(m.name + '_uv', 4, 4)
    img.pixels = [0.1, 0.1, 0.12, 1.0] * 16
    node = m.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = img
    m.node_tree.links.new(node.outputs['Color'], m.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    return m


# Materiały wspólne dla wszystkich modeli
def std_materials():
    return {
        'gold': material('gold', '#E2B33C', metal=1.0, rough=0.24),
        'gold_dark': material('gold_dark', '#B8862A', metal=1.0, rough=0.32),
        'steel': material('steel', '#D5DAE2', metal=1.0, rough=0.22),
        'brushed': material('brushed', '#C3C9D3', metal=1.0, rough=0.38),
        'dark_metal': material('dark_metal', '#2A2F3A', metal=0.8, rough=0.4),
        'rubber': material('rubber', '#1B1E25', rough=0.85),
        'glass': material('glass', '#DDEBFF', rough=0.04, alpha=0.22, ior=1.5),
        'ceramic': material('ceramic', '#FAFAF7', rough=0.18, coat=0.6),
        'navy': material('uni_lacquer', '#00276F', rough=0.3, coat=1.0, coat_rough=0.12),
        'plate': material('plate', '#CCD3E1', metal=0.35, rough=0.32),
        'pcb': material('pcb', '#123A2A', rough=0.55),
        # kolor gracza: gra podmienia te materiały na swoje (kolor główny, ciemny, jasny, świecący)
        'player': material('player', '#E5484D', rough=0.36, coat=0.6, coat_rough=0.2),
        'player_dark': material('player_dark', '#0A2A66', rough=0.45),
        'player_light': material('player_light', '#DDE3EE', rough=0.4),
        'player_band': material('player_band', '#E5484D', rough=0.35),
        'player_glow': material('player_glow', '#FF9FA2', emit='#FF9FA2', emit_strength=2.0),
        'screen': textured(material('screen', '#101318', emit='#FFFFFF', emit_strength=0.0)),
        'keys': textured(material('keys', '#1D212B', rough=0.7)),
        'led_green': material('led_green', '#7CF29A', emit='#7CF29A', emit_strength=3.0),
        'led_white': material('led_white', '#FFFFFF', emit='#FFFFFF', emit_strength=3.0),
        'led_cyan': material('led_cyan', '#5BE7FF', emit='#5BE7FF', emit_strength=3.0),
        'led_orange': material('led_orange', '#FF8A2A', emit='#FF8A2A', emit_strength=4.0),
    }


# ---------------------------------------------------------------------------
# Części
# ---------------------------------------------------------------------------
def _obj(name, mesh, mat, pos, rot, parent):
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    if mat is not None:
        mesh.materials.append(mat)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = quat(rot)
    o.location = to_b(pos)
    if parent is not None:
        o.parent = parent
    return o


def root(name, pos=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    o.location = to_b(pos)
    o.rotation_mode = 'QUATERNION'
    return o


def group(name, parent, pos=(0, 0, 0), rot=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = quat(rot)
    o.location = to_b(pos)
    o.parent = parent
    return o


def _bm_to_mesh(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def bevel(o, width, segments=3, angle=35):
    mod = o.modifiers.new('bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    mod.harden_normals = False
    mod.miter_outer = 'MITER_ARC'
    return o


def box(name, size, pos, mat, parent, rot=(0, 0, 0), r=0.0, seg=3):
    # prostopadłościan (szerokość x, wysokość y, głębokość z w układzie gry) z zaokrąglonymi krawędziami r
    w, h, d = size
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((w, d, h)), verts=bm.verts)
    o = _obj(name, _bm_to_mesh(name, bm), mat, pos, rot, parent)
    if r > 0:
        bevel(o, min(r, w / 2.01, h / 2.01, d / 2.01), seg)
    return o


def cyl(name, r_top, r_bot, h, pos, mat, parent, rot=(0, 0, 0), seg=40, r=0.0, bseg=3, cap=True):
    # walec (oś Y w grze); r_top/r_bot jak w THREE.CylinderGeometry
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r_bot, radius2=r_top, depth=h)
    o = _obj(name, _bm_to_mesh(name, bm), mat, pos, rot, parent)
    if r > 0:
        bevel(o, min(r, h / 2.01, max(r_top, r_bot) / 2), bseg)
    return o


def quad(name, w, h, pos, mat, parent, rot=(0, 0, 0)):
    # płaski prostokąt przodem do +Z gry, z mapowaniem obrazu (ekran, klawiatura). Współrzędna v jest odwrócona,
    # bo gra kładzie na nim obrazy z canvasa (flipY), a eksport glTF i tak odwraca v: obraz wychodzi prosto.
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    vs = [bm.verts.new((x * w / 2, 0, y * h / 2)) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = bm.faces.new(vs)
    for loop, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = (u, 1 - v)
    return _obj(name, _bm_to_mesh(name, bm), mat, pos, rot, parent)


def sphere(name, radius, pos, mat, parent, scale=(1, 1, 1), seg=32, rings=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=radius)
    sx, sy, sz = scale
    bmesh.ops.scale(bm, vec=Vector((sx, sz, sy)), verts=bm.verts)
    o = _obj(name, _bm_to_mesh(name, bm), mat, pos, (0, 0, 0), parent)
    smooth(o)
    return o


def torus(name, major, minor, pos, mat, parent, rot=(0, 0, 0), seg=48, mseg=12):
    # torus leżący płasko (w płaszczyźnie XZ gry, oś Y)
    bm = bmesh.new()
    verts = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring = []
        for j in range(mseg):
            b = 2 * math.pi * j / mseg
            rr = major + minor * math.cos(b)
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), minor * math.sin(b))))
        verts.append(ring)
    for i in range(seg):
        for j in range(mseg):
            a, b = verts[i][j], verts[(i + 1) % seg][j]
            c, d = verts[(i + 1) % seg][(j + 1) % mseg], verts[i][(j + 1) % mseg]
            bm.faces.new((a, b, c, d))
    o = _obj(name, _bm_to_mesh(name, bm), mat, pos, rot, parent)
    smooth(o)
    return o


def lathe(name, pts, pos, mat, parent, seg=48, rot=(0, 0, 0), close_top=False, close_bottom=False):
    # bryła obrotowa z profilu [(promień, wysokość), ...] jak THREE.LatheGeometry
    bm = bmesh.new()
    rings = []
    for (rad, y) in pts:
        ring = [bm.verts.new((rad * math.cos(2 * math.pi * i / seg), rad * math.sin(2 * math.pi * i / seg), y)) for i in range(seg)]
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(seg):
            a, b = rings[k][i], rings[k][(i + 1) % seg]
            c, d = rings[k + 1][(i + 1) % seg], rings[k + 1][i]
            if a.co != b.co or c.co != d.co:
                bm.faces.new((a, b, c, d))
    if close_bottom:
        bm.faces.new(list(reversed(rings[0])))
    if close_top:
        bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _obj(name, _bm_to_mesh(name, bm), mat, pos, rot, parent)
    smooth(o, 50)
    return o


def tube(name, points, radius, mat, parent, seg=10, res=12):
    # rurka wzdłuż krzywej przez punkty (układ gry), np. przewód, rurka pary, sznur
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = max(1, seg // 4)
    cu.resolution_u = res
    cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = to_b(p)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    o.parent = parent
    # zamiana krzywej na siatkę
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(deps))
    m = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(m)
    m.parent = parent
    m.matrix_parent_inverse = o.matrix_parent_inverse.copy()
    m.location = o.location
    bpy.data.objects.remove(o)
    smooth(m, 60)
    return m


def text(name, body, size, pos, mat, parent, depth=0.004, rot=(0, 0, 0), align='CENTER'):
    # wypukły napis (wbudowana czcionka Blendera), zamieniony na siatkę; leży w płaszczyźnie XY gry (przodem do +Z)
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = depth / 2
    cu.align_x = align
    cu.align_y = 'CENTER'
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(deps))
    bpy.data.objects.remove(o)
    # napis Blendera leży w XY Blendera (przodem do +Z Blendera = góra gry): obracamy go przodem do +Z gry
    me.transform(Matrix.Rotation(math.radians(90), 4, 'X'))
    return _obj(name, me, mat, pos, rot, parent)


def smooth(o, angle=35):
    if o.type != 'MESH':
        return
    me = o.data
    for p in me.polygons:
        p.use_smooth = True
    # krawędzie ostrzejsze niż kąt zostają ostre
    bm = bmesh.new()
    bm.from_mesh(me)
    lim = math.radians(angle)
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) > lim:
            e.smooth = False
    bm.to_mesh(me)
    bm.free()


# ---------------------------------------------------------------------------
# Wykończenie, wypalanie i eksport
# ---------------------------------------------------------------------------
def _meshes(r):
    return [o for o in r.children_recursive if o.type == 'MESH']


def apply_modifiers(objs):
    deps = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if not o.modifiers:
            continue
        ev = o.evaluated_get(deps)
        me = bpy.data.meshes.new_from_object(ev)
        old = o.data
        o.modifiers.clear()
        o.data = me
        if old.users == 0:
            bpy.data.meshes.remove(old)
        smooth(o)


def densify(o, max_edge):
    # gęstsza siatka na dużych płaskich ścianach, żeby cień kontaktowy w kolorach wierzchołków był płynny
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    sc = o.matrix_world.to_scale()
    s = max(sc.x, sc.y, sc.z)
    for _ in range(3):
        long = [e for e in bm.edges if e.calc_length() * s > max_edge]
        if not long:
            break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True, use_only_quads=False)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bm.to_mesh(me)
    bm.free()


def bake_ao(roots, distance=0.12, samples=96, ground=True, max_edge=0.05):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.world.light_settings.distance = distance
    # modele obok siebie, żeby nie zasłaniały się nawzajem; pod każdym podłoga (cień przy podstawie)
    grounds = []
    for k, r in enumerate(roots):
        r.location.x += 50 * (k + 1)
        if ground:
            bpy.ops.mesh.primitive_plane_add(size=6, location=(r.location.x, r.location.y, r.location.z - 0.0005))
            grounds.append(bpy.context.active_object)
    bpy.context.view_layer.update()
    objs = [o for r in roots for o in _meshes(r)]
    apply_modifiers(objs)
    for o in objs:
        densify(o, max_edge)
        me = o.data
        for a in list(me.color_attributes):
            me.color_attributes.remove(a)
        attr = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = 0
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    for g in grounds:
        bpy.data.objects.remove(g)
    for k, r in enumerate(roots):
        r.location.x -= 50 * (k + 1)
    bpy.context.view_layer.update()


def no_ao(objs):
    # części świecące i przezroczyste: biały kolor wierzchołków (gra ich nie przyciemnia)
    for o in objs:
        attr = o.data.color_attributes.get('Col')
        if attr:
            for d in attr.data:
                d.color = (1, 1, 1, 1)


def _kept(o, r, keep):
    # część animowana w grze: jej nazwa (albo nazwa grupy nad nią) jest w `keep`; „fan_” oznacza wszystkie fan_*
    while o is not None and o is not r:
        n = o.name.split('.')[0]
        if n in keep or any(n.startswith(k) for k in keep if k.endswith('_')):
            return True
        o = o.parent
    return False


def merge_by_material(r, keep=()):
    # łączy części modelu o tym samym materiale; części z nazwami z `keep` (animowane w grze) zostają osobno
    groups = {}
    for o in _meshes(r):
        if _kept(o, r, keep):
            continue
        if o.parent is not r:
            mw = o.matrix_world.copy()
            o.parent = r
            o.matrix_world = mw
        mat = o.data.materials[0].name if o.data.materials else ''
        groups.setdefault(mat, []).append(o)
    for mat, objs in groups.items():
        if len(objs) > 1:
            bpy.ops.object.select_all(action='DESELECT')
            for o in objs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            bpy.ops.object.join()
        objs[0].name = f'{r.name}_{mat}'
        objs[0].data.name = objs[0].name
    # puste grupy pomocnicze bez dzieci są niepotrzebne
    for o in list(r.children_recursive):
        if o.type == 'EMPTY' and not o.children:
            bpy.data.objects.remove(o)


def export(path, roots):
    bpy.ops.object.select_all(action='DESELECT')
    for r in roots:
        r.select_set(True)
        for o in r.children_recursive:
            o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
        export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_normals=True,
        export_texcoords=True, export_materials='EXPORT', export_extras=False, export_cameras=False,
        export_lights=False, export_animations=False, export_image_format='AUTO',
    )


def count(roots):
    v = t = 0
    for r in roots:
        for o in _meshes(r):
            v += len(o.data.vertices)
            t += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return v, t
