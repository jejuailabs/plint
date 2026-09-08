'use client';

import { Settings2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  DevelopmentScenario,
  MassFloor,
} from '@/lib/domain/parcel-intelligence';

type CustomParams = {
  coveragePercent: number;
  farPercent: number;
  floors: number;
  typicalFloorHeightM: number;
  groundFloorHeightM: number;
  constructionCostPerSqm: number;
};

type Props = {
  areaSqm: number;
  appliedScenario?: DevelopmentScenario;
  maxCoverage: number;
  maxFar: number;
  comparablePricePerSqm: number;
  landPricePerSqm: number;
  onScenarioChange: (scenario: DevelopmentScenario) => void;
};

const DEFAULT_CONSTRUCTION_COST = 3_250_000;

function buildCustomScenario(
  areaSqm: number,
  params: CustomParams,
  comparablePricePerSqm: number,
  landPricePerSqm: number,
): DevelopmentScenario {
  const footprintSqm = areaSqm * (params.coveragePercent / 100);
  const grossFloorAreaSqm = Math.min(
    areaSqm * (params.farPercent / 100),
    footprintSqm * params.floors,
  );
  const floorCount = params.floors;

  const floors: MassFloor[] = Array.from({ length: floorCount }, (_, i) => ({
    floor: i + 1,
    footprintScale: 1,
    heightM: i === 0 ? params.groundFloorHeightM : params.typicalFloorHeightM,
  }));

  const estimatedRevenueKrw = 0;
  void comparablePricePerSqm;
  void landPricePerSqm;
  const estimatedCostKrw = Math.round(
    grossFloorAreaSqm * params.constructionCostPerSqm,
  );
  const estimatedProfitRatePercent = 0;

  return {
    id: 'custom',
    name: '세부설정',
    strategy: 'balanced',
    buildingCoverageRatio: Number(
      ((grossFloorAreaSqm / floorCount / areaSqm) * 100).toFixed(1),
    ),
    floorAreaRatio: Number(((grossFloorAreaSqm / areaSqm) * 100).toFixed(1)),
    grossFloorAreaSqm: Math.round(grossFloorAreaSqm),
    floors,
    estimatedRevenueKrw,
    estimatedCostKrw,
    estimatedProfitRatePercent,
    isPreliminaryOnly: true,
  };
}

