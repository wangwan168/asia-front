import bpy, os, math
from mathutils import Vector, Matrix

BASE = os.path.expanduser('~/workspace/ww2-asia/assets/models/opensource')
SRC = os.path.join(BASE, 'soldier_oga/LowpolySoldier/LowpolySoldier.fbx')
TEX = os.path.join(BASE, 'soldier_oga/LowpolySoldier/LowpolySoldier_Texture.png')
OUT = os.path.expanduser('~/workspace/ww2-asia/assets/models/infantry_ww2.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
meshes = [o for o in bpy.data.objects if o.type == 'MESH']

# texture (FBX brought no materials)
img = bpy.data.images.load(TEX)
mat = bpy.data.materials.new('SoldierTex')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
tnode = mat.node_tree.nodes.new('ShaderNodeTexImage')
tnode.image = img
mat.node_tree.links.new(tnode.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.9
for o in meshes:
    for uv in o.data.uv_layers:
        uv.name = 'UVMap'
    o.data.materials.clear()
    o.data.materials.append(mat)
img.pack()

# ground: shift whole rig so lowest vertex sits at z=0
bpy.context.view_layer.update()
minz = min((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
arm.location.z -= minz
bpy.context.view_layer.update()
print('GROUND shift', round(minz, 3))

# ---------------- rifle prop, bone-parented to RightHand ----------------
def box(name, size, loc, matl):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.dimensions = size
    o.location = loc
    o.data.materials.append(matl)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return o

wood = bpy.data.materials.new('RifleWood')
wood.use_nodes = True
wood.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.23, 0.14, 0.08, 1)
wood.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.8
steel = bpy.data.materials.new('RifleSteel')
steel.use_nodes = True
steel.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.16, 0.16, 0.17, 1)
steel.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.55

# rifle built along +Z (butt at z<0, muzzle at z>0), grip near origin; scene units are meters-ish (rig 1.8)
parts = []
parts.append(box('RifleStock', (0.045, 0.09, 0.34), (0, -0.01, -0.20), wood))
parts.append(box('RifleBody', (0.04, 0.06, 0.30), (0, 0, 0.10), wood))
parts.append(box('RifleBarrel', (0.016, 0.016, 0.34), (0, 0.025, 0.40), steel))
parts.append(box('RifleMag', (0.03, 0.09, 0.07), (0, -0.055, 0.10), steel))
bpy.ops.object.select_all(action='DESELECT')
for p in parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
rifle = bpy.context.active_object
rifle.name = 'Rifle'

# place grip at right hand, barrel continuing the forearm direction
bpy.context.view_layer.update()
fh = arm.pose.bones['RightForeArm']
hh = arm.pose.bones['RightHand']
elbow = arm.matrix_world @ fh.head
hand = arm.matrix_world @ hh.head
direction = (hand - elbow)
direction.normalize()
rifle.location = hand + direction * 0.02
rifle.rotation_mode = 'QUATERNION'
rifle.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction)
bpy.context.view_layer.update()
# solve the rifle's bind placement so it sits correctly in the AIM pose:
# temporarily apply the attack pose, read the posed RightHand matrix, then
# bind_world = OW @ R @ P^-1 @ OW^-1 @ desired_world  (rigid one-bone skinning)
def set_rot(bone, x=0.0, y=0.0, z=0.0):
    pb = arm.pose.bones[bone]
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = (x, y, z)

set_rot('LeftArm', x=0.12, z=1.28)
set_rot('RightArm', x=0.38, z=-1.02)
set_rot('RightForeArm', x=0.55, z=-0.30)
set_rot('Spine', x=0.09)
bpy.context.view_layer.update()
pb_hand = arm.pose.bones['RightHand']
P = pb_hand.matrix.copy()
R = arm.data.bones['RightHand'].matrix_local.copy()
OW = arm.matrix_world.copy()
hand_world = OW @ pb_hand.head
fwd = Vector((0, -1, 0.10)).normalized()
up = Vector((0, -0.10, 1)).normalized()
side = up.cross(fwd).normalized()
up = fwd.cross(side).normalized()
desired = Matrix(((side.x, up.x, fwd.x, hand_world.x),
                  (side.y, up.y, fwd.y, hand_world.y),
                  (side.z, up.z, fwd.z, hand_world.z),
                  (0, 0, 0, 1)))
rifle.matrix_world = OW @ R @ P.inverted() @ OW.inverted() @ desired
bpy.context.view_layer.update()
for pb in arm.pose.bones:
    pb.rotation_euler = (0, 0, 0)
bpy.context.view_layer.update()
print('RIFLE bind placement solved from aim pose')
vg = rifle.vertex_groups.new(name='RightHand')
vg.add(list(range(len(rifle.data.vertices))), 1.0, 'REPLACE')
mod = rifle.modifiers.new('Armature', 'ARMATURE')
mod.object = arm
print('RIFLE skinned to RightHand')

# ---------------- animations ----------------
def key(action, bone, frame, x=None, y=None, z=None, loc=None):
    pb = arm.pose.bones[bone]
    pb.rotation_mode = 'XYZ'
    if x is not None:
        pb.rotation_euler.x = x
        pb.keyframe_insert('rotation_euler', index=0, frame=frame, group=bone)
    if y is not None:
        pb.rotation_euler.y = y
        pb.keyframe_insert('rotation_euler', index=1, frame=frame, group=bone)
    if z is not None:
        pb.rotation_euler.z = z
        pb.keyframe_insert('rotation_euler', index=2, frame=frame, group=bone)
    if loc is not None:
        pb.location = loc
        for i in range(3):
            pb.keyframe_insert('location', index=i, frame=frame, group=bone)

def new_action(name):
    act = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = act
    # reset pose
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    bpy.context.view_layer.update()
    return act

ARM_DOWN = 1.32

# idle: arms down, gentle breathing sway, 60f loop
act = new_action('idle')
for f in (1, 30, 60):
    s = 0.02 if f == 30 else 0.0
    key(act, 'LeftArm', f, x=ARM_DOWN + s)
    key(act, 'RightArm', f, x=ARM_DOWN + s)
    key(act, 'LeftForeArm', f, x=0.14)
    key(act, 'RightForeArm', f, x=0.14)
    key(act, 'Spine', f, x=0.03 + s * 0.5)
    key(act, 'Spine1', f, x=0.02 + s)
    key(act, 'Head', f, x=-0.03, z=s * 0.6)
    key(act, 'Hips', f, loc=(0, 0, 0))

# march: 30f loop, opposite arm/leg swing, right arm trails the rifle
act = new_action('march')
import math as m
for i in range(7):
    f = 1 + i * 5
    ph = (i / 6.0) * 2 * m.pi
    s, c = m.sin(ph), m.cos(ph)
    key(act, 'LeftUpLeg', f, x=0.55 * s)
    key(act, 'RightUpLeg', f, x=-0.55 * s)
    key(act, 'LeftLeg', f, x=max(0.03, 0.34 * (0.5 - 0.5 * m.cos(ph - 0.7))))
    key(act, 'RightLeg', f, x=max(0.03, 0.34 * (0.5 - 0.5 * m.cos(ph + m.pi - 0.7))))
    key(act, 'LeftArm', f, x=ARM_DOWN - 0.38 * s)
    key(act, 'LeftForeArm', f, x=0.20)
    key(act, 'RightArm', f, x=1.12)
    key(act, 'RightForeArm', f, x=0.55)
    key(act, 'Spine', f, x=0.07, z=0.03 * c)
    key(act, 'Head', f, x=-0.04)
    key(act, 'Hips', f, loc=(0, -7.0 * abs(c), 0))

# attack: standing aim, recoil pulse at f1 and f21, 40f loop
act = new_action('attack')
for f in (1, 3, 21, 23, 40):
    kick = -0.05 if f in (3, 23) else 0.0
    key(act, 'LeftArm', f, x=0.12 + kick, z=1.28)
    key(act, 'LeftForeArm', f, x=0.25, z=0.45)
    key(act, 'RightArm', f, x=0.38 + kick, z=-1.02)
    key(act, 'RightForeArm', f, x=0.55, z=-0.30)
    key(act, 'Spine', f, x=0.09 + kick * 0.7)
    key(act, 'Head', f, x=0.10, z=0.10)
    key(act, 'LeftUpLeg', f, x=-0.28)
    key(act, 'RightUpLeg', f, x=0.32)
    key(act, 'LeftLeg', f, x=0.30)
    key(act, 'RightLeg', f, x=0.38)
    key(act, 'Hips', f, loc=(0, -6.0, 0))

# die: fall backward over 25f, held at the end
act = new_action('die')
for f, t in ((1, 0.0), (9, 0.15), (17, 0.75), (21, 1.0), (25, 1.0)):
    key(act, 'Hips', f, x=-1.45 * t, loc=(0, -78.0 * t * t, 0))
    key(act, 'LeftArm', f, x=ARM_DOWN - 0.75 * t)
    key(act, 'RightArm', f, x=ARM_DOWN - 1.15 * t)
    key(act, 'Spine', f, x=-0.25 * t)
    key(act, 'Head', f, x=-0.30 * t)
    key(act, 'LeftUpLeg', f, x=-0.25 * t)
    key(act, 'RightUpLeg', f, x=0.20 * t)

# stash all actions as NLA strips so the exporter emits every clip
if arm.animation_data.action:
    arm.animation_data.action = None
for a in list(bpy.data.actions):
    track = arm.animation_data.nla_tracks.new()
    track.name = a.name
    strip = track.strips.new(a.name, 1, a)
    strip.action_frame_start = 1
    strip.action_frame_end = a.frame_range[1]
print('ACTIONS', [a.name for a in bpy.data.actions])

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True,
                          export_animations=True, export_nla_strips=True,
                          export_apply=False)
print('SOLDIER-BUILD exported', OUT)
