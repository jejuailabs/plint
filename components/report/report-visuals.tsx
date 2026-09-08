'use client';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { LazyAnalysisScene } from '@/components/analysis/lazy-analysis-scene';
import { LazyCesiumContext } from '@/components/analysis/lazy-cesium-context';
import type {
  ParcelIntelligence,
  DevelopmentScenario,
} from '@/lib/domain/parcel-intelligence';
export type ReportImages = {
  massing: string;
  cesium: string;
  capturedAt: string;
  scenarioId: string;
  attribution: string;
};
export function ReportVisuals({
  data,
  scenario,
  onImages,
}: {
  data: ParcelIntelligence;
  scenario: DevelopmentScenario;
  onImages: (images: ReportImages) => void;
}) {
  const mass = useRef<(() => Promise<string>) | null>(null),
    geo = useRef<(() => Promise<string>) | null>(null);
  const [ready, setReady] = useState({ mass: false, geo: false });
  const [images, setImages] = useState<ReportImages | null>(
    data.reportImages ?? null,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const massReady = useCallback((fn: () => Promise<string>) => {
    mass.current = fn;
    setReady((v) => ({ ...v, mass: true }));
  }, []);
  const geoReady = useCallback((fn: () => Promise<string>) => {
    geo.current = fn;
    setReady((v) => ({ ...v, geo: true }));
  }, []);
  const capture = async () => {
    if (!mass.current || !geo.current) return;
    setBusy(true);
    setError('');
    try {
      const [massing, cesium] = await Promise.all([
        mass.current(),
        geo.current(),
      ]);
      const value = {
        massing,
        cesium,
        capturedAt: new Date().toISOString(),
        scenarioId: scenario.id,
        attribution:
          '매스 배경: 공간정보 오픈플랫폼 VWorld · 지리 배경: VWorld 3D (기본) / Cesium 대체 지도. 화면의 공급자 출처 표시를 함께 확인하세요.',
      };
      setImages(value);
      onImages(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 저장 실패');
    } finally {
      setBusy(false);
    }
  };
  const center = data.identity.center.value;
  if (!center || center.latitude < 33 || center.longitude < 124)
    return (
      <p>
        좌표를 확인하지 못해 현장 이미지를 생성할 수 없습니다. 주소·좌표를 다시
        조회해 주세요.
      </p>
    );
  return (
    <section className="col-span-full space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 print:hidden">
        <div>
          <h3 className="mb-2 text-sm">대지·배치 매스 · {scenario.name}</h3>
          <div className="relative h-[420px] overflow-hidden rounded-xl border border-white/10">
            <LazyAnalysisScene
              address={data.identity.jibunAddress.value ?? ''}
              center={center}
              boundary={data.geometry.boundary}
              areaSqm={data.geometry.areaSqm.value ?? 0}
              scenario={scenario}
              context={data.context}
              onCaptureReady={massReady}
            />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm">
            VWorld 3D / Cesium 현장 · 같은 배치안
          </h3>
          <div className="relative h-[420px] overflow-hidden rounded-xl border border-white/10">
            <LazyCesiumContext
              address={data.identity.jibunAddress.value ?? ''}
              center={center}
              areaSqm={data.geometry.areaSqm.value ?? 0}
              boundary={data.geometry.boundary.value}
              context={data.context}
              scenario={scenario}
              onCaptureReady={geoReady}
            />
          </div>
        </div>
      </div>
      <div className="print:hidden">
        <button
          type="button"
          disabled={!ready.mass || !ready.geo || busy}
          onClick={() => void capture()}
          className="rounded-lg bg-cyan-300 px-4 py-2 text-sm text-slate-950 disabled:opacity-40"
        >
          {busy
            ? '이미지 캡처 중…'
            : images
              ? '현재 시점으로 이미지 갱신'
              : '두 화면을 보고서 이미지로 저장'}
        </button>
        <p className="mt-2 text-xs text-slate-400">
          원하는 시점으로 회전·확대 후 저장하세요. 두 이미지는 인쇄/PDF와
          Excel에 함께 포함됩니다.
        </p>
        {error && (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        )}
      </div>
      {images && (
        <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-1">
          {(['massing', 'cesium'] as const).map((kind) => (
            <figure key={kind} className="break-inside-avoid">
              <Image
                unoptimized
                width={1200}
                height={700}
                src={images[kind]}
                alt={
                  kind === 'massing'
                    ? '분석 매스 저장 이미지'
                    : 'Cesium 현장 저장 이미지'
                }
                className="w-full rounded-xl"
              />
              <figcaption className="mt-2 text-xs text-slate-400">
                {kind === 'massing' ? '3D 배치 매스' : 'Cesium 지리 맥락'} ·{' '}
                {scenario.name} ·{' '}
                {new Date(images.capturedAt).toLocaleString('ko-KR')} · 규제
                미검증
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400 print:text-slate-600">
        {images?.attribution ?? '영상 출처: VWorld 3D · Cesium'} · 지형·주변
        건물 자료의 누락과 높이 추정이 있을 수 있습니다. 현황 측량도나 법정
        일조검토 결과가 아닙니다.
      </p>
    </section>
  );
}
