import { describe, expect, it } from 'vitest';

import { POST } from '@/app/api/analysis/preview/route';
import { runPreviewAnalysis } from '@/lib/pipeline/preview';
import { calculateScenarios } from '@/lib/pipeline/regulations/calculate-envelope';

describe('development scenarios', () => {
  it('orders scenarios from maximum yield to quality', () => {
    const scenarios = calculateScenarios({
      areaSqm: 600,
      buildingCoverageLimit: 60,
      floorAreaRatioLimit: 200,
      comparablePricePerSqm: 12_000_000,
      landPricePerSqm: 5_000_000,
    });

    expect(scenarios).toHaveLength(3);
    expect(scenarios.map((scenario) => scenario.id)).toEqual(['yield', 'balanced', 'quality']);
    expect(scenarios[0].grossFloorAreaSqm).toBeGreaterThan(scenarios[1].grossFloorAreaSqm);
    expect(scenarios[1].grossFloorAreaSqm).toBeGreaterThan(scenarios[2].grossFloorAreaSqm);
    expect(scenarios.every((scenario) => scenario.isPreliminaryOnly)).toBe(true);
  });

  it('never exceeds the supplied statutory candidates', () => {
    const [scenario] = calculateScenarios({
      areaSqm: 480,
      buildingCoverageLimit: 50,
      floorAreaRatioLimit: 150,
      comparablePricePerSqm: 9_000_000,
      landPricePerSqm: 4_000_000,
    });

    expect(scenario.buildingCoverageRatio).toBeLessThanOrEqual(50);
    expect(scenario.floorAreaRatio).toBeLessThanOrEqual(150);
    expect(scenario.grossFloorAreaSqm).toBe(720);
  });
});

describe('preview analysis', () => {
  it('creates a deterministic parcel with traceable evidence', async () => {
    const address = '서울특별시 성동구 성수동2가 277-17';
    const first = await runPreviewAnalysis(address);
    const second = await runPreviewAnalysis(address);

    expect(first.meta.mode).toBe('mock');
    expect(first.data.identity.pnu.value).toBe(second.data.identity.pnu.value);
    expect(first.data.geometry.areaSqm.value).toBe(second.data.geometry.areaSqm.value);
    expect(first.data.geometry.boundary.evidence[0].datasetId).toBe('15056910');
    expect(first.data.scenarios).toHaveLength(3);
    expect(first.data.coverage.percent).toBeGreaterThan(0);
    expect(first.data.coverage.percent).toBeLessThan(100);
  });

  it('marks unavailable risk sources instead of inventing a low score', async () => {
    const result = await runPreviewAnalysis('서울특별시 강남구 역삼동 123-4');
    const flood = result.data.risks.find((risk) => risk.code === 'FLOOD');

    expect(flood?.level).toBe('unknown');
    expect(flood?.finding.value).toBeNull();
    expect(flood?.finding.warnings.length).toBeGreaterThan(0);
  });
});

describe('preview route', () => {
  it('rejects an invalid address with the common error envelope', async () => {
    const request = new Request('http://localhost/api/analysis/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: '서울' }),
    });
    const response = await POST(request);
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_ADDRESS');
  });
});
