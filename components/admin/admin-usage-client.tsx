'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const COLORS = [
  '#0ea5e9',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#6366f1',
  '#ec4899',
  '#14b8a6',
];

interface ProviderStat {
  provider: string;
  totalCalls: number;
  avgResponseTime: number;
  errorRate: number;
  totalCost: number;
}

interface ApiStatus {
  provider: string;
  is_healthy: boolean;
  last_checked_at: string | null;
  last_error: string | null;
}

interface ErrorLog {
  provider: string;
  endpoint: string;
  status_code: number | null;
  created_at: string;
}

export function AdminUsageClient({
  providerStats,
  dailyChartData,
  providers,
  apiStatus,
  errorLogs,
}: {
  providerStats: ProviderStat[];
  dailyChartData: Record<string, string | number>[];
  providers: string[];
  apiStatus: ApiStatus[];
  errorLogs: ErrorLog[];
}) {
  return (
    <div className="space-y-6">
      {/* API Health badges */}
      {apiStatus.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {apiStatus.map((api) => (
            <Badge
              key={api.provider}
              variant={api.is_healthy ? 'default' : 'destructive'}
            >
              {api.provider}: {api.is_healthy ? '정상' : '장애'}
            </Badge>
          ))}
        </div>
      )}

      {/* Daily calls chart */}
      {dailyChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              일별 API 호출 수 (최근 30일)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyChartData}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                {providers.map((p, i) => (
                  <Line
                    key={p}
                    type="monotone"
                    dataKey={p}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Provider stats table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            프로바이더별 요약 (최근 30일)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {providerStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>프로바이더</TableHead>
                  <TableHead className="text-right">총 호출</TableHead>
                  <TableHead className="text-right">평균 응답(ms)</TableHead>
                  <TableHead className="text-right">에러율</TableHead>
                  <TableHead className="text-right">추정 비용</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providerStats.map((s) => (
                  <TableRow key={s.provider}>
                    <TableCell className="font-medium">{s.provider}</TableCell>
                    <TableCell className="text-right">
                      {s.totalCalls.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.avgResponseTime.toLocaleString()}ms
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          s.errorRate > 5 ? 'text-destructive font-medium' : ''
                        }
                      >
                        {s.errorRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {s.totalCost.toLocaleString()}원
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              사용량 데이터가 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent error logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            최근 에러 로그 (7일)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errorLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>프로바이더</TableHead>
                  <TableHead>엔드포인트</TableHead>
                  <TableHead>상태 코드</TableHead>
                  <TableHead>시각</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorLogs.map((log, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{log.provider}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs">
                      {log.endpoint}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {log.status_code ?? 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(log.created_at).toLocaleString('ko-KR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              최근 에러가 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
