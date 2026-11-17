import bpy, math
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/home/hatch/workspace/ww2-asia/assets/models/fighter_zero.glb')
scene = bpy.context.scene
if scene.world is None:
    scene.world = bpy.data.worlds.new('W')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.25, 0.24, 0.22, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
cam_data = bpy.data.cameras.new('Cam')
cam = bpy.data.objects.new('Cam', cam_data)
scene.collection.objects.link(cam)
cam.location = (0, 0, 14)
cam.rotation_euler = (0, 0, math.radians(180))
scene.camera = cam
sun_data = bpy.data.lights.new('Sun', type='SUN')
sun = bpy.data.objects.new('Sun', sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(30), 0, math.radians(20))
sun_data.energy = 3.0
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 700
scene.render.resolution_y = 700
scene.render.filepath = '/home/hatch/workspace/ww2-asia/assets/models/fighter_top.png'
bpy.ops.render.render(write_still=True)
print('TOP done')
