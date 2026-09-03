import { requireAuth } from '@/lib/auth/require-auth';
import { error, paginated } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const claims = await requireAuth();

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = await createClient();

    // Count total (filtered by user)
    const { count, error: countError } = await supabase
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', claims.userId);

    if (countError) {
      console.error('Failed to count analyses', countError);
      return error('DB_ERROR', '분석 목록 조회에 실패했습니다.', 500);
    }

    const { data, error: dbError } = await supabase
      .from('analyses')
      .select('*')
      .eq('user_id', claims.userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (dbError) {
      console.error('Failed to fetch analyses', dbError);
      return error('DB_ERROR', '분석 목록 조회에 실패했습니다.', 500);
    }

    return paginated(data ?? [], { page, pageSize, total: count ?? 0 });
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}
