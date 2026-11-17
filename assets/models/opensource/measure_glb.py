import bpy, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
GLB = argv[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
dg = bpy.context.evaluated_depsgraph_get()
mins = Vector((1e9, 1e9, 1e9))
maxs = Vector((-1e9, -1e9, -1e9))
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    eo = o.evaluated_get(dg)
    for c in eo.bound_box:
        w = eo.matrix_world @ Vector(c)
        for i in range(3):
            mins[i] = min(mins[i], w[i])
            maxs[i] = max(maxs[i], w[i])
size = maxs - mins
print('WORLD-SIZE', tuple(round(v, 2) for v in size), 'min', tuple(round(v, 2) for v in mins), 'max', tuple(round(v, 2) for v in maxs))
