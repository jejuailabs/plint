'use client';

import {
  CreditCard, Layers3, LogOut, Settings, User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/browser';

type NavUser = {
  email: string;
  name: string;
  avatarUrl: string | null;
};

const navLinks = [
  { href: '/dashboard', label: '프로젝트' },
  { href: '/dashboard/billing', label: '설정' },
] as const;

export function DashboardNavbar({ user }: { user: NavUser }) {
  const router = useRouter();
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-white/8 bg-[#07101c]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_32px_rgba(64,228,255,.14)]">
            <Layers3 className="size-4 text-cyan-200" />
          </span>
          <span className="text-sm font-semibold tracking-[0.22em] text-white">PLINT</span>
        </Link>

        {/* Center nav links */}
        <div className="hidden items-center gap-8 text-[13px] text-slate-300 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none transition hover:opacity-80">
            <Avatar size="sm">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
              <AvatarFallback className="bg-cyan-300/20 text-[10px] text-cyan-200">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-64 border border-white/10 bg-[#0d1b2a] text-slate-200">
            <DropdownMenuLabel className="px-3 py-2">
              <p className="text-sm font-medium text-white">{user.name || '사용자'}</p>
              <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
              <Badge variant="outline" className="mt-2 border-cyan-300/20 bg-cyan-300/8 text-[10px] text-cyan-200">
                Free
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/8" />
            <DropdownMenuItem className="gap-2 px-3 py-1.5 text-slate-300 focus:bg-white/5 focus:text-white" onClick={() => router.push('/dashboard')}>
              <User className="size-3.5" />
              내 프로젝트
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 px-3 py-1.5 text-slate-300 focus:bg-white/5 focus:text-white" onClick={() => router.push('/dashboard/billing')}>
              <CreditCard className="size-3.5" />
              결제 관리
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 px-3 py-1.5 text-slate-300 focus:bg-white/5 focus:text-white" onClick={() => router.push('/dashboard/billing')}>
              <Settings className="size-3.5" />
              설정
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/8" />
            <DropdownMenuItem className="gap-2 px-3 py-1.5 text-slate-300 focus:bg-white/5 focus:text-white" onClick={handleSignOut}>
              <LogOut className="size-3.5" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
