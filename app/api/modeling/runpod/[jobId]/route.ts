import { error, success } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth/require-auth';
import { getBlenderModelingJob, isRunpodConfigured, RunpodConfigurationError } from '@/lib/runpod/blender-modeling';

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    await requireAuth();
    const { jobId } = await params;
    if (!/^[A-Za-z0-9-]{8,200}$/.test(jobId)) return error('INVALID_JOB_ID', '유효한 RunPod 작업 ID를 입력해 주세요.');
    if (!isRunpodConfigured()) {
      return error('RUNPOD_ENDPOINT_NOT_CONFIGURED', 'Blender 워커 Endpoint ID가 아직 설정되지 않았습니다.', 503);
    }
    return success(await getBlenderModelingJob(jobId));
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    if (thrown instanceof RunpodConfigurationError) return error('RUNPOD_NOT_CONFIGURED', thrown.message, 503);
    console.error('RunPod Blender job status lookup failed', thrown);
    return error('RUNPOD_STATUS_FAILED', 'Blender 모델링 작업 상태를 확인하지 못했습니다.', 502);
  }
}
