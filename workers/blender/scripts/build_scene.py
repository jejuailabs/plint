from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def arguments_after_separator() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--output-dir", required=True)
args = parser.parse_args(arguments_after_separator())

payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
output_dir = Path(args.output_dir)
output_dir.mkdir(parents=True, exist_ok=True)
area_sqm = float(payload["parcel"]["areaSqm"])
scenario = payload["scenario"]
floors = max(1, int(scenario["floors"]))
coverage = min(100.0, max(1.0, float(scenario["buildingCoveragePercent"]))) / 100.0
placement = scenario["placement"]
floor_heights = scenario["floorHeights"]
floor_areas = scenario["floorAreasSqm"]
parcel_side = max(20.0, math.sqrt(area_sqm))
width = placement["widthM"]
depth = placement["depthM"]
rotation = placement["rotationRad"]
center = placement["center"]
building_height = sum(floor_heights)


def local(point):
    return ((point["longitude"] - center["longitude"]) * 111320 * math.cos(math.radians(center["latitude"])),
            (point["latitude"] - center["latitude"]) * 111320)


def make_material(name: str, color: tuple[float, float, float, float], metallic: float = 0.0, roughness: float = 0.5):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    return mat


ground_mat = make_material("Urban ground", (0.022, 0.06, 0.10, 1), 0.15, 0.45)
road_mat = make_material("Road", (0.035, 0.09, 0.14, 1), 0.1, 0.52)
context_mat = make_material("Context buildings", (0.06, 0.16, 0.30, 1), 0.2, 0.42)
mass_mat = make_material("Proposed mass", (0.50, 0.92, 1.0, 1), 0.08, 0.22)
edge_mat = make_material("Parcel edge", (0.64, 1.0, 0.24, 1), 0.0, 0.3)


def cube(name: str, location: tuple[float, float, float], scale: tuple[float, float, float], mat):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


# Ground is a neutral render surface, not fabricated streets or terrain.
cube("Neutral reference ground", (0, 0, -0.4), (parcel_side * 10, parcel_side * 10, 0.8), ground_mat)

# Trace the supplied parcel, without substituting a square.
ring = payload["parcel"]["boundary"]
curve = bpy.data.curves.new("Actual parcel boundary", "CURVE")
curve.dimensions = "3D"
curve.bevel_depth = 0.08
poly = curve.splines.new("POLY")
poly.points.add(len(ring) - 1)
for point, geo in zip(poly.points, ring):
    x, y = local(geo)
    point.co = (x, y, 0.12, 1)
poly.use_cyclic_u = True
outline = bpy.data.objects.new("Actual parcel boundary", curve)
bpy.context.collection.objects.link(outline)
outline.data.materials.append(edge_mat)

z = 0.0
for floor, (height, floor_area) in enumerate(zip(floor_heights, floor_areas)):
    scale = math.sqrt(floor_area / (width * depth))
    obj = cube(f"Proposed mass floor {floor + 1}", (0, 0, z + height / 2), (width * scale, depth * scale, height), mass_mat)
    obj.rotation_euler.z = rotation
    z += height

# Extrude only supplied actual footprints. No random city blocks or invented roads.
for index, building in enumerate(payload.get("context", [])):
    coords = building["footprint"]
    if coords[0] == coords[-1]:
        coords = coords[:-1]
    height = building["heightM"]
    xy = [local(point) for point in coords]
    n = len(xy)
    vertices = [(x, y, 0) for x, y in xy] + [(x, y, height) for x, y in xy]
    faces = [tuple(range(n-1, -1, -1)), tuple(range(n, 2*n))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(f"Actual context {index}")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(f"Actual context {index} (height may be estimated)", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(context_mat)

bpy.ops.object.light_add(type="AREA", location=(parcel_side * 1.2, -parcel_side * 1.3, building_height * 2.3))
key_light = bpy.context.object
key_light.data.energy = 1700
key_light.data.shape = "DISK"
key_light.data.size = parcel_side * 1.7

bpy.ops.object.light_add(type="AREA", location=(-parcel_side * 1.15, parcel_side * 0.6, building_height * 1.35))
fill_light = bpy.context.object
fill_light.data.energy = 900
fill_light.data.color = (0.25, 0.72, 1.0)
fill_light.data.size = parcel_side

bpy.ops.object.camera_add(location=(parcel_side * 1.62, -parcel_side * 1.72, building_height * 1.45 + parcel_side * 0.8))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, building_height * 0.38)) - camera.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = camera
camera.data.lens = 47

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = 1280
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.world.color = (0.006, 0.018, 0.04)
scene.render.filepath = str(output_dir / "preview.png")
bpy.ops.render.render(write_still=True)

# Cameras/lights stay in the render pipeline but are not exported to the web model.
for obj in [camera, key_light, fill_light]:
    obj.select_set(True)
    obj.hide_render = True

bpy.ops.export_scene.gltf(
    filepath=str(output_dir / "massing.glb"),
    export_format="GLB",
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)

(output_dir / "metadata.json").write_text(
    json.dumps(
        {
            "floors": floors,
            "grossFloorAreaSqm": round(sum(floor_areas), 1),
            "renderWidth": 1280,
            "renderHeight": 800,
        }
    ),
    encoding="utf-8",
)
