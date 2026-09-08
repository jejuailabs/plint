"""PLINT RunPod worker: structured parcel input -> GLB + preview PNG."""

from __future__ import annotations

import base64
import json
import math
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import runpod


MAX_OUTPUT_BYTES = 7 * 1024 * 1024


def require_number(value: Any, label: str, minimum: float = 0.0) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= minimum:
        raise ValueError(f"{label} must be a number greater than {minimum}.")
    return float(value)


def validate_input(payload: dict[str, Any]) -> dict[str, Any]:
    address = payload.get("address")
    analysis_id = payload.get("analysisId")
    parcel = payload.get("parcel")
    scenario = payload.get("scenario")
    if not isinstance(address, str) or not address.strip():
        raise ValueError("address is required.")
    if not isinstance(analysis_id, str) or not analysis_id.strip():
        raise ValueError("analysisId is required.")
    if not isinstance(parcel, dict) or not isinstance(scenario, dict):
        raise ValueError("parcel and scenario are required.")

    area_sqm = require_number(parcel.get("areaSqm"), "parcel.areaSqm")
    floors = require_number(scenario.get("floors"), "scenario.floors")
    coverage = require_number(scenario.get("buildingCoveragePercent"), "scenario.buildingCoveragePercent")
    floor_area_ratio = require_number(scenario.get("floorAreaRatioPercent"), "scenario.floorAreaRatioPercent")
    if floors > 150 or coverage > 100 or floor_area_ratio > 2000:
        raise ValueError("scenario values are out of the supported range.")

    placement = scenario.get("placement")
    heights = scenario.get("floorHeights")
    areas = scenario.get("floorAreasSqm")
    boundary = parcel.get("boundary")
    if not isinstance(placement, dict) or not isinstance(boundary, list) or not 4 <= len(boundary) <= 1000:
        raise ValueError("Actual parcel boundary and fitted placement are required.")
    def coordinate(point):
        if not isinstance(point, dict):
            raise ValueError("Invalid coordinate")
        lat = require_number(point.get("latitude"), "latitude")
        lon = require_number(point.get("longitude"), "longitude")
        if not 33 <= lat <= 39 or not 124 <= lon <= 132:
            raise ValueError("Coordinate outside Korea")
        return {"latitude":lat, "longitude":lon}
    boundary = [coordinate(point) for point in boundary]
    width = require_number(placement.get("widthM"), "widthM")
    depth = require_number(placement.get("depthM"), "depthM")
    rotation = placement.get("rotationRad", 0)
    if not isinstance(rotation, (int,float)) or not math.isfinite(rotation):
        raise ValueError("Invalid rotation")
    if not isinstance(heights, list) or not isinstance(areas, list) or len(heights) != int(floors) or len(areas) != int(floors):
        raise ValueError("Floor areas and heights must match the number of floors")
    heights = [require_number(h, "floor height") for h in heights]
    areas = [require_number(a, "floor area") for a in areas]
    if any(a > width*depth + 0.1 for a in areas):
        raise ValueError("Floor area exceeds the fitted footprint")
    context = payload.get("context", [])
    if not isinstance(context,list) or len(context)>80:
        raise ValueError("Invalid context")
    checked_context=[]
    for building in context:
        points=building.get("footprint",[])
        if not isinstance(points,list) or not 4<=len(points)<=1000:
            raise ValueError("Invalid context footprint")
        checked_context.append({"footprint":[coordinate(p) for p in points],"heightM":require_number(building.get("heightM"),"context height")})

    return {
        "analysisId": analysis_id,
        "address": address.strip(),
        "parcel": {"areaSqm": area_sqm, "boundary":boundary},
        "context":checked_context,
        "scenario": {
            "id": str(scenario.get("id", "balanced")),
            "label": str(scenario.get("label", "균형 개발")),
            "floors": int(floors),
            "buildingCoveragePercent": coverage,
            "floorAreaRatioPercent": floor_area_ratio,
            "floorHeights":heights,"floorAreasSqm":areas,
            "placement":{"widthM":width,"depthM":depth,"rotationRad":rotation,"center":coordinate(placement.get("center"))},
        },
    }


def read_as_base64(path: Path) -> str:
    data = path.read_bytes()
    if len(data) > MAX_OUTPUT_BYTES:
        raise RuntimeError(f"Generated artifact exceeds {MAX_OUTPUT_BYTES} bytes.")
    return base64.b64encode(data).decode("ascii")


def handler(job: dict[str, Any]) -> dict[str, Any]:
    payload = validate_input(job.get("input", {}))
    with tempfile.TemporaryDirectory(prefix="plint-") as work_dir:
        work_path = Path(work_dir)
        input_path = work_path / "input.json"
        output_dir = work_path / "output"
        input_path.write_text(json.dumps(payload), encoding="utf-8")
        output_dir.mkdir()
        completed = subprocess.run(
            [
                "blender", "--background", "--factory-startup", "--python", "/app/scripts/build_scene.py", "--",
                "--input", str(input_path), "--output-dir", str(output_dir),
            ],
            text=True,
            capture_output=True,
            timeout=240,
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(f"Blender render failed: {(completed.stderr or completed.stdout)[-1800:]}")

        model_path = output_dir / "massing.glb"
        preview_path = output_dir / "preview.png"
        metadata_path = output_dir / "metadata.json"
        if not model_path.exists() or not preview_path.exists() or not metadata_path.exists():
            raise RuntimeError("Blender did not produce every expected artifact.")
        return {
            "formatVersion": "plint-blender-v3",
            "renderer": "blender-eevee",
            "model": {"mimeType": "model/gltf-binary", "base64": read_as_base64(model_path)},
            "preview": {"mimeType": "image/png", "base64": read_as_base64(preview_path)},
            "metrics": json.loads(metadata_path.read_text(encoding="utf-8")),
        }


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
