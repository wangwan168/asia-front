import bpy, sys

argv = sys.argv[sys.argv.index('--') + 1:]
GLB, CLIP, FRAME = argv[0], argv[1], int(argv[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
arm.animation_data_create()
arm.animation_data.action = bpy.data.actions[CLIP]
bpy.context.scene.frame_set(FRAME)
bpy.context.view_layer.update()
for name in ('LeftArm', 'LeftHand', 'RightArm', 'RightHand', 'Head', 'Hips'):
    pb = arm.pose.bones[name]
    head = arm.matrix_world @ pb.head
    tail = arm.matrix_world @ pb.tail
    print('POSE', name, 'head', tuple(round(v, 2) for v in head), 'tail', tuple(round(v, 2) for v in tail))
rifle = bpy.data.objects.get('Rifle')
if rifle:
    print('POSE Rifle loc', tuple(round(v, 2) for v in rifle.matrix_world.translation))
else:
    print('POSE Rifle MISSING; objects:', [o.name for o in bpy.data.objects])
