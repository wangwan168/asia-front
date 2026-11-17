import bpy, os

SRC = os.path.expanduser('~/workspace/ww2-asia/assets/models/opensource/soldier_oga/LowpolySoldier/LowpolySoldier.fbx')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]

def handpos(label):
    bpy.context.view_layer.update()
    lh = arm.matrix_world @ arm.pose.bones['LeftHand'].head
    rh = arm.matrix_world @ arm.pose.bones['RightHand'].head
    hips = arm.matrix_world @ arm.pose.bones['Hips'].head
    print('HANDPOS', label, 'L', tuple(round(v, 2) for v in lh), 'R', tuple(round(v, 2) for v in rh), 'hips', tuple(round(v, 2) for v in hips))

def set_rot(bone, x=0.0, y=0.0, z=0.0):
    pb = arm.pose.bones[bone]
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = (x, y, z)

handpos('bind')
set_rot('LeftArm', z=-1.35)
set_rot('RightArm', z=1.35)
handpos('pureZ')
set_rot('LeftArm', x=0.12, z=-1.28)
set_rot('RightArm', x=0.38, z=1.02)
handpos('attackXZ')
set_rot('LeftArm', x=0.0, y=-1.35, z=0.0)
set_rot('RightArm', x=0.0, y=1.35, z=0.0)
handpos('pureY')
