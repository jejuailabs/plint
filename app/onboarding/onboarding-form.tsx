'use client';

import { ArrowRight, Building2, Home, Landmark, LoaderCircle } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const segmentOptions = [
  { value: 'owner', title: '건축주', description: '내 땅의 가능성과 사업성을 빠르게 확인합니다.', icon: Home },
  { value: 'architect', title: '건축사·설계사', description: '대지 검토와 초기 설계 판단을 구조화합니다.', icon: Building2 },
  { value: 'platform', title: '부동산·개발 플랫폼', description: '여러 필지의 분석 결과를 서비스로 연결합니다.', icon: Landmark },
] as const;

type Segment = (typeof segmentOptions)[number]['value'];

export function OnboardingForm() {
  const [segment, setSegment] = useState<Segment>('owner');
  const [companyName, setCompanyName] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment, companyName: companyName.trim() || null }),
      });
      if (!response.ok) throw new Error('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      window.location.assign('/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '설정을 저장하지 못했습니다.');
      setIsPending(false);
    }
  }

  return (
    <form className="mt-8" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-3">
        {segmentOptions.map(({ value, title, description, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setSegment(value)}
            aria-pressed={segment === value}
            className={`rounded-2xl border p-4 text-left transition ${segment === value ? 'border-cyan-300/50 bg-cyan-300/10' : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.07]'}`}
          >
            <Icon className={`size-4 ${segment === value ? 'text-cyan-200' : 'text-slate-400'}`} />
            <p className="mt-6 text-sm font-medium">{title}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
          </button>
        ))}
      </div>
      <label className="mt-6 block text-xs text-slate-400" htmlFor="company-name">소속명 <span className="text-slate-600">(선택)</span></label>
      <Input id="company-name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="회사·사무소·플랫폼 이름" className="mt-2 h-11 border-white/10 bg-white/[0.035] text-white placeholder:text-slate-600" />
      {error ? <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="mt-6 h-11 w-full rounded-xl bg-lime-300 text-slate-950 hover:bg-lime-200">
        {isPending ? <LoaderCircle className="animate-spin" /> : <>워크스페이스 시작 <ArrowRight /></>}
      </Button>
    </form>
  );
}
