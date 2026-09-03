import { ArrowLeft, Layers3 } from 'lucide-react';
import Link from 'next/link';

import { LoginForm } from '@/app/login/login-form';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  return (
    <main className="site-shell grid min-h-screen place-items-center px-5 py-12 text-white">
      <div className="absolute right-5 top-5 sm:right-8 sm:top-8"><ThemeToggle /></div>
      <section className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/60 p-7 shadow-[0_40px_120px_rgba(0,0,0,.45)] backdrop-blur-xl sm:p-9">
        <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <Link href="/" className="relative inline-flex items-center gap-2 text-xs text-slate-400 transition hover:text-white">
          <ArrowLeft className="size-3.5" />
          홈으로
        </Link>

        <div className="relative mt-10 grid size-11 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10">
          <Layers3 className="size-5 text-cyan-200" />
        </div>
        <p className="relative mt-7 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">PLINT Workspace</p>
        <h1 className="relative mt-3 text-3xl font-medium tracking-[-0.04em]">프로젝트를 이어가세요.</h1>
        <p className="relative mt-3 text-sm leading-6 text-slate-400">
          분석 대상과 결과물을 안전하게 저장하려면 Google 계정으로 로그인하세요.
        </p>

        <LoginForm />

        <p className="relative mt-6 text-center text-[11px] leading-5 text-slate-500">
          로그인하면 서비스 이용약관과 개인정보 처리방침에 동의한 것으로 간주됩니다.
        </p>
      </section>
    </main>
  );
}
