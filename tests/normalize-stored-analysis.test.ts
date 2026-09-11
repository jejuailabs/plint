import { describe, expect, it } from 'vitest';
import { normalizeStoredAnalysis } from '@/lib/domain/normalize-stored-analysis';

const evidence = [
  {
    provider: 'legacy-provider',
    datasetId: 'legacy',
    sourceUrl: 'https://example.com/dataset',
    observedAt: '2026-09-11T00:00:00.000Z',
    licenseCode: 'PUBLIC',
    rawSnapshotId: 'legacy-snapshot',
    confidence: 'derived',
  },
];

const storedAnalysis = {
  pipelineVersion: 2,
  identity: {
    center: { value: { latitude: 33.5, longitude: 126.5 }, evidence, warnings: [] },
  },
  scenarios: [{ id: 'balanced' }],
  demand: {
    population1km: { value: 1200, evidence, warnings: [] },
    households1km: { value: 500, evidence, warnings: [] },
    businesses500m: { value: 30, evidence, warnings: [] },
  },
};

describe('normalizeStoredAnalysis', () => {
  it('upgrades legacy demand keys without treating an unrelated value as a verified nearby business count', () => {
    const normalized = normalizeStoredAnalysis(storedAnalysis);
    expect(normalized?.demand.populationAdministrativeArea.value).toBe(1200);
    expect(normalized?.demand.householdsAdministrativeArea.value).toBe(500);
    expect(normalized?.demand.nearbyBusinesses500m.value).toBeNull();
    expect(normalized?.demand.administrativeArea.value).toBeNull();
  });

  it('rejects records that cannot render an analysis workspace', () => {
    expect(normalizeStoredAnalysis({ scenarios: [] })).toBeNull();
  });
});
