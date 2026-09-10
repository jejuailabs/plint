import {
  createProgressTracker,
  type AnalysisOptions,
} from '@/lib/pipeline/progress';
/**
 * Live data source: orchestrates real API connectors for the preview pipeline.
 *
 * Calls juso → (building-ledger, land-price, land-transaction, kma-weather) in
 * parallel, tolerating individual failures. Returns raw ConnectorResult objects
 * so the caller can build Evidence/Fact records with real snapshot IDs.
 */

import type { Confidence, Evidence } from '@/lib/domain/evidence';
import type { ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { createJusoAddressConnector } from '@/lib/external-apis/connectors/juso-address';
import type { JusoAddressOutput } from '@/lib/external-apis/connectors/juso-address';
import { createBuildingLedgerConnector } from '@/lib/external-apis/connectors/building-ledger';
import type { BuildingLedgerOutput } from '@/lib/external-apis/connectors/building-ledger';
import { createLandPriceConnector } from '@/lib/external-apis/connectors/land-price';
import type { LandPriceOutput } from '@/lib/external-apis/connectors/land-price';
import { createLandTransactionConnector } from '@/lib/external-apis/connectors/land-transaction';
import type {
  LandTransactionOutput,
  LandTransactionItem,
} from '@/lib/external-apis/connectors/land-transaction';
import { createKmaWeatherConnector } from '@/lib/external-apis/connectors/kma-weather';
import type { KmaWeatherOutput } from '@/lib/external-apis/connectors/kma-weather';
import { createLandUsePlanConnector } from '@/lib/external-apis/connectors/land-use-plan';
import type { LandUsePlanOutput } from '@/lib/external-apis/connectors/land-use-plan';
import { createCadastralBoundaryConnector } from '@/lib/external-apis/connectors/cadastral-boundary';
import type { CadastralBoundaryOutput } from '@/lib/external-apis/connectors/cadastral-boundary';
import { createContextBuildingsConnector } from '@/lib/external-apis/connectors/context-buildings';
import type { ContextBuildingsOutput } from '@/lib/external-apis/connectors/context-buildings';
import { createLandCharacteristicsConnector } from '@/lib/external-apis/connectors/land-characteristics';
import type { LandCharacteristicsOutput } from '@/lib/external-apis/connectors/land-characteristics';
import { createSgisDemandConnector } from '@/lib/external-apis/connectors/sgis-demand';
import type { SgisDemandOutput } from '@/lib/external-apis/connectors/sgis-demand';
import { createBuildingPermitConnector } from '@/lib/external-apis/connectors/building-permit';
import type { BuildingPermitOutput } from '@/lib/external-apis/connectors/building-permit';
import { createSmallBusinessCommerceConnector } from '@/lib/external-apis/connectors/small-business-commerce';
import type { CommerceOutput } from '@/lib/external-apis/connectors/small-business-commerce';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LiveSourceData = {
  juso: ConnectorResult<JusoAddressOutput>;
  building: ConnectorResult<BuildingLedgerOutput>;
  landPrice: ConnectorResult<LandPriceOutput>;
  transactions: ConnectorResult<LandTransactionOutput>;
  weather: ConnectorResult<KmaWeatherOutput>;
  landUsePlan: ConnectorResult<LandUsePlanOutput>;
  cadastralBoundary: ConnectorResult<CadastralBoundaryOutput>;
  contextBuildings: ConnectorResult<ContextBuildingsOutput>;
  landCharacteristics: ConnectorResult<LandCharacteristicsOutput>;
  demand: ConnectorResult<SgisDemandOutput>;
  permits: ConnectorResult<BuildingPermitOutput>;
  commerce: ConnectorResult<CommerceOutput>;
  pnuCode: string | null;
  adminCode: string | null;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Evidence helper
// ---------------------------------------------------------------------------

/** Build an Evidence record from a connector manifest + live result metadata. */
export function liveEvidence(
  connectorId: string,
  result: Pick<ConnectorResult<unknown>, 'rawSnapshotId' | 'observedAt'>,
  confidence: Confidence = 'verified',
): Evidence {
  const manifest = getConnectorManifest(connectorId);
  if (!manifest) throw new Error(`Unknown connector: ${connectorId}`);
  return {
    provider: manifest.provider,
    datasetId: manifest.datasetId,
    sourceUrl: manifest.sourceUrl,
    observedAt: result.observedAt,
    licenseCode: manifest.licenseCode,
    coordinateSystem: manifest.coordinateSystem,
    rawSnapshotId: result.rawSnapshotId,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// ASOS station mapping (admin-code prefix → nearest station)
// ---------------------------------------------------------------------------

const ADMIN_TO_STATION: Record<string, string> = {
  '11': '108',
  '26': '159',
  '27': '143',
  '28': '112',
  '29': '156',
  '30': '133',
  '31': '152',
  '36': '133',
  '41': '108',
  '42': '101',
  '43': '131',
  '44': '129',
  '45': '146',
  '46': '156',
  '47': '143',
  '48': '155',
  '50': '184',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyResult<T>(warning: string): ConnectorResult<T> {
  return {
    data: null,
    rawSnapshotId: `skip-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}

function unwrapSettled<T>(
  settled: PromiseSettledResult<ConnectorResult<T>>,
  label: string,
): ConnectorResult<T> {
  if (settled.status === 'fulfilled') return settled.value;
  return emptyResult<T>(`${label}: ${String(settled.reason)}`);
}

// ---------------------------------------------------------------------------
// Main fetch
// ---------------------------------------------------------------------------

export async function fetchLiveSourceData(
  address: string,
  options: AnalysisOptions = {},
): Promise<LiveSourceData> {
  const warnings: string[] = [];
  const { start, track } = createProgressTracker(options.onProgress);
  const signal = options.signal;
  signal?.throwIfAborted();

  // Step 1: address → PNU + coordinates (gate for downstream calls)
  start('address', 1);
  const juso = await track('address', () =>
    createJusoAddressConnector().execute({ address }, signal),
  );

  if (!juso.data) {
    const skip = '주소 해석 실패로 조회 불가';
    for (const step of ['building', 'market', 'planning', 'weather'] as const) {
      options.onProgress?.({ step, status: 'skipped', message: skip });
    }
    return {
      juso,
      building: emptyResult<BuildingLedgerOutput>(skip),
      landPrice: emptyResult<LandPriceOutput>(skip),
      transactions: emptyResult<LandTransactionOutput>(skip),
      weather: emptyResult<KmaWeatherOutput>(skip),
      landUsePlan: emptyResult<LandUsePlanOutput>(skip),
      cadastralBoundary: emptyResult<CadastralBoundaryOutput>(skip),
      contextBuildings: emptyResult<ContextBuildingsOutput>(skip),
      landCharacteristics: emptyResult<LandCharacteristicsOutput>(skip),
      demand: emptyResult<SgisDemandOutput>(skip),
      permits: emptyResult<BuildingPermitOutput>(skip),
      commerce: emptyResult<CommerceOutput>(skip),
      pnuCode: null,
      adminCode: null,
      warnings: [
        ...juso.warnings,
        '주소 해석 실패로 후속 조회를 건너뛰었습니다.',
      ],
    };
  }

  // Step 2: parse PNU (19 digits: admCd[10] + mtFlag[1] + bon[4] + bu[4])
  const pnu = juso.data.pnuCode;
  const adminCode = juso.data.administrativeCode;
  const sigunguCode = pnu.slice(0, 5);
  const bjdongCode = pnu.slice(5, 10);
  const bun = pnu.slice(11, 15);
  const ji = pnu.slice(15, 19);

  // Transaction query: previous 12 full months. This supports both current
  // comparable evidence and a transparent six-month-versus-prior-six-month
  // trend without treating an incomplete current month as a full period.
  const now = new Date();
  const txMonths: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    txMonths.push(
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`,
    );
  }

  // Weather query: previous full year, nearest station
  const lastYear = now.getFullYear() - 1;
  const stnId = ADMIN_TO_STATION[adminCode.slice(0, 2)] ?? '108';

  // Step 3: parallel downstream calls (transactions query 12 months)
  const txConnector = createLandTransactionConnector();
  const lat0 = juso.data.latitude;
  const lon0 = juso.data.longitude;
  signal?.throwIfAborted();
  start('building', 2);
  start('market', 3 + txMonths.length);
  start('planning', 4);
  start('weather', 1);
  const [bldg, permitsSettled, price, commerceSettled, wx, lup, cad, ctxBldg, landChar, demandSettled, ...txSettled] =
    await Promise.allSettled([
      track('building', () =>
        createBuildingLedgerConnector().execute(
          { sigunguCode, bjdongCode, bun, ji },
          signal,
        ),
      ),
      track('building', () =>
        createBuildingPermitConnector().execute(
          { sigunguCode, bjdongCode, bun, ji },
          signal,
        ),
      ),
      track('market', () =>
        createLandPriceConnector().execute({ pnuCode: pnu }, signal),
      ),
      track('market', () => lat0 && lon0 ? createSmallBusinessCommerceConnector().execute({ latitude: lat0, longitude: lon0, radiusM: 500 }, signal) : Promise.resolve(emptyResult<CommerceOutput>('좌표 미확인으로 상권 조회 불가'))),
      track('weather', () =>
        createKmaWeatherConnector().execute(
          {
            stationId: stnId,
            startDate: `${lastYear}0101`,
            endDate: `${lastYear}1231`,
          },
          signal,
        ),
      ),
      track('planning', () =>
        createLandUsePlanConnector().execute({ pnuCode: pnu }, signal),
      ),
      track('planning', () =>
        createCadastralBoundaryConnector().execute({ pnuCode: pnu }, signal),
      ),
      track('planning', () =>
        lat0 && lon0
          ? createContextBuildingsConnector().execute(
              {
                centerLat: lat0,
                centerLon: lon0,
                radiusM: 150,
                targetPnu: pnu,
              },
              signal,
            )
          : Promise.resolve(
              emptyResult<ContextBuildingsOutput>(
                '좌표 미확인으로 주변 건물 조회 불가',
              ),
            ),
      ),
      track('planning', () =>
        createLandCharacteristicsConnector().execute({ pnuCode: pnu }, signal),
      ),
      track('market', () =>
        lat0 && lon0
          ? createSgisDemandConnector().execute(
              { latitude: lat0, longitude: lon0 },
              signal,
            )
          : Promise.resolve(
              emptyResult<SgisDemandOutput>('좌표 미확인으로 SGIS 수요 조회 불가'),
            ),
      ),
      ...txMonths.map((ym) =>
        track('market', () =>
          txConnector.execute(
            { lawdCode: sigunguCode, dealYearMonth: ym },
            signal,
          ),
        ),
      ),
    ]);

  const building = unwrapSettled(bldg, '건축물대장 조회 실패');
  const permits = unwrapSettled(permitsSettled, '건축 인허가 조회 실패');
  const commerce = unwrapSettled(commerceSettled, '상권 조회 실패');
  const landPrice = unwrapSettled(price, '공시지가 조회 실패');
  const weather = unwrapSettled(wx, '기상 조회 실패');
  const landUsePlan = unwrapSettled(lup, '토지이용계획 조회 실패');
  const cadastralBoundary = unwrapSettled(cad, '연속지적도 조회 실패');
  const contextBuildings = unwrapSettled(ctxBldg, '주변 건물 조회 실패');
  const landCharacteristics = unwrapSettled(landChar, '토지특성 조회 실패');
  const demand = unwrapSettled(demandSettled, 'SGIS 수요 조회 실패');

  // Merge 12 months of transactions into a single result
  const allTxItems: LandTransactionItem[] = [];
  let txSnapshot = `landtx-merged-${Date.now()}`;
  let txObserved = new Date().toISOString();
  const txWarnings: string[] = [];
  let txSuccess = 0;
  for (const settled of txSettled) {
    const r = unwrapSettled<LandTransactionOutput>(
      settled,
      '실거래가 조회 실패',
    );
    if (r.data) {
      txSuccess++;
      allTxItems.push(...r.data);
      txSnapshot = r.rawSnapshotId;
      txObserved = r.observedAt;
    }
    if (r.warnings.length) txWarnings.push(...r.warnings);
  }
  const transactions: ConnectorResult<LandTransactionOutput> =
    allTxItems.length > 0
      ? {
          data: allTxItems,
          rawSnapshotId: txSnapshot,
          observedAt: txObserved,
          warnings: txWarnings,
        }
      : {
          data: txSuccess === txMonths.length ? [] : null,
          rawSnapshotId: txSnapshot,
          observedAt: txObserved,
          warnings: txWarnings.length ? txWarnings : ['최근 12개월간 거래 내역 없음'],
        };

  for (const r of [
    building,
    permits,
    commerce,
    landPrice,
    transactions,
    weather,
    landUsePlan,
    cadastralBoundary,
    contextBuildings,
    landCharacteristics,
    demand,
  ]) {
    if (!r.data && r.warnings.length) warnings.push(...r.warnings);
  }

  // Fix coordinates from cadastral boundary centroid if juso returned 0,0
  if (
    juso.data &&
    (juso.data.latitude === 0 || juso.data.longitude === 0) &&
    cadastralBoundary.data
  ) {
    const ring = cadastralBoundary.data.coordinates[0];
    if (ring && ring.length > 2) {
      let sumLon = 0,
        sumLat = 0;
      for (const [lon, lat] of ring) {
        sumLon += lon;
        sumLat += lat;
      }
      juso.data.longitude = sumLon / ring.length;
      juso.data.latitude = sumLat / ring.length;
      warnings.push('좌표를 지적도 폴리곤 중심점에서 보정했습니다.');
    }
  }

  return {
    juso,
    building,
    permits,
    commerce,
    landPrice,
    transactions,
    weather,
    landUsePlan,
    cadastralBoundary,
    contextBuildings,
    landCharacteristics,
    demand,
    pnuCode: pnu,
    adminCode,
    warnings,
  };
}
