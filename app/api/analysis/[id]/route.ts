import { requireAuth } from '@/lib/auth/require-auth';
import { error, success } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { persistBlenderArtifacts } from '@/lib/runpod/artifacts';
import { getBlenderModelingJob, isRunpodConfigured } from '@/lib/runpod/blender-modeling';

type ModelingRecord = {
  provider?: string;
  jobId?: string;
  status?: string;
  [key: string]: unknown;
};

function runpodModeling(result: Record<string, unknown> | null) {
  const candidate = result?.modeling;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const modeling = candidate as ModelingRecord;
  return modeling.provider === 'runpod-blender' && typeof modeling.jobId === 'string'
    ? modeling
    : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireAuth();
    const { id } = await params;

    const supabase = await createClient();

    const { data, error: dbError } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .eq('user_id', claims.userId)
      .single();

    if (dbError || !data) {
      return error('NOT_FOUND', '분석 결과를 찾을 수 없습니다.', 404);
    }

    const result = (data.result ?? null) as Record<string, unknown> | null;
    const modeling = data.status === 'modeling' ? runpodModeling(result) : null;

    if (!modeling || !isRunpodConfigured()) {
      return success(data);
    }

    const job = await getBlenderModelingJob(modeling.jobId!);
    if (job.status === 'COMPLETED') {
      if (!job.output) {
        throw new Error('RunPod 작업이 완료되었지만 Blender 출력이 없습니다.');
      }

      const artifacts = await persistBlenderArtifacts(supabase, {
        analysisId: data.id,
        userId: claims.userId,
        result: job.output,
      });
      const updatedResult = {
        ...result,
        modeling: {
          ...modeling,
          status: job.status,
          renderer: job.output.renderer,
          metrics: job.output.metrics,
          artifacts,
          completedAt: new Date().toISOString(),
        },
      };
      const { data: completed, error: updateError } = await supabase
        .from('analyses')
        .update({
          status: 'completed',
          result: updatedResult,
          completed_at: new Date().toISOString(),
        })
        .eq('id', data.id)
        .eq('user_id', claims.userId)
        .select('*')
        .single();
      if (updateError || !completed) throw new Error('Blender 결과 저장에 실패했습니다.');
      return success(completed);
    }

    if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'TIMED_OUT') {
      const { data: failed, error: updateError } = await supabase
        .from('analyses')
        .update({
          status: 'failed',
          error_code: 'RUNPOD_BLENDER_FAILED',
          error_message: job.error ?? 'RunPod Blender 작업이 완료되지 않았습니다.',
        })
        .eq('id', data.id)
        .eq('user_id', claims.userId)
        .select('*')
        .single();
      if (updateError || !failed) throw new Error('Blender 작업 실패 상태 저장에 실패했습니다.');
      return success(failed);
    }

    return success({ ...data, runpod: { jobId: job.id, status: job.status } });
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}
