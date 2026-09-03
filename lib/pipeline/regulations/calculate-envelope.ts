import type { DevelopmentScenario } from '@/lib/domain/parcel-intelligence';

type EnvelopeInput = {
  areaSqm: number;
  buildingCoverageLimit: number;
  floorAreaRatioLimit: number;
  comparablePricePerSqm: number;
  landPricePerSqm: number;
};

const FLOOR_HEIGHT_M = 3.3;
const CONSTRUCTION_COST_PER_SQM = 3_250_000;

function createScenario(
  input: EnvelopeInput,
  definition: Pick<DevelopmentScenario, 'id' | 'name' | 'strategy'> & { coverageFactor: number; farFactor: number },
): DevelopmentScenario {
  const buildingCoverageRatio = input.buildingCoverageLimit * definition.coverageFactor;
  const floorAreaRatio = input.floorAreaRatioLimit * definition.farFactor;
  const footprintSqm = input.areaSqm * (buildingCoverageRatio / 100);
  const grossFloorAreaSqm = input.areaSqm * (floorAreaRatio / 100);
  const floorCount = Math.max(1, Math.ceil(grossFloorAreaSqm / footprintSqm));
  const floors = Array.from({ length: floorCount }, (_, index) => ({
    floor: index + 1,
    footprintScale: Math.max(0.7, 1 - Math.max(0, index - 2) * 0.07),
    heightM: FLOOR_HEIGHT_M,
  }));
  const estimatedRevenueKrw = Math.round(grossFloorAreaSqm * input.comparablePricePerSqm);
  const estimatedCostKrw = Math.round(
    grossFloorAreaSqm * CONSTRUCTION_COST_PER_SQM + input.areaSqm * input.landPricePerSqm * 1.22,
  );
  const estimatedProfitRatePercent = Number(
    (((estimatedRevenueKrw - estimatedCostKrw) / estimatedCostKrw) * 100).toFixed(1),
  );

  return {
    id: definition.id,
    name: definition.name,
    strategy: definition.strategy,
    buildingCoverageRatio: Number(buildingCoverageRatio.toFixed(1)),
    floorAreaRatio: Number(floorAreaRatio.toFixed(1)),
    grossFloorAreaSqm: Math.round(grossFloorAreaSqm),
    floors,
    estimatedRevenueKrw,
    estimatedCostKrw,
    estimatedProfitRatePercent,
    isPreliminaryOnly: true,
  };
}

export function calculateScenarios(input: EnvelopeInput): DevelopmentScenario[] {
  return [
    createScenario(input, { id: 'yield', name: '최대 용적', strategy: 'max_yield', coverageFactor: 1, farFactor: 1 }),
    createScenario(input, { id: 'balanced', name: '균형 개발', strategy: 'balanced', coverageFactor: 0.9, farFactor: 0.88 }),
    createScenario(input, { id: 'quality', name: '공간 품질', strategy: 'quality', coverageFactor: 0.78, farFactor: 0.72 }),
  ];
}
