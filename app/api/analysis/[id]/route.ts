import { requireAuth } from '@/lib/auth/require-auth';
import { error, success } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';

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

    return success(data);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}
