'use client';

import { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/admin/data-table';

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  segment: string | null;
  role: string;
  currentPlan: string;
  subscriptionStatus: string;
  createdAt: string;
  lastLoginAt: string | null;
}

const segmentLabels: Record<string, string> = {
  owner: '건축주',
  architect: '건축사',
  platform: '플랫폼',
};

const columns: Column<UserRow>[] = [
  {
    key: 'email',
    header: '이메일',
    render: (row) => (
      <div>
        <p className="font-medium">{row.email}</p>
        {row.displayName && <p className="text-xs text-muted-foreground">{row.displayName}</p>}
      </div>
    ),
  },
  {
    key: 'segment',
    header: '소속구분',
    render: (row) =>
      row.segment ? <Badge variant="secondary">{segmentLabels[row.segment] ?? row.segment}</Badge> : <span className="text-muted-foreground">-</span>,
  },
  {
    key: 'currentPlan',
    header: '현재 플랜',
    render: (row) =>
      row.currentPlan === '없음' ? <span className="text-muted-foreground">없음</span> : <Badge variant="outline">{row.currentPlan}</Badge>,
  },
  {
    key: 'role',
    header: '권한',
    render: (row) => (row.role === 'admin' ? <Badge>관리자</Badge> : <span className="text-sm">사용자</span>),
  },
  {
    key: 'createdAt',
    header: '가입일',
    render: (row) => new Date(row.createdAt).toLocaleDateString('ko-KR'),
  },
  {
    key: 'lastLoginAt',
    header: '최근 로그인',
    render: (row) => (row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleDateString('ko-KR') : '-'),
  },
];

export function AdminUsersClient({
  users,
  plans,
}: {
  users: UserRow[];
  plans: { id: string; name: string; code: string }[];
}) {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let result = users;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((u) => u.email.toLowerCase().includes(q) || u.displayName?.toLowerCase().includes(q));
    }
    if (planFilter !== 'all') {
      result = result.filter((u) => u.currentPlan === planFilter);
    }
    return result;
  }, [users, search, planFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="이메일 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="all">전체 플랜</option>
          <option value="없음">플랜 없음</option>
          {plans.map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>
      <DataTable columns={columns} data={filtered} rowKey={(r) => r.id} />
    </div>
  );
}
