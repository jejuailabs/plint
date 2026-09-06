import { createClient } from '@/lib/supabase/server';
import { AdminUsageClient } from '@/components/admin/admin-usage-client';

export const dynamic = 'force-dynamic';

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default async function AdminUsagePage() {
  const supabase = await createClient();

  const [logsResult, apiStatusResult, errorLogsResult] = await Promise.all([
    // Usage logs for the past 30 days
    supabase
      .from('usage_logs')
      .select('provider, endpoint, request_count, response_time_ms, cost_krw, status_code, created_at')
      .gte('created_at', daysAgo(30))
      .order('created_at', { ascending: false })
      .limit(5000),
    // API provider status
    supabase
      .from('api_provider_status')
      .select('provider, is_healthy, last_checked_at, last_error'),
    // Recent error logs
    supabase
      .from('usage_logs')
      .select('provider, endpoint, status_code, created_at')
      .or('status_code.gte.400,status_code.is.null')
      .gte('created_at', daysAgo(7))
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const logs = logsResult.data ?? [];
  const apiStatus = apiStatusResult.data ?? [];
  const errorLogs = errorLogsResult.data ?? [];

  // Aggregate per provider
  const providerMap = new Map<
    string,
    {
      totalCalls: number;
      totalResponseTime: number;
      responseCount: number;
      errors: number;
      totalCost: number;
    }
  >();

  for (const log of logs) {
    const prev = providerMap.get(log.provider) ?? {
      totalCalls: 0,
      totalResponseTime: 0,
      responseCount: 0,
      errors: 0,
      totalCost: 0,
    };
    prev.totalCalls += log.request_count ?? 1;
    if (log.response_time_ms != null) {
      prev.totalResponseTime += log.response_time_ms;
      prev.responseCount += 1;
    }
    if (log.status_code != null && log.status_code >= 400) {
      prev.errors += 1;
    }
    prev.totalCost += Number(log.cost_krw ?? 0);
    providerMap.set(log.provider, prev);
  }

  const providerStats = Array.from(providerMap.entries()).map(
    ([provider, stats]) => ({
      provider,
      totalCalls: stats.totalCalls,
      avgResponseTime:
        stats.responseCount > 0
          ? Math.round(stats.totalResponseTime / stats.responseCount)
          : 0,
      errorRate:
        stats.totalCalls > 0
          ? Number(((stats.errors / stats.totalCalls) * 100).toFixed(1))
          : 0,
      totalCost: Math.round(stats.totalCost),
    }),
  );

  // Daily call counts for chart (last 30 days)
  const dailyMap = new Map<string, Map<string, number>>();
  for (const log of logs) {
    const day = log.created_at.slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, new Map());
    const provMap = dailyMap.get(day)!;
    provMap.set(log.provider, (provMap.get(log.provider) ?? 0) + (log.request_count ?? 1));
  }

  const allProviders = Array.from(providerMap.keys());
  const dailyChartData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, provMap]) => {
      const row: Record<string, string | number> = { date };
      for (const p of allProviders) {
        row[p] = provMap.get(p) ?? 0;
      }
      return row;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API 사용량 모니터링</h1>
        <p className="text-sm text-muted-foreground">
          외부 API 호출 현황과 에러를 모니터링합니다.
        </p>
      </div>
      <AdminUsageClient
        providerStats={providerStats}
        dailyChartData={dailyChartData}
        providers={allProviders}
        apiStatus={apiStatus}
        errorLogs={errorLogs}
      />
    </div>
  );
}
