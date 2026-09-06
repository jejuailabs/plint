'use client';

import {
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  CreditCard,
  BarChart3,
  FileText,
  Settings,
};

interface SidebarItem {
  href: string;
  label: string;
  icon: string;
}

export function AdminSidebarClient({
  items,
  userEmail,
}: {
  items: readonly SidebarItem[];
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 flex-shrink-0 border-r border-border bg-muted/30 md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <ShieldCheck className="size-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">PLINT Admin</span>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {items.map((item) => {
          const Icon = iconMap[item.icon] ?? LayoutDashboard;
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
        <Link
          href="/dashboard"
          className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          워크스페이스로 돌아가기
        </Link>
      </div>
    </aside>
  );
}
