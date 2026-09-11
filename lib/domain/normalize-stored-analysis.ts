import { fact, type Fact } from '@/lib/domain/evidence';
import type { ParcelIntelligence } from '@/lib/domain/parcel-intelligence';

type FactRecord = Record<string, unknown>;

function isRecord(value: unknown): value is FactRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFact(value: unknown): value is Fact<unknown> {
  return (
    isRecord(value) &&
    'value' in value &&
    Array.isArray(value.evidence) &&
    Array.isArray(value.warnings)
  );
}

function missingFact<T>(label: string): Fact<T> {
  return fact<T>(null, [], {
    warnings: [`저장된 분석에는 ${label} 데이터가 없습니다. 최신 분석에서 다시 조회할 수 있습니다.`],
  });
}

function factOrMissing<T>(value: unknown, label: string): Fact<T> {
  return isFact(value) ? (value as Fact<T>) : missingFact<T>(label);
}

/**
 * Stored analyses are long-lived user records. Keep them readable after a
 * dashboard field is renamed instead of allowing a missing field to crash the
 * complete analysis page. This only fills display fields; it never invents
 * evidence or turns an unavailable source into a confirmed result.
 */
export function normalizeStoredAnalysis(value: unknown): ParcelIntelligence | null {
  if (!isRecord(value)) return null;

  const identity = value.identity;
  const scenarios = value.scenarios;
  if (!isRecord(identity) || !isFact(identity.center) || !Array.isArray(scenarios)) {
    return null;
  }

  const rawDemand = isRecord(value.demand) ? value.demand : {};
  const legacyNearbyBusinesses = rawDemand.businesses500m;
  const canReuseLegacyNearbyBusinesses =
    isFact(legacyNearbyBusinesses) &&
    legacyNearbyBusinesses.evidence.some(
      (entry) => isRecord(entry) && entry.provider === 'small-business-commerce',
    );

  return {
    ...(value as ParcelIntelligence),
    demand: {
      populationAdministrativeArea: factOrMissing<number>(
        rawDemand.populationAdministrativeArea ?? rawDemand.population1km,
        '행정동 인구',
      ),
      householdsAdministrativeArea: factOrMissing<number>(
        rawDemand.householdsAdministrativeArea ?? rawDemand.households1km,
        '행정동 가구',
      ),
      businessesAdministrativeArea: factOrMissing<number>(
        rawDemand.businessesAdministrativeArea,
        '행정동 사업체',
      ),
      nearbyBusinesses500m: factOrMissing<number>(
        rawDemand.nearbyBusinesses500m ??
          (canReuseLegacyNearbyBusinesses ? legacyNearbyBusinesses : undefined),
        '반경 500m 상가업소',
      ),
      administrativeArea: factOrMissing<string>(
        rawDemand.administrativeArea,
        '기준 행정동',
      ),
      transitStops500m: factOrMissing<number>(
        rawDemand.transitStops500m,
        '대중교통 정류장',
      ),
    },
  };
}
