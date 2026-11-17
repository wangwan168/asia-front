import bpy, os, math

MODELS = os.path.expanduser('~/workspace/ww2-asia/assets/models')

def mat(name, rgb, rough=0.8, metal=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'DITHERED'
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

def root_anims(root, kind):
    def new_action(name):
        act = bpy.data.actions.new(name)
        root.animation_data_create()
        root.animation_data.action = act
        root.rotation_mode = 'XYZ'
        root.rotation_euler = (0, 0, 0)
        root.location = (0, 0, 0)
        return act

    def key(f, rx=0.0, ry=0.0, rz=0.0, ly=0.0, lz=0.0):
        root.rotation_euler = (rx, ry, rz)
        for i in range(3):
            root.keyframe_insert('rotation_euler', index=i, frame=f)
        root.location = (0, ly, lz)
        root.keyframe_insert('location', index=1, frame=f)
        root.keyframe_insert('location', index=2, frame=f)

    if kind == 'gun':
        new_action('idle')
        for f, s in ((1, 0), (30, 1), (60, 0)):
            key(f, rx=0.002 * s, lz=0.004 * s)
        new_action('move')
        for f, s in ((1, -1), (12, 1), (24, -1), (36, 1), (48, -1)):
            key(f, rx=0.010 * s, lz=0.03 * (s * 0.5 + 0.5))
        new_action('attack')
        for f, ly, rx in ((1, 0.0, 0.0), (8, 0.0, 0.0), (11, 0.17, 0.035), (24, 0.0, 0.0), (40, 0.0, 0.0)):
            key(f, rx=rx, ly=ly)
        new_action('die')
        for f, t in ((1, 0.0), (20, 0.45), (40, 0.8), (55, 1.0)):
            key(f, rz=0.95 * t, lz=-0.22 * t)
    else:  # plane
        new_action('idle')
        for f, s in ((1, -1), (30, 1), (60, -1)):
            key(f, rx=0.010 * s, rz=0.016 * s, lz=0.05 * s)
        new_action('move')
        for f, s in ((1, -1), (25, 1), (50, -1)):
            key(f, rx=0.016 * s, rz=0.05 * s, lz=0.08 * s)
        new_action('attack')
        for f, t in ((1, 0.0), (15, 0.5), (30, 1.0), (45, 0.4), (60, 0.0)):
            key(f, rx=-0.20 * t, rz=0.10 * t, lz=-0.55 * t)
        new_action('die')
        for f, t in ((1, 0.0), (15, 0.3), (30, 0.65), (45, 1.0)):
            key(f, rx=0.5 * t, rz=2.6 * t, lz=-2.6 * t * t)
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
    print('EXPORTED', fname)

# ================= ARTILLERY =================
bpy.ops.wm.read_factory_settings(use_empty=True)
OLIVE = mat('GunOlive', (0.30, 0.33, 0.22))
STEEL = mat('Steel', (0.35, 0.36, 0.37), 0.45, 0.5)
DARK = mat('DarkMetal', (0.13, 0.13, 0.14), 0.55, 0.3)
RUBBER = mat('WheelRubber', (0.16, 0.16, 0.16), 0.9)

root = bpy.data.objects.new('Gun', None)
bpy.context.scene.collection.objects.link(root)

for sx in (-0.88, 0.88):
    cyl(root, 'Wheel', (sx, 0, 0.62), 0.62, 0.11, RUBBER, rot=(0, math.radians(90), 0), verts=18)
    cyl(root, 'WheelRim', (sx * 1.01, 0, 0.62), 0.40, 0.13, STEEL, rot=(0, math.radians(90), 0), verts=18)
    cyl(root, 'Hub', (sx * 1.03, 0, 0.62), 0.13, 0.15, DARK, rot=(0, math.radians(90), 0))
    for k in range(3):
        box(root, 'Spoke', (sx * 1.01, 0, 0.62), (0.05, 0.72, 0.07), STEEL,
            rot=(0, 0, k * math.pi / 3))
cyl(root, 'Axle', (0, 0, 0.62), 0.09, 1.8, DARK, rot=(0, math.radians(90), 0))
box(root, 'Carriage', (0, 0.25, 0.78), (0.34, 1.1, 0.30), OLIVE)
for sx in (-1, 1):
    box(root, 'Trail', (sx * 0.42, 1.85, 0.42), (0.16, 2.6, 0.20), OLIVE, rot=(0.10, 0, sx * -0.16))
    box(root, 'Spade', (sx * 0.83, 3.12, 0.16), (0.34, 0.5, 0.06), STEEL, rot=(0.5, 0, sx * -0.16))
box(root, 'Shield', (0, -0.42, 1.18), (2.15, 0.07, 1.05), OLIVE, rot=(math.radians(12), 0, 0))
box(root, 'ShieldWingL', (-1.18, -0.30, 1.14), (0.45, 0.07, 0.95), OLIVE, rot=(math.radians(12), math.radians(-28), 0))
box(root, 'ShieldWingR', (1.18, -0.30, 1.14), (0.45, 0.07, 0.95), OLIVE, rot=(math.radians(12), math.radians(28), 0))
gun = bpy.data.objects.new('GunBarrel', None)
bpy.context.scene.collection.objects.link(gun)
gun.parent = root
gun.location = (0, -0.05, 1.12)
gun.rotation_euler = (math.radians(-24), 0, 0)
cyl(gun, 'Barrel', (0, -1.45, 0), 0.085, 2.6, STEEL, rot=(math.radians(90), 0, 0))
cyl(gun, 'Sleeve', (0, -0.55, 0), 0.14, 1.0, OLIVE, rot=(math.radians(90), 0, 0))
cyl(gun, 'Muzzle', (0, -2.72, 0), 0.115, 0.22, DARK, rot=(math.radians(90), 0, 0))
box(gun, 'Breech', (0, 0.28, 0), (0.30, 0.5, 0.34), OLIVE)
cyl(root, 'ElevWheel', (0.30, 0.18, 0.95), 0.11, 0.05, DARK, rot=(0, math.radians(90), 0))
box(root, 'FactionBand', (0, -0.44, 1.62), (0.9, 0.09, 0.16), mat('FactionBand', (0.55, 0.55, 0.55)))
root_anims(root, 'gun')
export(root, 'artillery.glb')

# ================= BOMBER =================
bpy.ops.wm.read_factory_settings(use_empty=True)
BODY = mat('BomberBody', (0.36, 0.40, 0.34))
DARKM = mat('DarkMetal', (0.13, 0.13, 0.14), 0.55, 0.3)
GLASS = mat('Glass', (0.10, 0.16, 0.20), 0.2, 0.1)
PROPD = mat('PropDisc', (0.6, 0.6, 0.6), 0.4, 0.0, alpha=0.28)
BAND = mat('FactionBand', (0.55, 0.55, 0.55))

root = bpy.data.objects.new('Bomber', None)
bpy.context.scene.collection.objects.link(root)
root.location = (0, 0, 3.2)

fuse = loft(root, 'Fuselage', [(-5.2, 0.02), (-4.9, 0.34), (-4.2, 0.55), (-2.5, 0.66),
                               (0.0, 0.68), (2.2, 0.60), (3.8, 0.44), (4.8, 0.26), (5.2, 0.05)], BODY)
nose = loft(root, 'NoseGlass', [(-5.55, 0.02), (-5.35, 0.22), (-5.2, 0.30)], GLASS)
box(root, 'Canopy', (0, -1.7, 0.62), (0.52, 1.15, 0.30), GLASS)
cyl(root, 'DorsalTurret', (0, 0.9, 0.62), 0.24, 0.22, DARKM)
box(root, 'BombBay', (0, 0.4, -0.62), (0.8, 2.6, 0.10), DARKM)
wing = box(root, 'Wing', (0, -0.5, -0.05), (13.2, 1.95, 0.13), BODY)
wing.scale = (1, 1, 1)
box(root, 'Stab', (0, 4.55, 0.18), (4.4, 0.95, 0.10), BODY)
for sx in (-1.95, 1.95):
    fin = box(root, 'Fin', (sx, 4.55, 0.55), (0.09, 0.85, 0.85), BODY)
for sx in (-2.3, 2.3):
    nac = loft(root, 'Nacelle', [(-2.6, 0.05), (-2.2, 0.30), (-1.0, 0.36), (0.6, 0.30), (1.5, 0.10)], BODY)
    nac.location = (sx, -0.5, -0.12)
    for k in range(3):
        bl = box(root, 'PropBlade', (sx, -3.25, -0.12), (0.09, 0.05, 1.55), DARKM,
                 rot=(k * math.pi / 3, 0, 0))
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.82, depth=0.03,
                                        location=(sx, -3.28, -0.12))
    disc = bpy.context.active_object
    disc.name = 'PropDisc'
    disc.rotation_euler = (math.radians(90), 0, 0)
    disc.data.materials.append(PROPD)
    disc.parent = root
    cyl(root, 'Roundel', (sx * 1.85, -0.5, 0.045), 0.42, 0.03, BAND, verts=20)
root_anims(root, 'plane')
export(root, 'bomber.glb')
print('GUN+BOMBER DONE')
