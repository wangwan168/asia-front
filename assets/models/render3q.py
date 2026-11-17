import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
GLB, OUT = argv[0], argv[1]
DIST = float(argv[2]) if len(argv) > 2 else 6.0
H = float(argv[3]) if len(argv) > 3 else 2.6
TZ = float(argv[4]) if len(argv) > 4 else 0.7

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

scn = bpy.context.scene
scn.render.engine = 'BLENDER_EEVEE_NEXT'
scn.render.resolution_x = 720
scn.render.resolution_y = 720
scn.render.filepath = OUT
world = bpy.data.worlds.new('W')
scn.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.16, 0.14, 0.11, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.7

bpy.ops.mesh.primitive_cylinder_add(radius=DIST * 0.55, depth=0.04, location=(0, 0, -0.02))
gnd = bpy.context.object
gm = bpy.data.materials.new('g')
gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.42, 0.38, 0.32, 1)
gnd.data.materials.append(gm)

def light(name, loc, energy, size=4):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = energy
    d.shape = 'DISK'
    d.size = size
    o = bpy.data.objects.new(name, d)
    scn.collection.objects.link(o)
    o.location = loc
    look_at(o, (0, 0, TZ))
    return o

light('key', (DIST * 0.7, -DIST * 0.6, DIST * 0.9), 900)
light('fill', (-DIST * 0.8, DIST * 0.3, DIST * 0.5), 350)
light('rim', (0, DIST, DIST * 0.7), 500)

cd = bpy.data.cameras.new('c')
cd.lens = 40
cam = bpy.data.objects.new('cam', cd)
scn.collection.objects.link(cam)
cam.location = (DIST * 0.72, -DIST * 0.72, H)
look_at(cam, (0, 0, TZ))
scn.camera = cam
bpy.ops.render.render(write_still=True)
print('RENDER3Q done', OUT)
