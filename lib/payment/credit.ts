import { createAdminClient } from '@/lib/supabase/admin';

export type CreditCheckResult =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: string };

export async function checkAndDeductCredit(userId: string): Promise<CreditCheckResult> {
  const supabase = createAdminClient();

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('id, remaining_credit, status')
    .eq('user_id', userId)
    .in('status', ['active', 'cancel_at_period_end'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !subscription) {
    return { allowed: false, reason: '활성 구독이 없습니다. 플랜을 선택해 주세요.' };
  }

  if (subscription.remaining_credit <= 0) {
    return { allowed: false, reason: '이번 달 크레딧을 모두 사용했습니다. 플랜을 업그레이드하거나 다음 결제일을 기다려 주세요.' };
  }

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      remaining_credit: subscription.remaining_credit - 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id)
    .eq('remaining_credit', subscription.remaining_credit); // optimistic lock

  if (updateError) {
    return { allowed: false, reason: '크레딧 차감 중 오류가 발생했습니다. 다시 시도해 주세요.' };
  }

  return { allowed: true, remaining: subscription.remaining_credit - 1 };
}

export async function resetCredit(subscriptionId: string, credit: number): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from('subscriptions')
    .update({
      remaining_credit: credit,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);
}
