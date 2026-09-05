import 'server-only';

export type BlenderModelingInput = {
  analysisId: string;
  address: string;
  parcel: { areaSqm: number; boundary?: Array<{ latitude: number; longitude: number }> };
  scenario: {
    id: string;
    label: string;
    floors: number;
    buildingCoveragePercent: number;
    floorAreaRatioPercent: number;
  };
};

export type RunpodJobStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';

export type RunpodBlenderResult = {
  formatVersion: 'plint-blender-v1';
  renderer: 'blender-eevee';
  model: { mimeType: 'model/gltf-binary'; base64: string };
  preview: { mimeType: 'image/png'; base64: string };
  metrics: { floors: number; grossFloorAreaSqm: number; renderWidth: number; renderHeight: number };
};

export type RunpodJob<TOutput = unknown> = {
  id: string;
  status: RunpodJobStatus;
  output?: TOutput;
  error?: string;
  delayTime?: number;
  executionTime?: number;
};

export class RunpodConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunpodConfigurationError';
  }
}

function getConfig() {
  // RUNPOD is the name already used in this project's local environment.
  // RUNPOD_API_KEY is also supported for standard RunPod deployments.
  const apiKey = process.env.RUNPOD_API_KEY ?? process.env.RUNPOD;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  if (!apiKey) throw new RunpodConfigurationError('RUNPOD API 키가 설정되지 않았습니다.');
  if (!endpointId) throw new RunpodConfigurationError('RUNPOD_ENDPOINT_ID가 설정되지 않았습니다.');
  return { apiKey, endpointId };
}

async function requestRunpod<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey, endpointId } = getConfig();
  const response = await fetch(`https://api.runpod.ai/v2/${endpointId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`RunPod API 요청 실패 (${response.status}): ${body.slice(0, 500)}`);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error('RunPod API가 JSON 응답을 반환하지 않았습니다.');
  }
}

export function isRunpodConfigured() {
  return Boolean((process.env.RUNPOD_API_KEY ?? process.env.RUNPOD) && process.env.RUNPOD_ENDPOINT_ID);
}

export async function submitBlenderModelingJob(input: BlenderModelingInput) {
  return requestRunpod<RunpodJob<RunpodBlenderResult>>('/run', {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export async function getBlenderModelingJob(jobId: string) {
  return requestRunpod<RunpodJob<RunpodBlenderResult>>(`/status/${encodeURIComponent(jobId)}`);
}

export async function getRunpodHealth() {
  return requestRunpod<{
    jobs?: { completed?: number; failed?: number; inProgress?: number; inQueue?: number };
    workers?: { idle?: number; running?: number };
  }>('/health');
}
