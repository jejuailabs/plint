'use client';

import { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/admin/data-table';

interface SubscriptionRow {
  id: string;
  userEmail: string;
  userName: string;
  planName: string;
  planCode: string;
  status: string;
  currentPeriodEnd: string | null;
  remainingCredit: number;
  monthlyCredit: number;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

interface PaymentRow {
  id: string;
  userEmail: string;
  amount: number;
  status: string;
  portonePaymentId: string;
  paidAt: string | null;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  active: '활성',
  past_due: '연체',
  canceled: '취소',
  trialing: '체험',
};

const paymentStatusLabels: Record<string, string> = {
  paid: '결제완료',
  failed: '실패',
  canceled: '취소',
  refunded: '환불',
};

const subColumns: Column<SubscriptionRow>[] = [
  {
    key: 'userEmail',
    header: '사용자',
    render: (row) => (
      <div>
        <p className="font-medium">{row.userEmail}</p>
        {row.userName && <p className="text-xs text-muted-foreground">{row.userName}</p>}
      </div>
    ),
  },
  {
    key: 'planName',
    header: '플랜',
    render: (row) => <Badge variant="outline">{row.planName}</Badge>,
  },
  {
    key: 'status',
    header: '상태',
    render: (row) => {
      const s = row.status;
      const variant = s === 'active' ? 'default' : s === 'past_due' ? 'destructive' : 'secondary';
      const label = row.cancelAtPeriodEnd ? '해지예정' : statusLabels[s] ?? s;
      return <Badge variant={variant as 'default' | 'destructive' | 'secondary'}>{label}</Badge>;
    },
  },
  {
    key: 'currentPeriodEnd',
    header: '다음 결제일',
    render: (row) => (row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleDateString('ko-KR') : '-'),
  },
  {
    key: 'remainingCredit',
    header: '잔여 크레딧',
    render: (row) => `${row.remainingCredit} / ${row.monthlyCredit}`,
  },
];

const payColumns: Column<PaymentRow>[] = [
  {
    key: 'paidAt',
    header: '결제일',
    render: (row) => (row.paidAt ? new Date(row.paidAt).toLocaleDateString('ko-KR') : '-'),
  },
  {
    key: 'userEmail',
    header: '사용자',
    render: (row) => row.userEmail,
  },
  {
    key: 'amount',
    header: '금액',
    render: (row) => `${row.amount.toLocaleString()}원`,
  },
  {
    key: 'status',
    header: '상태',
    render: (row) => {
      const s = row.status;
      const variant = s === 'paid' ? 'default' : s === 'failed' ? 'destructive' : 'secondary';
      return <Badge variant={variant as 'default' | 'destructive' | 'secondary'}>{paymentStatusLabels[s] ?? s}</Badge>;
    },
  },
  {
    key: 'portonePaymentId',
    header: '포트원 결제ID',
    render: (row) => <span className="font-mono text-xs">{row.portonePaymentId}</span>,
  },
];

export function AdminBillingClient({
  subscriptions,
  payments,
}: {
  subscriptions: SubscriptionRow[];
  payments: PaymentRow[];
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tab, setTab] = useState<'subs' | 'payments'>('subs');

  const filteredSubs = useMemo(() => {
    if (statusFilter === 'all') return subscriptions;
    if (statusFilter === 'cancel_pending') return subscriptions.filter((s) => s.cancelAtPeriodEnd);
    return subscriptions.filter((s) => s.status === statusFilter);
  }, [subscriptions, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setTab('subs')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'subs' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          구독 현황
        </button>
        <button
          onClick={() => setTab('payments')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'payments' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          결제 내역
        </button>
      </div>

      {tab === 'subs' && (
        <div className="space-y-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">전체 상태</option>
            <option value="active">활성</option>
            <option value="cancel_pending">해지예정</option>
            <option value="past_due">연체</option>
            <option value="canceled">취소</option>
            <option value="trialing">체험</option>
          </select>
          <DataTable columns={subColumns} data={filteredSubs} rowKey={(r) => r.id} />
        </div>
      )}

      {tab === 'payments' && <DataTable columns={payColumns} data={payments} rowKey={(r) => r.id} />}
    </div>
  );
}
