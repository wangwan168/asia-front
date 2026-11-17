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

def tank_anims(root):
    def new_action(name):
        act = bpy.data.actions.new(name)
        root.animation_data_create()
        root.animation_data.action = act
        root.rotation_mode = 'XYZ'
        root.rotation_euler = (0, 0, 0)
        root.location = (0, 0, 0)
        return act

    def key(f, rx=0.0, rz=0.0, ly=0.0, lz=0.0):
        root.rotation_euler = (rx, 0, rz)
        root.keyframe_insert('rotation_euler', index=0, frame=f)
        root.keyframe_insert('rotation_euler', index=2, frame=f)
        root.location = (0, ly, lz)
        root.keyframe_insert('location', index=1, frame=f)
        root.keyframe_insert('location', index=2, frame=f)

    new_action('idle')
    for f, s in ((1, 0), (30, 1), (60, 0)):
        key(f, rx=0.002 * s, lz=0.006 * s)
    new_action('move')
    for f, s in ((1, -1), (10, 1), (20, -1), (30, 1), (40, -1)):
        key(f, rx=0.012 * s, lz=0.02 * (s * 0.5 + 0.5))
    new_action('attack')
    for f, s, ly in ((1, 0, 0.0), (8, 0, 0.0), (11, 1, 0.11), (22, 0, 0.0), (40, 0, 0.0)):
        key(f, rx=0.010 * s, lz=0.006 * s, ly=ly)
    new_action('die')
    for f, t in ((1, 0.0), (20, 0.4), (40, 0.75), (55, 1.0)):
        key(f, rx=0.06 * t, rz=0.38 * t, lz=-0.18 * t)
    root.animation_data.action = None
    for a in list(bpy.data.actions):
        track = root.animation_data.nla_tracks.new()
        track.name = a.name
        strip = track.strips.new(a.name, 1, a)
        strip.action_frame_start = 1
        strip.action_frame_end = a.frame_range[1]

def build_tank(fname, body_rgb, L=6.3, W=1.95, hull_h=0.62, hull_z=1.18,
               wheels=(-2.35, -1.2, 0.0, 1.2, 2.35), wheel_r=0.35,
               turret_y=-0.35, turret_r=0.92, turret_h=0.52, barrel_len=2.15,
               muzzle=True, glacis_ang=-38, band=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    BODY = mat('Body', body_rgb)
    TRACK = mat('TrackDark', (0.12, 0.12, 0.12), 0.6, 0.3)
    STEEL = mat('Steel', (0.35, 0.36, 0.37), 0.45, 0.5)
    BAND = mat('FactionBand', (0.55, 0.55, 0.55))
    RUBBER = mat('WheelRubber', (0.16, 0.16, 0.16), 0.9)
    root = bpy.data.objects.new('Tank', None)
    bpy.context.scene.collection.objects.link(root)
    tx = W / 2
    for sx in (-tx, tx):
        side = 1 if sx > 0 else -1
        box(root, 'Track', (sx, 0, 0.46), (0.58, L, 0.92), TRACK)
        for wy in wheels:
            cyl(root, 'Wheel', (sx + side * 0.34, wy, 0.42), wheel_r, 0.09, STEEL, rot=(0, math.radians(90), 0))
            cyl(root, 'Hub', (sx + side * 0.40, wy, 0.42), wheel_r * 0.37, 0.05, RUBBER, rot=(0, math.radians(90), 0))
        box(root, 'Fender', (sx, -0.1, 0.97), (0.66, L + 0.2, 0.07), BODY)
    box(root, 'Hull', (0, 0.1, hull_z), (W, L - 0.7, hull_h), BODY)
    box(root, 'Glacis', (0, -(L / 2 - 0.13), hull_z - 0.16), (W, 0.85, 0.10), BODY, rot=(math.radians(glacis_ang), 0, 0))
    box(root, 'NosePlate', (0, -(L / 2 + 0.07), 0.62), (W, 0.10, 0.55), BODY)
    box(root, 'RearPlate', (0, L / 2 - 0.13, 0.95), (W, 0.12, 0.75), BODY)
    tur = bpy.data.objects.new('Turret', None)
    bpy.context.scene.collection.objects.link(tur)
    tur.parent = root
    tur.location = (0, turret_y, hull_z + hull_h / 2 + turret_h / 2 - 0.06)
    tb = cyl(tur, 'TurretBody', (0, 0.15, 0.0), turret_r, turret_h, BODY, verts=10)
    tb.scale = (1.0, 1.25, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    box(tur, 'Mantlet', (0, -turret_r * 1.12, 0.02), (0.52, 0.30, 0.34), BODY)
    cyl(tur, 'Barrel', (0, -turret_r * 1.12 - barrel_len / 2, 0.04), 0.085, barrel_len, STEEL, rot=(math.radians(90), 0, 0))
    if muzzle:
        cyl(tur, 'MuzzleBrake', (0, -turret_r * 1.12 - barrel_len + 0.15, 0.04), 0.125, 0.34, STEEL, rot=(math.radians(90), 0, 0))
    cyl(tur, 'Cupola', (-turret_r * 0.4, 0.30, turret_h / 2 + 0.06), 0.26, 0.16, BODY)
    box(tur, 'Bustle', (0, turret_r * 1.28, 0.0), (1.15, 0.5, 0.42), BODY)
    if band:
        box(tur, 'FactionBand', (0, turret_r * 1.55, 0.0), (1.17, 0.06, 0.30), BAND)
    tank_anims(root)
    bpy.ops.export_scene.gltf(filepath=os.path.join(MODELS, fname), export_format='GLB',
                              export_yup=True, export_animations=True, export_nla_strips=True)
    print('TANK-C4 exported', fname)

# T-34: soviet green, 5 big Christie wheels, steep glacis, long barrel, no muzzle brake (early 76mm)
build_tank('t34.glb', (0.23, 0.30, 0.17), wheels=(-2.4, -1.25, 0.0, 1.25, 2.4),
           wheel_r=0.42, barrel_len=2.5, muzzle=False, glacis_ang=-52, turret_r=0.88)
# Sherman: US olive, taller hull, 6 smaller wheels (3 bogie pairs), shorter barrel with brake
build_tank('sherman.glb', (0.32, 0.33, 0.23), hull_h=0.78, hull_z=1.28,
           wheels=(-2.2, -1.55, -0.55, 0.55, 1.55, 2.2), wheel_r=0.29,
           barrel_len=1.85, muzzle=True, turret_r=0.95)
# Type-95 Ha-Go: small Japanese light tank, 4 wheels, short barrel, offset feel via narrow hull
build_tank('type95.glb', (0.36, 0.36, 0.27), L=4.9, W=1.55, hull_h=0.52, hull_z=1.02,
           wheels=(-1.75, -0.6, 0.6, 1.75), wheel_r=0.31,
           barrel_len=1.25, muzzle=False, turret_r=0.62, turret_h=0.44, turret_y=-0.2)
print('C4 TANKS DONE')
