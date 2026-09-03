import { createAdminClient } from '@/lib/supabase/admin';
import { resetCredit } from '@/lib/payment/credit';
import { requestPayment } from '@/lib/payment/portone';

export async function executeBillingCycle(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('id', subscriptionId)
    .single();

  if (subError || !subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  if (subscription.status === 'canceled') {
    return { success: false, error: 'Subscription is canceled' };
  }

  if (subscription.cancel_at_period_end) {
    await supabase
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', subscriptionId);
    return { success: true };
  }

  if (!subscription.billing_key) {
    return { success: false, error: 'No billing key' };
  }

  const plan = subscription.plans;
  if (!plan || plan.price_monthly === 0) {
    await renewPeriod(supabase, subscription, plan?.monthly_credit ?? 0);
    return { success: true };
  }

  const paymentId = `plint-${subscriptionId}-${Date.now()}`;

  try {
    const result = await requestPayment(paymentId, {
      billingKey: subscription.billing_key,
      orderName: `PLINT ${plan.name} 월 구독`,
      amount: plan.price_monthly,
      customerId: subscription.portone_customer_id ?? subscription.user_id,
    });

    await supabase.from('payments').insert({
      user_id: subscription.user_id,
      subscription_id: subscriptionId,
      portone_payment_id: result.paymentId,
      amount: result.amount,
      status: result.status === 'PAID' ? 'paid' : 'failed',
      paid_at: result.paidAt,
      failed_reason: result.failedReason,
    });

    if (result.status === 'PAID') {
      await renewPeriod(supabase, subscription, plan.monthly_credit);
      return { success: true };
    }

    await supabase
      .from('subscriptions')
      .update({ status: 'past_due', updated_at: new Date().toISOString() })
      .eq('id', subscriptionId);

    return { success: false, error: result.failedReason ?? 'Payment failed' };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Unknown billing error';
    console.error('Billing cycle failed', { subscriptionId, error: message });
    return { success: false, error: message };
  }
}

async function renewPeriod(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: { id: string; current_period_end: string | null },
  monthlyCredit: number,
) {
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id);

  await resetCredit(subscription.id, monthlyCredit);
}
