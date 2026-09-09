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
  FileText,
  Globe2,
  Layers3,
  LoaderCircle,
  MapPinned,
  Minus,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  X,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AddressSearch, type AddressResult } from '@/components/address-search';
import { AnalysisProgressView } from '@/components/analysis/analysis-progress';
import {
  readAnalysisStream,
  type AnalysisProgress,
  type StepId,
} from '@/lib/pipeline/progress';
import { LazyAnalysisScene } from '@/components/analysis/lazy-analysis-scene';
import { LazyCesiumContext } from '@/components/analysis/lazy-cesium-context';
import { ScenarioCustomizer } from '@/components/analysis/scenario-customizer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import Image from 'next/image';
import { placeMassing, type MassPlacement } from '@/lib/pipeline/massing';
import type {
  AnalysisPreviewResponse,
  DevelopmentScenario,
} from '@/lib/domain/parcel-intelligence';

const LazyBlenderModelViewer = dynamic(
  () =>
    import('@/components/analysis/blender-model-viewer').then(
      (module) => module.BlenderModelViewer,
    ),
  { ssr: false },
);

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
  const router = useRouter();
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
  const [hasOpenedContext, setHasOpenedContext] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [exportStatus, setExportStatus] = useState<
    'idle' | 'submitting' | 'submitted' | 'error'
  >('idle');
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);
  const [sunlight, setSunlight] = useState<SunlightData | null>(null);
  const [sunlightStatus, setSunlightStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [blenderMessage, setBlenderMessage] = useState('');
  const blenderPoll = useRef(0);
  const [blenderJobId, setBlenderJobId] = useState<string | null>(null);
  const [blenderPreview, setBlenderPreview] = useState<string | null>(null);
  const [blenderGlb, setBlenderGlb] = useState<string | null>(null);
  const [showBlenderModel, setShowBlenderModel] = useState(false);
  const [customScenario, setCustomScenario] =
    useState<DevelopmentScenario | null>(null);
  const [placementOverride, setPlacementOverride] =
    useState<MassPlacement | null>(null);
  const handleCustomScenarioChange = useCallback(
    (nextScenario: DevelopmentScenario) => {
      setPlacementOverride(null);
      setCustomScenario(nextScenario);
    },
    [],
  );

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

  const [progress, setProgress] = useState<
    Partial<Record<StepId, AnalysisProgress>>
  >({});
  const analysisRequest = useRef<AbortController | null>(null);
  useEffect(() => () => analysisRequest.current?.abort(), []);

  const analyze = useCallback(
    async (
      nextAddress: string,
      forceRefresh = false,
      existingAnalysisId?: string | null,
    ) => {
      analysisRequest.current?.abort();
      const controller = new AbortController();
      analysisRequest.current = controller;
      const signal = controller.signal;
      setProgress({});
      setResult(null);
      setSceneMode('massing');
      setHasOpenedContext(false);
      blenderPoll.current++;
      setBlenderJobId(null);
      setStatus('loading');
      setMessage(
        forceRefresh ? '분석 요청 중...' : '저장된 분석을 확인하고 있습니다...',
      );
      if (!forceRefresh) {
        try {
          const lookupParams = new URLSearchParams({ address: nextAddress });
          if (existingAnalysisId)
            lookupParams.set('analysisId', existingAnalysisId);
          const lookupRes = await fetch(
            `/api/analysis/lookup?${lookupParams}`,
            {
              signal,
            },
          );
          if (lookupRes.ok) {
            const lookupBody = await lookupRes.json();
            if (signal.aborted) return;
            const saved = lookupBody?.data;
            if (saved?.result?.pipelineVersion === 2) {
              const restored: AnalysisPreviewResponse = {
                data: saved.result as AnalysisPreviewResponse['data'],
                meta: {
                  requestId: saved.analysisId,
                  generatedAt: saved.completedAt ?? new Date().toISOString(),
                  mode: 'hybrid' as const,
                  durationMs: 0,
                },
              };
              setResult(restored);
              setScenarioId('balanced');
              setSavedAnalysisId(saved.analysisId);
              setSaveStatus('saved');
              setStatus('ready');
              const center = restored.data.identity.center.value;
              if (center) {
                setSunlightStatus('loading');
                fetch('/api/analysis/sunlight', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    latitude: center.latitude,
                    longitude: center.longitude,
                  }),
                })
                  .then((r) => (r.ok ? r.json() : Promise.reject()))
                  .then((d) => {
                    setSunlight(d as SunlightData);
                    setSunlightStatus('ready');
                  })
                  .catch(() => setSunlightStatus('error'));
              }
              return;
            }
            if (saved?.result) {
              setStatus('error');
              setMessage(
                '저장된 분석 형식이 현재 화면과 달라 바로 표시할 수 없습니다. 재분석을 선택하면 새 결과로 갱신합니다.',
              );
              return;
            }
          }
        } catch {
          /* lookup failed, proceed with fresh analysis */
        }
      }

      if (signal.aborted) return;
      setSaveStatus('idle');
      setSavedAnalysisId(null);
      setSunlight(null);
      setSunlightStatus('idle');
      setBlenderPreview(null);
      setBlenderGlb(null);
      setShowBlenderModel(false);
      setExportStatus('idle');
      setStatus('loading');
      setMessage('실제 자료를 조회하고 있습니다...');

      try {
        const response = await fetch('/api/analysis/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/x-ndjson',
          },
          body: JSON.stringify({ address: nextAddress }),
          signal,
        });
        const payload = await readAnalysisStream(response, (event) => {
          if (signal.aborted) return;
          setProgress((current) => ({ ...current, [event.step]: event }));
          if (event.step === 'scenarios' && event.status === 'running')
            setMessage(event.message);
          else if (event.step === 'address' && event.status === 'running')
            setMessage('주소를 해석하고 있습니다...');
          else if (event.step === 'address' && event.status === 'completed')
            setMessage('실제 자료를 조회하고 있습니다...');
        });
        if (signal.aborted) return;
        setResult(payload);
        setScenarioId('balanced');
        setStatus('ready');

        // Auto-save to Supabase (silently fails if not logged in)
        fetch('/api/analysis/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: nextAddress,
            result: payload.data,
            coverage: payload.data.coverage,
          }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((body) => {
            if (body?.data?.analysisId) {
              setSavedAnalysisId(body.data.analysisId);
              setSaveStatus('saved');
            }
          })
          .catch(() => {});

        const center = payload.data.identity.center.value;
        if (center) {
          setSunlightStatus('loading');
          fetch('/api/analysis/sunlight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: center.latitude,
              longitude: center.longitude,
            }),
          })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
              setSunlight(data as SunlightData);
              setSunlightStatus('ready');
            })
            .catch(() => setSunlightStatus('error'));
        }
      } catch (error) {
        if (signal.aborted) return;
        setProgress((current) =>
          Object.fromEntries(
            Object.entries(current).map(([key, step]) => [
              key,
              step.status === 'running'
                ? {
                    ...step,
                    status: 'failed',
                    message: '분석 중단 · 다시 시도해 주세요.',
                  }
                : step,
            ]),
          ),
        );
        setStatus('error');
        setMessage(
          error instanceof Error
            ? error.message
            : '분석을 완료하지 못했습니다.',
        );
      }
    },
    [],
  );

  useEffect(() => {
    const initialParams = new URLSearchParams(window.location.search);
    const initial = initialParams.get('address')?.trim() || '';
    const initialAnalysisId = initialParams.get('analysisId')?.trim();
    if (initial) {
      const timer = window.setTimeout(() => {
        setAddress(initial);
        setQuery(initial);
        void analyze(initial, false, initialAnalysisId);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [analyze]);

  const baseScenario = useMemo(
    () =>
      scenarioId === 'custom' && customScenario
        ? customScenario
        : (result?.data.scenarios.find((item) => item.id === scenarioId) ??
          result?.data.scenarios[0]),
    [result, scenarioId, customScenario],
  );

  const scenario = useMemo(() => {
    if (!baseScenario || baseScenario.id !== 'custom' || !result)
      return baseScenario;
    const area = result.data.geometry.areaSqm.value ?? 0;
    const massing =
      placementOverride ??
      placeMassing(result.data.geometry.boundary.value, area, baseScenario);
    if (!massing) return baseScenario;
    const gross = Math.round(massing.floorAreasSqm.reduce((a, b) => a + b, 0));
    const unit =
      baseScenario.estimatedCostKrw /
      Math.max(1, baseScenario.grossFloorAreaSqm);
    return {
      ...baseScenario,
      massing,
      grossFloorAreaSqm: gross,
      floorAreaRatio: Math.round((gross / area) * 1000) / 10,
      buildingCoverageRatio:
        Math.round(((massing.widthM * massing.depthM) / area) * 1000) / 10,
      estimatedCostKrw: Math.round(gross * unit),
    };
  }, [baseScenario, result, placementOverride]);

  const legalLimits = useMemo(() => {
    if (!result) return { maxCoverage: 60, maxFar: 200 };
    const maxYield = result.data.scenarios.find((s) => s.id === 'yield');
    return {
      maxCoverage: maxYield?.buildingCoverageRatio ?? 60,
      maxFar: maxYield?.floorAreaRatio ?? 200,
    };
  }, [result]);

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

  useEffect(
    () => () => {
      blenderPoll.current++;
    },
    [],
  );

  const pollBlenderJob = useCallback(async (jobId: string) => {
    setExportStatus('submitted');
    const generation = ++blenderPoll.current;
    const maxAttempts = 90;
    setBlenderMessage('GPU 작업 상태 확인 중…');
    for (let i = 0; i < maxAttempts; i++) {
      if (generation !== blenderPoll.current) return;
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const res = await fetch(
          `/api/modeling/runpod/${encodeURIComponent(jobId)}`,
          { signal: AbortSignal.timeout(20000) },
        );
        if (generation !== blenderPoll.current) return;
        const payload = await res.json();
        if (!res.ok)
          throw new Error(payload.error?.message ?? '작업 상태 조회 실패');
        const job = payload.data;
        if (!job?.status) throw new Error('GPU 작업 응답 형식 오류');
        setBlenderMessage(
          job.status === 'IN_QUEUE'
            ? 'GPU 할당 대기 중'
            : job.status === 'IN_PROGRESS'
              ? 'Blender 모델링·렌더링 중'
              : job.status,
        );
        if (job.status === 'COMPLETED') {
          if (job.output?.formatVersion !== 'plint-blender-v3') {
            setBlenderJobId(null);
            throw new Error(
              'GPU 워커 업데이트가 필요합니다. 이전 워커는 임의 주변 건물을 생성하므로 결과를 표시하지 않습니다.',
            );
          }
          if (!job.output?.preview?.base64 || !job.output?.model?.base64)
            throw new Error(
              '작업 완료 응답에 모델 또는 렌더 이미지가 없습니다.',
            );
          if (job.output.preview?.base64) {
            setBlenderPreview(
              `data:image/png;base64,${job.output.preview.base64}`,
            );
          }
          if (job.output.model?.base64) {
            setBlenderGlb(
              `data:model/gltf-binary;base64,${job.output.model.base64}`,
            );
          }
          setBlenderMessage('Blender 생성 완료');
          setExportStatus('submitted');
          return;
        }
        if (
          job.status === 'FAILED' ||
          job.status === 'CANCELLED' ||
          job.status === 'TIMED_OUT'
        ) {
          setBlenderJobId(null);
          setBlenderMessage(
            `GPU 작업 종료: ${job.status}${job.error ? ' · ' + String(job.error).slice(0, 160) : ''}`,
          );
          setExportStatus('error');
          return;
        }
      } catch (error) {
        setBlenderMessage(
          error instanceof Error ? error.message : 'GPU 상태 확인 실패',
        );
        setExportStatus('error');
        return;
      }
    }
    setBlenderMessage(
      '상태 확인 시간이 초과되었습니다. 서버 작업은 계속될 수 있습니다.',
    );
    setExportStatus('error');
  }, []);

  const exportBlender = useCallback(async () => {
    if (
      !result ||
      !scenario ||
      exportStatus === 'submitting' ||
      exportStatus === 'submitted'
    )
      return;
    if (blenderJobId) {
      void pollBlenderJob(blenderJobId);
      return;
    }
    if (!scenario.massing) {
      setBlenderMessage(
        '실제 경계 내 배치 계산 후 Blender를 생성할 수 있습니다.',
      );
      setExportStatus('error');
      return;
    }
    if (!savedAnalysisId) {
      setExportStatus('error');
      return;
    }
    setExportStatus('submitting');
    setBlenderPreview(null);
    setBlenderGlb(null);
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
            boundary: boundary?.coordinates[0]?.map(
              ([lon, lat]: [number, number]) => ({
                latitude: lat,
                longitude: lon,
              }),
            ),
          },
          context: result.data.context
            .filter((b) => b.footprint.coordinates.length === 1)
            .map((b) => ({
              footprint: b.footprint.coordinates[0].map(
                ([longitude, latitude]) => ({ latitude, longitude }),
              ),
              heightM: b.heightM.value ?? 9,
            })),
          scenario: {
            placement: scenario.massing,
            floorAreasSqm: scenario.massing.floorAreasSqm,
            floorHeights: scenario.floors.map((f) => f.heightM),
            id: scenario.id,
            label: scenario.name,
            floors: scenario.floors.length,
            buildingCoveragePercent: scenario.buildingCoverageRatio,
            floorAreaRatioPercent: scenario.floorAreaRatio,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(body.error?.message ?? 'Blender 모델링 요청 실패');
      if (body?.data?.jobId) {
        setBlenderJobId(body.data.jobId);
        void pollBlenderJob(body.data.jobId);
      }
      if (!body?.data?.jobId)
        throw new Error('GPU 작업 ID가 반환되지 않았습니다.');
      setExportStatus('submitted');
    } catch (error) {
      setBlenderMessage(
        error instanceof Error ? error.message : 'Blender 요청 실패',
      );
      setExportStatus('error');
    }
  }, [
    result,
    scenario,
    savedAnalysisId,
    exportStatus,
    blenderJobId,
    pollBlenderJob,
  ]);

  const handleAddressSelect = useCallback(
    (result: AddressResult) => {
      const selected = result.jibunAddress || result.roadAddress;
      if (!selected) return;
      setAddress(selected);
      setQuery(selected);
      window.history.replaceState(
        null,
        '',
        `/analysis?address=${encodeURIComponent(selected)}`,
      );
      void analyze(selected);
    },
    [analyze],
  );

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
          <div className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1.5">
            <AddressSearch
              onSelect={handleAddressSelect}
              placeholder="지번 또는 도로명주소를 입력하세요"
              defaultValue={query}
              className="flex-1"
              inputClassName="h-9 text-sm"
            />
            <Button
              type="button"
              size="sm"
              disabled={!address}
              onClick={() => {
                if (address) void analyze(address, true);
              }}
              className="h-9 shrink-0 bg-cyan-300 px-4 text-slate-950 hover:bg-cyan-200"
            >
              재분석
            </Button>
          </div>
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
          <button
            type="button"
            onClick={() => setShowReportConfirm(true)}
            className="grid size-9 place-items-center rounded-lg border border-lime-300/25 bg-lime-300/10 text-lime-200 transition hover:bg-lime-300/15"
            aria-label="의사결정 보고서 생성"
          >
            <Download className="size-4" />
          </button>
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
              <div className="mx-auto mt-8 rounded-2xl border border-white/12 bg-white/[0.065] p-2 shadow-[0_24px_90px_rgba(0,0,0,.32)] backdrop-blur-xl">
                <AddressSearch
                  onSelect={handleAddressSelect}
                  placeholder="도로명, 지번, 건물명으로 검색"
                />
              </div>
              <p className="mt-4 text-xs text-slate-600">
                예: 서울특별시 강남구 역삼동 123-45
              </p>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="grid min-h-[calc(100vh-64px)] place-items-center px-6">
            <div className="w-full max-w-sm text-center">
              <LoaderCircle className="mx-auto size-10 animate-spin text-cyan-300" />
              <p className="mt-6 text-base font-medium text-white">{message}</p>
              <AnalysisProgressView progress={progress} />
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="grid min-h-[calc(100vh-64px)] place-items-center px-6">
            <Card className="max-w-md border border-rose-400/20 bg-rose-400/5 text-white">
              <CardContent className="flex flex-col items-center py-8 text-center">
                <AlertTriangle className="size-8 text-rose-300" />
                <p className="mt-4 text-sm" role="alert">
                  {message}
                </p>
                <AnalysisProgressView progress={progress} />
                <Button className="mt-5" onClick={() => void analyze(address)}>
                  <RefreshCw />
                  다시 시도
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {status === 'ready' && !result && (
          <div className="grid min-h-[calc(100vh-64px)] place-items-center px-6">
            <Card className="max-w-md border border-amber-300/20 bg-amber-300/5 text-white">
              <CardContent className="flex flex-col items-center py-8 text-center">
                <AlertTriangle className="size-8 text-amber-200" />
                <p className="mt-4 text-sm">
                  분석 결과를 표시할 수 없습니다. 주소 자료를 다시 조회해
                  주세요.
                </p>
                <Button
                  className="mt-5"
                  onClick={() => address && void analyze(address, true)}
                  disabled={!address}
                >
                  <RefreshCw />
                  다시 분석
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {status === 'ready' && result && (
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
                      {result.meta.mode === 'live'
                        ? 'LIVE'
                        : result.meta.mode === 'hybrid'
                          ? 'HYBRID'
                          : 'PREVIEW'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 pt-1">
                  <Metric
                    icon={Ruler}
                    label="대지면적"
                    value={
                      result.data.geometry.areaSqm.value != null
                        ? `${result.data.geometry.areaSqm.value.toLocaleString('ko-KR')}㎡`
                        : '-'
                    }
                  />
                  <Metric
                    icon={Building2}
                    label="지목"
                    value={result.data.geometry.landCategory.value ?? '-'}
                  />
                  <Metric
                    icon={MapPinned}
                    label="도로 폭"
                    value={
                      result.data.geometry.roadWidthM.value != null
                        ? `약 ${result.data.geometry.roadWidthM.value}m`
                        : '미확인'
                    }
                  />
                  <Metric
                    icon={TrendingUp}
                    label="경사"
                    value={
                      result.data.geometry.slopePercent.value != null
                        ? `${result.data.geometry.slopePercent.value}%`
                        : '미확인'
                    }
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
                    <span className="text-xs text-slate-400">
                      일조 분석 중...
                    </span>
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
                        {sunlight.winterSolstice.sunrise} ~{' '}
                        {sunlight.winterSolstice.sunset}
                      </p>
                      <p className="text-xs text-slate-400">
                        {sunlight.winterSolstice.daylightHours}시간
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/10 p-3">
                      <p className="text-[10px] text-slate-500">하지 (6/21)</p>
                      <p className="mt-1 text-sm text-slate-200">
                        {sunlight.summerSolstice.sunrise} ~{' '}
                        {sunlight.summerSolstice.sunset}
                      </p>
                      <p className="text-xs text-slate-400">
                        {sunlight.summerSolstice.daylightHours}시간
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/10 p-3">
                      <p className="text-[10px] text-slate-500">춘분 (3/20)</p>
                      <p className="mt-1 text-sm text-slate-200">
                        {sunlight.equinox.sunrise} ~ {sunlight.equinox.sunset}
                      </p>
                      <p className="text-xs text-slate-400">
                        {sunlight.equinox.daylightHours}시간
                      </p>
                    </div>
                    <SummaryRow
                      label="연간 일조시간 (추정)"
                      value={`${sunlight.annualSunlightHoursEstimate.toLocaleString('ko-KR')}시간`}
                    />
                    <p className="text-[9px] leading-4 text-slate-600">
                      {sunlight.disclaimer}
                    </p>
                  </CardContent>
                </Card>
              )}
            </aside>

            <section className="analysis-scene-frame min-h-[620px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
              <div className="relative h-[520px] xl:h-[calc(100vh-205px)] xl:min-h-[620px]">
                {scenario ? (
                  <>
                    <div
                      className={`absolute inset-0 transition-opacity ${sceneMode === 'massing' ? 'z-[1] opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
                    >
                      <LazyAnalysisScene
                        address={address}
                        center={
                          result.data.identity.center.value ?? {
                            latitude: 0,
                            longitude: 0,
                          }
                        }
                        boundary={result.data.geometry.boundary}
                        areaSqm={result.data.geometry.areaSqm.value ?? 500}
                        scenario={scenario}
                        context={result.data.context}
                      />
                    </div>
                    {hasOpenedContext && (
                      <div
                        className={`absolute inset-0 transition-opacity ${sceneMode === 'context' ? 'z-[1] opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
                      >
                        <LazyCesiumContext
                          address={address}
                          center={
                            result.data.identity.center.value ?? {
                              latitude: 0,
                              longitude: 0,
                            }
                          }
                          areaSqm={
                            result.data.geometry.areaSqm.value ?? undefined
                          }
                          scenario={scenario}
                          boundary={result.data.geometry.boundary.value}
                          context={result.data.context}
                          glbDataUrl={blenderGlb}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid h-full place-items-center px-8 text-center">
                    <div className="max-w-sm rounded-2xl border border-amber-300/20 bg-slate-950/75 p-6 backdrop-blur">
                      <AlertTriangle className="mx-auto size-7 text-amber-200" />
                      <p className="mt-3 text-sm font-medium text-white">
                        3D 매스·도시지형을 만들 수 없습니다.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        VWorld에서 필지 경계 또는 면적을 받지 못했습니다.
                        주소·규제·건축물·시장 자료는 계속 표시됩니다.
                      </p>
                    </div>
                  </div>
                )}
                <div className="pointer-events-none absolute left-5 top-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {!scenario
                      ? '필지 공간자료 미연결'
                      : sceneMode === 'massing'
                        ? 'Interactive massing'
                        : 'Geographic context'}
                  </p>
                  <p className="mt-1 text-base font-medium text-white">
                    {!scenario
                      ? '필지 공간자료 미연결'
                      : sceneMode === 'massing'
                        ? scenarioId === 'custom'
                          ? '세부설정 시나리오'
                          : `${scenario.name} 시나리오`
                        : '도시·지형 컨텍스트'}
                  </p>
                </div>
                <div className="absolute right-5 top-5 z-10 flex rounded-xl border border-white/10 bg-slate-950/70 p-1 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setSceneMode('massing')}
                    disabled={!scenario}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition ${sceneMode === 'massing' ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                  >
                    3D 매스
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasOpenedContext(true);
                      setSceneMode('context');
                    }}
                    disabled={!scenario}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${sceneMode === 'context' ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                  >
                    <Globe2 className="size-3.5" />
                    도시·지형
                  </button>
                </div>
                {scenario && (
                  <div className="absolute bottom-5 left-5 right-5 z-30 flex gap-2 overflow-x-auto pb-1">
                    {result.data.scenarios.map((item) => (
                      <ScenarioButton
                        key={item.id}
                        scenario={item}
                        active={item.id === scenario.id}
                        onClick={() => setScenarioId(item.id)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setScenarioId('custom')}
                      className={`flex min-w-[132px] items-center gap-2 rounded-xl border px-4 py-3 text-left transition ${scenarioId === 'custom' ? 'border-cyan-300/45 bg-cyan-300/10 shadow-[0_0_28px_rgba(34,211,238,.08)]' : 'border-white/8 bg-white/[0.035] hover:bg-white/[0.06]'}`}
                    >
                      <Settings2
                        className={`size-4 ${scenarioId === 'custom' ? 'text-cyan-200' : 'text-slate-400'}`}
                      />
                      <div>
                        <span
                          className={`block text-sm font-medium ${scenarioId === 'custom' ? 'text-cyan-200' : 'text-slate-300'}`}
                        >
                          세부설정
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          직접 조정
                        </span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-4">
              {scenarioId === 'custom' && scenario ? (
                <ScenarioCustomizer
                  appliedScenario={scenario}
                  areaSqm={result.data.geometry.areaSqm.value ?? 500}
                  maxCoverage={legalLimits.maxCoverage}
                  maxFar={legalLimits.maxFar}
                  comparablePricePerSqm={
                    result.data.market.comparableMedianPerSqm.value ?? 0
                  }
                  landPricePerSqm={
                    result.data.market.officialLandPricePerSqm.value ?? 0
                  }
                  placement={scenario.massing}
                  onScenarioChange={handleCustomScenarioChange}
                  onPlacementChange={setPlacementOverride}
                />
              ) : scenario ? (
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
                      value={
                        scenario.estimatedRevenueKrw > 0
                          ? formatKrw(scenario.estimatedRevenueKrw)
                          : '미확인'
                      }
                    />
                    <SummaryRow
                      label="개략 공사비 (가정)"
                      value={
                        scenario.estimatedCostKrw > 0
                          ? formatKrw(scenario.estimatedCostKrw)
                          : '미확인'
                      }
                    />
                    <div className="flex items-center justify-between border-t border-white/10 pt-3">
                      <span className="text-xs text-slate-400">
                        개략 수익률
                      </span>
                      {scenario.estimatedRevenueKrw > 0 ? (
                        <span
                          className={`text-lg font-semibold ${scenario.estimatedProfitRatePercent >= 0 ? 'text-lime-200' : 'text-rose-300'}`}
                        >
                          {scenario.estimatedProfitRatePercent}%
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">
                          시장 데이터 부족
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-amber-300/20 bg-amber-300/5 text-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="size-4 text-amber-200" />
                      시나리오 미산정
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs leading-5 text-slate-400">
                    필지 면적 또는 경계를 받으면 건폐율·용적률 시나리오와 3D
                    매스를 계산합니다. 다른 분석 자료는 아래에 그대로
                    표시됩니다.
                  </CardContent>
                </Card>
              )}

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
                    value={
                      result.data.market.officialLandPricePerSqm.value
                        ? `${formatKrw(result.data.market.officialLandPricePerSqm.value)}/㎡`
                        : '미연결'
                    }
                  />
                  <SummaryRow
                    label="유사사례 중앙값"
                    value={
                      result.data.market.comparableMedianPerSqm.value
                        ? `${formatKrw(result.data.market.comparableMedianPerSqm.value)}/㎡`
                        : '미연결'
                    }
                  />
                  <SummaryRow
                    label="비교 표본"
                    value={
                      result.data.market.comparableCount.value != null
                        ? `${result.data.market.comparableCount.value}건`
                        : '-'
                    }
                  />
                  <SummaryRow
                    label="12개월 추세"
                    value={
                      result.data.market.trendPercent.value != null
                        ? `${result.data.market.trendPercent.value > 0 ? '+' : ''}${result.data.market.trendPercent.value}%`
                        : '미연결'
                    }
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
                  <>
                    <LoaderCircle className="size-4 animate-spin" /> 저장 중...
                  </>
                ) : saveStatus === 'saved' ? (
                  <>
                    <CheckCircle2 className="size-4 text-lime-300" /> 저장 완료
                  </>
                ) : saveStatus === 'error' ? (
                  <>
                    <Save className="size-4" /> 다시 저장 (로그인 필요)
                  </>
                ) : (
                  <>
                    <Save className="size-4" /> 분석 결과 저장
                  </>
                )}
              </Button>

              <Button
                onClick={exportBlender}
                disabled={
                  !savedAnalysisId ||
                  exportStatus === 'submitting' ||
                  exportStatus === 'submitted'
                }
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                {exportStatus === 'submitting' ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" /> Blender
                    렌더링 중...
                  </>
                ) : exportStatus === 'submitted' && blenderPreview ? (
                  <>
                    <CheckCircle2 className="size-4 text-lime-300" /> 조감도
                    렌더링 완료
                  </>
                ) : exportStatus === 'submitted' ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" /> GPU 작업
                    상태 확인 중...
                  </>
                ) : (
                  <>
                    <Box className="size-4" />{' '}
                    {blenderJobId
                      ? 'GPU 작업 상태 다시 확인'
                      : '3D 모델 + 조감도 생성 (Blender)'}
                  </>
                )}
              </Button>
              {blenderMessage && (
                <output className="block text-sm text-slate-400">
                  {blenderMessage}
                </output>
              )}
              {!savedAnalysisId && exportStatus === 'error' && (
                <p className="px-1 text-xs text-amber-300">
                  먼저 분석 결과를 저장해 주세요.
                </p>
              )}
              {blenderPreview && (
                <Card className="overflow-hidden border border-lime-300/15 bg-black/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Sparkles className="size-4 text-lime-300" />
                      Blender 조감도
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <Image
                      unoptimized
                      width={1024}
                      height={768}
                      src={blenderPreview}
                      alt="Blender 조감도 렌더링"
                      className="w-full rounded-lg"
                    />
                    {blenderGlb && (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() =>
                          setShowBlenderModel((current) => !current)
                        }
                      >
                        <Box className="size-4" />
                        {showBlenderModel ? '3D 모델 닫기' : '3D 모델 조작하기'}
                      </Button>
                    )}
                    {blenderGlb && showBlenderModel && (
                      <div className="mt-2">
                        <LazyBlenderModelViewer src={blenderGlb} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <button
                type="button"
                onClick={() => setShowReportConfirm(true)}
                className="block w-full rounded-2xl border border-lime-300/20 bg-lime-300/[0.07] p-4 text-left transition hover:bg-lime-300/[0.12]"
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
              </button>

              <p className="px-1 text-xs leading-5 text-slate-600">
                본 결과는 사전검토용 개략 분석이며 인허가, 감정평가 또는 전문
                용역을 대체하지 않습니다.
              </p>
            </aside>
          </div>
        )}
      </div>

      {/* Report generation confirmation modal */}
      {showReportConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-white/12 bg-[#0c1829] p-6 shadow-[0_40px_120px_rgba(0,0,0,.6)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">보고서 생성</h3>
              <button
                type="button"
                aria-label="보고서 창 닫기"
                onClick={() => setShowReportConfirm(false)}
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-lime-300/15 bg-lime-300/[0.04] p-4">
              <div className="flex gap-3">
                <FileText className="mt-0.5 size-5 shrink-0 text-lime-300" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    PLINT Decision Report
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{address}</p>
                  {result && (
                    <p className="mt-2 text-xs text-slate-500">
                      {result.data.scenarios.length}개 시나리오 · 데이터
                      커버리지 {result.data.coverage.percent}%
                    </p>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              현재 분석 결과를 기반으로 개발·상권 보고서를 생성합니다.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowReportConfirm(false)}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm text-slate-300 hover:bg-white/[0.08]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReportConfirm(false);
                  try {
                    sessionStorage.setItem(
                      'plint-report-input',
                      JSON.stringify({
                        ...result,
                        data: result
                          ? {
                              ...result.data,
                              scenarios:
                                scenario?.id === 'custom'
                                  ? [...result.data.scenarios, scenario]
                                  : result.data.scenarios,
                            }
                          : undefined,
                        selectedScenarioId: scenario?.id,
                      }),
                    );
                  } catch {
                    /* Report can restore the saved analysis. */
                  }
                  router.push(`/report?address=${encodeURIComponent(address)}`);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime-300 py-2.5 text-sm font-medium text-slate-950 hover:bg-lime-200"
              >
                <FileText className="size-4" />
                보고서 생성
              </button>
            </div>
          </div>
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
