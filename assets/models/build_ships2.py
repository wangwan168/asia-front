import bpy, os, math
from mathutils import Matrix

MODELS = os.path.expanduser('~/workspace/ww2-asia/assets/models')

def mat(name, rgb, rough=0.8):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    return m

GREY = mat('HullGrey', (0.42, 0.45, 0.47))
DECKM = mat('Deck', (0.30, 0.30, 0.29))
BOOT = mat('BootTop', (0.35, 0.16, 0.12))
DARK = mat('DarkMetal', (0.13, 0.13, 0.14), 0.55)
GLASS = mat('BridgeGlass', (0.10, 0.15, 0.18), 0.25)
BAND = mat('FactionBand', (0.55, 0.55, 0.55))
RUST = mat('CargoRust', (0.45, 0.30, 0.20))
CREAM = mat('DeckPlane', (0.55, 0.57, 0.50))

def box(parent, name, loc, size, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.dimensions = size
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        o.data.materials.append(material)
    o.parent = parent
    return o

def cyl(parent, name, loc, radius, depth, material, rot=(0, 0, 0), verts=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        o.data.materials.append(material)
    o.parent = parent
    return o

def hull(parent, sections, name='Hull'):
    NR = 10
    verts, faces = [], []
    rings = []
    for (y, hw, rz, zc) in sections:
        rings.append(len(verts))
        for i in range(NR):
            a = 2 * math.pi * i / NR
            verts.append((hw * math.cos(a), y, zc + rz * math.sin(a)))
    for s in range(len(sections) - 1):
        a0, b0 = rings[s], rings[s + 1]
        for i in range(NR):
            faces.append((a0 + i, b0 + i, b0 + (i + 1) % NR, a0 + (i + 1) % NR))
    faces.append(tuple(rings[0] + i for i in reversed(range(NR))))
    faces.append(tuple(rings[-1] + i for i in range(NR)))
    mesh = bpy.data.meshes.new(name + 'Mesh')
    mesh.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(GREY)
    o.data.materials.append(BOOT)
    for p in o.data.polygons:
        if p.center.z < -0.22:
            p.material_index = 1
    o.parent = parent
    return o

def turret(parent, name, y, z, flip=False):
    g = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(g)
    g.parent = parent
    g.location = (0, y, z)
    if flip:
        g.rotation_euler = (0, 0, math.pi)
    cyl(g, name + 'Base', (0, 0, 0.02), 0.30, 0.10, GREY)
    box(g, name + 'House', (0, -0.02, 0.16), (0.52, 0.62, 0.22), GREY)
    for sx in (-0.13, 0.13):
        cyl(g, name + 'Gun', (sx, -0.52, 0.20), 0.045, 0.62, DARK, rot=(math.radians(90), 0, 0))
    return g

def funnel(parent, name, y, z, h=0.62, r=0.16):
    cyl(parent, name, (0, y, z + h / 2), r, h, GREY, rot=(math.radians(8), 0, 0))
    cyl(parent, name + 'Cap', (0, y - math.sin(math.radians(8)) * h / 2, z + h + 0.01),
        r * 1.01, 0.10, DARK, rot=(math.radians(8), 0, 0))

def ship_anims(root):
    def new_action(name):
        act = bpy.data.actions.new(name)
        root.animation_data_create()
        root.animation_data.action = act
        root.rotation_mode = 'XYZ'
        root.rotation_euler = (0, 0, 0)
        root.location = (0, 0, 0)
        return act

    def rkey(f, rx=0.0, rz=0.0, lz=0.0):
        root.rotation_euler = (rx, 0, rz)
        root.keyframe_insert('rotation_euler', index=0, frame=f)
        root.keyframe_insert('rotation_euler', index=2, frame=f)
        root.location = (0, 0, lz)
        root.keyframe_insert('location', index=2, frame=f)

    new_action('idle')
    for f, s in ((1, 0), (30, 1), (60, 0)):
        rkey(f, rx=0.008 * s, rz=0.012 * s, lz=0.045 * s)
    new_action('move')
    for f, s in ((1, -1), (20, 1), (40, -1)):
        rkey(f, rx=0.016 * s, rz=0.010 * s, lz=0.06 * s)
    new_action('attack')
    for f, s in ((1, 0), (20, 1), (40, 0)):
        rkey(f, rx=0.004 * s, rz=0.035 * s, lz=0.01 * s)
    new_action('die')
    for f, t in ((1, 0.0), (18, 0.35), (34, 0.7), (50, 1.0)):
        rkey(f, rx=-0.16 * t, rz=1.12 * t, lz=-1.5 * t * t)
    root.animation_data.action = None
    for a in list(bpy.data.actions):
        track = root.animation_data.nla_tracks.new()
        track.name = a.name
        strip = track.strips.new(a.name, 1, a)
        strip.action_frame_start = 1
        strip.action_frame_end = a.frame_range[1]

def export(root, fname):
    bpy.ops.export_scene.gltf(filepath=os.path.join(MODELS, fname), export_format='GLB',
                              export_yup=True, export_animations=True, export_nla_strips=True)
    print('SHIP exported', fname)

def fresh_root(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # materials were wiped by factory reset; rebuild them
    globals()['GREY'] = mat('HullGrey', (0.42, 0.45, 0.47))
    globals()['DECKM'] = mat('Deck', (0.30, 0.30, 0.29))
    globals()['BOOT'] = mat('BootTop', (0.35, 0.16, 0.12))
    globals()['DARK'] = mat('DarkMetal', (0.13, 0.13, 0.14), 0.55)
    globals()['GLASS'] = mat('BridgeGlass', (0.10, 0.15, 0.18), 0.25)
    globals()['BAND'] = mat('FactionBand', (0.55, 0.55, 0.55))
    globals()['RUST'] = mat('CargoRust', (0.45, 0.30, 0.20))
    globals()['CREAM'] = mat('DeckPlane', (0.55, 0.57, 0.50))
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    return root

# ============ CRUISER ============
root = fresh_root('Ship')
L, B = 11.0, 1.55
secs = [(5.5, 0.55, 0.42, 0.02), (4.6, 0.72, 0.48, 0.02), (3.0, 0.78, 0.50, 0.02),
        (0.5, 0.78, 0.50, 0.02), (-2.0, 0.74, 0.50, 0.02), (-3.8, 0.62, 0.48, 0.03),
        (-5.0, 0.38, 0.44, 0.05), (-5.5, 0.04, 0.30, 0.08)]
hull(root, secs)
box(root, 'Deck', (0, 0.1, 0.50), (B * 0.92, L * 0.94, 0.06), DECKM)
turret(root, 'TurretA', -3.55, 0.52)
turret(root, 'TurretB', -2.75, 0.66)
turret(root, 'TurretC', 4.15, 0.52, flip=True)
box(root, 'BridgeBase', (0, -1.55, 0.78), (0.95, 0.85, 0.5), GREY)
box(root, 'BridgeTop', (0, -1.60, 1.16), (0.80, 0.62, 0.28), GREY)
box(root, 'BridgeGlass', (0, -1.94, 1.16), (0.70, 0.05, 0.16), GLASS)
cyl(root, 'MastF', (0, -1.15, 1.35), 0.035, 1.15, DARK)
funnel(root, 'Funnel1', -0.45, 0.55, 0.72, 0.19)
funnel(root, 'Funnel2', 0.75, 0.55, 0.72, 0.19)
box(root, 'Catapult', (0, 2.35, 0.60), (0.30, 1.5, 0.08), DARK)
box(root, 'Floatplane', (0, 2.35, 0.72), (0.16, 0.85, 0.10), CREAM)
box(root, 'FloatWing', (0, 2.30, 0.74), (0.95, 0.28, 0.05), CREAM)
cyl(root, 'MastA', (0, 3.35, 1.05), 0.03, 1.0, DARK)
for sx in (-0.72, 0.72):
    cyl(root, 'AA', (sx, 1.55, 0.62), 0.05, 0.35, DARK)
box(root, 'FactionBand', (0, 4.95, 0.18), (B * 0.86, 0.5, 0.34), BAND)
ship_anims(root)
export(root, 'cruiser.glb')

# ============ CARRIER ============
root = fresh_root('Ship')
L, B = 12.0, 2.3
secs = [(6.0, 1.55, 0.55, 0.0), (5.0, 1.85, 0.62, 0.0), (2.5, 1.95, 0.65, 0.0),
        (-0.5, 1.95, 0.65, 0.0), (-3.0, 1.85, 0.63, 0.0), (-5.0, 1.45, 0.58, 0.02),
        (-6.0, 0.55, 0.45, 0.05)]
hull(root, secs)
box(root, 'FlightDeck', (0, 0, 0.86), (3.35, 12.3, 0.14), DECKM)
box(root, 'DeckEdge', (0, 0, 0.76), (3.40, 12.3, 0.06), GREY)
box(root, 'IslandBase', (1.72, -1.2, 1.25), (0.55, 1.7, 0.65), GREY)
box(root, 'IslandTop', (1.72, -1.35, 1.72), (0.48, 1.1, 0.30), GREY)
box(root, 'IslandGlass', (1.72, -1.93, 1.72), (0.40, 0.05, 0.15), GLASS)
cyl(root, 'FunnelI', (1.72, -0.35, 1.35), 0.13, 0.75, GREY)
cyl(root, 'MastI', (1.72, -1.6, 2.05), 0.03, 0.85, DARK)
for i, (px, py) in enumerate(((-0.7, -3.6), (0.55, -2.6), (-0.45, -1.4), (0.7, 2.8), (-0.6, 4.1))):
    box(root, 'DeckPlane%d' % i, (px, py, 0.99), (0.15, 0.85, 0.09), CREAM)
    box(root, 'DeckWing%d' % i, (px, py + 0.05, 1.0), (0.95, 0.26, 0.04), CREAM)
for sx in (-1.62, 1.62):
    for py in (-4.4, 0.4, 4.4):
        cyl(root, 'AA', (sx, py, 0.62), 0.05, 0.3, DARK)
box(root, 'FactionBand', (0, 5.45, 0.25), (2.6, 0.5, 0.4), BAND)
ship_anims(root)
export(root, 'carrier.glb')

# ============ TRANSPORT ============
root = fresh_root('Ship')
L, B = 9.0, 1.9
secs = [(4.5, 1.30, 0.73, -0.18), (3.8, 1.60, 0.80, -0.18), (1.5, 1.72, 0.83, -0.18),
        (-1.0, 1.72, 0.83, -0.18), (-3.0, 1.60, 0.81, -0.18), (-4.2, 1.15, 0.76, -0.16),
        (-4.5, 0.35, 0.60, -0.13)]
hull(root, secs)
box(root, 'Deck', (0, 0, 0.63), (B * 1.55, L * 0.92, 0.07), DECKM)
for i, hy in enumerate((-2.6, -0.4, 1.9)):
    box(root, 'Hatch%d' % i, (0, hy, 0.76), (1.9, 1.55, 0.22), RUST)
box(root, 'BridgeBlock', (0, 3.15, 1.0), (1.7, 1.1, 0.75), GREY)
box(root, 'BridgeGlass', (0, 2.58, 1.22), (1.45, 0.05, 0.18), GLASS)
funnel(root, 'FunnelT', 3.95, 0.68, 0.66, 0.20)
for cy in (-1.5, 0.8):
    cyl(root, 'CranePost', (0, cy, 1.15), 0.055, 1.05, DARK)
    box(root, 'CraneBoom', (0, cy - 0.55, 1.55), (0.07, 1.3, 0.07), DARK, rot=(math.radians(-38), 0, 0))
for sx in (-0.95, 0.95):
    box(root, 'Lifeboat', (sx, 3.1, 1.05), (0.22, 0.85, 0.18), CREAM)
box(root, 'FactionBand', (0, 4.15, 0.22), (2.3, 0.45, 0.38), BAND)
ship_anims(root)
export(root, 'transport.glb')
print('ALL SHIPS DONE')
