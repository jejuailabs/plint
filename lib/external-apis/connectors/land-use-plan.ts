/**
 * 토지이용계획확인서 API connector.
 *
 * Endpoint: http://apis.data.go.kr/1611000/nsdi/eios/LadfrlService/getLadfrlList
 * Env:      DATA_GO_KR_API_KEY
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { fetchWithRetry, HttpError, buildDataGoKrUrl } from '@/lib/external-apis/http-client';

export type LandUsePlanInput = {
  pnuCode: string;
};

export type LandUseZone = {
  code: string;
  name: string;
  category: 'zoning' | 'district' | 'area' | 'other';
};

export type LandUsePlanOutput = {
  zones: LandUseZone[];
  primaryZone: LandUseZone | null;
};

type LadfrlItem = {
  prposAreaDstrcCode?: string;
  prposAreaDstrcCodeNm?: string;
  cnflcAt?: string;
};

type DataGoKrResponse = {
  ladfrlVOList?: {
    resultCode?: string;
    resultMsg?: string;
    totalCount?: number;
    ladfrlVOList?: LadfrlItem | LadfrlItem[];
  };
};

const CONNECTOR_ID = 'land-use-plan';

const ZONING_PREFIXES = ['UQ', 'UC', 'UG', 'UR'];
const DISTRICT_PREFIXES = ['UD'];

function categorize(code: string): LandUseZone['category'] {
  if (ZONING_PREFIXES.some((p) => code.startsWith(p))) return 'zoning';
  if (DISTRICT_PREFIXES.some((p) => code.startsWith(p))) return 'district';
  if (code.startsWith('UA')) return 'area';
  return 'other';
}

export function createLandUsePlanConnector(): Connector<LandUsePlanInput, LandUsePlanOutput> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);

  return {
    manifest,

    async execute(input, signal) {
      const apiKey = process.env.DATA_GO_KR_API_KEY;
      if (!apiKey) return emptyResult('DATA_GO_KR_API_KEY is not configured');

      const fullUrl = buildDataGoKrUrl(
        'http://apis.data.go.kr/1611000/nsdi/eios/LadfrlService/getLadfrlList',
        'authkey',
        apiKey,
        {
          pnu: input.pnuCode,
          format: 'json',
          numOfRows: '30',
          pageNo: '1',
        },
      );

      try {
        const raw = await fetchWithRetry<DataGoKrResponse>(fullUrl, {
          timeoutMs: manifest.timeoutMs,
          signal,
        });

        const result = raw.ladfrlVOList;
        if (!result || (result.resultCode && result.resultCode !== 'OK')) {
          return emptyResult(result?.resultMsg ?? 'Unknown error from land use plan API');
        }

        const rawItems = result.ladfrlVOList;
        if (!rawItems) return emptyResult('No land use plan data found');

        const list = Array.isArray(rawItems) ? rawItems : [rawItems];

        const zones: LandUseZone[] = list
          .filter((item) => item.prposAreaDstrcCode && item.prposAreaDstrcCodeNm)
          .map((item) => ({
            code: item.prposAreaDstrcCode!,
            name: item.prposAreaDstrcCodeNm!,
            category: categorize(item.prposAreaDstrcCode!),
          }));

        const primaryZone = zones.find((z) => z.category === 'zoning') ?? null;

        return {
          data: { zones, primaryZone },
          rawSnapshotId: `landuse-${Date.now()}`,
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

function emptyResult(warning: string): ConnectorResult<LandUsePlanOutput> {
  return {
    data: null,
    rawSnapshotId: `landuse-err-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}
