import { z } from 'zod';

import { requireAuth } from '@/lib/auth/require-auth';
import { error, success } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  address: z.string().trim().min(5),
  result: z.record(z.string(), z.unknown()),
  coverage: z.record(z.string(), z.unknown()),
  aiReport: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const claims = await requireAuth();

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return error('INVALID_BODY', parsed.error.issues[0]?.message ?? '요청 형식을 확인해 주세요.');
    }

    const { address, result, coverage, aiReport } = parsed.data;
    const supabase = await createClient();

    let siteId: string;
    const { data: existingSite } = await supabase
      .from('sites')
      .select('id')
      .eq('user_id', claims.userId)
      .eq('jibun_address', address)
      .limit(1)
      .maybeSingle();

    if (existingSite) {
      siteId = existingSite.id;
    } else {
      const { data: newSite, error: siteError } = await supabase
        .from('sites')
        .insert({ user_id: claims.userId, jibun_address: address })
        .select('id')
        .single();
      if (siteError || !newSite) {
        console.error('Site insert failed', siteError);
        return error('DB_ERROR', '사이트 저장에 실패했습니다.', 500);
      }
      siteId = newSite.id;
    }

    const analysisResult = aiReport ? { ...result, aiReport } : result;

    const { data: analysis, error: analysisError } = await supabase
      .from('analyses')
      .insert({
        site_id: siteId,
        user_id: claims.userId,
        status: 'completed',
        result: analysisResult,
        coverage,
        completed_at: new Date().toISOString(),
      })
      .select('id, status')
      .single();

    if (analysisError || !analysis) {
      console.error('Analysis insert failed', analysisError);
      return error('DB_ERROR', '분석 결과 저장에 실패했습니다.', 500);
    }

    return success({ analysisId: analysis.id, siteId, status: analysis.status });
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}
