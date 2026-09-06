import { createClient } from '@/lib/supabase/server';
import { AdminBillingClient } from '@/components/admin/admin-billing-client';

export const dynamic = 'force-dynamic';

export default async function AdminBillingPage() {
  const supabase = await createClient();

  const [subsResult, paymentsResult] = await Promise.all([
    supabase
      .from('subscriptions')
      .select(`
        id,
        status,
        current_period_end,
        remaining_credit,
        cancel_at_period_end,
        created_at,
        users(email, display_name),
        plans(name, code, monthly_credit)
      `)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('payments')
      .select(`
        id,
        amount,
        status,
        portone_payment_id,
        paid_at,
        created_at,
        users(email)
      `)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const subscriptions = (subsResult.data ?? []).map((s) => ({
    id: s.id,
    userEmail: (s as any).users?.email ?? '-',
    userName: (s as any).users?.display_name ?? '',
    planName: (s as any).plans?.name ?? '-',
    planCode: (s as any).plans?.code ?? '',
    status: s.status,
    currentPeriodEnd: s.current_period_end,
    remainingCredit: s.remaining_credit,
    monthlyCredit: (s as any).plans?.monthly_credit ?? 0,
    cancelAtPeriodEnd: s.cancel_at_period_end,
    createdAt: s.created_at,
  }));

  const payments = (paymentsResult.data ?? []).map((p) => ({
    id: p.id,
    userEmail: (p as any).users?.email ?? '-',
    amount: p.amount,
    status: p.status,
    portonePaymentId: p.portone_payment_id,
    paidAt: p.paid_at,
    createdAt: p.created_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">구독/결제 관리</h1>
        <p className="text-sm text-muted-foreground">
          구독 현황과 결제 내역을 조회합니다.
        </p>
      </div>
      <AdminBillingClient subscriptions={subscriptions} payments={payments} />
    </div>
  );
}
