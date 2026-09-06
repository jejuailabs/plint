import {
  Activity,
  AlertTriangle,
  CreditCard,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { redirect } from 'next/navigation';

import { StatCard } from '@/components/admin/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { AdminPlanChart } from '@/components/admin/admin-plan-chart';

export const dynamic = 'force-dynamic';

function startOf(unit: 'day' | 'week' | 'month') {
  const now = new Date();
  if (unit === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (unit === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Parallel queries
  const [
    todaySignups,
    weekSignups,
    monthSignups,
    activeSubscriptions,
    monthRevenue,
    todayAnalyses,
    failedAnalyses,
    apiStatus,
    planDistribution,
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOf('day')),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOf('week')),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOf('month')),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('payments')
      .select('amount')
      .eq('status', 'paid')
      .gte('paid_at', startOf('month')),
    supabase
      .from('analyses')
      .select('id, status', { count: 'exact' })
      .gte('created_at', startOf('day')),
    supabase
      .from('analyses')
      .select('id, site_id, user_id, status, error_message, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('api_provider_status')
      .select('provider, is_healthy, last_checked_at, last_error'),
    supabase
      .from('subscriptions')
      .select('plan_id, plans(name)')
      .eq('status', 'active'),
  ]);

  const totalRevenue = (monthRevenue.data ?? []).reduce(
    (sum, p) => sum + (p.amount ?? 0),
    0,
  );

  const todayAnalysesData = todayAnalyses.data ?? [];
  const todayTotal = todayAnalyses.count ?? 0;
  const todayFailed = todayAnalysesData.filter((a) => a.status === 'failed').length;
  const todayCompleted = todayAnalysesData.filter((a) => a.status === 'completed').length;

  // Plan distribution for chart
  const planCounts: Record<string, number> = {};
  for (const sub of planDistribution.data ?? []) {
    const name = (sub as any).plans?.name ?? '알 수 없음';
    planCounts[name] = (planCounts[name] ?? 0) + 1;
  }
  const planChartData = Object.entries(planCounts).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">관리자 대시보드</h1>
        <p className="text-sm text-muted-foreground">
          서비스 운영 현황을 한눈에 확인합니다.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="오늘 가입"
          value={todaySignups.count ?? 0}
          description={`이번주 ${weekSignups.count ?? 0}명 / 이번달 ${monthSignups.count ?? 0}명`}
          icon={<UserPlus className="size-4" />}
        />
        <StatCard
          title="활성 구독"
          value={activeSubscriptions.count ?? 0}
          description="현재 유효한 구독 수"
          icon={<Users className="size-4" />}
        />
        <StatCard
          title="이번달 매출"
          value={`${totalRevenue.toLocaleString()}원`}
          description="결제 성공 기준"
          icon={<CreditCard className="size-4" />}
        />
        <StatCard
          title="오늘 분석 요청"
          value={todayTotal}
          description={`완료 ${todayCompleted} / 실패 ${todayFailed}`}
          icon={<Activity className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Plan distribution chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">플랜별 구독 분포</CardTitle>
          </CardHeader>
          <CardContent>
            {planChartData.length > 0 ? (
              <AdminPlanChart data={planChartData} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                구독 데이터가 없습니다.
              </p>
            )}
          </CardContent>
        </Card>

        {/* API Health Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              외부 API 상태
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(apiStatus.data ?? []).length > 0 ? (
              <div className="space-y-3">
                {(apiStatus.data ?? []).map((api) => (
                  <div
                    key={api.provider}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm font-medium">{api.provider}</span>
                    <Badge
                      variant={api.is_healthy ? 'default' : 'destructive'}
                    >
                      {api.is_healthy ? '정상' : '장애'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                등록된 API 프로바이더가 없습니다.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent failed analyses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4 text-destructive" />
            최근 실패한 분석
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(failedAnalyses.data ?? []).length > 0 ? (
            <div className="space-y-2">
              {(failedAnalyses.data ?? []).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="space-y-0.5">
                    <p className="font-mono text-xs text-muted-foreground">
                      {a.id.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-destructive">
                      {a.error_message ?? '알 수 없는 오류'}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString('ko-KR')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              최근 실패한 분석이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
