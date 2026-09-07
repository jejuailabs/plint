/**
 * 개별공시지가 / 토지특성 API connector.
 *
 * Endpoint: http://apis.data.go.kr/1611000/nsdi/IndvdLandPriceService
 * Env:      DATA_GO_KR_API_KEY
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { fetchWithRetry, HttpError, buildDataGoKrUrl } from '@/lib/external-apis/http-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LandPriceInput = {
  pnuCode: string;
};

export type LandPriceOutput = {
  officialPricePerSqm: number;
  year: number;
  slopeCode: string | null;
  shapeCode: string | null;
};

type LandPriceItem = {
  pblntfPclnd?: number;
  stdrYear?: string;
  tpgrphHgCd?: string;
  tpgrphFrmCd?: string;
};

type DataGoKrResponse = {
  indvdLandPrices: {
    resultCode: string;
    resultMsg: string;
    totalCount?: number;
    field?: LandPriceItem | LandPriceItem[];
  };
};

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

const CONNECTOR_ID = 'land-characteristics';

export function createLandPriceConnector(): Connector<LandPriceInput, LandPriceOutput> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);

  return {
    manifest,

    async execute(input, signal) {
      const apiKey = process.env.DATA_GO_KR_API_KEY;
      if (!apiKey) {
        return emptyResult('DATA_GO_KR_API_KEY is not configured');
      }

      const fullUrl = buildDataGoKrUrl(
        'http://apis.data.go.kr/1611000/nsdi/IndvdLandPriceService/attr/getIndvdLandPriceAttr',
        'authkey',
        apiKey,
        {
          pnu: input.pnuCode,
          stdrYear: String(new Date().getFullYear() - 1),
          format: 'json',
          numOfRows: '1',
          pageNo: '1',
        },
      );

      try {
        const raw = await fetchWithRetry<DataGoKrResponse>(fullUrl, {
          timeoutMs: manifest.timeoutMs,
          signal,
        });

        const result = raw.indvdLandPrices;
        if (!result || result.resultCode !== 'OK') {
          const msg = result?.resultMsg ?? 'Unknown error from land price API';
          console.error(`[${CONNECTOR_ID}] API error: ${msg}`);
          return emptyResult(msg);
        }

        const items = result.field;
        const item: LandPriceItem | undefined = Array.isArray(items) ? items[0] : items;

        if (!item || item.pblntfPclnd == null) {
          return emptyResult('No land price data found for PNU');
        }

        const year = item.stdrYear ? parseInt(item.stdrYear, 10) : new Date().getFullYear() - 1;

        return {
          data: {
            officialPricePerSqm: item.pblntfPclnd,
            year,
            slopeCode: item.tpgrphHgCd ?? null,
            shapeCode: item.tpgrphFrmCd ?? null,
          },
          rawSnapshotId: `landprice-${Date.now()}`,
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

function emptyResult(warning: string): ConnectorResult<LandPriceOutput> {
  return {
    data: null,
    rawSnapshotId: `landprice-err-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}
