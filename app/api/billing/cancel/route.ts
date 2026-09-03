import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, status, billing_key')
    .eq('user_id', user.id)
    .in('status', ['active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!subscription) {
    return Response.json({ error: { code: 'NO_SUBSCRIPTION', message: '활성 구독이 없습니다.' } }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      status: 'cancel_at_period_end',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('Cancel subscription failed', updateError);
    return Response.json({ error: { code: 'CANCEL_FAILED', message: '해지 처리 중 오류가 발생했습니다.' } }, { status: 500 });
  }

  return Response.json({ data: { subscriptionId: subscription.id, status: 'cancel_at_period_end' } });
}
