'use client';

import {
  ArrowRight,
  Box,
  Building2,
  FileChartColumn,
  Layers3,
  MapPinned,
  MapPin,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import { AddressSearch, type AddressResult } from '@/components/address-search';
import { AuthNav } from '@/components/auth-nav';
import { LazyParcelScene } from '@/components/landing/lazy-parcel-scene';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';

const capabilities = [
  {
    index: '01',
    title: '필지의 사실을 읽습니다',
    body: '주소를 경계, 면적, 지목, 용도지역과 연결합니다. 값이 확보되지 않은 항목은 추정치처럼 보이지 않도록 출처와 상태를 함께 표시합니다.',
    icon: MapPinned,
  },
  {
    index: '02',
    title: '개발 가능성을 공간으로 봅니다',
    body: '건폐율·용적률·높이 조건을 같은 좌표 위에 놓고 여러 매스 시나리오를 비교합니다. 주변이 비어 있다면 그 빈 환경도 그대로 반영합니다.',
    icon: Box,
  },
  {
    index: '03',
    title: '판단 가능한 결과물로 정리합니다',
    body: '규제, 입지, 시장 근거와 3D 뷰를 하나의 보고서에 담습니다. 검토 회의와 고객 제안에 바로 쓸 수 있는 맥락을 만듭니다.',
    icon: FileChartColumn,
  },
] as const;

const sourceRows = [
  ['토지·건축 기초', '필지 경계 · 면적 · 지목 · 건축물대장'],
  ['공간 맥락', 'VWorld 지도 · 도시지형 · 3D 매스'],
  ['규제·사업성', '용도지역 · 건폐율 · 용적률 · 시나리오'],
  ['의사결정 결과물', '근거 요약 · 보고서 · 3D 모델 · 조감도'],
] as const;

export default function Home() {
  const [submittedAddress, setSubmittedAddress] = useState('');
  const [pendingResult, setPendingResult] = useState<AddressResult | null>(
    null,
  );
  const handleAddressSelect = useCallback(
    (result: AddressResult) => setPendingResult(result),
    [],
  );
  const dismiss = useCallback(() => setPendingResult(null), []);
  const confirmAnalysis = useCallback(() => {
    if (!pendingResult) return;
    const address = pendingResult.jibunAddress || pendingResult.roadAddress;
    setSubmittedAddress(address);
    setPendingResult(null);
    window.location.assign(`/analysis?address=${encodeURIComponent(address)}`);
  }, [pendingResult]);

  return (
    <main className="site-shell min-h-screen overflow-hidden text-white">
      <nav className="relative z-30 mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <a
          href="#top"
          className="flex items-center gap-3"
          aria-label="PLINT 홈"
        >
          <span className="grid size-9 place-items-center rounded-xl border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_32px_rgba(64,228,255,.14)]">
            <Layers3 className="size-4 text-cyan-200" />
          </span>
          <span className="text-sm font-semibold tracking-[0.22em]">PLINT</span>
        </a>
        <div className="hidden items-center gap-8 text-[13px] text-slate-300 md:flex">
          <a className="transition hover:text-white" href="#intelligence">
            인텔리전스
          </a>
          <a className="transition hover:text-white" href="#outputs">
            결과물
          </a>
          <a className="transition hover:text-white" href="#data">
            데이터
          </a>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AuthNav />
        </div>
      </nav>

      <section
        id="top"
        className="relative mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-[1440px] items-center gap-8 px-5 pb-16 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:px-12"
      >
        <div className="relative z-10 max-w-2xl py-10 lg:py-0">
          <Badge
            className="mb-6 h-7 border border-cyan-300/20 bg-cyan-300/10 px-3 text-cyan-100"
            variant="outline"
          >
            <span className="mr-1 size-1.5 rounded-full bg-lime-300 shadow-[0_0_14px_rgba(190,242,100,.9)]" />
            Parcel Intelligence System
          </Badge>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[.28em] text-cyan-200/80">
            From parcel to decision
          </p>
          <h1 className="max-w-[760px] text-balance text-[clamp(3.2rem,6.6vw,7.1rem)] font-medium leading-[.88] tracking-[-.065em]">
            한 필지의 판단을
            <span className="hero-gradient block">입체적으로.</span>
          </h1>
          <p className="mt-7 max-w-xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
            주소 하나를 필지·법규·입지·사업성의 공통 좌표로 연결합니다. PLINT는
            숫자를 나열하지 않고, 개발을 판단할 수 있는 공간과 근거를 만듭니다.
          </p>
          <div className="mt-9 max-w-xl rounded-2xl border border-white/12 bg-white/[.065] p-2 shadow-[0_24px_90px_rgba(0,0,0,.32)] backdrop-blur-xl">
            <AddressSearch
              onSelect={handleAddressSelect}
              placeholder="도로명, 지번, 건물명으로 분석 시작"
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <ScanSearch className="size-3.5 text-cyan-300" />
              주소부터 보고서까지 한 흐름
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-cyan-300" />
              값과 데이터 상태를 함께 표시
            </span>
          </div>
        </div>
        <div className="relative z-0 min-h-[520px] lg:h-[min(76vh,820px)]">
          <div className="absolute inset-0 rounded-[32px] border border-white/10 bg-slate-950/35 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_40px_120px_rgba(0,0,0,.3)] backdrop-blur-sm" />
          <LazyParcelScene address={submittedAddress} />
          <div className="pointer-events-none absolute left-5 right-5 top-5 flex items-center justify-between sm:left-7 sm:right-7 sm:top-7">
            <div>
              <p className="text-[10px] uppercase tracking-[.24em] text-slate-500">
                Spatial decision model
              </p>
              <p className="mt-1 text-xs text-slate-300">
                필지 · 환경 · 시나리오를 하나의 장면에서
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-lime-300/25 bg-lime-300/10 text-lime-200"
            >
              3D CONTEXT
            </Badge>
          </div>
          <div className="pointer-events-none absolute bottom-5 left-5 right-5 grid grid-cols-3 gap-2 sm:bottom-7 sm:left-7 sm:right-7 sm:gap-3">
            {['필지 경계', '규제 조건', '개발 시나리오'].map((label, index) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 backdrop-blur-xl sm:px-4"
              >
                <p className="text-[9px] uppercase tracking-[.14em] text-slate-500">
                  0{index + 1}
                </p>
                <p className="mt-1 truncate text-xs font-medium text-cyan-100 sm:text-sm">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute -left-36 top-1/4 size-[420px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -right-44 bottom-0 size-[480px] rounded-full bg-blue-600/10 blur-[140px]" />
      </section>

      <section
        id="intelligence"
        className="scroll-mt-12 border-y border-white/8 bg-[#091627]/55 py-24 sm:py-32"
      >
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.25em] text-cyan-300">
                Decision intelligence
              </p>
              <h2 className="mt-4 text-balance text-4xl font-medium leading-[.98] tracking-[-.045em] sm:text-6xl">
                좋은 분석은
                <br />한 장면에서 이해됩니다.
              </h2>
            </div>
            <p className="max-w-2xl self-end text-pretty text-lg leading-8 text-slate-300">
              PLINT의 화면은 데이터 대시보드가 아니라 현장 검토를 위한
              작업대입니다. 누락된 데이터는 누락되었다고 보여 주고, 실제 확보된
              근거만으로 시나리오를 계산합니다.
            </p>
          </div>
          <div className="mt-16 grid gap-px overflow-hidden rounded-[28px] border border-white/10 bg-white/10 md:grid-cols-3">
            {capabilities.map(({ index, title, body, icon: Icon }) => (
              <article
                key={index}
                className="group min-h-[310px] bg-[#0b192a] p-7 transition hover:bg-[#10243a] sm:p-9"
              >
                <div className="flex items-start justify-between">
                  <Icon className="size-6 text-cyan-300" />
                  <span className="font-mono text-xs text-slate-500">
                    {index}
                  </span>
                </div>
                <h3 className="mt-20 text-2xl font-medium tracking-[-.035em] text-white">
                  {title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-slate-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="outputs" className="scroll-mt-12 py-24 sm:py-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.25em] text-lime-300">
                From analysis to proposal
              </p>
              <h2 className="mt-4 text-balance text-4xl font-medium leading-[.98] tracking-[-.045em] sm:text-6xl">
                검토의 결과가
                <br />
                바로 제안의 재료가 됩니다.
              </h2>
            </div>
            <a
              href="#top"
              className="group inline-flex items-center gap-2 text-sm text-cyan-200 transition hover:text-white"
            >
              내 필지 분석하기{' '}
              <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </a>
          </div>
          <div className="mt-16 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            <div className="overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[radial-gradient(circle_at_70%_15%,rgba(34,211,238,.18),transparent_34%),linear-gradient(145deg,#142844,#081321_70%)] p-7 sm:p-10">
              <div className="flex items-center gap-3 text-cyan-200">
                <Sparkles className="size-5" />
                <span className="text-sm font-medium">
                  Development scenario studio
                </span>
              </div>
              <div className="mt-14 max-w-lg">
                <p className="text-[11px] uppercase tracking-[.22em] text-slate-400">
                  Three connected views
                </p>
                <h3 className="mt-3 text-3xl font-medium tracking-[-.04em] sm:text-4xl">
                  필지 위에서 만든 시나리오를
                  <br />
                  3D와 보고서로 이어갑니다.
                </h3>
              </div>
              <div className="mt-14 grid grid-cols-3 gap-3">
                {['3D 매스', '도시지형', '의사결정 보고서'].map(
                  (item, index) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/12 bg-slate-950/45 p-4"
                    >
                      <span className="text-[11px] text-lime-300">
                        0{index + 1}
                      </span>
                      <p className="mt-7 text-sm text-slate-100">{item}</p>
                    </div>
                  ),
                )}
              </div>
            </div>
            <div className="grid gap-5">
              <article className="rounded-[28px] border border-white/10 bg-white/[.035] p-7">
                <Building2 className="size-6 text-lime-300" />
                <h3 className="mt-12 text-xl font-medium">건축·개발 검토</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  높이, 층수, 건폐율과 용적률을 조절하며 가능한 매스를
                  비교합니다.
                </p>
              </article>
              <article className="rounded-[28px] border border-white/10 bg-white/[.035] p-7">
                <FileChartColumn className="size-6 text-cyan-300" />
                <h3 className="mt-12 text-xl font-medium">보고서·조감도</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  지도, 3D 매스, 도시지형, 근거와 요약을 같은 보고서에 담습니다.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section
        id="data"
        className="scroll-mt-12 border-y border-white/8 bg-[#071321] py-24 sm:py-32"
      >
        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:px-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.25em] text-cyan-300">
              Evidence, not decoration
            </p>
            <h2 className="mt-4 text-balance text-4xl font-medium leading-[.98] tracking-[-.045em] sm:text-6xl">
              근거가 보이는
              <br />
              개발 검토.
            </h2>
            <p className="mt-7 max-w-md text-base leading-7 text-slate-300">
              데이터를 가져오지 못한 경우에도 전체 결과를 숨기지 않습니다. 각
              영역의 연결 상태를 드러내어 다음 검토와 보완의 기준으로 남깁니다.
            </p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-[#0c1b2d] p-2 sm:p-4">
            {sourceRows.map(([label, detail], index) => (
              <div
                key={label}
                className="flex gap-4 border-b border-white/8 px-4 py-5 last:border-0 sm:px-6"
              >
                <span className="font-mono text-xs text-lime-300">
                  0{index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="mt-1 text-sm text-slate-400">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-28 sm:py-36">
        <div className="mx-auto max-w-[900px] px-5 text-center sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[.25em] text-cyan-300">
            Start with an address
          </p>
          <h2 className="mt-5 text-balance text-4xl font-medium leading-[.98] tracking-[-.05em] sm:text-6xl">
            다음 현장 검토를
            <br />
            PLINT에서 시작하세요.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-300">
            주소를 입력하면 필지의 사실부터 확인하고, 확보된 데이터로 개발
            시나리오를 만듭니다.
          </p>
          <div className="mx-auto mt-9 max-w-xl rounded-2xl border border-white/12 bg-white/[.065] p-2 shadow-[0_24px_90px_rgba(0,0,0,.32)] backdrop-blur-xl">
            <AddressSearch
              onSelect={handleAddressSelect}
              placeholder="검토할 주소를 입력하세요"
            />
          </div>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[150px]" />
      </section>

      {pendingResult && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="주소 확인"
          onClick={(event) => {
            if (event.target === event.currentTarget) dismiss();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') dismiss();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#0c1829] p-6 shadow-[0_40px_120px_rgba(0,0,0,.6)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">주소 확인</h3>
              <button
                type="button"
                onClick={dismiss}
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[.04] p-4">
              <div className="flex gap-3">
                <MapPin className="mt-.5 size-4 shrink-0 text-cyan-300" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {pendingResult.roadAddress || pendingResult.jibunAddress}
                  </p>
                  {pendingResult.roadAddress && pendingResult.jibunAddress && (
                    <p className="mt-1 text-xs text-slate-400">
                      {pendingResult.jibunAddress}
                    </p>
                  )}
                  {pendingResult.buildingName && (
                    <p className="mt-1 text-xs text-cyan-200/70">
                      {pendingResult.buildingName}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">
                    {pendingResult.zipCode}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              이 주소로 개발 사전검토 분석을 시작합니다.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={dismiss}
                className="flex-1 rounded-xl border border-white/10 bg-white/[.04] py-2.5 text-sm text-slate-300 hover:bg-white/[.08]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmAnalysis}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300 py-2.5 text-sm font-medium text-slate-950 hover:bg-cyan-200"
              >
                <Layers3 className="size-4" />
                분석 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
