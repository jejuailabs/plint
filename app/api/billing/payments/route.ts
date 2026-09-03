import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') ?? '20')));
  const offset = (page - 1) * pageSize;

  const { data: payments, error, count } = await supabase
    .from('payments')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error('Payments query failed', error);
    return Response.json({ error: { code: 'QUERY_FAILED', message: '결제 내역을 불러올 수 없습니다.' } }, { status: 500 });
  }

  return Response.json({
    data: payments ?? [],
    pagination: { page, pageSize, total: count ?? 0 },
  });
}
