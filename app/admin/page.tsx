import { ArrowLeft, Database, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (user.app_metadata?.role !== 'admin') redirect('/dashboard');

  return (
    <main className="site-shell min-h-screen px-5 py-6 text-white sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
          <ArrowLeft className="size-4" /> 워크스페이스
        </Link>
        <ThemeToggle />
      </header>
      <section className="mx-auto mt-16 max-w-6xl">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl border border-lime-300/35 bg-lime-300/10"><ShieldCheck className="size-5 text-lime-200" /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-200/80">PLINT Control</p>
            <h1 className="mt-1 text-3xl font-medium tracking-[-0.04em] sm:text-4xl">관리자 콘솔</h1>
          </div>
        </div>
        <p className="mt-5 max-w-2xl leading-7 text-slate-300">관리자 권한이 확인된 계정만 접근할 수 있습니다. 운영 데이터와 고객 기능은 실제 API 연결 후 이 콘솔에서 관리합니다.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <AdminCard icon={<Users className="size-5" />} title="사용자 관리" description="가입 사용자, 권한, 세그먼트 현황" status="구현 예정" />
          <AdminCard icon={<Database className="size-5" />} title="데이터 운영" description="커넥터 상태, 수집 이력, 데이터 커버리지" status="구현 예정" />
          <AdminCard icon={<ShieldCheck className="size-5" />} title="권한 상태" description={`${user.email ?? '현재 계정'} · 관리자 권한 확인됨`} status="정상" />
        </div>
      </section>
    </main>
  );
}

function AdminCard({ icon, title, description, status }: { icon: ReactNode; title: string; description: string; status: string }) {
  return <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6"><div className="flex items-center justify-between"><span className="text-cyan-200">{icon}</span><span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-xs text-slate-300">{status}</span></div><h2 className="mt-8 text-lg font-semibold">{title}</h2><p className="mt-2 leading-6 text-sm text-slate-400">{description}</p></section>;
}
