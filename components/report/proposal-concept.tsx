'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { DevelopmentScenario } from '@/lib/domain/parcel-intelligence';
import {
  conceptUses,
  conceptStyles,
  type ConceptImage,
} from '@/lib/report/concept';
import type { ReportImages } from './report-visuals';
export function ProposalConcept({
  address,
  scenario,
  images,
  initial,
  onApprove,
}: {
  address: string;
  scenario: DevelopmentScenario;
  images: ReportImages | null;
  initial?: ConceptImage;
  onApprove: (image: ConceptImage) => void;
}) {
  const [use, setUse] = useState<string>(conceptUses[0]),
    [style, setStyle] = useState<string>(conceptStyles[0]);
  const [output, setOutput] = useState<ConceptImage | null>(initial ?? null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function generate() {
    if (!images) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/analysis/concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          use,
          style,
          floors: scenario.floors.length,
          heightM: scenario.floors.reduce((s, f) => s + f.heightM, 0),
          grossArea: scenario.grossFloorAreaSqm,
          massing: images.massing,
          cesium: images.cesium,
        }),
        signal: AbortSignal.timeout(175000),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? '이미지 생성 실패');
      setOutput(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 생성 실패');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 space-y-4 rounded-xl border border-cyan-500/20 p-5 print:break-inside-avoid">
      <div className="print:hidden">
        <h3 className="text-base font-medium">
          제안서용 건축 이미지 · GPT Image 2
        </h3>
        <p className="mt-2 text-xs text-slate-400">
          저장한 현장·매스 이미지를 OpenAI에 보내 생성합니다. API 사용료가
          발생합니다. 주변 건물과 해안선의 보존을 원본과 비교한 뒤 보고서에 넣어
          주세요.
        </p>
        <div className="my-3 flex flex-wrap items-end gap-3">
          <label className="text-xs">
            건축 용도 가정
            <select
              aria-label="제안 건축 용도"
              value={use}
              onChange={(e) => setUse(e.target.value)}
              className="mt-1 block rounded bg-slate-800 p-2 text-white"
            >
              {conceptUses.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            표현 방식
            <select
              aria-label="제안 이미지 표현 방식"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="mt-1 block rounded bg-slate-800 p-2 text-white"
            >
              {conceptStyles.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <span className="text-xs">
            {scenario.floors.length}층 · {scenario.name}
            <br />
            층수 변경: 분석 화면의 세부설정
          </span>
        </div>
        <button
          disabled={!images || images.scenarioId !== scenario.id || busy}
          onClick={() => void generate()}
          className="rounded bg-cyan-300 px-4 py-2 text-sm text-slate-950 disabled:opacity-40"
        >
          {busy ? '제안 이미지 생성 중…' : '선택 조건으로 이미지 생성'}
        </button>
        <p className="mt-2 text-xs text-slate-400">
          용도 허용 여부는 미검증입니다. 먼저 같은 시나리오의 두 화면을 저장해
          주세요. 생성 그림은 측량도·설계도·인허가 결과가 아닙니다.
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-rose-400">
            {error}
          </p>
        )}
      </div>
      {output && (
        <figure className={output.reviewed ? '' : 'print:hidden'}>
          <Image
            unoptimized
            src={output.image}
            alt="AI 생성 건축 제안 컨셉 이미지"
            width={1536}
            height={1024}
            className="h-auto w-full rounded-lg"
          />
          <figcaption className="mt-2 text-xs">
            AI 생성 개념 이미지 · {output.model} ·{' '}
            {new Date(output.generatedAt).toLocaleDateString('ko-KR')} · 실제
            현황 및 설계 정확성을 보장하지 않습니다.
          </figcaption>
          {!output.reviewed && (
            <button
              onClick={() => {
                const approved = { ...output, reviewed: true };
                setOutput(approved);
                onApprove(approved);
              }}
              className="mt-3 rounded border border-cyan-500 px-4 py-2 text-sm print:hidden"
            >
              원본과 비교 검토함 · 보고서에 포함
            </button>
          )}
        </figure>
      )}
    </section>
  );
}
