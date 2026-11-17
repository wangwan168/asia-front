import bpy, os, math

MODELS = os.path.expanduser('~/workspace/ww2-asia/assets/models')

def mat(name, rgb, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m

OLIVE = mat('OliveDrab', (0.30, 0.33, 0.22))
TRACK = mat('TrackDark', (0.12, 0.12, 0.12), 0.6, 0.3)
STEEL = mat('Steel', (0.35, 0.36, 0.37), 0.45, 0.5)
BAND = mat('FactionBand', (0.55, 0.55, 0.55))
RUBBER = mat('WheelRubber', (0.16, 0.16, 0.16), 0.9)

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

def cyl(parent, name, loc, radius, depth, material, rot=(0, 0, 0), verts=14):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        o.data.materials.append(material)
    o.parent = parent
    return o

bpy.ops.wm.read_factory_settings(use_empty=True)
OLIVE = mat('OliveDrab', (0.30, 0.33, 0.22))
TRACK = mat('TrackDark', (0.12, 0.12, 0.12), 0.6, 0.3)
STEEL = mat('Steel', (0.35, 0.36, 0.37), 0.45, 0.5)
BAND = mat('FactionBand', (0.55, 0.55, 0.55))
RUBBER = mat('WheelRubber', (0.16, 0.16, 0.16), 0.9)

root = bpy.data.objects.new('Tank', None)
bpy.context.scene.collection.objects.link(root)

# tracks + wheels
for sx in (-0.98, 0.98):
    box(root, 'Track', (sx, 0, 0.46), (0.58, 6.3, 0.92), TRACK)
    for i, wy in enumerate((-2.35, -1.2, 0.0, 1.2, 2.35)):
        cyl(root, 'Wheel', (sx * 1.31, wy, 0.42), 0.35, 0.09, STEEL, rot=(0, math.radians(90), 0))
        cyl(root, 'Hub', (sx * 1.37, wy, 0.42), 0.13, 0.05, RUBBER, rot=(0, math.radians(90), 0))
    box(root, 'Fender', (sx, -0.1, 0.97), (0.66, 6.5, 0.07), OLIVE)

# hull
box(root, 'Hull', (0, 0.1, 1.18), (1.95, 5.6, 0.62), OLIVE)
box(root, 'Glacis', (0, -3.02, 1.02), (1.95, 0.85, 0.10), OLIVE, rot=(math.radians(-38), 0, 0))
box(root, 'NosePlate', (0, -3.22, 0.62), (1.95, 0.10, 0.55), OLIVE)
box(root, 'RearPlate', (0, 3.02, 0.95), (1.95, 0.12, 0.75), OLIVE)
box(root, 'DeckRear', (0, 2.35, 1.52), (1.9, 1.15, 0.07), STEEL)
for sx in (-0.7, 0.7):
    box(root, 'Exhaust', (sx, 2.95, 1.30), (0.28, 0.5, 0.16), STEEL)
box(root, 'HeadlightL', (-0.75, -3.28, 0.86), (0.16, 0.06, 0.12), STEEL)
box(root, 'HeadlightR', (0.75, -3.28, 0.86), (0.16, 0.06, 0.12), STEEL)

# turret group (animated for recoil)
tur = bpy.data.objects.new('Turret', None)
bpy.context.scene.collection.objects.link(tur)
tur.parent = root
tur.location = (0, -0.35, 1.78)
cyl(tur, 'TurretBody', (0, 0.15, 0.0), 0.92, 0.52, OLIVE, verts=10)
tur_body = bpy.context.active_object
tur_body.scale = (1.0, 1.25, 1.0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
box(tur, 'Mantlet', (0, -1.02, 0.02), (0.52, 0.30, 0.34), OLIVE)
cyl(tur, 'Barrel', (0, -2.15, 0.04), 0.085, 2.15, STEEL, rot=(math.radians(90), 0, 0))
cyl(tur, 'MuzzleBrake', (0, -3.05, 0.04), 0.125, 0.34, STEEL, rot=(math.radians(90), 0, 0))
cyl(tur, 'Cupola', (-0.38, 0.30, 0.33), 0.26, 0.16, OLIVE)
cyl(tur, 'Hatch', (0.30, 0.42, 0.29), 0.24, 0.07, STEEL)
box(tur, 'Bustle', (0, 1.18, 0.0), (1.15, 0.5, 0.42), OLIVE)
box(tur, 'FactionBand', (0, 1.45, 0.0), (1.17, 0.06, 0.30), BAND)
cyl(tur, 'SpareWheel', (1.02, 0.45, 0.0), 0.33, 0.09, RUBBER, rot=(0, math.radians(90), 0))
cyl(tur, 'AA_MG', (0.30, 0.42, 0.55), 0.035, 0.55, TRACK, rot=(math.radians(65), 0, 0))

# ---- animations ----
def root_action(name):
    act = bpy.data.actions.new(name)
    root.animation_data_create()
    root.animation_data.action = act
    root.rotation_mode = 'XYZ'
    root.rotation_euler = (0, 0, 0)
    root.location = (0, 0, 0)
    return act

def rkey(f, rx=0.0, rz=0.0, lz=0.0, ly=0.0):
    root.rotation_euler = (rx, 0, rz)
    root.keyframe_insert('rotation_euler', index=0, frame=f)
    root.keyframe_insert('rotation_euler', index=2, frame=f)
    root.location = (0, ly, lz)
    root.keyframe_insert('location', index=1, frame=f)
    root.keyframe_insert('location', index=2, frame=f)

root_action('idle')
for f, s in ((1, 0), (30, 1), (60, 0)):
    rkey(f, rx=0.002 * s, lz=0.006 * s)
root_action('move')
for f, s in ((1, -1), (10, 1), (20, -1), (30, 1), (40, -1)):
    rkey(f, rx=0.012 * s, lz=0.02 * (s * 0.5 + 0.5))
root_action('attack')
for f, s, ly in ((1, 0, 0.0), (8, 0, 0.0), (11, 1, 0.11), (22, 0, 0.0), (40, 0, 0.0)):
    rkey(f, rx=0.010 * s, lz=0.006 * s, ly=ly)
root_action('die')
for f, t in ((1, 0.0), (20, 0.4), (40, 0.75), (55, 1.0)):
    rkey(f, rx=0.06 * t, rz=0.38 * t, lz=-0.18 * t)

root.animation_data.action = None
for a in list(bpy.data.actions):
    track = root.animation_data.nla_tracks.new()
    track.name = a.name
    strip = track.strips.new(a.name, 1, a)
    strip.action_frame_start = 1
    strip.action_frame_end = a.frame_range[1]

bpy.ops.export_scene.gltf(filepath=os.path.join(MODELS, 'tank_medium.glb'), export_format='GLB',
                          export_yup=True, export_animations=True, export_nla_strips=True)
print('TANK exported tank_medium.glb')
