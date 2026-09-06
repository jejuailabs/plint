import { createClient } from '@/lib/supabase/server';
import { AdminUsersClient } from '@/components/admin/admin-users-client';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: users } = await supabase
    .from('users')
    .select(`
      id,
      email,
      display_name,
      segment,
      role,
      created_at,
      last_login_at,
      subscriptions(
        id,
        status,
        plans(name)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, code')
    .eq('is_active', true);

  const formattedUsers = (users ?? []).map((u) => {
    const activeSub = (u.subscriptions as any[])?.find(
      (s: any) => s.status === 'active',
    );
    return {
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      segment: u.segment,
      role: u.role,
      currentPlan: activeSub?.plans?.name ?? '없음',
      subscriptionStatus: activeSub?.status ?? 'none',
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">사용자 관리</h1>
        <p className="text-sm text-muted-foreground">
          가입된 사용자 목록을 조회하고 관리합니다.
        </p>
      </div>
      <AdminUsersClient
        users={formattedUsers}
        plans={(plans ?? []).map((p) => ({ id: p.id, name: p.name, code: p.code }))}
      />
    </div>
  );
}
