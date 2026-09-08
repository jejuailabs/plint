import { Layers3 } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ThemeToggle } from '@/components/theme-toggle';
import { SiteCardGrid } from '@/components/dashboard/site-card-grid';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect('/login');

  return (
    <main className="site-shell min-h-screen px-5 py-6 text-white sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl border border-cyan-300/35 bg-cyan-300/10"><Layers3 className="size-4 text-cyan-200" /></span><span className="text-sm font-semibold tracking-[0.22em]">PLINT</span></Link>
        <ThemeToggle />
      </header>
      <section className="mx-auto mt-20 max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Your workspace</p>
        <h1 className="mt-4 text-4xl font-medium tracking-[-0.05em] sm:text-6xl">개발 검토를 시작하세요.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">새 주소를 분석하거나, 저장된 프로젝트와 산출물을 이곳에서 관리합니다.</p>
        <div className="mt-10">
          <SiteCardGrid />
        </div>
      </section>
    </main>
  );
}
