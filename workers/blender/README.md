# PLINT Blender RunPod worker

This is the GPU worker that Vercel cannot run. It accepts a parcel area and scenario,
uses Blender in headless mode, then returns a web-ready `GLB` massing model and a
rendered `PNG` preview. The app sends jobs to it through RunPod's asynchronous `/run`
endpoint and polls `/status/{jobId}`.

## Build and publish

```bash
docker build --platform linux/amd64 -f workers/blender/Dockerfile -t <registry-user>/plint-blender:latest .
docker push <registry-user>/plint-blender:latest
```

This repository also contains a GitHub Actions workflow that publishes
`ghcr.io/jejuailabs/plint-blender:latest` automatically whenever the worker files
are pushed to `main`. That path does not require Docker on the development PC.

Create a **RunPod Serverless Endpoint** with this image, then put the endpoint ID in
Vercel as `RUNPOD_ENDPOINT_ID`. The API key remains server-only as `RUNPOD` (or
`RUNPOD_API_KEY`).

## Input contract

```json
{
  "input": {
    "analysisId": "uuid",
    "address": "제주특별자치도 제주시 연동 273-15",
    "parcel": { "areaSqm": 480 },
    "scenario": {
      "id": "balanced",
      "label": "균형 개발",
      "floors": 4,
      "buildingCoveragePercent": 60,
      "floorAreaRatioPercent": 200
    }
  }
}
```

The current worker is a fast **massing + render** pipeline. Bonsai (formerly
BlenderBIM) is an optional next layer for IFC authoring/export; it is not needed for
the browser GLB or preview image.
