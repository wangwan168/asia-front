import bpy, os, math

MODELS = os.path.expanduser('~/workspace/ww2-asia/assets/models')

def mat(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    return m

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

def loft(parent, name, sections, material, nr=12):
    verts, faces, rings = [], [], []
    for (y, r) in sections:
        rings.append(len(verts))
        for i in range(nr):
            a = 2 * math.pi * i / nr
            verts.append((r * math.cos(a), y, r * math.sin(a)))
    for s in range(len(sections) - 1):
        a0, b0 = rings[s], rings[s + 1]
        for i in range(nr):
            faces.append((a0 + i, b0 + i, b0 + (i + 1) % nr, a0 + (i + 1) % nr))
    faces.append(tuple(rings[0] + i for i in reversed(range(nr))))
    faces.append(tuple(rings[-1] + i for i in range(nr)))
    mesh = bpy.data.meshes.new(name + 'Mesh')
    mesh.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    if material:
        o.data.materials.append(material)
    o.parent = parent
    return o

bpy.ops.wm.read_factory_settings(use_empty=True)
HORSE = mat('HorseBrown', (0.34, 0.23, 0.14))
MANE = mat('ManeDark', (0.17, 0.11, 0.07))
KHAKI = mat('SovietKhaki', (0.38, 0.36, 0.24))
SKIN = mat('Skin', (0.72, 0.55, 0.42))
LEATHER = mat('Leather', (0.30, 0.19, 0.11))
DARK = mat('DarkMetal', (0.15, 0.15, 0.15), 0.5)
BAND = mat('FactionBand', (0.55, 0.55, 0.55))
RED = mat('StarRed', (0.55, 0.12, 0.10))

root = bpy.data.objects.new('Cavalry', None)
bpy.context.scene.collection.objects.link(root)

# ---- horse ----
body = loft(root, 'HorseBody', [(-1.55, 0.30), (-1.25, 0.50), (-0.4, 0.56), (0.5, 0.55),
                                (1.25, 0.50), (1.55, 0.28)], HORSE)
body.location = (0, 0, 1.38)
body.scale = (0.80, 1.0, 1.0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
body.location = (0, 0, 1.38)
box(root, 'Neck', (0, -1.62, 1.86), (0.32, 0.95, 0.60), HORSE, rot=(math.radians(-38), 0, 0))
box(root, 'Mane', (0, -1.44, 2.02), (0.08, 0.95, 0.52), MANE, rot=(math.radians(-38), 0, 0))
box(root, 'Head', (0, -2.12, 2.28), (0.25, 0.80, 0.32), HORSE, rot=(math.radians(-18), 0, 0))
box(root, 'Muzzle', (0, -2.48, 2.14), (0.19, 0.30, 0.24), MANE, rot=(math.radians(-18), 0, 0))
for sx in (-0.09, 0.09):
    box(root, 'Ear', (sx, -1.92, 2.52), (0.06, 0.10, 0.18), HORSE)
for sx in (-0.30, 0.30):
    for ly, lz, ang in ((-1.15, 0.55, 6), (1.15, 0.55, -6)):
        box(root, 'Leg', (sx, ly, lz), (0.13, 0.16, 1.12), HORSE, rot=(math.radians(ang), 0, 0))
        box(root, 'Hoof', (sx, ly + (0.06 if ang > 0 else -0.06), 0.03), (0.14, 0.22, 0.07), DARK)
box(root, 'Tail', (0, 1.72, 1.62), (0.09, 0.30, 0.85), MANE, rot=(math.radians(28), 0, 0))
box(root, 'SaddleBlanket', (0, -0.05, 1.86), (0.98, 0.95, 0.10), BAND)
box(root, 'Saddle', (0, -0.05, 1.97), (0.55, 0.72, 0.13), LEATHER)
box(root, 'Bridle', (0, -2.30, 2.30), (0.27, 0.30, 0.06), LEATHER, rot=(math.radians(-18), 0, 0))

# ---- rider ----
for sx in (-0.36, 0.36):
    box(root, 'Thigh', (sx, -0.28, 1.80), (0.15, 0.55, 0.20), KHAKI, rot=(math.radians(30), 0, sx * 6))
    box(root, 'Shin', (sx * 1.12, -0.02, 1.28), (0.13, 0.18, 0.95), KHAKI)
    box(root, 'Boot', (sx * 1.12, -0.10, 0.78), (0.13, 0.30, 0.16), LEATHER)
box(root, 'Torso', (0, 0.02, 2.42), (0.46, 0.27, 0.75), KHAKI, rot=(math.radians(6), 0, 0))
box(root, 'Belt', (0, 0.03, 2.14), (0.48, 0.29, 0.10), LEATHER)
cyl(root, 'Head', (0, 0.06, 2.94), 0.135, 0.26, SKIN, verts=10)
bud = cyl(root, 'Budenovka', (0, 0.06, 3.10), 0.145, 0.22, KHAKI, verts=10)
bud.scale = (1, 1, 1)
cone = bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.13, radius2=0.02, depth=0.22,
                                       location=(0, 0.06, 3.30))
cone_o = bpy.context.active_object
cone_o.name = 'BudenovkaTip'
cone_o.data.materials.append(KHAKI)
cone_o.parent = root
box(root, 'StarBadge', (0, -0.085, 3.06), (0.07, 0.02, 0.07), RED)
box(root, 'ArmR', (0.34, -0.10, 2.62), (0.12, 0.16, 0.55), KHAKI, rot=(math.radians(-52), 0, math.radians(-18)))
box(root, 'Saber', (0.46, -0.34, 2.98), (0.035, 0.80, 0.09), DARK, rot=(math.radians(-38), 0, math.radians(-18)))
box(root, 'ArmL', (-0.33, -0.14, 2.44), (0.12, 0.16, 0.52), KHAKI, rot=(math.radians(38), 0, math.radians(14)))
box(root, 'Carbine', (0.10, 0.24, 2.48), (0.07, 0.09, 0.95), DARK, rot=(math.radians(10), 0, math.radians(24)))

# ---- animations ----
def new_action(name):
    act = bpy.data.actions.new(name)
    root.animation_data_create()
    root.animation_data.action = act
    root.rotation_mode = 'XYZ'
    root.rotation_euler = (0, 0, 0)
    root.location = (0, 0, 0)
    return act

def key(f, rx=0.0, rz=0.0, lz=0.0):
    root.rotation_euler = (rx, 0, rz)
    root.keyframe_insert('rotation_euler', index=0, frame=f)
    root.keyframe_insert('rotation_euler', index=2, frame=f)
    root.location = (0, 0, lz)
    root.keyframe_insert('location', index=2, frame=f)

new_action('idle')
for f, s in ((1, 0), (30, 1), (60, 0)):
    key(f, rx=0.006 * s, lz=0.015 * s)
new_action('move')
for f, s in ((1, -1), (10, 1), (20, -1)):
    key(f, rx=0.045 * s, lz=0.11 * (s * 0.5 + 0.5))
new_action('attack')
for f, s in ((1, -1), (10, 1), (20, -1)):
    key(f, rx=0.065 * s - 0.02, lz=0.15 * (s * 0.5 + 0.5))
new_action('die')
for f, t in ((1, 0.0), (18, 0.4), (34, 0.75), (48, 1.0)):
    key(f, rz=1.30 * t, lz=-0.55 * t)
root.animation_data.action = None
for a in list(bpy.data.actions):
    track = root.animation_data.nla_tracks.new()
    track.name = a.name
    strip = track.strips.new(a.name, 1, a)
    strip.action_frame_start = 1
    strip.action_frame_end = a.frame_range[1]

bpy.ops.export_scene.gltf(filepath=os.path.join(MODELS, 'cavalry_ussr.glb'), export_format='GLB',
                          export_yup=True, export_animations=True, export_nla_strips=True)
print('CAVALRY exported cavalry_ussr.glb')
