'use client';

import { ArrowRight, DatabaseZap, Layers3, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { SyntheticEvent, useState } from 'react';

import { LazyParcelScene } from '@/components/landing/lazy-parcel-scene';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';

const signals = [
  { label: '용도지역', value: '제2종 일반주거', tone: 'cyan' },
  { label: '예상 연면적', value: '1,284㎡', tone: 'lime' },
  { label: '데이터 신뢰도', value: '92%', tone: 'cyan' },
] as const;

export default function Home() {
  const [address, setAddress] = useState('서울특별시 성동구 성수동2가 277-17');
  const [submittedAddress, setSubmittedAddress] = useState(address);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = address.trim();
    if (normalized) {
      setSubmittedAddress(normalized);
      window.location.assign(`/analysis?address=${encodeURIComponent(normalized)}`);
    }
  }

  return (
    <main className="site-shell min-h-screen overflow-hidden text-white">
      <nav className="relative z-20 mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <a href="#top" className="flex items-center gap-3" aria-label="PLINT 홈">
          <span className="grid size-9 place-items-center rounded-xl border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_32px_rgba(64,228,255,.14)]">
            <Layers3 className="size-4 text-cyan-200" />
          </span>
          <span className="text-sm font-semibold tracking-[0.22em]">PLINT</span>
        </a>

        <div className="hidden items-center gap-8 text-[13px] text-slate-300 md:flex">
          <a className="transition hover:text-white" href="#intelligence">인텔리전스</a>
          <a className="transition hover:text-white" href="#outputs">결과물</a>
          <a className="transition hover:text-white" href="#data">데이터</a>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className={buttonVariants({
              variant: 'outline',
              className: 'h-9 border-white/15 bg-white/5 px-4 text-white hover:bg-white/10 hover:text-white',
            })}
          >
            Google 로그인
          </Link>
        </div>
      </nav>

      <section id="top" className="relative mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-[1440px] items-center gap-6 px-5 pb-12 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-12 lg:pb-16">
        <div className="relative z-10 max-w-2xl py-10 lg:py-0">
          <Badge className="mb-6 h-7 border border-cyan-300/20 bg-cyan-300/10 px-3 text-cyan-100" variant="outline">
            <span className="mr-1 size-1.5 rounded-full bg-lime-300 shadow-[0_0_14px_rgba(190,242,100,.9)]" />
            Parcel Intelligence System
          </Badge>

          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">From parcel to possibility</p>
          <h1 className="max-w-[760px] text-balance text-[clamp(3.35rem,6.8vw,7.4rem)] font-medium leading-[0.88] tracking-[-0.065em]">
            땅의 가능성을
            <span className="hero-gradient block">보이게 만들다.</span>
          </h1>

          <p className="mt-7 max-w-xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
            주소 하나로 필지, 법규, 시장, 위험 데이터를 결합하고 실제 설계로 이어지는 3D 개발 시나리오를 만듭니다.
          </p>

          <form onSubmit={handleSubmit} className="mt-9 max-w-xl rounded-2xl border border-white/12 bg-white/[0.065] p-2 shadow-[0_24px_90px_rgba(0,0,0,.32)] backdrop-blur-xl">
            <label className="sr-only" htmlFor="parcel-address">분석할 지번 또는 도로명주소</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="parcel-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="지번 또는 도로명주소를 입력하세요"
                className="h-12 flex-1 border-0 bg-transparent px-4 text-[15px] text-white shadow-none placeholder:text-slate-500 focus-visible:ring-0"
              />
              <Button type="submit" className="h-12 rounded-xl bg-lime-300 px-5 text-slate-950 hover:bg-lime-200">
                가능성 분석
                <ArrowRight className="ml-1 size-4" />
              </Button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-400">
            <span className="flex items-center gap-2"><DatabaseZap className="size-3.5 text-cyan-300" />20+ 공공데이터 통합</span>
            <span className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-cyan-300" />모든 수치의 출처 추적</span>
          </div>
        </div>

        <div className="relative z-0 min-h-[520px] lg:h-[min(76vh,820px)]">
          <div className="absolute inset-0 rounded-[32px] border border-white/10 bg-slate-950/35 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_40px_120px_rgba(0,0,0,.3)] backdrop-blur-sm" />
          <LazyParcelScene address={submittedAddress} />

          <div className="pointer-events-none absolute left-4 right-4 top-4 flex items-center justify-between sm:left-6 sm:right-6 sm:top-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Live parcel model</p>
              <p className="mt-1 max-w-[260px] truncate text-xs text-slate-300">{submittedAddress}</p>
            </div>
            <Badge variant="outline" className="border-lime-300/25 bg-lime-300/10 text-lime-200">SCENARIO A</Badge>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2 sm:bottom-6 sm:left-6 sm:right-6 sm:gap-3">
            {signals.map((signal) => (
              <div key={signal.label} className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 backdrop-blur-xl sm:px-4">
                <p className="truncate text-[9px] uppercase tracking-[0.14em] text-slate-500 sm:text-[10px]">{signal.label}</p>
                <p className={`mt-1 truncate text-xs font-medium sm:text-sm ${signal.tone === 'lime' ? 'text-lime-200' : 'text-cyan-100'}`}>{signal.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute -left-36 top-1/4 size-[420px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -right-44 bottom-0 size-[480px] rounded-full bg-blue-600/10 blur-[140px]" />
      </section>
    </main>
  );
}
