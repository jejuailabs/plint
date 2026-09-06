'use client';

import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Box,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Database,
  Download,
  Globe2,
  Layers3,
  LoaderCircle,
  MapPinned,
  Minus,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { LazyAnalysisScene } from '@/components/analysis/lazy-analysis-scene';
import { LazyCesiumContext } from '@/components/analysis/lazy-cesium-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import type {
  AnalysisPreviewResponse,
  DevelopmentScenario,
} from '@/lib/domain/parcel-intelligence';

type SunlightData = {
  winterSolstice: { sunrise: string; sunset: string; daylightHours: number };
  summerSolstice: { sunrise: string; sunset: string; daylightHours: number };
  equinox: { sunrise: string; sunset: string; daylightHours: number };
  annualSunlightHoursEstimate: number;
  disclaimer: string;
};

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
        className={`block text-sm font-medium ${active ? 'text-lime-200' : 'text-slate-300'}`}
      >
        {scenario.name}
      </span>
      <span className="mt-1 block text-xs text-slate-500">
        용적률 {scenario.floorAreaRatio}%
      </span>
    </button>
  );
}

export function AnalysisWorkspace() {
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<AnalysisPreviewResponse | null>(null);
  const [scenarioId, setScenarioId] = useState('balanced');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [message, setMessage] = useState('');
  const [zoom, setZoom] = useState(100);
  const [sceneMode, setSceneMode] = useState<'massing' | 'context'>('massing');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [exportStatus, setExportStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);
  const [sunlight, setSunlight] = useState<SunlightData | null>(null);
  const [sunlightStatus, setSunlightStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const setWorkspaceZoom = useCallback((nextZoom: number) => {
    setZoom(Math.min(140, Math.max(80, nextZoom)));
  }, []);

  useEffect(() => {
    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setZoom((current) =>
        Math.min(140, Math.max(80, current + (event.deltaY < 0 ? 10 : -10))),
      );
    }

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

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
      const center = payload.data.identity.center.value;
      if (center) {
        setSunlightStatus('loading');
        fetch('/api/analysis/sunlight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: center.latitude, longitude: center.longitude }),
        })
          .then((r) => r.ok ? r.json() : Promise.reject())
          .then((data) => { setSunlight(data as SunlightData); setSunlightStatus('ready'); })
          .catch(() => setSunlightStatus('error'));
      }
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error ? error.message : '분석을 완료하지 못했습니다.',
      );
    }
  }, []);

  useEffect(() => {
    const initial =
      new URLSearchParams(window.location.search).get('address')?.trim() || '';
    if (initial) {
      setAddress(initial);
      setQuery(initial);
      void analyze(initial);
    }
  }, [analyze]);

  const scenario = useMemo(
    () =>
      result?.data.scenarios.find((item) => item.id === scenarioId) ??
      result?.data.scenarios[0],
    [result, scenarioId],
  );

  const saveToDb = useCallback(async () => {
    if (!result || saveStatus === 'saving') return;
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/analysis/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          result: result.data,
          coverage: result.data.coverage,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message ?? '저장 실패');
      }
      if (body?.data?.analysisId) setSavedAnalysisId(body.data.analysisId);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [result, address, saveStatus]);

  const exportBlender = useCallback(async () => {
    if (!result || !scenario || exportStatus === 'submitting') return;
    if (!savedAnalysisId) {
      setExportStatus('error');
      return;
    }
    setExportStatus('submitting');
    try {
      const boundary = result.data.geometry.boundary.value;
      const res = await fetch('/api/modeling/runpod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: savedAnalysisId,
          address: result.data.identity.jibunAddress.value,
          parcel: {
            areaSqm: result.data.geometry.areaSqm.value ?? 500,
            boundary: boundary?.coordinates[0]?.map(([lon, lat]: [number, number]) => ({ latitude: lat, longitude: lon })),
          },
          scenario: {
            id: scenario.id,
            label: scenario.name,
            floors: scenario.floors.length,
            buildingCoveragePercent: scenario.buildingCoverageRatio,
            floorAreaRatioPercent: scenario.floorAreaRatio,
          },
        }),
      });
      if (!res.ok) throw new Error('Blender 모델링 요청 실패');
      setExportStatus('submitted');
    } catch {
      setExportStatus('error');
    }
  }, [result, scenario, savedAnalysisId, exportStatus]);

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
    <main className="analysis-readable site-shell min-h-screen text-white">
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
              placeholder="지번 또는 도로명주소를 입력하세요"
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
          <div
            className="hidden items-center rounded-lg border border-white/10 bg-white/[0.045] p-1 sm:flex"
            aria-label="분석 화면 확대 및 축소"
          >
            <button
              type="button"
              onClick={() => setWorkspaceZoom(zoom - 10)}
              disabled={zoom <= 80}
              className="grid size-7 place-items-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="화면 축소"
              title="화면 축소"
            >
              <Minus className="size-3.5" />
            </button>
            <output className="min-w-10 text-center text-xs font-medium text-slate-200">
              {zoom}%
            </output>
            <button
              type="button"
              onClick={() => setWorkspaceZoom(zoom + 10)}
              disabled={zoom >= 140}
              className="grid size-7 place-items-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="화면 확대"
              title="화면 확대 (Ctrl + 마우스 휠)"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
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

      <div className="analysis-zoom-surface" style={{ zoom: `${zoom}%` }}>
        {status === 'idle' && (
          <div className="grid min-h-[calc(100vh-64px)] place-items-center px-6">
            <div className="w-full max-w-xl text-center">
              <MapPinned className="mx-auto size-10 text-cyan-300/60" />
              <h2 className="mt-5 text-xl font-semibold text-white">
                새 필지 분석
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                분석할 대지의 지번 또는 도로명주소를 입력하세요
              </p>
              <form
                onSubmit={submit}
                className="mx-auto mt-8 rounded-2xl border border-white/12 bg-white/[0.065] p-2 shadow-[0_24px_90px_rgba(0,0,0,.32)] backdrop-blur-xl"
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex flex-1 items-center gap-2 px-2">
                    <MapPinned className="size-4 shrink-0 text-cyan-300" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="지번 또는 도로명주소를 입력하세요"
                      className="h-12 flex-1 border-0 bg-transparent px-2 text-[15px] text-white shadow-none placeholder:text-slate-500 focus-visible:ring-0"
                      autoFocus
                      aria-label="분석 주소"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={!query.trim()}
                    className="h-12 rounded-xl bg-cyan-300 px-6 text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
                  >
                    <Sparkles className="mr-1 size-4" />
                    분석 시작
                  </Button>
                </div>
              </form>
              <p className="mt-4 text-xs text-slate-600">
                예: 서울특별시 강남구 역삼동 123-45
              </p>
            </div>
          </div>
        )}

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
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Parcel identity
                      </p>
                      <CardTitle className="mt-2 text-base">
                        {result.data.identity.jibunAddress.value}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        result.meta.mode === 'live'
                          ? 'border-lime-300/20 bg-lime-300/8 text-lime-200'
                          : result.meta.mode === 'hybrid'
                            ? 'border-amber-300/20 bg-amber-300/8 text-amber-200'
                            : 'border-cyan-300/20 bg-cyan-300/8 text-cyan-200'
                      }
                    >
                      {result.meta.mode === 'live' ? 'LIVE' : result.meta.mode === 'hybrid' ? 'HYBRID' : 'PREVIEW'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 pt-1">
                  <Metric
                    icon={Ruler}
                    label="대지면적"
                    value={result.data.geometry.areaSqm.value != null ? `${result.data.geometry.areaSqm.value.toLocaleString('ko-KR')}㎡` : '-'}
                  />
                  <Metric
                    icon={Building2}
                    label="지목"
                    value={result.data.geometry.landCategory.value ?? '-'}
                  />
                  <Metric
                    icon={MapPinned}
                    label="도로 폭"
                    value={result.data.geometry.roadWidthM.value != null ? `약 ${result.data.geometry.roadWidthM.value}m` : '미확인'}
                  />
                  <Metric
                    icon={TrendingUp}
                    label="경사"
                    value={result.data.geometry.slopePercent.value != null ? `${result.data.geometry.slopePercent.value}%` : '미확인'}
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
                        <span className="text-sm font-medium text-slate-200">
                          {constraint.name}
                        </span>
                        <StatusBadge status={constraint.status} />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {constraint.summary.value}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {sunlightStatus === 'loading' && (
                <Card className="border border-white/8 bg-white/[0.035] text-white">
                  <CardContent className="flex items-center gap-3 py-4">
                    <LoaderCircle className="size-4 animate-spin text-amber-300" />
                    <span className="text-xs text-slate-400">일조 분석 중...</span>
                  </CardContent>
                </Card>
              )}
              {sunlightStatus === 'ready' && sunlight && (
                <Card className="border border-white/8 bg-white/[0.035] text-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Sun className="size-4 text-amber-300" />
                      일조 분석 (사전검토용)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-xl border border-white/8 bg-black/10 p-3">
                      <p className="text-[10px] text-slate-500">동지 (12/22)</p>
                      <p className="mt-1 text-sm text-slate-200">
                        {sunlight.winterSolstice.sunrise} ~ {sunlight.winterSolstice.sunset}
                      </p>
                      <p className="text-xs text-slate-400">{sunlight.winterSolstice.daylightHours}시간</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/10 p-3">
                      <p className="text-[10px] text-slate-500">하지 (6/21)</p>
                      <p className="mt-1 text-sm text-slate-200">
                        {sunlight.summerSolstice.sunrise} ~ {sunlight.summerSolstice.sunset}
                      </p>
                      <p className="text-xs text-slate-400">{sunlight.summerSolstice.daylightHours}시간</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/10 p-3">
                      <p className="text-[10px] text-slate-500">춘분 (3/20)</p>
                      <p className="mt-1 text-sm text-slate-200">
                        {sunlight.equinox.sunrise} ~ {sunlight.equinox.sunset}
                      </p>
                      <p className="text-xs text-slate-400">{sunlight.equinox.daylightHours}시간</p>
                    </div>
                    <SummaryRow
                      label="연간 일조시간 (추정)"
                      value={`${sunlight.annualSunlightHoursEstimate.toLocaleString('ko-KR')}시간`}
                    />
                    <p className="text-[9px] leading-4 text-slate-600">{sunlight.disclaimer}</p>
                  </CardContent>
                </Card>
              )}
            </aside>

            <section className="analysis-scene-frame min-h-[620px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
              <div className="relative h-[520px] xl:h-[calc(100vh-205px)] xl:min-h-[620px]">
                {sceneMode === 'massing' ? (
                  <LazyAnalysisScene
                    address={address}
                    center={
                      result.data.identity.center.value ?? {
                        latitude: 37.5446,
                        longitude: 127.0558,
                      }
                    }
                    boundary={result.data.geometry.boundary}
                    areaSqm={result.data.geometry.areaSqm.value ?? 500}
                    scenario={scenario}
                    context={result.data.context}
                  />
                ) : (
                  <LazyCesiumContext
                    address={address}
                    center={
                      result.data.identity.center.value ?? {
                        latitude: 37.5446,
                        longitude: 127.0558,
                      }
                    }
                    areaSqm={result.data.geometry.areaSqm.value ?? undefined}
                    scenario={scenario}
                  />
                )}
                <div className="pointer-events-none absolute left-5 top-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {sceneMode === 'massing'
                      ? 'Interactive massing'
                      : 'Geographic context'}
                  </p>
                  <p className="mt-1 text-base font-medium text-white">
                    {sceneMode === 'massing'
                      ? `${scenario.name} 시나리오`
                      : '도시·지형 컨텍스트'}
                  </p>
                </div>
                <div className="absolute right-5 top-5 z-10 flex rounded-xl border border-white/10 bg-slate-950/70 p-1 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setSceneMode('massing')}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition ${sceneMode === 'massing' ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                  >
                    3D 매스
                  </button>
                  <button
                    type="button"
                    onClick={() => setSceneMode('context')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${sceneMode === 'context' ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                  >
                    <Globe2 className="size-3.5" />
                    도시·지형
                  </button>
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
                    value={result.data.market.officialLandPricePerSqm.value ? `${formatKrw(result.data.market.officialLandPricePerSqm.value)}/㎡` : '미연결'}
                  />
                  <SummaryRow
                    label="유사사례 중앙값"
                    value={result.data.market.comparableMedianPerSqm.value ? `${formatKrw(result.data.market.comparableMedianPerSqm.value)}/㎡` : '미연결'}
                  />
                  <SummaryRow
                    label="비교 표본"
                    value={result.data.market.comparableCount.value != null ? `${result.data.market.comparableCount.value}건` : '-'}
                  />
                  <SummaryRow
                    label="12개월 추세"
                    value={result.data.market.trendPercent.value != null ? `${result.data.market.trendPercent.value > 0 ? '+' : ''}${result.data.market.trendPercent.value}%` : '미연결'}
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
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
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

              <Button
                onClick={saveToDb}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] py-3 text-sm text-cyan-200 transition hover:bg-cyan-300/[0.12] disabled:opacity-60"
              >
                {saveStatus === 'saving' ? (
                  <><LoaderCircle className="size-4 animate-spin" /> 저장 중...</>
                ) : saveStatus === 'saved' ? (
                  <><CheckCircle2 className="size-4 text-lime-300" /> 저장 완료</>
                ) : saveStatus === 'error' ? (
                  <><Save className="size-4" /> 다시 저장 (로그인 필요)</>
                ) : (
                  <><Save className="size-4" /> 분석 결과 저장</>
                )}
              </Button>

              <Button
                onClick={exportBlender}
                disabled={!savedAnalysisId || exportStatus === 'submitting' || exportStatus === 'submitted'}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                {exportStatus === 'submitting' ? (
                  <><LoaderCircle className="size-4 animate-spin" /> 모델링 요청 중...</>
                ) : exportStatus === 'submitted' ? (
                  <><CheckCircle2 className="size-4 text-lime-300" /> 모델링 작업 시작됨</>
                ) : (
                  <><Box className="size-4" /> 3D 모델 내보내기 (Blender)</>
                )}
              </Button>
              {!savedAnalysisId && exportStatus === 'error' && (
                <p className="px-1 text-xs text-amber-300">먼저 분석 결과를 저장해 주세요.</p>
              )}

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

              <p className="px-1 text-xs leading-5 text-slate-600">
                본 결과는 사전검토용 개략 분석이며 인허가, 감정평가 또는 전문
                용역을 대체하지 않습니다.
              </p>
            </aside>
          </div>
        )}
      </div>
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
      <p className="mt-3 text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-medium text-slate-100">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-200">{value}</span>
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
      <span className="flex items-center gap-1 text-xs text-cyan-200">
        <CheckCircle2 className="size-3" />
        확인
      </span>
    );
  if (status === 'conditional')
    return (
      <span className="flex items-center gap-1 text-xs text-amber-200">
        <AlertTriangle className="size-3" />
        조건부
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-slate-400">
      <ShieldCheck className="size-3" />
      검토필요
    </span>
  );
}
