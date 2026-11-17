import bpy, os, math
from mathutils import Vector

BASE = os.path.expanduser('~/workspace/ww2-asia/assets/models/opensource')
SRC = os.path.join(BASE, 'soldier_oga/LowpolySoldier/LowpolySoldier.fbx')
TEX = os.path.join(BASE, 'soldier_oga/LowpolySoldier/LowpolySoldier_Texture.png')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]

# --- texture fix: no materials came in with the FBX; build one from the PNG
img = bpy.data.images.load(TEX)
mat = bpy.data.materials.new('SoldierTex')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
tex.image = img
mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.9
for o in bpy.data.objects:
    if o.type == 'MESH':
        for uv in o.data.uv_layers:
            uv.name = 'UVMap'
        o.data.materials.clear()
        o.data.materials.append(mat)
img.pack()
print('TEXFIX ok')

# --- bone directions in armature space (for axis calibration)
for name in ('LeftArm', 'RightArm', 'LeftUpLeg', 'Spine', 'Hips'):
    b = arm.data.bones[name]
    d = (b.tail_local - b.head_local)
    print('BONEDIR', name, tuple(round(v, 2) for v in d), 'len', round(d.length, 3))

# --- test pose: arms down (Z rot), left leg fwd / right leg back (X rot), spine lean
def set_rot(bone, x=0.0, y=0.0, z=0.0):
    pb = arm.pose.bones[bone]
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = (x, y, z)

set_rot('LeftArm', x=1.30)
set_rot('RightArm', x=-1.30)
set_rot('LeftForeArm', x=0.30)
set_rot('RightForeArm', x=-0.30)
set_rot('LeftUpLeg', x=-0.55)
set_rot('RightUpLeg', x=0.45)
set_rot('LeftLeg', x=0.15)
set_rot('Spine', x=0.10)
bpy.context.view_layer.update()

# --- render front + side
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.film_transparent = False
if bpy.context.scene.world is None:
    bpy.context.scene.world = bpy.data.worlds.new('World')
w = bpy.context.scene.world
w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.32, 0.29, 0.24, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(35))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
scene.collection.objects.link(cam)
scene.camera = cam
center = Vector((0, 0, 0.9))
for label, loc in (('front', Vector((0, -4.2, 1.3))), ('side', Vector((4.2, 0, 1.3))), ('q', Vector((3.0, -3.0, 1.6)))):
    cam.location = loc
    d = center - loc
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(BASE, 'calib_%s.png' % label)
    bpy.ops.render.render(write_still=True)
print('CALIB done')
