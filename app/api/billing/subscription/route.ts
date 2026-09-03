import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, plans(code, name, price_monthly, monthly_credit, features)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!subscription) {
    return Response.json({ data: null });
  }

  return Response.json({
    data: {
      id: subscription.id,
      status: subscription.status,
      plan: subscription.plans,
      remainingCredit: subscription.remaining_credit,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}
