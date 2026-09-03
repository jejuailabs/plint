import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { isPortOneConfigured, validateBillingKey } from '@/lib/payment/portone';

const requestSchema = z.object({
  billingKey: z.string().min(1),
  planCode: z.string().min(1),
  customerId: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' } }, { status: 400 });
  }

  if (!isPortOneConfigured()) {
    return Response.json({ error: { code: 'PAYMENT_NOT_CONFIGURED', message: '결제 시스템이 아직 설정되지 않았습니다.' } }, { status: 503 });
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('code', parsed.data.planCode)
    .eq('is_active', true)
    .single();

  if (!plan) {
    return Response.json({ error: { code: 'PLAN_NOT_FOUND', message: '유효한 플랜을 선택해 주세요.' } }, { status: 404 });
  }

  try {
    const billingInfo = await validateBillingKey(parsed.data.billingKey);
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data: subscription, error: insertError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        plan_id: plan.id,
        status: 'active',
        billing_key: billingInfo.billingKey,
        portone_customer_id: billingInfo.customerId,
        remaining_credit: plan.monthly_credit,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (insertError) {
      console.error('Subscription upsert failed', insertError);
      return Response.json({ error: { code: 'SUBSCRIBE_FAILED', message: '구독 처리 중 오류가 발생했습니다.' } }, { status: 500 });
    }

    return Response.json({ data: { subscriptionId: subscription.id, status: 'active', planCode: plan.code } });
  } catch (caught) {
    console.error('Subscribe failed', caught);
    return Response.json({ error: { code: 'BILLING_KEY_INVALID', message: '결제 수단을 확인할 수 없습니다.' } }, { status: 400 });
  }
}
