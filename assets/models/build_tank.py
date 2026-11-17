import bpy, math, os

# Low-poly 1930s light tank, scripted hard-surface build.
# Forward = -Y (matches the 0 A.D. asset convention; exports to +Z in glTF).
OUT = os.path.expanduser('~/workspace/ww2-asia/assets/models/tank_light.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    return m

OLIVE = mat('olive', (0.30, 0.33, 0.20))
OLIVE_D = mat('olive_dark', (0.22, 0.24, 0.15))
TRACK = mat('track', (0.10, 0.09, 0.08), 0.95)
STEEL = mat('steel', (0.25, 0.25, 0.26), 0.6)

def box(name, loc, size, material, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(scale=True)
    if material:
        o.data.materials.append(material)
    if bevel > 0:
        mod = o.modifiers.new('bev', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    return o

def cyl(name, loc, radius, depth, material, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    o = bpy.context.object
    o.name = name
    o.rotation_euler = rot
    if material:
        o.data.materials.append(material)
    return o

# --- hull ---
box('hull_lower', (0, 0, 0.52), (1.66, 3.15, 0.52), OLIVE, bevel=0.04)
box('hull_upper', (0, 0.05, 0.86), (1.46, 2.85, 0.30), OLIVE, bevel=0.04)
box('glacis', (0, -1.52, 0.72), (1.46, 0.55, 0.10), OLIVE_D, rot=(math.radians(-38), 0, 0))
box('rear_plate', (0, 1.52, 0.72), (1.46, 0.45, 0.10), OLIVE_D, rot=(math.radians(30), 0, 0))
box('nose', (0, -1.62, 0.42), (1.30, 0.30, 0.34), OLIVE_D, bevel=0.03)

# --- tracks & wheels ---
for side in (-1, 1):
    x = side * 0.86
    box('track_%d' % side, (x, 0, 0.36), (0.42, 3.35, 0.68), TRACK, bevel=0.10)
    box('fender_%d' % side, (x, 0, 0.76), (0.52, 3.30, 0.06), OLIVE_D)
    for i, y in enumerate((-1.28, -0.64, 0.0, 0.64, 1.28)):
        r = 0.30 if i in (0, 4) else 0.26
        cyl('wheel_%d_%d' % (side, i), (x + side * 0.20, y, 0.32), r, 0.08, STEEL,
            rot=(0, math.radians(90), 0), verts=14)
    box('stowage_%d' % side, (x, 0.55, 0.86), (0.30, 0.90, 0.16), OLIVE_D, bevel=0.02)

# --- turret (boxy, offset slightly rear) ---
tur = box('turret', (0, 0.28, 1.22), (0.92, 1.05, 0.40), OLIVE, bevel=0.05)
box('turret_roof', (0, 0.28, 1.45), (0.80, 0.90, 0.08), OLIVE_D)
cyl('hatch', (-0.18, 0.20, 1.52), 0.17, 0.07, STEEL, verts=14)
cyl('cupola', (0.22, 0.48, 1.50), 0.13, 0.10, OLIVE_D, verts=12)
# main gun pointing forward (-Y) + mantlet
box('mantlet', (0, -0.30, 1.22), (0.34, 0.18, 0.30), OLIVE_D)
cyl('gun', (0, -0.95, 1.22), 0.05, 1.15, STEEL, rot=(math.radians(90), 0, 0), verts=10)
cyl('muzzle', (0, -1.48, 1.22), 0.075, 0.16, STEEL, rot=(math.radians(90), 0, 0), verts=10)
# hull MG ball + exhaust + lights
cyl('hull_mg', (0.45, -1.60, 0.62), 0.09, 0.12, STEEL, rot=(math.radians(90), 0, 0), verts=10)
cyl('exhaust', (0.55, 1.68, 0.62), 0.07, 0.35, STEEL, rot=(math.radians(90), 0, 0), verts=10)
for side in (-1, 1):
    box('headlight_%d' % side, (side * 0.55, -1.66, 0.62), (0.16, 0.08, 0.12), STEEL)

# join everything into one mesh for a clean single-node GLB
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = tur
bpy.ops.object.join()
body = bpy.context.object
body.name = 'tank_light'

tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print('TANK tris approx:', tris)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True)
print('EXPORTED', OUT)
