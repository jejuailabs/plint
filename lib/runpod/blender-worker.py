"""
PLINT Blender Worker — RunPod Serverless GPU Handler (v2)

Generates a GLB massing model + multi-angle PNG renders from analysis input.
Deploy to RunPod as a serverless endpoint with a Blender-enabled Docker image.

Input (JSON):
  analysisId, address, parcel {areaSqm, boundary[]}, scenario {id, label, floors,
  buildingCoveragePercent, floorAreaRatioPercent, floorHeights[]},
  material? ('residential'|'commercial'|'mixed'|'office'),
  renderAngles? ('birdseye'|'perspective'|'front'|'side')[]

Output (JSON):
  formatVersion 'plint-blender-v2', renderer 'blender-eevee',
  model {mimeType, base64}, preview {mimeType, base64},
  views[] {angle, mimeType, base64}, metrics {}
"""

import bpy
import bmesh
import math
import json
import base64
import os
import sys
from mathutils import Vector

# ---------------------------------------------------------------------------
# Material presets
# ---------------------------------------------------------------------------

MATERIALS = {
    'residential': {
        'wall':    {'color': (0.85, 0.82, 0.78, 1), 'roughness': 0.7, 'metallic': 0.0},
        'window':  {'color': (0.45, 0.65, 0.80, 0.6), 'roughness': 0.05, 'metallic': 0.15},
        'slab':    {'color': (0.75, 0.73, 0.70, 1), 'roughness': 0.6, 'metallic': 0.05},
        'roof':    {'color': (0.60, 0.58, 0.55, 1), 'roughness': 0.5, 'metallic': 0.1},
    },
    'commercial': {
        'wall':    {'color': (0.30, 0.35, 0.40, 1), 'roughness': 0.3, 'metallic': 0.4},
        'window':  {'color': (0.50, 0.70, 0.85, 0.4), 'roughness': 0.02, 'metallic': 0.3},
        'slab':    {'color': (0.40, 0.42, 0.45, 1), 'roughness': 0.5, 'metallic': 0.2},
        'roof':    {'color': (0.35, 0.37, 0.40, 1), 'roughness': 0.4, 'metallic': 0.3},
    },
    'mixed': {
        'wall':    {'color': (0.78, 0.75, 0.70, 1), 'roughness': 0.6, 'metallic': 0.05},
        'window':  {'color': (0.48, 0.68, 0.82, 0.5), 'roughness': 0.04, 'metallic': 0.2},
        'slab':    {'color': (0.70, 0.68, 0.65, 1), 'roughness': 0.55, 'metallic': 0.08},
        'roof':    {'color': (0.55, 0.53, 0.50, 1), 'roughness': 0.45, 'metallic': 0.15},
    },
    'office': {
        'wall':    {'color': (0.35, 0.38, 0.42, 1), 'roughness': 0.25, 'metallic': 0.5},
        'window':  {'color': (0.55, 0.75, 0.90, 0.35), 'roughness': 0.01, 'metallic': 0.35},
        'slab':    {'color': (0.45, 0.47, 0.50, 1), 'roughness': 0.45, 'metallic': 0.25},
        'roof':    {'color': (0.40, 0.42, 0.45, 1), 'roughness': 0.35, 'metallic': 0.35},
    },
}

# ---------------------------------------------------------------------------
# Camera presets (offset from building center, in meters)
# ---------------------------------------------------------------------------

CAMERA_ANGLES = {
    'birdseye':    {'loc': (0, -30, 80),  'rot': (math.radians(25), 0, 0)},
    'perspective': {'loc': (40, -35, 25),  'rot': (math.radians(65), 0, math.radians(50))},
    'front':       {'loc': (0, -50, 15),   'rot': (math.radians(78), 0, 0)},
    'side':        {'loc': (50, 0, 15),    'rot': (math.radians(78), 0, math.radians(90))},
}


