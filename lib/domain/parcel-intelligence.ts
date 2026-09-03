import type { Fact } from '@/lib/domain/evidence';

export type Position = [number, number];

export type Polygon = {
  type: 'Polygon';
  coordinates: Position[][];
};

export type ParcelIdentity = {
  pnu: Fact<string>;
  jibunAddress: Fact<string>;
  roadAddress: Fact<string>;
  center: Fact<{ latitude: number; longitude: number }>;
};

export type ParcelGeometry = {
  areaSqm: Fact<number>;
  landCategory: Fact<string>;
  boundary: Fact<Polygon>;
  frontageM: Fact<number>;
  roadWidthM: Fact<number>;
  slopePercent: Fact<number>;
};

export type PlanningConstraint = {
  code: string;
  name: string;
  category: 'zoning' | 'district' | 'road' | 'height' | 'parking' | 'sunlight';
  status: 'confirmed' | 'conditional' | 'review_required';
  summary: Fact<string>;
};

export type ExistingBuilding = {
  id: string;
  use: Fact<string>;
  floorsAbove: Fact<number>;
  totalFloorAreaSqm: Fact<number>;
  approvedAt: Fact<string>;
};

export type ContextBuilding = {
  id: string;
  footprint: Polygon;
  heightM: Fact<number>;
};

export type MarketEvidence = {
  officialLandPricePerSqm: Fact<number>;
  comparableMedianPerSqm: Fact<number>;
  comparableCount: Fact<number>;
  trendPercent: Fact<number>;
};

export type DemandProfile = {
  population1km: Fact<number>;
  households1km: Fact<number>;
  businesses500m: Fact<number>;
  transitStops500m: Fact<number>;
};

export type ClimateProfile = {
  annualSunlightHours: Fact<number>;
  solarRadiationKwhM2: Fact<number>;
  prevailingWind: Fact<string>;
};

export type RiskFinding = {
  code: string;
  label: string;
  level: 'low' | 'medium' | 'high' | 'unknown';
  finding: Fact<string>;
  nextAction?: string;
};

export type MassFloor = {
  floor: number;
  footprintScale: number;
  heightM: number;
};

export type DevelopmentScenario = {
  id: string;
  name: string;
  strategy: 'max_yield' | 'balanced' | 'quality';
  buildingCoverageRatio: number;
  floorAreaRatio: number;
  grossFloorAreaSqm: number;
  floors: MassFloor[];
  estimatedRevenueKrw: number;
  estimatedCostKrw: number;
  estimatedProfitRatePercent: number;
  isPreliminaryOnly: true;
};

export type CoverageScore = {
  percent: number;
  verifiedFacts: number;
  derivedFacts: number;
  estimatedFacts: number;
  missingFacts: number;
};

export type ParcelIntelligence = {
  identity: ParcelIdentity;
  geometry: ParcelGeometry;
  planning: PlanningConstraint[];
  existing: ExistingBuilding[];
  context: ContextBuilding[];
  market: MarketEvidence;
  demand: DemandProfile;
  climate: ClimateProfile;
  risks: RiskFinding[];
  scenarios: DevelopmentScenario[];
  coverage: CoverageScore;
};

export type AnalysisPreviewResponse = {
  data: ParcelIntelligence;
  meta: {
    requestId: string;
    generatedAt: string;
    mode: 'mock' | 'live' | 'hybrid';
    durationMs: number;
  };
};
