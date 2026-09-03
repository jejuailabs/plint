import { createClient } from '@/lib/supabase/server';
import { error, success } from '@/lib/api/response';

export async function GET() {
  const supabase = await createClient();

  const { data, error: dbError } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('price_monthly', { ascending: true });

  if (dbError) {
    console.error('Failed to fetch plans', dbError);
    return error('DB_ERROR', '요금제 조회에 실패했습니다.', 500);
  }

  return success(data ?? []);
}