def create_pbr_material(name, props):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = props['color']
        bsdf.inputs['Roughness'].default_value = props['roughness']
        bsdf.inputs['Metallic'].default_value = props['metallic']
    if props['color'][3] < 1.0:
        mat.blend_method = 'BLEND'
        mat.shadow_method = 'NONE'
        if bsdf:
            bsdf.inputs['Alpha'].default_value = props['color'][3]
    return mat


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if not block.users:
            bpy.data.meshes.remove(block)


def build_massing(parcel, scenario, preset):
    mats = {k: create_pbr_material(f'{preset}_{k}', v) for k, v in MATERIALS[preset].items()}
    area = parcel['areaSqm']
    coverage = scenario['buildingCoveragePercent'] / 100
    footprint = area * coverage
    side = math.sqrt(footprint)
    depth = side * 0.85
    floor_heights = scenario.get('floorHeights') or [3.2] * scenario['floors']
    n_floors = len(floor_heights)

    objects = []
    z = 0.0

    for i, fh in enumerate(floor_heights):
        # Floor slab
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z + 0.1))
        slab = bpy.context.active_object
        slab.name = f'slab_{i}'
        slab.scale = (side + 0.3, depth + 0.3, 0.2)
        slab.data.materials.append(mats['slab'])
        objects.append(slab)

        # Wall
        wall_h = fh - 0.2
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z + 0.2 + wall_h / 2))
        wall = bpy.context.active_object
        wall.name = f'wall_{i}'
        wall.scale = (side, depth, wall_h)
        wall.data.materials.append(mats['wall'])
        objects.append(wall)

        # Windows — simple strip per floor face
        win_h = wall_h * 0.55
        win_w = side * 0.85
        for sign in (-1, 1):
            bpy.ops.mesh.primitive_plane_add(
                size=1,
                location=(0, sign * (depth / 2 + 0.01), z + 0.2 + wall_h * 0.45),
            )
            win = bpy.context.active_object
            win.name = f'win_{i}_{sign}'
            win.scale = (win_w, 1, win_h)
            win.rotation_euler = (math.radians(90), 0, 0)
            win.data.materials.append(mats['window'])
            objects.append(win)

        z += fh

    # Roof
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z + 0.08))
    roof = bpy.context.active_object
    roof.name = 'roof'
    roof.scale = (side + 0.5, depth + 0.5, 0.15)
    roof.data.materials.append(mats['roof'])
    objects.append(roof)

    # Rooftop equipment (small box)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(side * 0.2, 0, z + 0.3))
    equip = bpy.context.active_object
    equip.name = 'rooftop_equip'
    equip.scale = (side * 0.15, depth * 0.2, 0.5)
    equip.data.materials.append(mats['slab'])
    objects.append(equip)

    # Ground plane
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = 'ground'
    gmat = bpy.data.materials.new('ground')
    gmat.use_nodes = True
    gbsdf = gmat.node_tree.nodes.get('Principled BSDF')
    if gbsdf:
        gbsdf.inputs['Base Color'].default_value = (0.35, 0.38, 0.32, 1)
        gbsdf.inputs['Roughness'].default_value = 0.9
    ground.data.materials.append(gmat)
    objects.append(ground)

    return objects, z


def setup_lighting(building_height):
    # Sun
    bpy.ops.object.light_add(type='SUN', location=(20, -20, building_height + 30))
    sun = bpy.context.active_object
    sun.data.energy = 3.0
    sun.data.color = (1.0, 0.95, 0.88)
    sun.rotation_euler = (math.radians(45), math.radians(15), math.radians(-30))

    # Fill light
    bpy.ops.object.light_add(type='AREA', location=(-15, 10, building_height * 0.6))
    fill = bpy.context.active_object
    fill.data.energy = 150
    fill.data.size = 10
    fill.data.color = (0.85, 0.92, 1.0)

    # HDRI world
    world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (0.55, 0.65, 0.80, 1)
        bg.inputs['Strength'].default_value = 0.8


