import bpy, os, math
from mathutils import Vector

OUT = os.path.expanduser('~/workspace/ww2-asia/assets/models/destroyer.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    return m

HULL = mat('HullGrey', (0.34, 0.36, 0.38))
BOOT = mat('BootTop', (0.23, 0.12, 0.09))
DECK = mat('DeckDark', (0.15, 0.14, 0.13))
SUPER = mat('SuperGrey', (0.40, 0.42, 0.44))
DARK = mat('DarkMetal', (0.10, 0.10, 0.11), 0.6)
FACTION = mat('FactionBand', (0.55, 0.50, 0.38))

root = bpy.data.objects.new('Ship', None)
bpy.context.scene.collection.objects.link(root)

def parent(o):
    o.parent = root
    return o

def box(name, loc, size, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.dimensions = size
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        o.data.materials.append(material)
    return parent(o)

def cyl(name, loc, radius, depth, material, rot=(0, 0, 0), verts=14):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        o.data.materials.append(material)
    return parent(o)

# ---------------- lofted hull (Blender: bow toward -Y, up +Z) ----------------
# sections stern(+Y) -> bow(-Y): (y, half_beam, deck_z, keel_z)
sections = [
    (5.5, 0.40, 0.60, -0.26),
    (5.0, 0.52, 0.58, -0.36),
    (4.0, 0.56, 0.56, -0.42),
    (2.0, 0.57, 0.55, -0.44),
    (0.0, 0.57, 0.55, -0.44),
    (-2.0, 0.55, 0.56, -0.42),
    (-3.5, 0.48, 0.58, -0.35),
    (-4.5, 0.34, 0.61, -0.24),
    (-5.2, 0.15, 0.64, -0.08),
    (-5.5, 0.015, 0.66, 0.34),
]
# outline across: deck edge L, chine L, bilge L, keel C, bilge R, chine R, deck edge R
def outline(sec):
    y, hb, dz, kz = sec
    return [
        Vector((-hb, y, dz)),
        Vector((-hb * 0.99, y, 0.05)),
        Vector((-hb * 0.80, y, kz + 0.13)),
        Vector((0, y, kz)),
        Vector((hb * 0.80, y, kz + 0.13)),
        Vector((hb * 0.99, y, 0.05)),
        Vector((hb, y, dz)),
    ]

verts, faces = [], []
rings = []
for sec in sections:
    ring = outline(sec)
    rings.append(len(verts))
    verts.extend(ring)
NP = 7
for s in range(len(sections) - 1):
    a, b = rings[s], rings[s + 1]
    for i in range(NP - 1):
        faces.append((a + i, b + i, b + i + 1, a + i + 1))
# stern transom cap
faces.append(tuple(rings[0] + i for i in reversed(range(NP))))
mesh = bpy.data.meshes.new('HullMesh')
mesh.from_pydata([tuple(v) for v in verts], [], faces)
hull = bpy.data.objects.new('Hull', mesh)
bpy.context.scene.collection.objects.link(hull)
hull.data.materials.append(HULL)
hull.data.materials.append(BOOT)
for p in hull.data.polygons:
    cz = sum(hull.data.vertices[i].co.z for i in p.vertices) / len(p.vertices)
    p.material_index = 1 if cz < -0.18 else 0
parent(hull)

# deck strip (flat, dark)
dv, df = [], []
dr = []
for sec in sections:
    y, hb, dz, kz = sec
    dr.append(len(dv))
    dv.extend([(-hb + 0.02, y, dz - 0.015), (hb - 0.02, y, dz - 0.015)])
for s in range(len(sections) - 1):
    a, b = dr[s], dr[s + 1]
    df.append((a, a + 1, b + 1, b))
dmesh = bpy.data.meshes.new('DeckMesh')
dmesh.from_pydata(dv, [], df)
deck = bpy.data.objects.new('Deck', dmesh)
bpy.context.scene.collection.objects.link(deck)
deck.data.materials.append(DECK)
parent(deck)

# faction band: thin box strip along the hull side at the stern quarter (recolorable)
box('FactionBand', (0, 4.55, 0.30), (1.06, 1.5, 0.16), FACTION)

# ---------------- superstructure & weapons ----------------
def turret(name, y, base_z, facing):
    cyl(name + 'Base', (0, y, base_z + 0.07), 0.30, 0.14, SUPER)
    box(name + 'House', (0, y - facing * 0.05, base_z + 0.26), (0.52, 0.72, 0.24), SUPER)
    for sx in (-0.11, 0.11):
        cyl(name + 'Gun', (sx, y - facing * 0.62, base_z + 0.30), 0.028, 0.62, DARK,
            rot=(math.radians(90), 0, 0))

turret('TurretA', -3.85, 0.60, 1)          # bow turret, faces -Y
turret('TurretB', -2.75, 0.76, 1)          # superfiring
turret('TurretX', 4.15, 0.58, -1)          # stern turret, faces +Y
box('BridgeBase', (0, -1.55, 0.78), (0.78, 0.85, 0.42), SUPER)
box('BridgeTop', (0, -1.60, 1.10), (0.62, 0.62, 0.26), SUPER)
box('BridgeGlass', (0, -1.86, 1.12), (0.56, 0.06, 0.14), DARK)
cyl('Mast', (0, -1.45, 1.62), 0.022, 0.85, DARK)
box('MastYard', (0, -1.45, 1.86), (0.55, 0.03, 0.03), DARK)
cyl('Funnel1', (0, -0.55, 0.92), 0.17, 0.72, SUPER, rot=(math.radians(6), 0, 0))
cyl('Funnel1Cap', (0, -0.51, 1.26), 0.175, 0.08, DARK, rot=(math.radians(6), 0, 0))
cyl('Funnel2', (0, 0.75, 0.90), 0.17, 0.68, SUPER, rot=(math.radians(6), 0, 0))
cyl('Funnel2Cap', (0, 0.79, 1.22), 0.175, 0.08, DARK, rot=(math.radians(6), 0, 0))
box('MidDeck', (0, 1.85, 0.68), (0.66, 0.9, 0.24), SUPER)
for yy in (1.55, 2.15):
    cyl('Torpedo', (0, yy, 0.88), 0.16, 0.30, DARK, rot=(0, 0, 0))
    for sx in (-0.10, 0.0, 0.10):
        cyl('TTube', (sx, yy, 0.90), 0.035, 0.34, SUPER, rot=(math.radians(90), 0, 0))
box('AftDeck', (0, 3.15, 0.66), (0.6, 0.7, 0.2), SUPER)
cyl('AAGun1', (-0.38, -0.9, 0.78), 0.05, 0.22, DARK)
cyl('AAGun2', (0.38, -0.9, 0.78), 0.05, 0.22, DARK)
box('DCrack', (0, 5.15, 0.68), (0.5, 0.35, 0.16), DARK)

# ---------------- root animations: idle / move / die ----------------
def new_action(name):
    act = bpy.data.actions.new(name)
    root.animation_data_create()
    root.animation_data.action = act
    root.rotation_mode = 'XYZ'
    root.rotation_euler = (0, 0, 0)
    root.location = (0, 0, 0)
    return act

def rkey(act, f, rx=0.0, ry=0.0, lz=0.0):
    root.rotation_euler = (rx, ry, 0)
    root.keyframe_insert('rotation_euler', index=0, frame=f)
    root.keyframe_insert('rotation_euler', index=1, frame=f)
    root.location = (0, 0, lz)
    root.keyframe_insert('location', index=2, frame=f)

act = new_action('idle')
for f, ph in ((1, 0), (30, 1), (60, 0)):
    s = 1 if ph else 0
    rkey(act, f, rx=0.012 * s, ry=0.005 * s, lz=0.035 * s)
act = new_action('move')
for f, ph in ((1, 0), (10, 1), (20, 0), (30, 1), (40, 0)):
    s = 1 if ph else -1
    rkey(act, f, rx=0.02 * s, ry=0.010 * s, lz=0.05 * s)
act = new_action('attack')
for f in (1, 40):
    rkey(act, f, rx=0.015, ry=0.004, lz=0.02)
act = new_action('die')
for f, t in ((1, 0.0), (18, 0.25), (34, 0.7), (46, 1.0), (55, 1.0)):
    rkey(act, f, rx=1.15 * t, ry=-0.25 * t, lz=-1.55 * t * t)

root.animation_data.action = None
for a in list(bpy.data.actions):
    track = root.animation_data.nla_tracks.new()
    track.name = a.name
    strip = track.strips.new(a.name, 1, a)
    strip.action_frame_start = 1
    strip.action_frame_end = a.frame_range[1]

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True,
                          export_animations=True, export_nla_strips=True)
tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
print('DESTROYER exported', OUT)
