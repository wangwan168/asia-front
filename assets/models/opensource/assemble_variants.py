import bpy, os

BASE = os.path.expanduser('~/workspace/ww2-asia/assets/models')
SRC = os.path.join(BASE, 'infantry_ww2.glb')
TEXDIR = os.path.join(BASE, 'opensource/tex_variants')
FACTIONS = ['roc', 'japan', 'ccp', 'usa', 'uk']

for fac in FACTIONS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    tex_path = os.path.join(TEXDIR, 'soldier_tex_%s.png' % fac)
    img = bpy.data.images.load(tex_path)
    img.name = 'SoldierTex_%s' % fac
    swapped = 0
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE':
                n.image = img
                swapped += 1
    out = os.path.join(BASE, 'infantry_%s.glb' % fac)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True,
                              export_animations=True, export_nla_strips=True)
    print('VARIANT', fac, 'swapped', swapped, '->', out)
print('ALL VARIANTS DONE')
