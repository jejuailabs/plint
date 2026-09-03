'use client';

import { Layers3, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';

import { LoginForm } from '@/app/login/login-form';
import { createClient } from '@/lib/supabase/browser';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function AuthNav() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }

  if (!user) {
    return (
      <Dialog>
        <DialogTrigger render={<button type="button" className="h-9 rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10" />}>
          Google 로그인
        </DialogTrigger>
        <DialogContent className="auth-modal w-[min(100%-2rem,430px)] rounded-[28px] border border-white/10 bg-[#091522]/95 p-7 text-white shadow-[0_35px_100px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-8">
          <DialogHeader className="gap-0">
            <div className="grid size-11 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10">
              <Layers3 className="size-5 text-cyan-200" />
            </div>
            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">PLINT Workspace</p>
            <DialogTitle className="mt-3 text-3xl tracking-[-0.04em] text-white">프로젝트를 이어가세요.</DialogTitle>
            <DialogDescription className="mt-3 leading-6 text-slate-400">분석 대상과 결과물을 안전하게 저장하려면 Google 계정으로 로그인하세요.</DialogDescription>
          </DialogHeader>
          <LoginForm />
          <p className="text-center text-[11px] leading-5 text-slate-500">로그인하면 서비스 이용약관과 개인정보 처리방침에 동의한 것으로 간주됩니다.</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {user.app_metadata?.role === 'admin' && (
        <Link href="/admin" className="grid size-9 place-items-center rounded-lg border border-lime-300/25 bg-lime-300/10 text-lime-200 transition hover:bg-lime-300/15" aria-label="관리자 콘솔">
          <ShieldCheck className="size-4" />
        </Link>
      )}
      <Link href="/dashboard" className="inline-flex h-9 items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15">
        <LayoutDashboard className="size-3.5" />
        워크스페이스
      </Link>
      <button type="button" onClick={() => void signOut()} className="grid size-9 place-items-center rounded-lg border border-white/12 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="로그아웃">
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
