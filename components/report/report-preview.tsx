'use client';

import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bot,
  Building2,
  ChevronRight,
  CloudSun,
  FileSpreadsheet,
  Layers3,
  LoaderCircle,
  MapPinned,
  Printer,
  Ruler,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ProposalConcept } from '@/components/report/proposal-concept';
import {
  ReportVisuals,
  type ReportImages,
} from '@/components/report/report-visuals';
import { Button } from '@/components/ui/button';
import type {
  AnalysisPreviewResponse,
  DevelopmentScenario,
} from '@/lib/domain/parcel-intelligence';
import type { Fact } from '@/lib/domain/evidence';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type AIReportSection = { title: string; body: string };
type AIReport = {
  summary: string;
  feasibility: AIReportSection;
  regulations: AIReportSection;
  market: AIReportSection;
  risks: AIReportSection;
  recommendation: AIReportSection;
  generatedAt: string;
  model: string;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatKrw(value: number) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`;
}

function formatKrwFull(value: number) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억원`;
  return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만원`;
}

function confidenceLabel(fact: Fact<unknown>) {
  const c =
    fact.value == null
      ? 'missing'
      : (fact.evidence[0]?.confidence ?? 'missing');
  return c === 'verified'
    ? '확인'
    : c === 'derived'
      ? '산출'
      : c === 'estimated'
        ? '추정'
        : '미확인';
}

function confidenceColor(fact: Fact<unknown>) {
  const c =
    fact.value == null
      ? 'missing'
      : (fact.evidence[0]?.confidence ?? 'missing');
  return c === 'verified'
    ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/20'
    : c === 'derived'
      ? 'bg-cyan-400/15 text-cyan-300 border-cyan-400/20'
      : c === 'estimated'
        ? 'bg-amber-400/15 text-amber-300 border-amber-400/20'
        : 'bg-slate-400/15 text-slate-400 border-slate-400/20';
}

/* ------------------------------------------------------------------ */
/* SVG Charts                                                          */
/* ------------------------------------------------------------------ */

function DonutChart({
  percent,
  size = 100,
  stroke = 8,
  label,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#donut-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
        <defs>
          <linearGradient id="donut-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a3e635" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <span className="text-lg font-bold text-white">{percent}%</span>
        {label && (
          <span className="block text-[9px] text-slate-500">{label}</span>
        )}
      </div>
    </div>
  );
}

function HBar({
  label,
  value,
  max,
  color = 'cyan',
}: {
  label: string;
  value: number;
  max: number;
  color?: 'cyan' | 'lime' | 'amber';
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const bg =
    color === 'lime'
      ? 'bg-lime-400'
      : color === 'amber'
        ? 'bg-amber-400'
        : 'bg-cyan-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-slate-200">
          {formatKrwFull(value)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full ${bg} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export function ReportPreview() {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<AnalysisPreviewResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [aiStatus, setAiStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [downloading, setDownloading] = useState(false);
  const [images, setImages] = useState<ReportImages | null>(null);
  const [selectedId, setSelectedId] = useState('balanced');
  const [saveMessage, setSaveMessage] = useState('');

  const fetchAIReport = useCallback(
    async (data: AnalysisPreviewResponse['data'], nextAddress: string) => {
      setAiStatus('loading');
      try {
        const res = await fetch('/api/analysis/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        });
        if (!res.ok) throw new Error();
        const report = (await res.json()) as AIReport;
        setAiReport(report);
        setAiStatus('ready');
        const saved = await fetch('/api/analysis/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: nextAddress,
            result: data,
            coverage: data.coverage,
            aiReport: report,
          }),
        });
        setSaveMessage(
          saved.ok
            ? '보고서 저장 완료'
            : '보고서는 생성되었으나 저장하지 못했습니다. 로그인 상태를 확인해 주세요.',
        );
      } catch {
        setAiStatus('error');
      }
    },
    [],
  );

  const analyze = useCallback(
    async (nextAddress: string) => {
      setStatus('loading');
      try {
        let payload: AnalysisPreviewResponse | null = null;
        const reportId = new URLSearchParams(window.location.search).get(
          'reportId',
        );
        try {
          const cached =
            !reportId &&
            JSON.parse(sessionStorage.getItem('plint-report-input') ?? 'null');
          if (
            cached?.data?.pipelineVersion === 2 &&
            [
              cached.data.identity.jibunAddress.value,
              cached.data.identity.roadAddress.value,
            ].includes(nextAddress)
          ) {
            payload = cached;
            setSelectedId(cached.selectedScenarioId ?? 'balanced');
          }
        } catch {
          /* Fall back to saved server result. */
        }
        if (!payload) {
          const saved = await fetch(
            `/api/analysis/lookup?address=${encodeURIComponent(nextAddress)}${reportId ? '&reportId=' + encodeURIComponent(reportId) : ''}`,
          );
          const body = saved.ok ? await saved.json() : null;
          if (
            body?.data?.result &&
            (reportId || body.data.result.pipelineVersion === 2)
          )
            payload = {
              data: body.data.result,
              meta: {
                requestId: body.data.analysisId,
                generatedAt: body.data.completedAt,
                mode: 'hybrid',
                durationMs: 0,
              },
            };
        }
        if (!payload && reportId)
          throw new Error('저장된 보고서를 찾지 못했습니다.');
        if (!payload) {
          const response = await fetch('/api/analysis/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: nextAddress }),
          });
          if (!response.ok) throw new Error('분석 실패');
          payload = await response.json();
        }
        if (!payload) throw new Error('분석 결과 없음');
        setResult(payload);
        if (payload.data.reportImages) setImages(payload.data.reportImages);
        setStatus('ready');
        const stored = (
          payload.data as typeof payload.data & { aiReport?: AIReport }
        ).aiReport;
        if (stored) {
          setAiReport(stored);
          setAiStatus('ready');
          setSaveMessage('저장된 보고서');
        } else void fetchAIReport(payload.data, nextAddress);
        if (payload.data.reportImages)
          setSelectedId(payload.data.reportImages.scenarioId);
      } catch {
        setStatus('error');
      }
    },
    [fetchAIReport],
  );

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search)
      .get('address')
      ?.trim();
    if (!initial) return;
    const timer = window.setTimeout(() => {
      setAddress(initial);
      void analyze(initial);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [analyze]);

  const scenario = useMemo(
    () =>
      result?.data.scenarios.find((s) => s.id === selectedId) ??
      result?.data.scenarios[0],
    [result, selectedId],
  );

  const saveImages = useCallback(
    (value: ReportImages) => {
      setImages(value);
      if (!result) return;
      fetch('/api/analysis/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          result: { ...result.data, reportImages: value },
          coverage: result.data.coverage,
          aiReport: aiReport ?? undefined,
        }),
      })
        .then((res) =>
          setSaveMessage(
            res.ok
              ? '이미지 포함 보고서 저장 완료'
              : '이미지 저장 실패: 로그인 상태를 확인해 주세요.',
          ),
        )
        .catch(() =>
          setSaveMessage('이미지 저장 실패: 네트워크를 확인해 주세요.'),
        );
    },
    [result, address, aiReport],
  );

  const approveConcept = useCallback(
    (
      conceptImage: NonNullable<
        AnalysisPreviewResponse['data']['conceptImage']
      >,
    ) => {
      if (!result) return;
      const data = {
        ...result.data,
        reportImages: images ?? result.data.reportImages,
        conceptImage,
      };
      setResult({ ...result, data });
      fetch('/api/analysis/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          result: data,
          coverage: data.coverage,
          aiReport: aiReport ?? undefined,
        }),
      })
        .then((r) =>
          setSaveMessage(
            r.ok
              ? '제안 이미지 포함 보고서 저장 완료'
              : '제안 이미지 저장 실패',
          ),
        )
        .catch(() => setSaveMessage('제안 이미지 저장 실패'));
    },
    [result, images, address, aiReport],
  );

  const downloadExcel = useCallback(async () => {
    if (!result) return;
    setDownloading(true);
    try {
      const res = await fetch('/api/analysis/report/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: result.data,
          aiReport: aiReport ?? null,
          address,
          images,
          format: 'excel',
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PLINT_분석보고서_${address.replace(/\s+/g, '_').slice(0, 30)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('보고서 다운로드에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  }, [result, aiReport, address, images]);

  if (status === 'idle') return <StatusPage type="idle" address="" />;
  if (status === 'loading')
    return <StatusPage type="loading" address={address} />;
  if (status === 'error' || !result || !scenario)
    return <StatusPage type="error" address={address} />;

  const { data, meta } = result;
  const lat = data.identity.center.value?.latitude ?? 0;
  const lon = data.identity.center.value?.longitude ?? 0;
  const mapUrl =
    lat && lon
      ? `/api/map/static?lat=${lat}&lon=${lon}&zoom=17&w=1200&h=500&basemap=HYBRID`
      : null;

  return (
    <main className="min-h-screen bg-[#060e18] pb-20 text-white print:bg-white print:text-slate-900">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#060e18]/80 backdrop-blur-2xl print:static print:border-slate-200 print:bg-white">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-5">
          <Link
            href={`/analysis?address=${encodeURIComponent(address)}`}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white print:hidden"
          >
            <ArrowLeft className="size-3.5" /> 분석 화면
          </Link>
          <div className="flex items-center gap-1.5 text-[10px] tracking-[0.25em] text-slate-500 print:text-slate-400">
            <Layers3 className="size-3 text-cyan-400 print:text-cyan-700" />
            PLINT DECISION REPORT
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button
              disabled={!images}
              onClick={() => {
                const prev = document.title;
                document.title = `PLINT_분석보고서_${address.replace(/\s+/g, '_').slice(0, 30)}`;
                window.print();
                document.title = prev;
              }}
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              <Printer className="size-3.5" /> PDF
            </Button>
            <Button
              onClick={downloadExcel}
              disabled={downloading || !images}
              size="sm"
              className="h-8 gap-1.5 bg-white/[0.08] text-xs text-white hover:bg-white/[0.14]"
            >
              {downloading ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-3.5" />
              )}{' '}
              Excel
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-5 pt-8 print:px-0 print:pt-0">
        {saveMessage && (
          <output className="mb-4 block text-sm text-cyan-500 print:hidden">
            {saveMessage}
          </output>
        )}
        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 0 — COVER                                         */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[#0b1a2e] to-[#0a1420] p-8 sm:p-12 print:rounded-none print:border-slate-200 print:from-white print:to-slate-50">
          <div className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-cyan-500/[0.07] blur-[120px]" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.3em] text-cyan-300/70 print:text-cyan-700">
              <Sparkles className="size-3" /> PRELIMINARY FEASIBILITY REPORT
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.15] tracking-[-0.04em] text-white sm:text-5xl print:text-slate-900">
              개발 사전검토
              <br />
              의사결정 보고서
            </h1>
            <p className="mt-4 text-lg text-slate-300 print:text-slate-600">
              {data.identity.jibunAddress.value ?? address}
            </p>
            {data.identity.roadAddress.value && (
              <p className="mt-1 text-sm text-slate-500">
                {data.identity.roadAddress.value}
              </p>
            )}

            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <CoverMetric label="선택 배치안" value={scenario.name} />
              <CoverMetric
                label="예상 연면적"
                value={`${scenario.grossFloorAreaSqm.toLocaleString('ko-KR')}㎡`}
              />
              <CoverMetric
                label="개략 수익률"
                value={
                  scenario.estimatedRevenueKrw > 0
                    ? `${scenario.estimatedProfitRatePercent}%`
                    : '미확인'
                }
                accent
              />
              <CoverMetric
                label="데이터 커버리지"
                value={`${data.coverage.percent}%`}
              />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-white/[0.06] pt-6 text-[11px] text-slate-500 print:border-slate-200">
              <span>보고서 ID: {meta.requestId.slice(0, 8)}</span>
              <span>
                생성:{' '}
                {new Date(meta.generatedAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              <span>
                모드:{' '}
                {meta.mode === 'mock'
                  ? '미리보기'
                  : meta.mode === 'live'
                    ? '실시간'
                    : '부분 연결'}
              </span>
              <span>소요: {meta.durationMs}ms</span>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 1 — LOCATION MAP                                  */}
        {/* ══════════════════════════════════════════════════════════ */}
        <SectionDivider
          number="01"
          title="입지 현황"
          subtitle="Location Intelligence"
        />

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0b1828] print:border-slate-200 print:bg-white">
            {mapUrl ? (
              <div className="relative">
                <Image
                  unoptimized
                  width={1200}
                  height={500}
                  src={mapUrl}
                  alt="VWorld 위성 지도"
                  className="aspect-[12/5] w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-3 left-3 rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-[10px] text-slate-300 backdrop-blur">
                  <MapPinned className="mr-1 inline size-3 text-cyan-300" />
                  {lat.toFixed(6)}, {lon.toFixed(6)}
                </div>
                <div className="absolute right-3 top-3 rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-[10px] text-slate-400 backdrop-blur">
                  VWorld 위성영상 · EPSG:4326
                </div>
              </div>
            ) : (
              <div className="grid aspect-[12/5] place-items-center bg-slate-900/50 text-sm text-slate-500">
                좌표 정보 없음
              </div>
            )}
          </div>

          <div className="space-y-3">
            <DataCard
              label="대지면적"
              value={
                data.geometry.areaSqm.value != null
                  ? `${data.geometry.areaSqm.value.toLocaleString('ko-KR')}㎡`
                  : '미확인'
              }
              fact={data.geometry.areaSqm as Fact<unknown>}
              icon={<Ruler className="size-4" />}
            />
            <DataCard
              label="지목"
              value={data.geometry.landCategory.value ?? '미확인'}
              fact={data.geometry.landCategory as Fact<unknown>}
              icon={<Layers3 className="size-4" />}
            />
            <DataCard
              label="전면도로폭"
              value={
                data.geometry.roadWidthM.value != null
                  ? `${data.geometry.roadWidthM.value}m`
                  : '미확인'
              }
              fact={data.geometry.roadWidthM as Fact<unknown>}
              icon={<MapPinned className="size-4" />}
            />
            <DataCard
              label="경사도"
              value={
                data.geometry.slopePercent.value != null
                  ? `${data.geometry.slopePercent.value}%`
                  : '미확인'
              }
              fact={data.geometry.slopePercent as Fact<unknown>}
              icon={<TrendingUp className="size-4" />}
            />
            {data.existing.length > 0 &&
              data.existing.map((b) => (
                <DataCard
                  key={b.id}
                  label="기존 건물"
                  value={`${b.use.value ?? '미확인'} · ${b.floorsAbove.value ?? '-'}층 · ${b.totalFloorAreaSqm.value ?? '-'}㎡`}
                  fact={b.use as Fact<unknown>}
                  icon={<Building2 className="size-4" />}
                />
              ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 2 — REGULATORY                                    */}
        {/* ══════════════════════════════════════════════════════════ */}
        <SectionDivider
          number="02"
          title="법규 검토"
          subtitle="Regulatory Framework"
        />

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-white/[0.06] bg-[#0b1828] p-6 print:border-slate-200 print:bg-white">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-cyan-300/70 print:text-cyan-700">
              용도지역 · ZONING
            </p>
            <p className="mt-3 text-2xl font-semibold text-white print:text-slate-900">
              {data.planning[0]?.name ?? '확인 필요'}
            </p>
            <p className="mt-2 text-sm text-slate-400 print:text-slate-500">
              {data.planning[0]?.summary.value ?? '용도지역 정보 미확인'}
            </p>
            <div className="mt-6 space-y-4">
              <p className="text-sm">
                배치 건폐율 {scenario.buildingCoverageRatio}% · 법정 상한 미확정
              </p>
              <p className="text-sm">
                배치 용적률 {scenario.floorAreaRatio}% · 조례·중첩구역 확인 필요
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-[#0b1828] p-6 print:border-slate-200 print:bg-white">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-cyan-300/70 print:text-cyan-700">
              규제 사항 · CONSTRAINTS
            </p>
            <div className="mt-4 space-y-2">
              {data.planning.map((p) => (
                <div
                  key={p.code}
                  className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 print:border-slate-100 print:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 print:text-slate-800">
                      {p.name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {p.category === 'zoning'
                        ? '용도지역'
                        : p.category === 'district'
                          ? '지구'
                          : p.category === 'road'
                            ? '접도'
                            : p.category}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${p.status === 'confirmed' ? 'bg-emerald-400/10 text-emerald-300' : p.status === 'conditional' ? 'bg-amber-400/10 text-amber-300' : 'bg-rose-400/10 text-rose-300'}`}
                  >
                    {p.status === 'confirmed'
                      ? '확인'
                      : p.status === 'conditional'
                        ? '조건부'
                        : '검토 필요'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 3 — MARKET                                        */}
        {/* ══════════════════════════════════════════════════════════ */}
        <SectionDivider
          number="03"
          title="시장 분석"
          subtitle="Market Intelligence"
        />

        <div className="grid gap-5 lg:grid-cols-3">
          <MarketMetric
            label="공시지가"
            value={data.market.officialLandPricePerSqm.value}
            unit="원/㎡"
            fact={data.market.officialLandPricePerSqm as Fact<unknown>}
            description="국토교통부 개별공시지가"
          />
          <MarketMetric
            label="실거래 중위가"
            value={data.market.comparableMedianPerSqm.value}
            unit="원/㎡"
            fact={data.market.comparableMedianPerSqm as Fact<unknown>}
            description={`비교 거래 ${data.market.comparableCount.value ?? 0}건 기준`}
          />
          <div className="rounded-2xl border border-white/[0.06] bg-[#0b1828] p-6 print:border-slate-200 print:bg-white">
            <p className="text-xs text-slate-500">12개월 가격 추세</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white print:text-slate-900">
                {data.market.trendPercent.value != null
                  ? `${data.market.trendPercent.value > 0 ? '+' : ''}${data.market.trendPercent.value}%`
                  : '—'}
              </span>
              {data.market.trendPercent.value != null &&
                data.market.trendPercent.value > 0 && (
                  <TrendingUp className="size-5 text-lime-400" />
                )}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              동일 권역 유사 용도 토지
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/[0.06] bg-[#0b1828] p-6 print:border-slate-200 print:bg-white">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-cyan-300/70 print:text-cyan-700">
            생활권 수요 · ADMINISTRATIVE-DONG CENSUS
          </p>
          <p className="mt-2 text-sm font-medium text-slate-100 print:text-slate-800">
            {data.demand.administrativeArea.value ?? '행정동 통계 미연결'}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <MarketMetric
              label="인구"
              value={data.demand.populationAdministrativeArea.value}
              unit="명"
              fact={data.demand.populationAdministrativeArea as Fact<unknown>}
              description="기준 행정동 집계"
            />
            <MarketMetric
              label="가구"
              value={data.demand.householdsAdministrativeArea.value}
              unit="가구"
              fact={data.demand.householdsAdministrativeArea as Fact<unknown>}
              description="기준 행정동 집계"
            />
            <MarketMetric
              label="사업체"
              value={data.demand.businessesAdministrativeArea.value}
              unit="개"
              fact={data.demand.businessesAdministrativeArea as Fact<unknown>}
              description="기준 행정동 집계"
            />
          </div>
          <p className="mt-4 text-[11px] text-slate-500 print:text-slate-600">
            이 수치는 대상 필지 반경 500m·1km 수요가 아닌 행정동 단위 센서스입니다.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 4 — SCENARIOS                                     */}
        {/* ══════════════════════════════════════════════════════════ */}
        <SectionDivider
          number="04"
          title="개발 시나리오"
          subtitle="Development Scenarios"
        />

        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <ReportVisuals
            data={data}
            scenario={scenario}
            onImages={saveImages}
          />
          <div className="col-span-full">
            <ProposalConcept
              address={address}
              scenario={scenario}
              images={images}
              initial={data.conceptImage}
              onApprove={approveConcept}
            />
          </div>

          {/* Scenario Comparison */}
          <div className="space-y-3">
            {data.scenarios.map((s) => (
              <ScenarioCard key={s.id} scenario={s} isRecommended={false} />
            ))}
          </div>
          {scenario.financialModel && (
            <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5 print:border-cyan-200 print:bg-cyan-50">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-cyan-300 print:text-cyan-700">
                사업성 시뮬레이션 가정
              </p>
              <p className="mt-2 text-sm font-medium text-slate-100 print:text-slate-800">
                {scenario.financialModel.type === 'sale'
                  ? '분양·매각 모델'
                  : '임대 운영 모델'}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400 print:text-slate-600">
                {scenario.financialModel.type === 'sale'
                  ? `입력 단가 ${scenario.financialModel.salePricePerSqm?.toLocaleString('ko-KR') ?? 0}원/㎡ × 연면적 ${scenario.grossFloorAreaSqm.toLocaleString('ko-KR')}㎡`
                  : `월 임대료 ${scenario.financialModel.monthlyRentPerSqm?.toLocaleString('ko-KR') ?? 0}원/㎡ · 가동률 ${scenario.financialModel.occupancyPercent ?? 0}% · 운영비율 ${scenario.financialModel.operatingExpensePercent ?? 0}%`}
              </p>
              <p className="mt-2 text-[11px] text-slate-500 print:text-slate-500">
                사용자 입력 가정이며 공시지가·토지 실거래가를 신축 분양가 또는
                임대료로 자동 환산하지 않았습니다.
              </p>
            </div>
          )}
        </div>

        {/* Revenue comparison bar chart */}
        <div className="mt-5 rounded-2xl border border-white/[0.06] bg-[#0b1828] p-6 print:border-slate-200 print:bg-white">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-cyan-300/70 print:text-cyan-700">
            사업성 비교 · PROFITABILITY
          </p>
          <div className="mt-5 space-y-3">
            {data.scenarios.map((s) => {
              const maxRev = Math.max(
                ...data.scenarios.map((x) => x.estimatedRevenueKrw),
              );
              return (
                <div key={s.id} className="space-y-2">
                  <p className="text-xs font-medium text-slate-300 print:text-slate-700">
                    {s.name}{' '}
                    <span className="text-slate-500">
                      · 수익률{' '}
                      {s.estimatedRevenueKrw > 0
                        ? `${s.estimatedProfitRatePercent}%`
                        : '미확인'}
                    </span>
                  </p>
                  {s.estimatedRevenueKrw > 0 ? (
                    <HBar
                      label="예상 매출"
                      value={s.estimatedRevenueKrw}
                      max={maxRev || 1}
                      color="cyan"
                    />
                  ) : (
                    <p className="text-sm text-slate-400">
                      매출 미산정 · 분양/임대/운영 가정 미입력
                    </p>
                  )}
                  <HBar
                    label="개략 공사비 (가정)"
                    value={s.estimatedCostKrw}
                    max={maxRev || 1}
                    color="amber"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 5 — RISKS & CLIMATE                               */}
        {/* ══════════════════════════════════════════════════════════ */}
        <SectionDivider
          number="05"
          title="리스크 · 기후"
          subtitle="Risk & Climate Assessment"
        />

        <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          {/* Risks */}
          <div className="space-y-3">
            {data.risks.map((risk) => (
              <div
                key={risk.code}
                className="flex gap-4 rounded-2xl border border-white/[0.06] bg-[#0b1828] p-5 print:border-slate-200 print:bg-white"
              >
                <div
                  className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${risk.level === 'high' ? 'bg-rose-500/15' : risk.level === 'medium' ? 'bg-amber-500/15' : risk.level === 'low' ? 'bg-emerald-500/15' : 'bg-slate-500/15'}`}
                >
                  <ShieldAlert
                    className={`size-4 ${risk.level === 'high' ? 'text-rose-400' : risk.level === 'medium' ? 'text-amber-400' : risk.level === 'low' ? 'text-emerald-400' : 'text-slate-400'}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white print:text-slate-900">
                      {risk.label}
                    </p>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${risk.level === 'high' ? 'bg-rose-400/10 text-rose-300' : risk.level === 'medium' ? 'bg-amber-400/10 text-amber-300' : risk.level === 'low' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-400/10 text-slate-400'}`}
                    >
                      {risk.level === 'high'
                        ? '높음'
                        : risk.level === 'medium'
                          ? '중간'
                          : risk.level === 'low'
                            ? '낮음'
                            : '미확인'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {risk.finding.value ??
                      risk.finding.warnings?.[0] ??
                      '데이터 연결 필요'}
                  </p>
                  {risk.nextAction && (
                    <p className="mt-1 text-[11px] text-cyan-300/60 print:text-cyan-700">
                      → {risk.nextAction}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Climate */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0b1828] p-6 print:border-slate-200 print:bg-white">
            <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-cyan-300/70 print:text-cyan-700">
              <CloudSun className="size-3.5" /> 기후 환경
            </div>
            <div className="mt-5 space-y-5">
              <ClimateRow
                label="연간 일조시간"
                value={
                  data.climate.annualSunlightHours.value != null
                    ? `${data.climate.annualSunlightHours.value.toLocaleString('ko-KR')}시간`
                    : '미확인'
                }
              />
              <ClimateRow
                label="일사량"
                value={
                  data.climate.solarRadiationKwhM2.value != null
                    ? `${data.climate.solarRadiationKwhM2.value.toLocaleString('ko-KR')} kWh/㎡`
                    : '미확인'
                }
              />
              <ClimateRow
                label="주풍향"
                value={data.climate.prevailingWind.value ?? '미확인'}
              />
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 6 — AI ANALYSIS                                   */}
        {/* ══════════════════════════════════════════════════════════ */}
        <SectionDivider
          number="06"
          title="AI 종합 분석"
          subtitle="AI-Powered Analysis"
        />

        {aiStatus === 'loading' && (
          <div className="flex items-center gap-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.03] p-8">
            <LoaderCircle className="size-5 animate-spin text-cyan-300" />
            <div>
              <p className="text-sm text-white">
                AI가 데이터를 종합 분석하고 있습니다
              </p>
              <p className="mt-1 text-xs text-slate-500">
                필지·법규·시장·리스크를 교차 검증하여 의사결정 보고서를
                작성합니다.
              </p>
            </div>
          </div>
        )}

        {aiStatus === 'error' && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-300/10 bg-amber-300/[0.03] p-8">
            <AlertTriangle className="size-5 text-amber-300" />
            <p className="text-sm text-slate-300">
              AI 분석을 완료하지 못했습니다. 다시 시도해 주세요.
            </p>
          </div>
        )}

        {aiStatus === 'ready' && aiReport && (
          <div className="space-y-5">
            {/* Executive Summary */}
            <div className="rounded-2xl border border-lime-400/15 bg-gradient-to-br from-lime-400/[0.04] to-transparent p-6 sm:p-8 print:border-lime-600/20 print:from-lime-50">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime-400/10">
                  <Bot className="size-4 text-lime-300 print:text-lime-700" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-lime-300/80 print:text-lime-700">
                    EXECUTIVE SUMMARY
                  </p>
                  <p className="mt-3 text-[15px] leading-8 text-slate-200 print:text-slate-700">
                    {aiReport.summary}
                  </p>
                </div>
              </div>
            </div>

            {/* Analysis sections */}
            {(
              [
                aiReport.feasibility,
                aiReport.regulations,
                aiReport.market,
                aiReport.risks,
                aiReport.recommendation,
              ] as AIReportSection[]
            )
              .filter(Boolean)
              .map((section) => (
                <div
                  key={section.title}
                  className="rounded-2xl border border-white/[0.06] bg-[#0b1828] p-6 sm:p-8 print:border-slate-200 print:bg-white"
                >
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-white print:text-slate-900">
                    <span className="size-1.5 rounded-full bg-cyan-400" />
                    {section.title}
                  </h3>
                  <div className="mt-4 space-y-4 text-[14px] leading-[1.9] text-slate-300 print:text-slate-600">
                    {(section.body ?? '')
                      .replace(/\\n\\n/g, '\n\n')
                      .replace(/\\n/g, '\n')
                      .split('\n\n')
                      .map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))}
                  </div>
                </div>
              ))}

            <p className="text-[10px] text-slate-600">
              AI 모델: {aiReport.model} · 생성:{' '}
              {new Date(aiReport.generatedAt).toLocaleString('ko-KR')} · 본
              분석은 사전검토용이며 인허가 심의를 대체하지 않습니다.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 7 — DATA PROVENANCE                               */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section className="mb-8 space-y-4 break-inside-avoid">
          <h2 className="text-xl font-medium">확인된 자료와 추가 실사</h2>
          <p className="text-sm text-slate-400">
            커버리지는 자료 충족 지표이며 정확도·투자 안전 확률이 아닙니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">항목</th>
                  <th className="p-2">상태</th>
                  <th className="p-2">근거·누락 사유</th>
                </tr>
              </thead>
              <tbody>
                {data.sourceStatus?.map((source) => (
                  <tr key={source.id} className="border-t border-slate-400/20">
                    <td className="p-2">{source.label}</td>
                    <td className="p-2">
                      {
                        {
                          available: '조회 완료',
                          empty: '조회 0건',
                          partial: '일부/추정 포함',
                          unavailable: '조회 불가',
                        }[source.status]
                      }
                    </td>
                    <td className="p-2">{source.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {data.reviewNotes?.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="text-sm">
            추가 현장 검토: 진입·주차 동선, 층별 해안 조망, 기존 건물
            리모델링/철거 비교, 조례·고도·경관·어항 조건, 지반·침수·배수,
            총사업비와 운영 가정.
          </p>
        </section>
        <SectionDivider
          number="07"
          title="데이터 출처"
          subtitle="Data Provenance"
        />

        <div className="grid gap-5 lg:grid-cols-[0.6fr_1.4fr]">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-[#0b1828] p-8 print:border-slate-200 print:bg-white">
            <DonutChart
              percent={data.coverage.percent}
              size={120}
              stroke={10}
              label="커버리지"
            />
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <ProvenanceStat
                label="확인"
                count={data.coverage.verifiedFacts}
                color="emerald"
              />
              <ProvenanceStat
                label="산출"
                count={data.coverage.derivedFacts}
                color="cyan"
              />
              <ProvenanceStat
                label="추정"
                count={data.coverage.estimatedFacts}
                color="amber"
              />
              <ProvenanceStat
                label="미연결"
                count={data.coverage.missingFacts}
                color="slate"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0b1828] print:border-slate-200 print:bg-white">
            <div className="border-b border-white/[0.04] px-5 py-3 print:border-slate-100">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-cyan-300/70 print:text-cyan-700">
                EVIDENCE LEDGER
              </p>
            </div>
            <div className="divide-y divide-white/[0.04] print:divide-slate-100">
              <EvidenceRow
                label="필지 좌표"
                fact={data.identity.center as Fact<unknown>}
                provider={data.identity.center.evidence[0]?.provider}
                dataset={data.identity.center.evidence[0]?.datasetId}
              />
              <EvidenceRow
                label="공시지가"
                fact={data.market.officialLandPricePerSqm as Fact<unknown>}
                provider={
                  data.market.officialLandPricePerSqm.evidence[0]?.provider
                }
                dataset={
                  data.market.officialLandPricePerSqm.evidence[0]?.datasetId
                }
              />
              <EvidenceRow
                label="실거래 비교"
                fact={data.market.comparableMedianPerSqm as Fact<unknown>}
                provider={
                  data.market.comparableMedianPerSqm.evidence[0]?.provider
                }
                dataset={
                  data.market.comparableMedianPerSqm.evidence[0]?.datasetId
                }
              />
              {data.planning[0] && (
                <EvidenceRow
                  label="용도지역"
                  fact={data.planning[0].summary as Fact<unknown>}
                  provider={data.planning[0].summary.evidence[0]?.provider}
                  dataset={data.planning[0].summary.evidence[0]?.datasetId}
                />
              )}
              <EvidenceRow
                label="일조/기후"
                fact={data.climate.annualSunlightHours as Fact<unknown>}
                provider={
                  data.climate.annualSunlightHours.evidence[0]?.provider
                }
                dataset={
                  data.climate.annualSunlightHours.evidence[0]?.datasetId
                }
              />
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-12 border-t border-white/[0.04] pt-6 print:border-slate-200">
          <div className="flex items-start justify-between gap-4 text-[10px] text-slate-600">
            <div className="max-w-xl space-y-1">
              <p>
                본 보고서는 공공데이터 기반 사전검토용으로, 인허가
                심의·감정평가·설계도서·전문 용역을 대체하지 않습니다.
              </p>
              <p>
                수치의 출처·기준일·신뢰도는 Evidence Ledger에서 확인할 수
                있으며, 데이터 연결 상태에 따라 일부 항목이 추정값일 수
                있습니다.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="flex items-center gap-1 text-slate-500">
                <Layers3 className="size-3 text-cyan-400/50" /> PLINT
              </p>
              <p className="mt-0.5">Parcel Intelligence System</p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StatusPage({
  type,
  address,
}: {
  type: 'idle' | 'loading' | 'error';
  address: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#060e18] text-white">
      <div className="text-center">
        {type === 'loading' ? (
          <>
            <LoaderCircle className="mx-auto size-8 animate-spin text-cyan-300" />
            <p className="mt-5 text-sm text-slate-300">
              의사결정 보고서를 생성하고 있습니다
            </p>
            <p className="mt-2 text-xs text-slate-500">
              필지 · 법규 · 시장 · 시나리오 · 리스크
            </p>
          </>
        ) : type === 'error' ? (
          <>
            <AlertTriangle className="mx-auto size-8 text-rose-300" />
            <p className="mt-5 text-sm text-slate-300">
              보고서를 생성하지 못했습니다
            </p>
            <Link
              href={`/analysis?address=${encodeURIComponent(address)}`}
              className="mt-5 inline-flex items-center gap-2 text-sm text-cyan-200"
            >
              분석 화면으로 돌아가기 <ChevronRight className="size-4" />
            </Link>
          </>
        ) : (
          <>
            <BarChart3 className="mx-auto size-8 text-slate-500" />
            <p className="mt-5 text-sm text-slate-300">
              분석할 주소를 입력해 주세요
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function SectionDivider({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-5 mt-12 flex items-end gap-4 border-b border-white/[0.04] pb-4 print:border-slate-200 print:mt-8">
      <span className="text-3xl font-extralight tracking-[-0.04em] text-white/[0.12] print:text-slate-200">
        {number}
      </span>
      <div>
        <p className="text-[10px] tracking-[0.2em] text-slate-500 print:text-slate-400">
          {subtitle}
        </p>
        <h2 className="text-lg font-semibold text-white print:text-slate-900">
          {title}
        </h2>
      </div>
    </div>
  );
}

function CoverMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 print:border-slate-200 print:bg-slate-50">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${accent ? 'text-lime-300 print:text-lime-700' : 'text-white print:text-slate-900'}`}
      >
        {value}
      </p>
    </div>
  );
}

function DataCard({
  label,
  value,
  fact,
  icon,
}: {
  label: string;
  value: string;
  fact: Fact<unknown>;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-[#0b1828] px-4 py-3.5 print:border-slate-200 print:bg-white">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-cyan-300 print:bg-slate-100 print:text-cyan-700">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-white print:text-slate-900">
          {value}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-medium ${confidenceColor(fact)}`}
      >
        {confidenceLabel(fact)}
      </span>
    </div>
  );
}

function MarketMetric({
  label,
  value,
  unit,
  fact,
  description,
}: {
  label: string;
  value: number | null;
  unit: string;
  fact: Fact<unknown>;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0b1828] p-6 print:border-slate-200 print:bg-white">
      <div className="flex items-start justify-between">
        <p className="text-xs text-slate-500">{label}</p>
        <span
          className={`rounded-md border px-1.5 py-0.5 text-[9px] ${confidenceColor(fact)}`}
        >
          {confidenceLabel(fact)}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-white print:text-slate-900">
        {value != null ? value.toLocaleString('ko-KR') : '—'}
        {value != null && (
          <span className="ml-1 text-sm font-normal text-slate-500">
            {unit}
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">{description}</p>
    </div>
  );
}

function ScenarioCard({
  scenario: s,
  isRecommended,
}: {
  scenario: DevelopmentScenario;
  isRecommended: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${isRecommended ? 'border-lime-400/20 bg-lime-400/[0.04]' : 'border-white/[0.06] bg-[#0b1828]'} print:border-slate-200 print:bg-white`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white print:text-slate-900">
            {s.name}
          </p>
          {isRecommended && (
            <span className="rounded-md bg-lime-400/15 px-2 py-0.5 text-[10px] font-semibold text-lime-300 print:bg-lime-100 print:text-lime-700">
              권장
            </span>
          )}
        </div>
        <span className="text-lg font-bold text-white print:text-slate-900">
          {s.floors.length}F
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3 text-center">
        <ScenarioStat
          label="연면적"
          value={`${s.grossFloorAreaSqm.toLocaleString('ko-KR')}㎡`}
        />
        <ScenarioStat
          label="건폐/용적"
          value={`${s.buildingCoverageRatio}/${s.floorAreaRatio}%`}
        />
        <ScenarioStat
          label="예상 매출"
          value={
            s.estimatedRevenueKrw > 0
              ? formatKrw(s.estimatedRevenueKrw)
              : '미확인'
          }
        />
        <ScenarioStat
          label="수익률"
          value={
            s.estimatedRevenueKrw > 0
              ? `${s.estimatedProfitRatePercent}%`
              : '미확인'
          }
          accent
        />
      </div>
    </div>
  );
}

function ScenarioStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p
        className={`mt-0.5 text-xs font-semibold ${accent ? 'text-lime-300 print:text-lime-700' : 'text-slate-200 print:text-slate-700'}`}
      >
        {value}
      </p>
    </div>
  );
}

function ClimateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 last:border-0 last:pb-0 print:border-slate-100">
      <span className="text-sm text-slate-400 print:text-slate-500">
        {label}
      </span>
      <span className="text-sm font-medium text-white print:text-slate-900">
        {value}
      </span>
    </div>
  );
}

function EvidenceRow({
  label,
  fact,
  provider,
  dataset,
}: {
  label: string;
  fact: Fact<unknown>;
  provider?: string;
  dataset?: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div>
        <p className="text-sm font-medium text-slate-200 print:text-slate-800">
          {label}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {provider ?? '연결 예정'} · {dataset ?? '—'}
        </p>
      </div>
      <span
        className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${confidenceColor(fact)}`}
      >
        {confidenceLabel(fact)}
      </span>
    </div>
  );
}

function ProvenanceStat({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: 'emerald' | 'cyan' | 'amber' | 'slate';
}) {
  const dotColor =
    color === 'emerald'
      ? 'bg-emerald-400'
      : color === 'cyan'
        ? 'bg-cyan-400'
        : color === 'amber'
          ? 'bg-amber-400'
          : 'bg-slate-400';
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2 rounded-full ${dotColor}`} />
      <span className="text-slate-400 print:text-slate-500">{label}</span>
      <span className="font-medium text-slate-200 print:text-slate-800">
        {count}
      </span>
    </div>
  );
}