def setup_render(width=1920, height=1080):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'

    # EEVEE settings for quality
    eevee = scene.eevee
    eevee.use_gtao = True
    eevee.gtao_distance = 10
    eevee.use_bloom = True
    eevee.bloom_intensity = 0.05
    eevee.use_ssr = True
    eevee.use_ssr_refraction = True
    eevee.shadow_cube_size = '1024'
    eevee.shadow_cascade_size = '2048'
    eevee.taa_render_samples = 64


def render_angle(angle_name, building_height, output_path):
    cam_data = bpy.data.cameras.new(f'cam_{angle_name}')
    cam_obj = bpy.data.objects.new(f'cam_{angle_name}', cam_data)
    bpy.context.collection.objects.link(cam_obj)

    preset = CAMERA_ANGLES[angle_name]
    # Scale camera offset by building height for proportional framing
    scale = max(1.0, building_height / 15)
    cam_obj.location = Vector(preset['loc']) * scale
    cam_obj.rotation_euler = preset['rot']
    cam_data.lens = 35
    cam_data.clip_end = 500

    bpy.context.scene.camera = cam_obj
    bpy.context.scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)

    bpy.data.objects.remove(cam_obj)
    bpy.data.cameras.remove(cam_data)


def export_glb(output_path):
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
    )


def file_to_base64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')


# ---------------------------------------------------------------------------
# RunPod handler
# ---------------------------------------------------------------------------

def handler(event):
    inp = event.get('input', {})
    parcel = inp.get('parcel', {'areaSqm': 500})
    scenario = inp.get('scenario', {'floors': 4, 'buildingCoveragePercent': 60, 'floorAreaRatioPercent': 200})
    preset = inp.get('material', 'mixed')
    angles = inp.get('renderAngles', ['birdseye', 'perspective', 'front'])

    if preset not in MATERIALS:
        preset = 'mixed'

    tmp = '/tmp/plint_render'
    os.makedirs(tmp, exist_ok=True)

    clear_scene()
    _, building_height = build_massing(parcel, scenario, preset)
    setup_lighting(building_height)
    setup_render(1920, 1080)

    # Render each angle
    views = []
    main_preview = None
    for angle in angles:
        if angle not in CAMERA_ANGLES:
            continue
        path = os.path.join(tmp, f'{angle}.png')
        render_angle(angle, building_height, path)
        b64 = file_to_base64(path)
        views.append({'angle': angle, 'mimeType': 'image/png', 'base64': b64})
        if main_preview is None:
            main_preview = b64

    # Export GLB
    glb_path = os.path.join(tmp, 'massing.glb')
    export_glb(glb_path)
    glb_b64 = file_to_base64(glb_path)

    n_floors = scenario.get('floors', 4)
    gfa = parcel['areaSqm'] * (scenario.get('floorAreaRatioPercent', 200) / 100)

    return {
        'formatVersion': 'plint-blender-v2',
        'renderer': 'blender-eevee',
        'model': {'mimeType': 'model/gltf-binary', 'base64': glb_b64},
        'preview': {'mimeType': 'image/png', 'base64': main_preview or ''},
        'views': views,
        'metrics': {
            'floors': n_floors,
            'grossFloorAreaSqm': round(gfa, 1),
            'renderWidth': 1920,
            'renderHeight': 1080,
        },
    }


if __name__ == '__main__':
    # Local testing: python blender-worker.py input.json
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            event = json.load(f)
        result = handler(event)
        with open('/tmp/plint_render/output.json', 'w') as f:
            json.dump({k: v for k, v in result.items() if k != 'model'}, f, indent=2)
        print(f"Done: {len(result['views'])} views, GLB {len(result['model']['base64'])} chars")
    else:
        # RunPod serverless entry point
        import runpod
        runpod.serverless.start({'handler': handler})