function SliderRow({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-400">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            className="w-16 rounded border border-slate-600/50 bg-slate-800/60 px-1.5 py-0.5 text-right text-xs text-slate-200 outline-none focus:border-cyan-400/50"
          />
          <span className="text-[10px] text-slate-500">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700/60 accent-cyan-400 [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-300"
      />
      <div className="flex justify-between text-[9px] text-slate-600">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

function formatKrw(value: number) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (value >= 10_000)
    return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`;
  return `${value.toLocaleString('ko-KR')}`;
}

export function ScenarioCustomizer({
  areaSqm,
  appliedScenario,
  maxCoverage,
  maxFar,
  comparablePricePerSqm,
  landPricePerSqm,
  onScenarioChange,
}: Props) {
  const defaultFloors = useMemo(() => {
    const footprint = areaSqm * (maxCoverage / 100);
    const gross = areaSqm * ((maxFar * 0.88) / 100);
    return Math.max(1, Math.ceil(gross / footprint));
  }, [areaSqm, maxCoverage, maxFar]);

  const [params, setParams] = useState<CustomParams>({
    coveragePercent: Math.round(maxCoverage * 0.9),
    farPercent: Math.round(maxFar * 0.88),
    floors: defaultFloors,
    typicalFloorHeightM: 3.3,
    groundFloorHeightM: 4.0,
    constructionCostPerSqm: DEFAULT_CONSTRUCTION_COST,
  });

  const maxFloors = useMemo(() => {
    const footprint = areaSqm * (params.coveragePercent / 100);
    if (footprint <= 0) return 1;
    return Math.max(1, Math.ceil((areaSqm * (maxFar / 100)) / footprint));
  }, [areaSqm, params.coveragePercent, maxFar]);

  const update = useCallback(
    (partial: Partial<CustomParams>) => {
      setParams((prev) => {
        const next = { ...prev, ...partial };
        if ('coveragePercent' in partial || 'farPercent' in partial) {
          const footprint = areaSqm * (next.coveragePercent / 100);
          if (footprint > 0) {
            next.floors = Math.max(
              1,
              Math.ceil((areaSqm * (next.farPercent / 100)) / footprint),
            );
          }
        }
        return next;
      });
    },
    [areaSqm],
  );

  const scenario = useMemo(
    () =>
      buildCustomScenario(
        areaSqm,
        params,
        comparablePricePerSqm,
        landPricePerSqm,
      ),
    [areaSqm, params, comparablePricePerSqm, landPricePerSqm],
  );

  useEffect(() => {
    onScenarioChange(scenario);
  }, [scenario, onScenarioChange]);

  const displayScenario = appliedScenario ?? scenario;
  const totalHeight = displayScenario.floors.reduce((s, f) => s + f.heightM, 0);

  return (
    <div className="space-y-4 rounded-xl border border-cyan-300/15 scenario-customizer bg-slate-900/60 p-4">
      <div className="flex items-center gap-2">
        <Settings2 className="size-4 text-cyan-300" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          세부설정
        </h3>
        <span className="ml-auto rounded bg-cyan-300/10 px-1.5 py-0.5 text-[9px] text-cyan-300">
          검토 가정: 건폐 {maxCoverage}% · 용적 {maxFar}%
        </span>
      </div>

      <div className="space-y-4">
        <SliderRow
          label="건폐율"
          unit="%"
          value={params.coveragePercent}
          min={10}
          max={maxCoverage}
          step={1}
          onChange={(v) => update({ coveragePercent: v })}
        />

        <SliderRow
          label="용적률"
          unit="%"
          value={params.farPercent}
          min={10}
          max={maxFar}
          step={1}
          onChange={(v) => update({ farPercent: v })}
        />

        <SliderRow
          label="층수"
          unit="층"
          value={params.floors}
          min={1}
          max={Math.max(maxFloors, params.floors)}
          step={1}
          onChange={(v) => update({ floors: v })}
        />

        <div className="grid grid-cols-2 gap-3">
          <SliderRow
            label="기준 층고"
            unit="m"
            value={params.typicalFloorHeightM}
            min={2.7}
            max={5.0}
            step={0.1}
            onChange={(v) => update({ typicalFloorHeightM: v })}
          />

          <SliderRow
            label="1층 층고"
            unit="m"
            value={params.groundFloorHeightM}
            min={3.0}
            max={6.0}
            step={0.1}
            onChange={(v) => update({ groundFloorHeightM: v })}
          />
        </div>

        <SliderRow
          label="공사비 단가"
          unit="원/㎡"
          value={params.constructionCostPerSqm}
          min={2_000_000}
          max={6_000_000}
          step={50_000}
          onChange={(v) => update({ constructionCostPerSqm: v })}
        />
      </div>

      <div className="space-y-2 rounded-lg border border-white/8 bg-black/20 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">예상 연면적</span>
          <span className="font-medium text-slate-200">
            {displayScenario.grossFloorAreaSqm.toLocaleString('ko-KR')}㎡
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">건물 높이</span>
          <span className="font-medium text-slate-200">
            {totalHeight.toFixed(1)}m ({params.floors}층)
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">예상 매출</span>
          <span className="font-medium text-slate-200">
            {displayScenario.estimatedRevenueKrw > 0
              ? formatKrw(displayScenario.estimatedRevenueKrw) + '원'
              : '미산정'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">개략 공사비</span>
          <span className="font-medium text-slate-200">
            {formatKrw(displayScenario.estimatedCostKrw)}원
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-white/8 pt-2 text-xs">
          <span className="text-slate-400">개략 수익률</span>
          <span
            className={`text-base font-semibold ${displayScenario.estimatedProfitRatePercent >= 0 ? 'text-lime-200' : 'text-rose-300'}`}
          >
            {displayScenario.estimatedRevenueKrw > 0
              ? `${displayScenario.estimatedProfitRatePercent}%`
              : '미산정'}
          </span>
        </div>
      </div>

      <p className="text-[9px] text-slate-600">
        조정값은 법정 한도가 아닙니다. 규제·주차·이격은 별도 검증해야 하며
        매출/수익률은 수익 모델 입력 전 미산정입니다.
      </p>
    </div>
  );
}
