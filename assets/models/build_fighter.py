import bpy, os, math
from mathutils import Vector

OUT = os.path.expanduser('~/workspace/ww2-asia/assets/models/fighter_zero.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough=0.8, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'DITHERED'
    return m

BODY = mat('BodyGreyGreen', (0.55, 0.58, 0.50))
COWL = mat('CowlingDark', (0.13, 0.13, 0.14), 0.6)
GLASS = mat('CanopyGlass', (0.10, 0.14, 0.16), 0.25)
RED = mat('Hinomaru', (0.62, 0.10, 0.10), 0.7)
DARK = mat('DarkMetal', (0.12, 0.12, 0.13), 0.55)
DISC = mat('PropDisc', (0.08, 0.08, 0.08), 0.4, alpha=0.16)

root = bpy.data.objects.new('Plane', None)
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

# ---- fuselage loft (Blender: nose toward -Y, up +Z). sections tail(+Y) -> nose(-Y)
sections = [
    (3.05, 0.05, 0.10), (2.6, 0.13, 0.10), (2.0, 0.20, 0.09), (1.2, 0.27, 0.07),
    (0.3, 0.32, 0.05), (-0.6, 0.34, 0.04), (-1.4, 0.35, 0.03), (-2.2, 0.36, 0.02),
    (-2.75, 0.36, 0.02), (-3.0, 0.30, 0.02),
]
NR = 10
verts, faces = [], []
rings = []
for (y, r, zo) in sections:
    rings.append(len(verts))
    for i in range(NR):
        a = 2 * math.pi * i / NR
        verts.append((r * math.cos(a), y, r * math.sin(a) + zo))
for s in range(len(sections) - 1):
    a0, b0 = rings[s], rings[s + 1]
    for i in range(NR):
        faces.append((a0 + i, b0 + i, b0 + (i + 1) % NR, a0 + (i + 1) % NR))
faces.append(tuple(rings[0] + i for i in reversed(range(NR))))
mesh = bpy.data.meshes.new('FuselageMesh')
mesh.from_pydata(verts, [], faces)
fus = bpy.data.objects.new('Fuselage', mesh)
bpy.context.scene.collection.objects.link(fus)
fus.data.materials.append(BODY)
parent(fus)

# cowling front ring + spinner + prop
cyl('Cowling', (0, -2.95, 0.02), 0.355, 0.28, COWL, rot=(math.radians(90), 0, 0))
bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.13, radius2=0.01, depth=0.34, location=(0, -3.22, 0.02))
spinner = bpy.context.active_object
spinner.name = 'Spinner'
spinner.rotation_euler = (math.radians(-90), 0, 0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
spinner.data.materials.append(COWL)
parent(spinner)
for k in range(3):
    ang = math.radians(120 * k)
    bl = box('PropBlade', (0, -3.14, 0.02), (0.085, 0.03, 0.78), DARK)
    # rotate blade around the Y (long) axis through the hub: bake pivot by rotating about hub point
    bl.rotation_euler = (0, 0, 0)
    # position blade center offset along its length, then rotate around hub via matrix
    from mathutils import Matrix
    off = Matrix.Translation((0, 0, 0.42))
    rotm = Matrix.Rotation(ang, 4, 'Y')
    hub = Matrix.Translation((0, -3.14, 0.02))
    bl.matrix_world = hub @ rotm @ off @ Matrix.Translation((-0, 0, -0.0))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
cyl('PropDisc', (0, -3.16, 0.02), 0.82, 0.012, DISC, rot=(math.radians(90), 0, 0), verts=24)

# ---- wings: tapered prisms (both halves in one mesh)
def prism(name, quads_top, thick, material):
    # quads_top: 4 (x,y) corners of the top face outline (plan view), extruded down by thick
    vs, fs = [], []
    for (x, y) in quads_top:
        vs.append((x, y, 0.0))
    for (x, y) in quads_top:
        vs.append((x, y, -thick))
    fs.append((0, 1, 2, 3))
    fs.append((7, 6, 5, 4))
    for i in range(4):
        j = (i + 1) % 4
        fs.append((i, j, j + 4, i + 4))
    m = bpy.data.meshes.new(name + 'Mesh')
    m.from_pydata(vs, [], fs)
    o = bpy.data.objects.new(name, m)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material)
    return parent(o)

