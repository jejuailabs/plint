/**
 * 건축물대장 API connector (건축HUB — 표제부).
 *
 * Endpoint: http://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo
 * Env:      DATA_GO_KR_API_KEY
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { fetchWithRetry, HttpError } from '@/lib/external-apis/http-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BuildingLedgerInput = {
  sigunguCode: string;
  bjdongCode: string;
  bun: string;
  ji: string;
};

export type BuildingLedgerOutput = {
  exists: boolean;
  use: string | null;
  floorsAbove: number | null;
  floorsBelow: number | null;
  structure: string | null;
  totalFloorAreaSqm: number | null;
  completionYear: number | null;
};

/** Raw JSON item from the data.go.kr response. */
type BldRgstItem = {
  mainPurpsCdNm?: string;
  grndFlrCnt?: number;
  ugrndFlrCnt?: number;
  strctCdNm?: string;
  totArea?: number;
  useAprDay?: string;
};

type DataGoKrResponse = {
  response: {
    header: { resultCode: string; resultMsg: string };
    body?: {
      totalCount?: number;
      items?: { item?: BldRgstItem | BldRgstItem[] };
    };
  };
};

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

const CONNECTOR_ID = 'building-ledger';

export function createBuildingLedgerConnector(): Connector<BuildingLedgerInput, BuildingLedgerOutput> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);

  return {
    manifest,

    async execute(input, signal) {
      const apiKey = process.env.DATA_GO_KR_API_KEY;
      if (!apiKey) {
        return emptyResult('DATA_GO_KR_API_KEY is not configured');
      }

      const url = new URL('http://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo');
      url.searchParams.set('serviceKey', apiKey);
      url.searchParams.set('sigunguCd', input.sigunguCode);
      url.searchParams.set('bjdongCd', input.bjdongCode);
      url.searchParams.set('bun', input.bun.padStart(4, '0'));
      url.searchParams.set('ji', input.ji.padStart(4, '0'));
      url.searchParams.set('numOfRows', '1');
      url.searchParams.set('pageNo', '1');
      url.searchParams.set('_type', 'json');

      try {
        const raw = await fetchWithRetry<DataGoKrResponse>(url.toString(), {
          timeoutMs: manifest.timeoutMs,
          signal,
        });

        const header = raw.response?.header;
        if (!header || header.resultCode !== '00') {
          const msg = header?.resultMsg ?? 'Unknown error from building ledger API';
          console.error(`[${CONNECTOR_ID}] API error: ${msg}`);
          return emptyResult(msg);
        }

        const body = raw.response.body;
        const totalCount = body?.totalCount ?? 0;

        if (totalCount === 0) {
          return {
            data: { exists: false, use: null, floorsAbove: null, floorsBelow: null, structure: null, totalFloorAreaSqm: null, completionYear: null },
            rawSnapshotId: `bldg-${Date.now()}`,
            observedAt: new Date().toISOString(),
            warnings: [],
          };
        }

        const rawItems = body?.items?.item;
        const item: BldRgstItem | undefined = Array.isArray(rawItems) ? rawItems[0] : rawItems;

        if (!item) {
          return emptyResult('No building record in response body');
        }

        const completionYear = item.useAprDay
          ? parseInt(item.useAprDay.slice(0, 4), 10) || null
          : null;

        return {
          data: {
            exists: true,
            use: item.mainPurpsCdNm ?? null,
            floorsAbove: item.grndFlrCnt ?? null,
            floorsBelow: item.ugrndFlrCnt ?? null,
            structure: item.strctCdNm ?? null,
            totalFloorAreaSqm: item.totArea ?? null,
            completionYear,
          },
          rawSnapshotId: `bldg-${Date.now()}`,
          observedAt: new Date().toISOString(),
          warnings: [],
        };
      } catch (error) {
        const message = error instanceof HttpError ? error.message : String(error);
        console.error(`[${CONNECTOR_ID}] ${message}`);
        return emptyResult(message);
      }
    },
  };
}

function emptyResult(warning: string): ConnectorResult<BuildingLedgerOutput> {
  return {
    data: null,
    rawSnapshotId: `bldg-err-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}
