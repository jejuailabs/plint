/**
 * 개별공시지가 API connector.
 *
 * Endpoint: https://api.vworld.kr/ned/data/getIndvdLandPriceAttr
 * Env:      VWORLD_API_KEY, VWORLD_DOMAIN
 *
 * 2024-01부터 구 NSDI(data.go.kr/1611000) → VWorld NED로 이관됨.
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { fetchWithRetry, HttpError } from '@/lib/external-apis/http-client';

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
  pblntfPclnd?: string | number;
  stdrYear?: string;
};

type VWorldNedResponse = {
  indvdLandPrices?: {
    resultCode?: string;
    resultMsg?: string;
    totalCount?: string | number;
    field?: LandPriceItem | LandPriceItem[];
  };
  response?: {
    resultCode?: string;
    resultMsg?: string;
    totalCount?: string | number;
  };
};

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

const CONNECTOR_ID = 'land-characteristics';

export function createLandPriceConnector(): Connector<
  LandPriceInput,
  LandPriceOutput
> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);

  return {
    manifest,

    async execute(input, signal) {
      const apiKey = process.env.VWORLD_API_KEY;
      if (!apiKey) {
        return emptyResult('VWORLD_API_KEY is not configured');
      }

      const url = new URL(
        'https://api.vworld.kr/ned/data/getIndvdLandPriceAttr',
      );
      url.searchParams.set('key', apiKey);
      if (process.env.VWORLD_DOMAIN) {
        url.searchParams.set('domain', process.env.VWORLD_DOMAIN);
      }
      url.searchParams.set('pnu', input.pnuCode);

      url.searchParams.set('format', 'json');
      url.searchParams.set('numOfRows', '100');
      url.searchParams.set('pageNo', '1');

      try {
        const raw = await fetchWithRetry<VWorldNedResponse>(url.toString(), {
          timeoutMs: manifest.timeoutMs,
          signal,
        });

        const result = raw.indvdLandPrices;
        if (!result?.field) {
          const msg =
            result?.resultMsg ||
            raw.response?.resultMsg ||
            'No land price data found for PNU';
          return emptyResult(msg);
        }

        const items = result.field;
        const item: LandPriceItem | undefined = Array.isArray(items)
          ? [...items].sort(
              (a, b) => Number(b.stdrYear ?? 0) - Number(a.stdrYear ?? 0),
            )[0]
          : items;

        if (!item || item.pblntfPclnd == null) {
          return emptyResult('No land price data found for PNU');
        }

        const price =
          typeof item.pblntfPclnd === 'string'
            ? parseInt(item.pblntfPclnd, 10)
            : item.pblntfPclnd;
        const year = item.stdrYear
          ? parseInt(item.stdrYear, 10)
          : new Date().getFullYear() - 1;

        if (!Number.isFinite(price) || price <= 0)
          return emptyResult('유효한 공시지가가 없습니다.');
        return {
          data: {
            officialPricePerSqm: price,
            year,
            slopeCode: null,
            shapeCode: null,
          },
          rawSnapshotId: `landprice-${Date.now()}`,
          observedAt: new Date().toISOString(),
          warnings: [],
        };
      } catch (error) {
        const message =
          error instanceof HttpError ? error.message : String(error);
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
