import { z } from 'zod';

import { requireAuth } from '@/lib/auth/require-auth';
import { error, success } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { runPreviewAnalysis } from '@/lib/pipeline/preview';

const bodySchema = z.object({
  siteId: z.uuid('유효한 사이트 ID를 입력해 주세요.'),
});

export async function POST(request: Request) {
  try {
    const claims = await requireAuth();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return error(
        'INVALID_BODY',
        parsed.error.issues[0]?.message ?? '요청 형식을 확인해 주세요.',
      );
    }

    const { siteId } = parsed.data;
    const supabase = await createClient();

    // Defense-in-depth: verify site belongs to authenticated user
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, jibun_address')
      .eq('id', siteId)
      .eq('user_id', claims.userId)
      .single();

    if (siteError || !site) {
      return error('SITE_NOT_FOUND', '사이트를 찾을 수 없습니다.', 404);
    }

    // Create analysis row with status='pending'
    const { data: analysis, error: insertError } = await supabase
      .from('analyses')
      .insert({
        site_id: siteId,
        user_id: claims.userId,
        status: 'pending',
      })
      .select('id, status')
      .single();

    if (insertError || !analysis) {
      console.error('Failed to create analysis', insertError);
      return error('DB_ERROR', '분석 생성에 실패했습니다.', 500);
    }

    // Kick off async pipeline: for now run preview and mark complete
    // Using a fire-and-forget pattern (no await) to return 202 immediately
    void (async () => {
      try {
        const preview = await runPreviewAnalysis(site.jibun_address);
        await supabase
          .from('analyses')
          .update({
            status: 'completed',
            result: preview.data as unknown as Record<string, unknown>,
            coverage: preview.data.coverage as unknown as Record<string, unknown>,
            completed_at: new Date().toISOString(),
          })
          .eq('id', analysis.id)
          .eq('user_id', claims.userId);
      } catch (pipelineError) {
        console.error('Pipeline failed for analysis', analysis.id, pipelineError);
        await supabase
          .from('analyses')
          .update({
            status: 'failed',
            error_code: 'PIPELINE_ERROR',
            error_message:
              pipelineError instanceof Error
                ? pipelineError.message
                : '분석 파이프라인 실행에 실패했습니다.',
          })
          .eq('id', analysis.id)
          .eq('user_id', claims.userId);
      }
    })();

    return success({ analysisId: analysis.id, status: 'pending' }, 202);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}
