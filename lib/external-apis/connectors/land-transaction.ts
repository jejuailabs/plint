/**
 * 실거래가 (토지) API connector.
 *
 * Endpoint: http://apis.data.go.kr/1613000/RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade
 * Env:      DATA_GO_KR_API_KEY
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { fetchWithRetry, HttpError } from '@/lib/external-apis/http-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LandTransactionInput = {
  lawdCode: string;
  dealYearMonth: string;
};

export type LandTransactionItem = {
  date: string;
  type: string;
  price: number;
  areaSqm: number;
};

export type LandTransactionOutput = LandTransactionItem[];

type RawItem = {
  dealYear?: string;
  dealMonth?: string;
  dealDay?: string;
  landUseCd?: string;
  dealAmount?: string;
  dealArea?: string;
};

type DataGoKrResponse = {
  response: {
    header: { resultCode: string; resultMsg: string };
    body?: {
      totalCount?: number;
      items?: { item?: RawItem | RawItem[] };
    };
  };
};

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

const CONNECTOR_ID = 'land-transactions';

export function createLandTransactionConnector(): Connector<LandTransactionInput, LandTransactionOutput> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);

  return {
    manifest,

    async execute(input, signal) {
      const apiKey = process.env.DATA_GO_KR_API_KEY;
      if (!apiKey) {
        return emptyResult('DATA_GO_KR_API_KEY is not configured');
      }

      const url = new URL(
        'http://apis.data.go.kr/1613000/RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade',
      );
      url.searchParams.set('serviceKey', apiKey);
      url.searchParams.set('LAWD_CD', input.lawdCode);
      url.searchParams.set('DEAL_YMD', input.dealYearMonth);
      url.searchParams.set('numOfRows', '100');
      url.searchParams.set('pageNo', '1');
      url.searchParams.set('_type', 'json');

      try {
        const raw = await fetchWithRetry<DataGoKrResponse>(url.toString(), {
          timeoutMs: manifest.timeoutMs,
          signal,
        });

        const header = raw.response?.header;
        if (!header || header.resultCode !== '00') {
          const msg = header?.resultMsg ?? 'Unknown error from land transaction API';
          console.error(`[${CONNECTOR_ID}] API error: ${msg}`);
          return emptyResult(msg);
        }

        const rawItems = raw.response.body?.items?.item;
        if (!rawItems) {
          return {
            data: [],
            rawSnapshotId: `landtx-${Date.now()}`,
            observedAt: new Date().toISOString(),
            warnings: [],
          };
        }

        const list = Array.isArray(rawItems) ? rawItems : [rawItems];

        const transactions: LandTransactionItem[] = list.map((item) => {
          const year = item.dealYear ?? '';
          const month = (item.dealMonth ?? '').padStart(2, '0');
          const day = (item.dealDay ?? '').trim().padStart(2, '0');
          const price = parseInt((item.dealAmount ?? '0').replace(/,/g, '').trim(), 10) * 10_000;
          const areaSqm = parseFloat(item.dealArea ?? '0');

          return {
            date: `${year}-${month}-${day}`,
            type: item.landUseCd ?? '토지',
            price,
            areaSqm,
          };
        });

        return {
          data: transactions,
          rawSnapshotId: `landtx-${Date.now()}`,
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

function emptyResult(warning: string): ConnectorResult<LandTransactionOutput> {
  return {
    data: null,
    rawSnapshotId: `landtx-err-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}
