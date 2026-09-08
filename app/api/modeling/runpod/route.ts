import { z } from 'zod';

import { error, success } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  isRunpodConfigured,
  RunpodConfigurationError,
  submitBlenderModelingJob,
} from '@/lib/runpod/blender-modeling';
import { createClient } from '@/lib/supabase/server';

const requestSchema = z.object({
  analysisId: z.uuid('유효한 분석 ID를 입력해 주세요.'),
  address: z.string().trim().min(5).max(160),
  parcel: z.object({
    areaSqm: z.number().positive().max(10_000_000),
    boundary: z
      .array(z.object({ latitude: z.number(), longitude: z.number() }))
      .min(4)
      .max(1000),
  }),
  context: z
    .array(
      z.object({
        footprint: z
          .array(
            z.object({
              latitude: z.number().min(33).max(39),
              longitude: z.number().min(124).max(132),
            }),
          )
          .min(4)
          .max(1000),
        heightM: z.number().positive().max(1000),
      }),
    )
    .max(80)
    .optional(),
  scenario: z.object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(80),
    floors: z.number().int().min(1).max(150),
    buildingCoveragePercent: z.number().positive().max(100),
    floorAreaRatioPercent: z.number().positive().max(2_000),
    floorHeights: z.array(z.number().positive().max(20)).min(1).max(150),
    floorAreasSqm: z.array(z.number().positive()).min(1).max(150),
    placement: z.object({
      widthM: z.number().positive(),
      depthM: z.number().positive(),
      rotationRad: z.number(),
      center: z.object({
        latitude: z.number().min(33).max(39),
        longitude: z.number().min(124).max(132),
      }),
    }),
  }),
});

export async function POST(request: Request) {
  try {
    const claims = await requireAuth();
    const parsed = requestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return error(
        'INVALID_BODY',
        parsed.error.issues[0]?.message ?? '모델링 요청 형식을 확인해 주세요.',
      );
    const supabase = await createClient();
    const { data: analysis } = await supabase
      .from('analyses')
      .select('id')
      .eq('id', parsed.data.analysisId)
      .eq('user_id', claims.userId)
      .maybeSingle();
    if (!analysis)
      return error(
        'ANALYSIS_NOT_FOUND',
        '본인 분석 결과에서만 모델을 생성할 수 있습니다.',
        404,
      );
    if (!isRunpodConfigured()) {
      return error(
        'RUNPOD_ENDPOINT_NOT_CONFIGURED',
        'Blender 워커 Endpoint ID가 아직 설정되지 않았습니다.',
        503,
      );
    }
    const job = await submitBlenderModelingJob(parsed.data);
    return success({ jobId: job.id, status: job.status }, 202);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    if (thrown instanceof RunpodConfigurationError)
      return error('RUNPOD_NOT_CONFIGURED', thrown.message, 503);
    console.error('RunPod Blender job submission failed', thrown);
    return error(
      'RUNPOD_SUBMISSION_FAILED',
      'Blender 모델링 작업을 시작하지 못했습니다.',
      502,
    );
  }
}
