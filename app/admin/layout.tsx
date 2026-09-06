import {
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { createClient } from '@/lib/supabase/server';
import { AdminSidebarClient } from '@/components/admin/admin-sidebar-client';

export const dynamic = 'force-dynamic';

const sidebarItems = [
  { href: '/admin', label: '대시보드', icon: 'LayoutDashboard' },
  { href: '/admin/users', label: '사용자 관리', icon: 'Users' },
  { href: '/admin/billing', label: '구독/결제', icon: 'CreditCard' },
  { href: '/admin/usage', label: 'API 사용량', icon: 'BarChart3' },
  { href: '/admin/content', label: '콘텐츠 관리', icon: 'FileText' },
  { href: '/admin/settings', label: '설정', icon: 'Settings' },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (user.app_metadata?.role !== 'admin') redirect('/dashboard');

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebarClient
        items={sidebarItems}
        userEmail={user.email ?? ''}
      />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
