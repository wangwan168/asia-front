import bpy, os, sys

SRC = os.path.expanduser('~/workspace/ww2-asia/assets/models/opensource/soldier_oga/LowpolySoldier/LowpolySoldier.fbx')
OUT = os.path.expanduser('~/workspace/ww2-asia/assets/models/opensource/soldier_oga.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
print('SOLDIER objects:', [(o.name, o.type) for o in bpy.data.objects])
for a in arms:
    print('SOLDIER bones:', len(a.data.bones), [b.name for b in a.data.bones][:30])
print('SOLDIER actions:', [a.name for a in bpy.data.actions])
allz = []
for m in meshes:
    for v in m.data.vertices:
        allz.append((m.matrix_world @ v.co).z)
print('SOLDIER height z range:', min(allz), max(allz))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True)
print('SOLDIER exported', OUT)
