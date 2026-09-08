'use client';

import { useMemo, useState } from 'react';
import type { DevelopmentScenario } from '@/lib/domain/parcel-intelligence';

type Props = {
  scenario: DevelopmentScenario;
  areaSqm: number;
};

type DrawingTab = 'floor' | 'elevation' | 'section';

const TAB_LABELS: Record<DrawingTab, string> = {
  floor: '평면도',
  elevation: '입면도',
  section: '단면도',
};

const WALL = '#475569';
const WALL_FILL = '#f8fafc';
const WINDOW = '#7dd3fc';
const SLAB = '#94a3b8';
const DIM = '#64748b';
const LABEL = '#cbd5e1';
const DOOR = '#fbbf24';

function fmt(n: number) {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Floor Plan (평면도)
// ---------------------------------------------------------------------------

function FloorPlanSvg({ scenario, areaSqm }: Props) {
  const baseSide = Math.sqrt(areaSqm * (scenario.buildingCoverageRatio / 100));
  const w = baseSide;
  const d = baseSide * 0.85;
  const wallT = 0.3;
  const pad = 8;
  const svgW = 400;
  const svgH = 340;
  const scale = Math.min((svgW - pad * 2) / (w + 10), (svgH - pad * 2 - 40) / (d + 10));
  const ox = svgW / 2;
  const oy = svgH / 2 + 10;

  const floors = scenario.floors;
  const [selectedFloor, setSelectedFloor] = useState(0);
  const floor = floors[selectedFloor];
  const fs = floor.footprintScale;
  const fw = w * fs;
  const fd = d * fs;

  const hfw = (fw * scale) / 2;
  const hfd = (fd * scale) / 2;
  const wt = wallT * scale;

  return (
    <div>
      <div className="mb-2 flex gap-1 overflow-x-auto">
        {floors.map((f, i) => (
          <button
            key={f.floor}
            onClick={() => setSelectedFloor(i)}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              i === selectedFloor
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {f.floor}F
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" aria-label={`${floor.floor}층 평면도`}>
        <text x={svgW / 2} y={18} textAnchor="middle" fill={LABEL} fontSize={11} fontWeight={600}>
          {floor.floor}층 평면도 (1/{Math.round(1 / scale * 10)}0)
        </text>

        {/* Outer wall */}
        <rect x={ox - hfw} y={oy - hfd} width={fw * scale} height={fd * scale}
          fill={WALL_FILL} stroke={WALL} strokeWidth={wt * 2} />

        {/* Interior walls */}
        <line x1={ox} y1={oy - hfd} x2={ox} y2={oy + hfd}
          stroke={WALL} strokeWidth={wt} />
        <line x1={ox - hfw} y1={oy} x2={ox + hfw} y2={oy}
          stroke={WALL} strokeWidth={wt * 0.8} strokeDasharray={`${wt * 3},${wt * 2}`} />

        {/* Windows - front face */}
        {[0.25, 0.75].map((t) => (
          <rect key={`wf${t}`}
            x={ox - hfw + fw * scale * t - (fw * scale * 0.12)}
            y={oy - hfd - wt}
            width={fw * scale * 0.24} height={wt * 2}
            fill={WINDOW} rx={1} />
        ))}
        {/* Windows - back face */}
        {[0.25, 0.75].map((t) => (
          <rect key={`wb${t}`}
            x={ox - hfw + fw * scale * t - (fw * scale * 0.12)}
            y={oy + hfd - wt}
            width={fw * scale * 0.24} height={wt * 2}
            fill={WINDOW} rx={1} />
        ))}
        {/* Windows - sides */}
        {[0.3, 0.7].map((t) => (
          <rect key={`wl${t}`}
            x={ox - hfw - wt}
            y={oy - hfd + fd * scale * t - (fd * scale * 0.1)}
            width={wt * 2} height={fd * scale * 0.2}
            fill={WINDOW} rx={1} />
        ))}
        {[0.3, 0.7].map((t) => (
          <rect key={`wr${t}`}
            x={ox + hfw - wt}
            y={oy - hfd + fd * scale * t - (fd * scale * 0.1)}
            width={wt * 2} height={fd * scale * 0.2}
            fill={WINDOW} rx={1} />
        ))}

        {/* Door (ground floor) */}
        {floor.floor === 1 && (
          <rect x={ox - fw * scale * 0.06} y={oy + hfd - wt}
            width={fw * scale * 0.12} height={wt * 2.5}
            fill={DOOR} rx={1} />
        )}

        {/* Room labels */}
        <text x={ox - hfw / 2} y={oy - hfd / 2 + 4} textAnchor="middle"
          fill={DIM} fontSize={9} fontWeight={500}>
          {floor.floor === 1 ? '거실' : `실-${floor.floor}A`}
        </text>
        <text x={ox + hfw / 2} y={oy - hfd / 2 + 4} textAnchor="middle"
          fill={DIM} fontSize={9} fontWeight={500}>
          {floor.floor === 1 ? '주방' : `실-${floor.floor}B`}
        </text>
        <text x={ox - hfw / 2} y={oy + hfd / 2 + 4} textAnchor="middle"
          fill={DIM} fontSize={8}>화장실</text>
        <text x={ox + hfw / 2} y={oy + hfd / 2 + 4} textAnchor="middle"
          fill={DIM} fontSize={8}>
          {floor.floor === 1 ? '현관' : '복도'}
        </text>

        {/* Dimension lines */}
        <g stroke={DIM} strokeWidth={0.5} fill={DIM} fontSize={8}>
          {/* Width */}
          <line x1={ox - hfw} y1={oy + hfd + 18} x2={ox + hfw} y2={oy + hfd + 18} markerEnd="url(#arr)" markerStart="url(#arr)" />
          <text x={ox} y={oy + hfd + 28} textAnchor="middle">{fmt(fw)}m</text>
          {/* Depth */}
          <line x1={ox + hfw + 18} y1={oy - hfd} x2={ox + hfw + 18} y2={oy + hfd} markerEnd="url(#arr)" markerStart="url(#arr)" />
          <text x={ox + hfw + 28} y={oy + 3} textAnchor="middle" transform={`rotate(90, ${ox + hfw + 28}, ${oy + 3})`}>{fmt(fd)}m</text>
        </g>
        {/* Arrow marker */}
        <defs>
          <marker id="arr" markerWidth={6} markerHeight={4} refX={3} refY={2} orient="auto">
            <path d="M0,0 L6,2 L0,4" fill={DIM} />
          </marker>
        </defs>

        {/* Area info */}
        <text x={svgW / 2} y={svgH - 8} textAnchor="middle" fill={DIM} fontSize={9}>
          바닥면적: {fmt(fw * fd)}㎡ · 층고: {fmt(floor.heightM)}m
        </text>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Elevation (입면도)
// ---------------------------------------------------------------------------

function ElevationSvg({ scenario, areaSqm }: Props) {
  const baseSide = Math.sqrt(areaSqm * (scenario.buildingCoverageRatio / 100));
  const floors = scenario.floors;
  const totalH = floors.reduce((s, f) => s + f.heightM, 0);
  const maxW = baseSide * Math.max(...floors.map((f) => f.footprintScale));

  const svgW = 400;
  const svgH = 340;
  const pad = 30;
  const scaleX = (svgW - pad * 3) / maxW;
  const scaleY = (svgH - pad * 2 - 20) / (totalH + 2);
  const sc = Math.min(scaleX, scaleY);
  const baseY = svgH - pad;
  const ox = svgW / 2;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" aria-label="정면 입면도">
      <text x={svgW / 2} y={16} textAnchor="middle" fill={LABEL} fontSize={11} fontWeight={600}>
        정면 입면도
      </text>

      {/* Ground line */}
      <line x1={pad} y1={baseY} x2={svgW - pad} y2={baseY} stroke={SLAB} strokeWidth={1.5} />

      {(() => {
        let y = baseY;
        return floors.map((floor) => {
          const fw = baseSide * floor.footprintScale;
          const fh = floor.heightM;
          const hw = (fw * sc) / 2;
          const hPx = fh * sc;
          const floorY = y - hPx;

          const el = (
            <g key={floor.floor}>
              {/* Wall */}
              <rect x={ox - hw} y={floorY} width={hw * 2} height={hPx}
                fill="none" stroke={WALL} strokeWidth={1.2} />

              {/* Floor slab */}
              <rect x={ox - hw - 2} y={floorY + hPx - 1} width={hw * 2 + 4} height={2}
                fill={SLAB} />

              {/* Windows */}
              {Array.from({ length: Math.max(2, Math.round(fw / 3)) }).map((_, i, arr) => {
                const ww = (hw * 2 * 0.7) / arr.length;
                const gap = (hw * 2 - ww * arr.length) / (arr.length + 1);
                const wx = ox - hw + gap + i * (ww + gap);
                const winH = hPx * 0.45;
                const winY = floorY + hPx * 0.2;
                return (
                  <rect key={i} x={wx} y={winY} width={ww * 0.85} height={winH}
                    fill={WINDOW} fillOpacity={0.5} stroke={WINDOW} strokeWidth={0.5} rx={0.5} />
                );
              })}

              {/* Floor label */}
              <text x={ox + hw + 6} y={floorY + hPx / 2 + 3}
                fill={DIM} fontSize={8}>{floor.floor}F</text>

              {/* Height dimension */}
              <line x1={ox - hw - 12} y1={floorY} x2={ox - hw - 12} y2={floorY + hPx}
                stroke={DIM} strokeWidth={0.4} />
              <text x={ox - hw - 16} y={floorY + hPx / 2 + 3}
                fill={DIM} fontSize={7} textAnchor="end">{fmt(fh)}m</text>
            </g>
          );
          y = floorY;
          return el;
        });
      })()}

      {/* Roof line */}
      {(() => {
        const topFloor = floors[floors.length - 1];
        const roofW = baseSide * topFloor.footprintScale;
        const roofY = baseY - totalH * sc;
        const hw = (roofW * sc) / 2;
        return (
          <line x1={ox - hw - 3} y1={roofY} x2={ox + hw + 3} y2={roofY}
            stroke={WALL} strokeWidth={2} />
        );
      })()}

      {/* Total height */}
      <g stroke={DIM} strokeWidth={0.5} fill={DIM} fontSize={8}>
        <line x1={ox + (maxW * sc) / 2 + 24} y1={baseY} x2={ox + (maxW * sc) / 2 + 24} y2={baseY - totalH * sc} />
        <text x={ox + (maxW * sc) / 2 + 30} y={baseY - (totalH * sc) / 2 + 3}
          textAnchor="start">{fmt(totalH)}m</text>
      </g>

      {/* Door on ground */}
      <rect x={ox - 3 * sc / 2} y={baseY - 2.4 * sc} width={3 * sc} height={2.4 * sc}
        fill={DOOR} fillOpacity={0.6} stroke={DOOR} strokeWidth={0.5} rx={1} />

      <text x={svgW / 2} y={svgH - 4} textAnchor="middle" fill={DIM} fontSize={9}>
        {floors.length}F · 총 높이 {fmt(totalH)}m · 건폐율 {Math.round(scenario.buildingCoverageRatio * 100)}%
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Section (단면도)
// ---------------------------------------------------------------------------

function SectionSvg({ scenario, areaSqm }: Props) {
  const baseSide = Math.sqrt(areaSqm * (scenario.buildingCoverageRatio / 100));
  const depth = baseSide * 0.85;
  const floors = scenario.floors;
  const totalH = floors.reduce((s, f) => s + f.heightM, 0);

  const svgW = 400;
  const svgH = 340;
  const pad = 30;
  const scaleX = (svgW - pad * 3) / depth;
  const scaleY = (svgH - pad * 2 - 20) / (totalH + 4);
  const sc = Math.min(scaleX, scaleY);
  const baseY = svgH - pad;
  const ox = svgW / 2;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" aria-label="단면도">
      <text x={svgW / 2} y={16} textAnchor="middle" fill={LABEL} fontSize={11} fontWeight={600}>
        단면도
      </text>

      {/* Ground fill */}
      <rect x={pad} y={baseY} width={svgW - pad * 2} height={20}
        fill="#1e293b" />
      <line x1={pad} y1={baseY} x2={svgW - pad} y2={baseY}
        stroke={SLAB} strokeWidth={1.5} />

      {/* Ground hatch */}
      <g stroke="#334155" strokeWidth={0.5}>
        {Array.from({ length: 20 }).map((_, i) => {
          const x = pad + i * ((svgW - pad * 2) / 20);
          return <line key={i} x1={x} y1={baseY} x2={x + 8} y2={baseY + 16} />;
        })}
      </g>

      {/* Cut section */}
      {(() => {
        let y = baseY;
        return floors.map((floor) => {
          const fd = depth * floor.footprintScale;
          const fh = floor.heightM;
          const hw = (fd * sc) / 2;
          const hPx = fh * sc;
          const floorY = y - hPx;

          const el = (
            <g key={floor.floor}>
              {/* Section cut fill */}
              <rect x={ox - hw} y={floorY} width={hw * 2} height={hPx}
                fill="#0f172a" fillOpacity={0.5} stroke={WALL} strokeWidth={1.2} />

              {/* Floor slab (thick in section) */}
              <rect x={ox - hw - 1} y={y - 2} width={hw * 2 + 2} height={3}
                fill={WALL} />

              {/* Ceiling line */}
              <line x1={ox - hw} y1={floorY + 1} x2={ox + hw} y2={floorY + 1}
                stroke={SLAB} strokeWidth={0.5} strokeDasharray="3,2" />

              {/* Person silhouette (scale reference) */}
              {floor.floor === 1 && (
                <g transform={`translate(${ox - hw / 2}, ${y})`}>
                  <line x1={0} y1={0} x2={0} y2={-1.7 * sc} stroke={DIM} strokeWidth={0.8} />
                  <circle cx={0} cy={-1.7 * sc - 0.15 * sc} r={0.15 * sc} fill="none" stroke={DIM} strokeWidth={0.5} />
                  <text x={3} y={-0.8 * sc} fill={DIM} fontSize={6}>1.7m</text>
                </g>
              )}

              {/* Floor label */}
              <text x={ox + hw + 6} y={floorY + hPx / 2 + 3}
                fill={DIM} fontSize={8}>{floor.floor}F</text>

              {/* Height marker */}
              <line x1={ox - hw - 10} y1={floorY} x2={ox - hw - 10} y2={y}
                stroke={DIM} strokeWidth={0.4} />
              <text x={ox - hw - 14} y={floorY + hPx / 2 + 3}
                fill={DIM} fontSize={7} textAnchor="end">{fmt(fh)}m</text>
            </g>
          );
          y = floorY;
          return el;
        });
      })()}

      {/* Roof */}
      {(() => {
        const topFloor = floors[floors.length - 1];
        const roofD = depth * topFloor.footprintScale;
        const hw = (roofD * sc) / 2;
        const roofY = baseY - totalH * sc;
        return (
          <rect x={ox - hw - 2} y={roofY - 2} width={hw * 2 + 4} height={3}
            fill={WALL} />
        );
      })()}

      <text x={svgW / 2} y={svgH - 4} textAnchor="middle" fill={DIM} fontSize={9}>
        깊이(단면방향): {fmt(depth)}m · 총 높이: {fmt(totalH)}m
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Exported Component
// ---------------------------------------------------------------------------

export function ArchitecturalDrawings({ scenario, areaSqm }: Props) {
  const [tab, setTab] = useState<DrawingTab>('floor');

  const drawing = useMemo(() => {
    switch (tab) {
      case 'floor':
        return <FloorPlanSvg scenario={scenario} areaSqm={areaSqm} />;
      case 'elevation':
        return <ElevationSvg scenario={scenario} areaSqm={areaSqm} />;
      case 'section':
        return <SectionSvg scenario={scenario} areaSqm={areaSqm} />;
    }
  }, [tab, scenario, areaSqm]);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          건축 도면
        </h3>
        <div className="flex gap-1 rounded-lg bg-slate-800/60 p-0.5">
          {(Object.entries(TAB_LABELS) as [DrawingTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                tab === key
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg bg-slate-950/50 p-2">
        {drawing}
      </div>
      <p className="mt-2 text-center text-[9px] text-slate-600">
        본 도면은 개발 검토용 자동 생성 도면이며, 실제 설계 도면을 대체하지 않습니다.
      </p>
    </div>
  );
}