# main wing at y ~ -0.1 (low wing), root chord 1.45, tip chord 0.78, span +-3.45
prism('WingR', [(0.16, -0.85), (3.45, -0.42), (3.45, 0.36), (0.16, 0.62)], 0.085, BODY)
prism('WingL', [(-0.16, 0.62), (-3.45, 0.36), (-3.45, -0.42), (-0.16, -0.85)], 0.085, BODY)
for o in bpy.data.objects:
    if o.name in ('WingR', 'WingL'):
        o.location.z = -0.10
# tailplane + fin
prism('TailR', [(0.10, 2.55), (1.25, 2.68), (1.25, 3.15), (0.10, 3.12)], 0.06, BODY)
prism('TailL', [(-0.10, 3.12), (-1.25, 3.15), (-1.25, 2.68), (-0.10, 2.55)], 0.06, BODY)
for o in bpy.data.objects:
    if o.name in ('TailR', 'TailL'):
        o.location.z = 0.10
box('Fin', (0, 2.88, 0.28), (0.045, 0.85, 0.42), BODY)
box('Rudder', (0, 3.28, 0.24), (0.04, 0.22, 0.34), BODY)

# canopy bubble
bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, location=(0, 0.55, 0.33))
can = bpy.context.active_object
can.name = 'Canopy'
can.dimensions = (0.44, 1.15, 0.34)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
can.data.materials.append(GLASS)
parent(can)
box('Headrest', (0, 1.18, 0.30), (0.20, 0.28, 0.22), BODY)

# exhaust + guns + hinomaru
for sx in (-0.20, 0.20):
    cyl('Exhaust', (sx, -2.55, -0.16), 0.035, 0.30, DARK, rot=(math.radians(90), 0, 0))
for sx in (-1.55, 1.55):
    cyl('WingGun', (sx, -0.52, -0.08), 0.022, 0.42, DARK, rot=(math.radians(90), 0, 0))
for sx in (-2.25, 2.25):
    cyl('HinomaruWing', (sx, -0.03, -0.055), 0.34, 0.095, RED, verts=18)
for sx in (-0.30, 0.30):
    cyl('HinomaruFuse', (sx, 1.15, 0.10), 0.21, 0.02, RED, rot=(0, math.radians(90), 0), verts=18)

# ---- root animations ----
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
for f, s in ((1, 0), (30, 1), (60, 0)):
    rkey(act, f, rx=0.010 * s, ry=0.006 * s, lz=0.05 * s)
act = new_action('move')
for f, s in ((1, -1), (10, 1), (20, -1), (30, 1), (40, -1)):
    rkey(act, f, rx=0.02 * s, ry=0.16 * s, lz=0.07 * s)
act = new_action('attack')
for f, d in ((1, 0), (8, 1), (16, 0), (24, 1), (32, 0), (40, 0)):
    rkey(act, f, rx=-0.13 * d, ry=0.03 * d, lz=-0.10 * d)
act = new_action('die')
for f, t in ((1, 0.0), (15, 0.3), (30, 0.65), (42, 1.0), (50, 1.0)):
    rkey(act, f, rx=-0.55 * t, ry=4.6 * t, lz=-3.4 * t * t)

root.animation_data.action = None
for a in list(bpy.data.actions):
    track = root.animation_data.nla_tracks.new()
    track.name = a.name
    strip = track.strips.new(a.name, 1, a)
    strip.action_frame_start = 1
    strip.action_frame_end = a.frame_range[1]

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True,
                          export_animations=True, export_nla_strips=True)
print('FIGHTER exported', OUT)
