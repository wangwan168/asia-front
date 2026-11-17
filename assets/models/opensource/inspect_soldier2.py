import bpy, os

SRC = os.path.expanduser('~/workspace/ww2-asia/assets/models/opensource/soldier_oga/LowpolySoldier/LowpolySoldier.fbx')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
print('ALLBONES', [b.name for b in arm.data.bones])
for m in bpy.data.materials:
    print('MAT', m.name, 'use_nodes', m.use_nodes)
    if m.use_nodes:
        for n in m.node_tree.nodes:
            print('   node', n.type, getattr(n, 'image', None).name if n.type == 'TEX_IMAGE' else '')
print('IMAGES', [(i.name, i.filepath, tuple(i.size)) for i in bpy.data.images])
for o in bpy.data.objects:
    if o.type == 'MESH':
        print('MESH', o.name, 'mats', [s.material.name if s.material else None for s in o.material_slots], 'uv', [u.name for u in o.data.uv_layers])
