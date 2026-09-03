import { redirect } from 'next/navigation';

import { OnboardingForm } from '@/app/onboarding/onboarding-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect('/login');

  return (
    <main className="site-shell grid min-h-screen place-items-center px-5 py-12 text-white">
      <section className="auth-surface w-full max-w-2xl rounded-[28px] border border-white/10 bg-slate-950/60 p-7 shadow-[0_40px_120px_rgba(0,0,0,.45)] backdrop-blur-xl sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">PLINT Setup</p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.045em]">어떤 관점으로 시작하시나요?</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">프로젝트에 맞는 분석 결과와 안내를 준비하기 위한 최초 1회 설정입니다.</p>
        <OnboardingForm />
      </section>
    </main>
  );
}
