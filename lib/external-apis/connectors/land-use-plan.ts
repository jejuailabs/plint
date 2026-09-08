/**
 * 토지이용계획확인서 API connector.
 *
 * Endpoint: https://api.vworld.kr/ned/data/getLandUseAttr
 * Env:      VWORLD_API_KEY, VWORLD_DOMAIN
 *
 * 2024-01부터 구 NSDI(data.go.kr/1611000) → VWorld NED로 이관됨.
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { fetchWithRetry, HttpError } from '@/lib/external-apis/http-client';

export type LandUsePlanInput = {
  pnuCode: string;
};

export type LandUseZone = {
  code: string;
  name: string;
  relation?: string;
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
  cnflcAtNm?: string;
};

type VWorldNedResponse = {
  landUses?: {
    resultCode?: string;
    resultMsg?: string;
    totalCount?: string | number;
    field?: LadfrlItem | LadfrlItem[];
  };
  response?: {
    resultCode?: string;
    resultMsg?: string;
    totalCount?: string | number;
  };
};

const CONNECTOR_ID = 'land-use-plan';

const ZONING_PREFIXES = ['UQA'];
const DISTRICT_PREFIXES = ['UQ', 'UD', 'UG', 'UB', 'UM'];

function categorize(code: string): LandUseZone['category'] {
  if (ZONING_PREFIXES.some((p) => code.startsWith(p))) return 'zoning';
  if (DISTRICT_PREFIXES.some((p) => code.startsWith(p))) return 'district';
  if (code.startsWith('UA')) return 'area';
  return 'other';
}

export function createLandUsePlanConnector(): Connector<
  LandUsePlanInput,
  LandUsePlanOutput
> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);

  return {
    manifest,

    async execute(input, signal) {
      const apiKey = process.env.VWORLD_API_KEY;
      if (!apiKey) return emptyResult('VWORLD_API_KEY is not configured');

      const url = new URL('https://api.vworld.kr/ned/data/getLandUseAttr');
      url.searchParams.set('key', apiKey);
      if (process.env.VWORLD_DOMAIN) {
        url.searchParams.set('domain', process.env.VWORLD_DOMAIN);
      }
      url.searchParams.set('pnu', input.pnuCode);
      url.searchParams.set('format', 'json');
      url.searchParams.set('numOfRows', '30');
      url.searchParams.set('pageNo', '1');

      try {
        const raw = await fetchWithRetry<VWorldNedResponse>(url.toString(), {
          timeoutMs: manifest.timeoutMs,
          signal,
        });

        const result = raw.landUses;
        if (!result?.field) {
          const msg =
            result?.resultMsg ||
            raw.response?.resultMsg ||
            'No land use plan data found';
          return emptyResult(msg);
        }

        const rawItems = result.field;
        const list = Array.isArray(rawItems) ? rawItems : [rawItems];

        const zones: LandUseZone[] = list
          .filter(
            (item) => item.prposAreaDstrcCode && item.prposAreaDstrcCodeNm,
          )
          .map((item) => ({
            code: item.prposAreaDstrcCode!,
            name: item.prposAreaDstrcCodeNm!,
            category: categorize(item.prposAreaDstrcCode!),
            relation: item.cnflcAtNm ?? '관계 미확인',
          }));

        const primaryZone = zones.find((z) => z.category === 'zoning') ?? null;

        return {
          data: { zones, primaryZone },
          rawSnapshotId: `landuse-${Date.now()}`,
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

function emptyResult(warning: string): ConnectorResult<LandUsePlanOutput> {
  return {
    data: null,
    rawSnapshotId: `landuse-err-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}
