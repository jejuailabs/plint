'use client';

import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Database,
  Download,
  Layers3,
  LoaderCircle,
  MapPinned,
  RefreshCw,
  Ruler,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { LazyParcelScene } from '@/components/landing/lazy-parcel-scene';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import type {
  AnalysisPreviewResponse,
  DevelopmentScenario,
} from '@/lib/domain/parcel-intelligence';

const fallbackAddress = '서울특별시 성동구 성수동2가 277-17';

function formatKrw(value: number) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억원`;
  if (value >= 10_000)
    return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만원`;
  return `${value.toLocaleString('ko-KR')}원`;
}

function ScenarioButton({
  scenario,
  active,
  onClick,
}: {
  scenario: DevelopmentScenario;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[132px] rounded-xl border px-4 py-3 text-left transition ${active ? 'border-lime-300/45 bg-lime-300/10 shadow-[0_0_28px_rgba(190,242,100,.08)]' : 'border-white/8 bg-white/[0.035] hover:bg-white/[0.06]'}`}
    >
      <span
        className={`block text-xs font-medium ${active ? 'text-lime-200' : 'text-slate-300'}`}
      >
        {scenario.name}
      </span>
      <span className="mt-1 block text-[10px] text-slate-500">
        용적률 {scenario.floorAreaRatio}%
      </span>
    </button>
  );
}

export function AnalysisWorkspace() {
  const [address, setAddress] = useState(fallbackAddress);
  const [query, setQuery] = useState(fallbackAddress);
  const [result, setResult] = useState<AnalysisPreviewResponse | null>(null);
  const [scenarioId, setScenarioId] = useState('balanced');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('필지 식별 정보를 확인하고 있습니다.');

  const analyze = useCallback(async (nextAddress: string) => {
    setStatus('loading');
    setMessage('공간정보와 규제 데이터를 결합하고 있습니다.');
    try {
      const response = await fetch('/api/analysis/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: nextAddress }),
      });
      const payload = (await response.json()) as AnalysisPreviewResponse & {
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(
          payload.error?.message ?? '분석을 완료하지 못했습니다.',
        );
      setResult(payload);
      setScenarioId('balanced');
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error ? error.message : '분석을 완료하지 못했습니다.',
      );
    }
  }, []);

  useEffect(() => {
    const initial =
      new URLSearchParams(window.location.search).get('address')?.trim() ||
      fallbackAddress;
    queueMicrotask(() => {
      setAddress(initial);
      setQuery(initial);
      void analyze(initial);
    });
  }, [analyze]);

  const scenario = useMemo(
    () =>
      result?.data.scenarios.find((item) => item.id === scenarioId) ??
      result?.data.scenarios[0],
    [result, scenarioId],
  );

  function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) return;
    setAddress(normalized);
    window.history.replaceState(
      null,
      '',
      `/analysis?address=${encodeURIComponent(normalized)}`,
    );
    void analyze(normalized);
  }

  return (
    <main className="site-shell min-h-screen text-white">
      <header className="analysis-header sticky top-0 z-30 border-b border-white/8 bg-[#07101c]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5"
            aria-label="홈으로 돌아가기"
          >
            <ArrowLeft className="size-4 text-slate-300" />
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <Layers3 className="size-4 text-cyan-300" />
            <span className="text-xs font-semibold tracking-[0.2em]">
              PLINT
            </span>
          </div>
          <form
            onSubmit={submit}
            className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1.5"
          >
            <MapPinned className="ml-2 size-4 shrink-0 text-cyan-300" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 border-0 bg-transparent text-sm text-white focus-visible:ring-0"
              aria-label="분석 주소"
            />
            <Button
              type="submit"
              size="sm"
              className="h-9 bg-cyan-300 px-4 text-slate-950 hover:bg-cyan-200"
            >
              재분석
            </Button>
          </form>
          <ThemeToggle />
          <Link
            href={`/report?address=${encodeURIComponent(address)}`}
            className="grid size-9 place-items-center rounded-lg border border-lime-300/25 bg-lime-300/10 text-lime-200 transition hover:bg-lime-300/15"
            aria-label="의사결정 보고서 미리보기"
          >
            <Download className="size-4" />
          </Link>
        </div>
      </header>

      {status === 'loading' && (
        <div className="grid min-h-[calc(100vh-64px)] place-items-center px-6">
          <div className="text-center">
            <LoaderCircle className="mx-auto size-8 animate-spin text-cyan-300" />
            <p className="mt-5 text-sm text-slate-300">{message}</p>
            <p className="mt-2 text-xs text-slate-600">
              주소 → PNU → 필지 → 규제 → 시장 → 시나리오
            </p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="grid min-h-[calc(100vh-64px)] place-items-center px-6">
          <Card className="max-w-md border border-rose-400/20 bg-rose-400/5 text-white">
            <CardContent className="flex flex-col items-center py-8 text-center">
              <AlertTriangle className="size-8 text-rose-300" />
              <p className="mt-4 text-sm">{message}</p>
              <Button className="mt-5" onClick={() => void analyze(address)}>
                <RefreshCw />
                다시 시도
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {status === 'ready' && result && scenario && (
        <div className="mx-auto grid max-w-[1600px] gap-4 p-4 sm:p-6 xl:grid-cols-[310px_minmax(0,1fr)_330px]">
          <aside className="space-y-4">
            <Card className="border border-white/8 bg-white/[0.035] text-white">
              <CardHeader className="border-b border-white/8">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      Parcel identity
                    </p>
                    <CardTitle className="mt-2 text-base">
                      {result.data.identity.jibunAddress.value}
                    </CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-cyan-300/20 bg-cyan-300/8 text-cyan-200"
                  >
                    MOCK
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 pt-1">
                <Metric
                  icon={Ruler}
                  label="대지면적"
                  value={`${result.data.geometry.areaSqm.value?.toLocaleString('ko-KR')}㎡`}
                />
                <Metric
                  icon={Building2}
                  label="지목"
                  value={result.data.geometry.landCategory.value ?? '-'}
                />
                <Metric
                  icon={MapPinned}
                  label="도로 폭"
                  value={`약 ${result.data.geometry.roadWidthM.value}m`}
                />
                <Metric
                  icon={TrendingUp}
                  label="경사"
                  value={`${result.data.geometry.slopePercent.value}%`}
                />
              </CardContent>
            </Card>

            <Card className="border border-white/8 bg-white/[0.035] text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ShieldCheck className="size-4 text-cyan-300" />
                  규제 검토
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.data.planning.map((constraint) => (
                  <div
                    key={constraint.code}
                    className="rounded-xl border border-white/8 bg-black/10 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-200">
                        {constraint.name}
                      </span>
                      <StatusBadge status={constraint.status} />
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                      {constraint.summary.value}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>

          <section className="analysis-scene-frame min-h-[620px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
            <div className="relative h-[520px] xl:h-[calc(100vh-205px)] xl:min-h-[620px]">
              <LazyParcelScene
                address={address}
                scenario={scenario}
                context={result.data.context}
              />
              <div className="pointer-events-none absolute left-5 top-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Interactive massing
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {scenario.name} 시나리오
                </p>
              </div>
              <div className="absolute bottom-5 left-5 right-5 flex gap-2 overflow-x-auto pb-1">
                {result.data.scenarios.map((item) => (
                  <ScenarioButton
                    key={item.id}
                    scenario={item}
                    active={item.id === scenario.id}
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <Card className="border border-lime-300/15 bg-lime-300/[0.045] text-white">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-4 text-lime-300" />
                    시나리오 요약
                  </span>
                  <span className="text-lime-200">
                    {scenario.floors.length}F
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SummaryRow
                  label="예상 연면적"
                  value={`${scenario.grossFloorAreaSqm.toLocaleString('ko-KR')}㎡`}
                />
                <SummaryRow
                  label="건폐율 / 용적률"
                  value={`${scenario.buildingCoverageRatio}% / ${scenario.floorAreaRatio}%`}
                />
                <SummaryRow
                  label="예상 매출"
                  value={formatKrw(scenario.estimatedRevenueKrw)}
                />
                <SummaryRow
                  label="예상 총사업비"
                  value={formatKrw(scenario.estimatedCostKrw)}
                />
                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-xs text-slate-400">개략 수익률</span>
                  <span
                    className={`text-lg font-semibold ${scenario.estimatedProfitRatePercent >= 0 ? 'text-lime-200' : 'text-rose-300'}`}
                  >
                    {scenario.estimatedProfitRatePercent}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-white/8 bg-white/[0.035] text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CircleDollarSign className="size-4 text-cyan-300" />
                  시장 근거
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SummaryRow
                  label="공시지가"
                  value={`${formatKrw(result.data.market.officialLandPricePerSqm.value ?? 0)}/㎡`}
                />
                <SummaryRow
                  label="유사사례 중앙값"
                  value={`${formatKrw(result.data.market.comparableMedianPerSqm.value ?? 0)}/㎡`}
                />
                <SummaryRow
                  label="비교 표본"
                  value={`${result.data.market.comparableCount.value}건`}
                />
                <SummaryRow
                  label="12개월 추세"
                  value={`+${result.data.market.trendPercent.value}%`}
                />
              </CardContent>
            </Card>

            <Card className="border border-white/8 bg-white/[0.035] text-white">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Database className="size-4 text-cyan-300" />
                    데이터 커버리지
                  </span>
                  <span className="text-cyan-200">
                    {result.data.coverage.percent}%
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-lime-300"
                    style={{ width: `${result.data.coverage.percent}%` }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                  <span>검증 {result.data.coverage.verifiedFacts}</span>
                  <span>계산 {result.data.coverage.derivedFacts}</span>
                  <span>추정 {result.data.coverage.estimatedFacts}</span>
                  <span>미연결 {result.data.coverage.missingFacts}</span>
                </div>
                <button className="mt-4 flex w-full items-center justify-between border-t border-white/8 pt-3 text-xs text-slate-400 hover:text-white">
                  <span>근거와 경고 모두 보기</span>
                  <ChevronRight className="size-3.5" />
                </button>
              </CardContent>
            </Card>

            <Link
              href={`/report?address=${encodeURIComponent(address)}`}
              className="block rounded-2xl border border-lime-300/20 bg-lime-300/[0.07] p-4 transition hover:bg-lime-300/[0.12]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-lime-200">
                  PLINT Decision Report
                </span>
                <ChevronRight className="size-4 text-lime-200" />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                고객에게 바로 보여줄 수 있는 개발·상권 보고서 미리보기
              </p>
            </Link>

            <p className="px-1 text-[10px] leading-4 text-slate-600">
              본 결과는 사전검토용 개략 분석이며 인허가, 감정평가 또는 전문
              용역을 대체하지 않습니다.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ruler;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/10 p-3">
      <Icon className="size-3.5 text-cyan-300" />
      <p className="mt-3 text-[10px] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-200">{value}</span>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: 'confirmed' | 'conditional' | 'review_required';
}) {
  if (status === 'confirmed')
    return (
      <span className="flex items-center gap-1 text-[9px] text-cyan-200">
        <CheckCircle2 className="size-3" />
        확인
      </span>
    );
  if (status === 'conditional')
    return (
      <span className="flex items-center gap-1 text-[9px] text-amber-200">
        <AlertTriangle className="size-3" />
        조건부
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[9px] text-slate-400">
      <ShieldCheck className="size-3" />
      검토필요
    </span>
  );
}
