import { fact, type Evidence } from '@/lib/domain/evidence';
import type { ContextBuilding, Polygon } from '@/lib/domain/parcel-intelligence';
import { getConnectorManifest } from '@/lib/external-apis/registry';

function seedFrom(value: string) {
  return Array.from(value).reduce((seed, char) => (seed * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
}

function evidence(connectorId: string, snapshotSuffix: string, confidence: Evidence['confidence'] = 'verified'): Evidence {
  const manifest = getConnectorManifest(connectorId);
  if (!manifest) throw new Error(`Unknown connector: ${connectorId}`);
  return {
    provider: manifest.provider,
    datasetId: manifest.datasetId,
    sourceUrl: manifest.sourceUrl,
    observedAt: new Date().toISOString(),
    effectiveAt: new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString(),
    licenseCode: manifest.licenseCode,
    coordinateSystem: manifest.coordinateSystem,
    rawSnapshotId: `mock-${connectorId}-${snapshotSuffix}`,
    confidence,
  };
}

function rectangle(width: number, depth: number, offsetX = 0, offsetY = 0): Polygon {
  return {
    type: 'Polygon',
    coordinates: [[
      [offsetX - width / 2, offsetY - depth / 2],
      [offsetX + width / 2, offsetY - depth / 2],
      [offsetX + width / 2, offsetY + depth / 2],
      [offsetX - width / 2, offsetY + depth / 2],
      [offsetX - width / 2, offsetY - depth / 2],
    ]],
  };
}

export function createMockSourceData(address: string) {
  const seed = seedFrom(address);
  const suffix = seed.toString(16);
  const areaSqm = 430 + (seed % 260);
  const latitude = 37.53 + ((seed % 180) - 90) / 10000;
  const longitude = 127.04 + (((seed >> 4) % 180) - 90) / 10000;
  const officialLandPrice = 4_300_000 + (seed % 35) * 100_000;
  const comparablePrice = officialLandPrice * 2.35;
  const boundary = rectangle(24 + (seed % 6), 19 + ((seed >> 3) % 5));

  const context: ContextBuilding[] = Array.from({ length: 11 }, (_, index) => {
    const angle = (index / 11) * Math.PI * 2;
    const radius = 34 + (index % 3) * 10;
    const floors = 2 + ((seed + index * 7) % 7);
    return {
      id: `context-${index + 1}`,
      footprint: rectangle(9 + (index % 4), 7 + ((index + 2) % 5), Math.cos(angle) * radius, Math.sin(angle) * radius),
      heightM: fact(floors * 3.2, [evidence('gis-building', `${suffix}-${index}`, 'estimated')], {
        derivation: 'context-height:v1=floors*3.2m',
        warnings: ['높이 원본이 없는 경우 층수 기반 표준 층고로 추정합니다.'],
      }),
    };
  });

  return {
    seed,
    suffix,
    areaSqm,
    latitude,
    longitude,
    officialLandPrice,
    comparablePrice,
    boundary,
    context,
    evidence,
  };
}
