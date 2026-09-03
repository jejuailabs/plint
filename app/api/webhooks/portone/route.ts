import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature, type WebhookEvent } from '@/lib/payment/portone';
import { resetCredit } from '@/lib/payment/credit';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-portone-signature') ?? '';

  if (!verifyWebhookSignature(body, signature)) {
    return Response.json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed.' } }, { status: 401 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(body) as WebhookEvent;
  } catch {
    return Response.json({ error: { code: 'INVALID_BODY', message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const supabase = createAdminClient();
  const paymentId = event.data.paymentId ?? event.data.transactionId;
  if (!paymentId) {
    return Response.json({ ok: true });
  }

  switch (event.type) {
    case 'Transaction.Paid': {
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id, subscription_id, status')
        .eq('portone_payment_id', paymentId)
        .single();

      if (existingPayment?.status === 'paid') {
        return Response.json({ ok: true });
      }

      await supabase
        .from('payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('portone_payment_id', paymentId);

      if (existingPayment?.subscription_id) {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('id, plan_id, plans(monthly_credit)')
          .eq('id', existingPayment.subscription_id)
          .single();

        if (subscription) {
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

          const monthlyCredit = (subscription.plans as { monthly_credit?: number } | null)?.monthly_credit ?? 0;
          await resetCredit(subscription.id, monthlyCredit);
        }
      }
      break;
    }

    case 'Transaction.Failed': {
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('portone_payment_id', paymentId);

      const { data: failedPayment } = await supabase
        .from('payments')
        .select('subscription_id')
        .eq('portone_payment_id', paymentId)
        .single();

      if (failedPayment?.subscription_id) {
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('id', failedPayment.subscription_id);
      }
      break;
    }

    case 'Transaction.Cancelled': {
      await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('portone_payment_id', paymentId);
      break;
    }

    default:
      break;
  }

  return Response.json({ ok: true });
}
