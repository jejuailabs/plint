import { createClient } from '@/lib/supabase/server';
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

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from('plans')
    .select('id, code, name, price_monthly, monthly_credit, target_segment, is_active, features')
    .order('price_monthly', { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">설정</h1>
        <p className="text-sm text-muted-foreground">
          플랜 요금 조회 및 시스템 설정 (수정 기능은 추후 지원)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">구독 플랜 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {(plans ?? []).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>코드</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead className="text-right">월 요금</TableHead>
                  <TableHead className="text-right">월 크레딧</TableHead>
                  <TableHead>대상 세그먼트</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(plans ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      {p.code}
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right">
                      {p.price_monthly.toLocaleString()}원
                    </TableCell>
                    <TableCell className="text-right">
                      {p.monthly_credit}건
                    </TableCell>
                    <TableCell>{p.target_segment ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? 'default' : 'secondary'}>
                        {p.is_active ? '활성' : '비활성'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              등록된 플랜이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">시스템 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            요금제 수정, 프로바이더 단가 설정 등은 추후 이 페이지에서 지원될
            예정입니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
