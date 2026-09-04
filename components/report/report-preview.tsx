'use client';

import {
  AlertTriangle, ArrowLeft, ArrowRight, Building2, Check, ChevronRight,
  Download, FileChartColumnIncreasing, LoaderCircle, LockKeyhole,
  MapPinned, ShieldCheck, Sparkles, TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { LazyParcelScene } from '@/components/landing/lazy-parcel-scene';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AnalysisPreviewResponse } from '@/lib/domain/parcel-intelligence';
import type { Fact } from '@/lib/domain/evidence';

const fallbackAddress = '제주특별자치도 제주시 연동 273-15';

function formatKrw(value: number) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억원`;
  return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만원`;
}

function confidenceLabel(fact: Fact<unknown>) {
  const confidence = fact.evidence[0]?.confidence ?? 'missing';
  return confidence === 'verified' ? '원천 확인' : confidence === 'derived' ? '계산값' : confidence === 'estimated' ? '추정값' : '연결 예정';
}

export function ReportPreview() {
  const [address, setAddress] = useState(fallbackAddress);
  const [result, setResult] = useState<AnalysisPreviewResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [paywallOpen, setPaywallOpen] = useState(false);

  const analyze = useCallback(async (nextAddress: string) => {
    setStatus('loading');
    try {
      const response = await fetch('/api/analysis/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: nextAddress }),
      });
      const payload = await response.json() as AnalysisPreviewResponse;
      if (!response.ok) throw new Error('리포트 미리보기를 생성하지 못했습니다.');
      setResult(payload);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('address')?.trim() || fallbackAddress;
    setAddress(initial);
    void analyze(initial);
  }, [analyze]);

  const scenario = useMemo(
    () => result?.data.scenarios.find((item) => item.strategy === 'balanced') ?? result?.data.scenarios[0],
    [result],
  );

  if (status === 'loading') return <LoadingReport />;
  if (status === 'error' || !result || !scenario) return <ErrorReport address={address} />;

  const { data, meta } = result;
  const recommendation = `권장안은 ${scenario.name}입니다. 개략 연면적 ${scenario.grossFloorAreaSqm.toLocaleString('ko-KR')}㎡를 기준으로, 필지 조건·시장 비교·개발 효율을 함께 검토한 사전 의사결정안입니다.`;
  const evidenceRows: Array<{ label: string; item: Fact<unknown> }> = [
    { label: '필지·좌표', item: data.identity.center as Fact<unknown> },
    { label: '공시지가', item: data.market.officialLandPricePerSqm as Fact<unknown> },
    { label: '실거래 비교', item: data.market.comparableMedianPerSqm as Fact<unknown> },
    ...(data.planning[0] ? [{ label: '용도지역', item: data.planning[0].summary as Fact<unknown> }] : []),
  ];

  return (
    <main className="site-shell min-h-screen pb-24 text-white">
      <header className="analysis-header sticky top-0 z-30 border-b border-white/8 bg-[#07101c]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={`/analysis?address=${encodeURIComponent(address)}`} className="flex shrink-0 items-center gap-2 text-sm text-slate-300 transition hover:text-white"><ArrowLeft className="size-4" /> <span className="hidden sm:inline">분석 화면</span></Link>
          <div className="min-w-0 text-center"><p className="truncate text-xs font-semibold tracking-[0.18em] text-white">PLINT DECISION REPORT</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{address}</p></div>
          <div className="flex items-center gap-2"><ThemeToggle /><Button onClick={() => setPaywallOpen(true)} className="h-9 bg-lime-300 px-3 text-xs text-slate-950 hover:bg-lime-200 sm:px-4"><Download className="size-3.5" /> <span className="hidden sm:inline">전체 보고서</span></Button></div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 sm:py-10">
        <div className="report-paper overflow-hidden rounded-[28px] border border-white/10 bg-[#0a1624] shadow-[0_30px_100px_rgba(0,0,0,.35)]">
          <section className="relative overflow-hidden border-b border-white/10 px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
            <div className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-cyan-400/15 blur-[100px]" />
            <div className="relative grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200"><Sparkles className="size-3.5" /> Preliminary decision brief</div>
                <p className="mt-7 text-sm text-slate-400">개발·매입·임대·MD 의사결정을 위한 통합 사전검토</p>
                <h1 className="mt-3 max-w-3xl text-3xl font-medium leading-[1.08] tracking-[-0.055em] text-white sm:text-5xl">주소 하나로, 다음 결정을<br /><span className="text-cyan-200">보이게 만듭니다.</span></h1>
                <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">{recommendation}</p>
                <div className="mt-8 flex flex-wrap gap-3 text-xs"><Pill icon={MapPinned} label="분석 대상" value={data.identity.jibunAddress.value} /><Pill icon={ShieldCheck} label="데이터 커버리지" value={`${data.coverage.percent}%`} /></div>
              </div>
              <div className="rounded-2xl border border-lime-300/20 bg-lime-300/[0.07] p-5 sm:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-lime-200">Recommendation</p>
                <div className="mt-5 flex items-end justify-between gap-4"><div><p className="text-xl font-semibold text-white">{scenario.name}</p><p className="mt-2 text-sm text-slate-400">개발 규모·사업성·공간 품질의 균형안</p></div><span className="text-3xl font-semibold tracking-[-0.06em] text-lime-200">{scenario.floors.length}F</span></div>
                <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5"><MiniMetric label="연면적" value={`${scenario.grossFloorAreaSqm.toLocaleString('ko-KR')}㎡`} /><MiniMetric label="예상 매출" value={formatKrw(scenario.estimatedRevenueKrw)} /><MiniMetric label="개략 수익률" value={`${scenario.estimatedProfitRatePercent}%`} tone="lime" /></div>
              </div>
            </div>
          </section>

          <section className="grid border-b border-white/10 lg:grid-cols-[1.05fr_.95fr]">
            <div className="min-h-[470px] border-b border-white/10 bg-[#06101d] lg:border-b-0 lg:border-r">
              <div className="relative h-[470px]"><LazyParcelScene address={address} scenario={scenario} context={data.context} /><div className="pointer-events-none absolute left-6 top-6"><p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Development envelope</p><p className="mt-1 text-sm font-medium text-white">{scenario.name} · 개략 매스 청사진</p></div><div className="pointer-events-none absolute bottom-6 left-6 rounded-xl border border-white/10 bg-slate-950/75 px-4 py-3 backdrop-blur"><p className="text-[10px] text-slate-500">필지 면적</p><p className="mt-1 text-sm font-medium text-cyan-100">{data.geometry.areaSqm.value?.toLocaleString('ko-KR')}㎡</p></div></div>
            </div>
            <div className="p-6 sm:p-9">
              <SectionHeading eyebrow="01 / Executive answer" title="이 필지는 무엇을 할 수 있는가" />
              <p className="mt-5 text-sm leading-7 text-slate-300">{data.planning[0]?.summary.value} 조건을 기준으로, 도로 접면과 주변 맥락을 반영해 개발 가능 범위를 산정했습니다. 확정 인허가 전에는 정밀 법규 검토가 필요합니다.</p>
              <div className="mt-8 grid grid-cols-2 gap-3"><MetricBox icon={Building2} label="용도지역" value={data.planning[0]?.name ?? '-'} /><MetricBox icon={TrendingUp} label="12개월 가격 추세" value={`+${data.market.trendPercent.value}%`} /><MetricBox icon={MapPinned} label="도로 폭" value={`약 ${data.geometry.roadWidthM.value}m`} /><MetricBox icon={ShieldCheck} label="확인 필요 항목" value={`${data.risks.filter((risk) => risk.level !== 'low').length}건`} tone="amber" /></div>
              <button onClick={() => setPaywallOpen(true)} className="mt-7 flex w-full items-center justify-between rounded-xl border border-cyan-300/20 bg-cyan-300/8 px-4 py-3 text-left transition hover:bg-cyan-300/13"><span><span className="block text-xs font-medium text-cyan-100">도면·규제 레이어 전체 보기</span><span className="mt-1 block text-[11px] text-slate-500">필지 경계, 도로, 규제, 일조 검토 근거 포함</span></span><LockKeyhole className="size-4 text-cyan-200" /></button>
            </div>
          </section>

          <section className="px-6 py-9 sm:px-10 lg:px-14 lg:py-12">
            <SectionHeading eyebrow="02 / Scenario comparison" title="세 가지 개발안, 한 번에 비교" />
            <div className="mt-7 overflow-hidden rounded-2xl border border-white/10"><div className="grid grid-cols-[1.25fr_repeat(3,1fr)] bg-white/[0.045] text-[11px] text-slate-500"><div className="p-4">시나리오</div>{data.scenarios.map((item) => <div key={item.id} className={`p-4 text-center ${item.id === scenario.id ? 'bg-lime-300/[0.08] text-lime-200' : ''}`}>{item.name}</div>)}</div><ScenarioRow label="예상 연면적" values={data.scenarios.map((item) => `${item.grossFloorAreaSqm.toLocaleString('ko-KR')}㎡`)} /><ScenarioRow label="건폐율 / 용적률" values={data.scenarios.map((item) => `${item.buildingCoverageRatio}% / ${item.floorAreaRatio}%`)} /><ScenarioRow label="예상 매출" values={data.scenarios.map((item) => formatKrw(item.estimatedRevenueKrw))} highlight /><ScenarioRow label="개략 수익률" values={data.scenarios.map((item) => `${item.estimatedProfitRatePercent}%`)} /></div>
          </section>

          <section className="grid border-y border-white/10 lg:grid-cols-2">
            <div className="p-6 sm:p-9 lg:border-r lg:border-white/10"><SectionHeading eyebrow="03 / Evidence ledger" title="수치마다 남는 근거" /><div className="mt-7 divide-y divide-white/8 rounded-2xl border border-white/10 bg-black/10">{evidenceRows.map(({ label, item }) => <div key={label} className="flex items-center justify-between gap-4 p-4"><div><p className="text-sm font-medium text-slate-200">{label}</p><p className="mt-1 text-[11px] text-slate-500">{item.evidence[0]?.provider ?? '연결 예정'} · {item.evidence[0]?.datasetId ?? '데이터셋 지정 예정'}</p></div><span className="shrink-0 rounded-full border border-cyan-300/15 bg-cyan-300/8 px-2.5 py-1 text-[10px] text-cyan-200">{confidenceLabel(item)}</span></div>)}</div><p className="mt-4 text-[11px] leading-5 text-slate-500">전체 보고서에는 원천 링크, 조회시각, 가정식, 경고와 수치별 신뢰도를 포함합니다.</p></div>
            <div className="p-6 sm:p-9"><SectionHeading eyebrow="04 / Decision risks" title="지금 확인할 변수" /><div className="mt-7 space-y-3">{data.risks.map((risk) => <div key={risk.code} className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-4"><RiskDot level={risk.level} /><div><div className="flex items-center gap-2"><p className="text-sm font-medium text-slate-200">{risk.label}</p><span className="text-[10px] text-slate-500">{risk.level === 'unknown' ? '데이터 연결 필요' : risk.level === 'medium' ? '추가 검토' : '낮음'}</span></div><p className="mt-1.5 text-xs leading-5 text-slate-500">{risk.nextAction ?? risk.finding.warnings[0] ?? risk.finding.value}</p></div></div>)}</div></div>
          </section>

          <section className="relative overflow-hidden px-6 py-10 sm:px-10 lg:px-14 lg:py-14"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_0%,rgba(34,211,238,.13),transparent_34%)]" /><div className="relative grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center"><div><div className="flex items-center gap-2 text-xs font-semibold text-lime-200"><LockKeyhole className="size-4" /> Full decision package</div><h2 className="mt-4 text-2xl font-medium tracking-[-0.045em] text-white sm:text-3xl">고객 앞에서 바로 열 수 있는<br />전문 보고서를 완성합니다.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-slate-400">PDF, Excel 원천데이터, 상세 법규 검토, 상권·수요 분석, 투자비 민감도, 3D GLB·SketchUp 산출물을 하나의 패키지로 제공합니다.</p></div><div className="rounded-2xl border border-lime-300/20 bg-lime-300/[0.06] p-6"><div className="space-y-3">{['표지·의사결정 요약 PDF', '법규·시장·상권 근거 부록', '수익성·민감도 Excel', '3D GLB / SketchUp 산출물'].map((item) => <p key={item} className="flex items-center gap-2 text-sm text-slate-200"><Check className="size-4 text-lime-200" />{item}</p>)}</div><Button onClick={() => setPaywallOpen(true)} className="mt-7 h-11 w-full bg-lime-300 text-slate-950 hover:bg-lime-200">전체 보고서 잠금 해제 <ArrowRight /></Button></div></div></section>
        </div>
        <p className="mx-auto mt-4 max-w-[1480px] px-2 text-[10px] leading-5 text-slate-500">미리보기는 사전 검토용이며 현재 {meta.mode === 'mock' ? '샘플 데이터' : '연결 데이터'}를 포함합니다. 인허가, 감정평가, 설계도서 또는 전문 용역을 대체하지 않습니다.</p>
      </div>

      <Dialog open={paywallOpen} onOpenChange={setPaywallOpen}>
        <DialogContent className="auth-modal w-[min(100%-2rem,480px)] rounded-[28px] border border-white/10 bg-[#091522]/95 p-7 text-white shadow-[0_35px_100px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-8"><DialogHeader><div className="grid size-11 place-items-center rounded-2xl border border-lime-300/30 bg-lime-300/10"><FileChartColumnIncreasing className="size-5 text-lime-200" /></div><p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-lime-200">PLINT Professional</p><DialogTitle className="mt-3 text-3xl tracking-[-0.04em] text-white">전체 보고서를<br />준비하고 있습니다.</DialogTitle><DialogDescription className="mt-3 leading-6 text-slate-400">결제 연결 후 이 화면에서 PDF·Excel·3D 산출물 패키지를 바로 생성·다운로드합니다.</DialogDescription></DialogHeader><div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300"><p className="font-medium text-white">포함 산출물</p><p className="mt-2">개발 타당성 보고서 · 상권 인텔리전스 · 근거 데이터 · 사업성 모델 · 3D 설계 패키지</p></div><Link href="/dashboard" className="mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-lime-300 px-4 text-sm font-medium text-slate-950 transition hover:bg-lime-200">워크스페이스에서 플랜 보기 <ChevronRight className="size-4" /></Link></DialogContent>
      </Dialog>
    </main>
  );
}

