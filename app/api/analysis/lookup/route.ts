import { getClaims } from '@/lib/auth/get-claims';
import { error, success } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const claims = await getClaims();
    if (!claims) {
      return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401);
    }

    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address')?.trim();
    const reportId = searchParams.get('reportId');
    if (!address || address.length < 5) {
      return error('INVALID_ADDRESS', '유효한 주소를 입력해 주세요.');
    }

    const supabase = await createClient();

    let query = supabase
      .from('analyses')
      .select(
        'id, result, coverage, status, completed_at, created_at, sites!inner(jibun_address)',
      )
      .eq('user_id', claims.userId)
      .eq('sites.jibun_address', address)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);
    if (reportId) query = query.eq('id', reportId);
    const { data, error: dbError } = await query.maybeSingle();

    if (dbError) {
      console.error('Analysis lookup failed', dbError);
      return error('DB_ERROR', '분석 조회에 실패했습니다.', 500);
    }

    if (!data) {
      return error('NOT_FOUND', '저장된 분석 결과가 없습니다.', 404);
    }

    return success({
      analysisId: data.id,
      result: data.result,
      coverage: data.coverage,
      completedAt: data.completed_at,
    });
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}
