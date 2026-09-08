/**
 * 실거래가 (토지) API connector.
 *
 * Endpoint: https://apis.data.go.kr/1613000/RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade
 * Env:      DATA_GO_KR_API_KEY
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import {
  fetchWithRetry,
  HttpError,
  buildDataGoKrUrl,
} from '@/lib/external-apis/http-client';

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
  neighborhood?: string;
  landCategory?: string;
  landUse?: string;
};

export type LandTransactionOutput = LandTransactionItem[];

type RawItem = {
  dealYear?: string | number;
  dealMonth?: string | number;
  dealDay?: string | number;
  dealAmount?: string | number;
  dealArea?: string | number;
  jimok?: string;
  landUse?: string;
  umdNm?: string;
  cdealType?: string;
  shareDealingType?: string;
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

export function createLandTransactionConnector(): Connector<
  LandTransactionInput,
  LandTransactionOutput
> {
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
        'https://apis.data.go.kr/1613000/RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade',
        'serviceKey',
        apiKey,
        {
          LAWD_CD: input.lawdCode,
          DEAL_YMD: input.dealYearMonth,
          numOfRows: '1000',
          pageNo: '1',
          _type: 'json',
        },
      );

      try {
        const raw = await fetchWithRetry<DataGoKrResponse>(fullUrl, {
          timeoutMs: manifest.timeoutMs,
          signal,
        });

        const header = raw.response?.header;
        if (
          !header ||
          !['00', '000', '0'].includes(String(header.resultCode))
        ) {
          const msg =
            header?.resultMsg ?? 'Unknown error from land transaction API';
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

        const list = Array.isArray(rawItems) ? [...rawItems] : [rawItems];
        const total = Number(raw.response.body?.totalCount ?? list.length);
        for (
          let page = 2;
          page <= Math.min(10, Math.ceil(total / 1000));
          page++
        ) {
          const url = new URL(fullUrl);
          url.searchParams.set('pageNo', String(page));
          const next = await fetchWithRetry<DataGoKrResponse>(url.toString(), {
            timeoutMs: manifest.timeoutMs,
            signal,
          });
          if (
            !['00', '000', '0'].includes(
              String(next.response?.header?.resultCode),
            )
          )
            return emptyResult('실거래 후속 페이지 조회 실패');
          const rows = next.response?.body?.items?.item;
          if (rows) list.push(...(Array.isArray(rows) ? rows : [rows]));
        }

        const transactions: LandTransactionItem[] = list
          .filter(
            (item) =>
              !String(item.cdealType ?? '').trim() &&
              !String(item.shareDealingType ?? '').trim(),
          )
          .map((item) => {
            const year = String(item.dealYear ?? '');
            const month = String(item.dealMonth ?? '').padStart(2, '0');
            const day = String(item.dealDay ?? '')
              .trim()
              .padStart(2, '0');
            const price =
              parseInt(
                String(item.dealAmount ?? '0')
                  .replace(/,/g, '')
                  .trim(),
                10,
              ) * 10_000;
            const areaSqm = parseFloat(String(item.dealArea ?? '0'));

            return {
              date: `${year}-${month}-${day}`,
              type: item.landUse ?? '토지',
              neighborhood: item.umdNm?.trim(),
              landCategory: item.jimok?.trim(),
              landUse: item.landUse?.trim(),
              price,
              areaSqm,
            };
          });

        return {
          data: transactions.filter(
            (t) =>
              Number.isFinite(t.price) &&
              t.price > 0 &&
              Number.isFinite(t.areaSqm) &&
              t.areaSqm > 0,
          ),
          rawSnapshotId: `landtx-${Date.now()}`,
          observedAt: new Date().toISOString(),
          warnings:
            total > list.length
              ? ['실거래 응답 일부만 수신되어 표본이 불완전합니다.']
              : [],
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

function emptyResult(warning: string): ConnectorResult<LandTransactionOutput> {
  return {
    data: null,
    rawSnapshotId: `landtx-err-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}