function LoadingReport() { return <main className="site-shell grid min-h-screen place-items-center text-white"><div className="text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-cyan-300" /><p className="mt-5 text-sm text-slate-300">주소를 의사결정 보고서로 구성하고 있습니다.</p><p className="mt-2 text-xs text-slate-500">필지 · 규제 · 시장 · 시나리오 · 근거</p></div></main>; }
function ErrorReport({ address }: { address: string }) { return <main className="site-shell grid min-h-screen place-items-center text-white"><div className="text-center"><AlertTriangle className="mx-auto size-8 text-rose-300" /><p className="mt-5 text-sm text-slate-300">리포트 미리보기를 만들지 못했습니다.</p><Link href={`/analysis?address=${encodeURIComponent(address)}`} className="mt-5 inline-flex items-center gap-2 text-sm text-cyan-200">분석 화면으로 돌아가기 <ChevronRight className="size-4" /></Link></div></main>; }
function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) { return <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">{eyebrow}</p><h2 className="mt-3 text-xl font-medium tracking-[-0.035em] text-white sm:text-2xl">{title}</h2></div>; }
function Pill({ icon: Icon, label, value }: { icon: typeof MapPinned; label: string; value: string | null }) { return <span className="flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs"><Icon className="size-3.5 shrink-0 text-cyan-300" /><span className="text-slate-500">{label}</span><span className="max-w-56 truncate text-slate-200">{value ?? '-'}</span></span>; }
function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: 'lime' }) { return <div><p className="text-[10px] text-slate-500">{label}</p><p className={`mt-1 text-sm font-semibold ${tone === 'lime' ? 'text-lime-200' : 'text-slate-100'}`}>{value}</p></div>; }
function MetricBox({ icon: Icon, label, value, tone }: { icon: typeof Building2; label: string; value: string; tone?: 'amber' }) { return <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4"><Icon className={`size-4 ${tone === 'amber' ? 'text-amber-200' : 'text-cyan-300'}`} /><p className="mt-3 text-[10px] text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-100">{value}</p></div>; }
function ScenarioRow({ label, values, highlight }: { label: string; values: string[]; highlight?: boolean }) { return <div className="grid grid-cols-[1.25fr_repeat(3,1fr)] border-t border-white/8 text-xs"><div className="p-4 text-slate-500">{label}</div>{values.map((value, index) => <div key={`${label}-${index}`} className={`p-4 text-center ${highlight ? 'font-medium text-cyan-100' : 'text-slate-300'}`}>{value}</div>)}</div>; }
function RiskDot({ level }: { level: 'low' | 'medium' | 'high' | 'unknown' }) { return <span className={`mt-1.5 size-2 shrink-0 rounded-full ${level === 'high' ? 'bg-rose-400' : level === 'medium' ? 'bg-amber-300' : level === 'low' ? 'bg-lime-300' : 'bg-slate-500'}`} />; }
