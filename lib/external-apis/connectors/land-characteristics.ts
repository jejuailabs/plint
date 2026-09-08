/**
 * 토지특성 API connector (VWorld NED).
 *
 * Endpoint: https://api.vworld.kr/ned/data/getLandCharacteristicsAttr
 * Env:      VWORLD_API_KEY, VWORLD_DOMAIN
 *
 * 지목, 경사, 형상, 도로접면 등 토지 물리적 속성을 반환한다.
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { fetchWithRetry, HttpError } from '@/lib/external-apis/http-client';

export type LandCharacteristicsInput = {
  pnuCode: string;
};

export type LandCharacteristicsOutput = {
  landCategory: string | null;
  landCategoryCode: string | null;
  slopeCode: string | null;
  shapeCode: string | null;
  roadSideCode: string | null;
  roadSideName: string | null;
  heightCode: string | null;
};

type LandCharItem = {
  lndcgrCode?: string;
  lndcgrCodeNm?: string;
  tpgrphHgCode?: string;
  tpgrphFrmCode?: string;
  roadSideCode?: string;
  roadSideCodeNm?: string;
  prposArea1Nm?: string;
};

type VWorldNedResponse = {
  landCharacteristicss?: {
    resultCode?: string;
    resultMsg?: string;
    totalCount?: string | number;
    field?: LandCharItem | LandCharItem[];
  };
  response?: {
    resultCode?: string;
    resultMsg?: string;
  };
};

const CONNECTOR_ID = 'land-characteristics';

const LAND_CATEGORY_MAP: Record<string, string> = {
  '01': '전', '02': '답', '03': '과수원', '04': '목장용지', '05': '임야',
  '06': '광천지', '07': '염전', '08': '대', '09': '공장용지', '10': '학교용지',
  '11': '주차장', '12': '주유소용지', '13': '창고용지', '14': '도로', '15': '철도용지',
  '16': '제방', '17': '하천', '18': '구거', '19': '유지', '20': '양어장',
  '21': '수도용지', '22': '공원', '23': '체육용지', '24': '유원지', '25': '종교용지',
  '26': '사적지', '27': '묘지', '28': '잡종지',
};

const ROAD_SIDE_MAP: Record<string, string> = {
  '01': '광대한면', '02': '광대소각', '03': '광대세각(가)',
  '04': '중로한면', '05': '중로각지', '06': '소로한면',
  '07': '소로각지', '08': '세로(가)', '09': '세로(불)',
  '10': '맹지', '11': '광대세각(나)',
};

export function createLandCharacteristicsConnector(): Connector<LandCharacteristicsInput, LandCharacteristicsOutput> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);

  return {
    manifest,

    async execute(input, signal) {
      const apiKey = process.env.VWORLD_API_KEY;
      if (!apiKey) return emptyResult('VWORLD_API_KEY is not configured');

      const url = new URL('https://api.vworld.kr/ned/data/getLandCharacteristicsAttr');
      url.searchParams.set('key', apiKey);
      if (process.env.VWORLD_DOMAIN) {
        url.searchParams.set('domain', process.env.VWORLD_DOMAIN);
      }
      url.searchParams.set('pnu', input.pnuCode);
      url.searchParams.set('stdrYear', String(new Date().getFullYear() - 1));
      url.searchParams.set('format', 'json');
      url.searchParams.set('numOfRows', '1');
      url.searchParams.set('pageNo', '1');

      try {
        const raw = await fetchWithRetry<VWorldNedResponse>(url.toString(), {
          timeoutMs: manifest.timeoutMs,
          signal,
        });

        const result = raw.landCharacteristicss;
        if (!result?.field) {
          const msg = result?.resultMsg || raw.response?.resultMsg || 'No land characteristics data';
          return emptyResult(msg);
        }

        const items = result.field;
        const item: LandCharItem = Array.isArray(items) ? items[0] : items;

        const landCategoryCode = item.lndcgrCode ?? null;
        const landCategory = item.lndcgrCodeNm ?? LAND_CATEGORY_MAP[landCategoryCode ?? ''] ?? null;
        const roadSideCode = item.roadSideCode ?? null;
        const roadSideName = item.roadSideCodeNm ?? ROAD_SIDE_MAP[roadSideCode ?? ''] ?? null;

        return {
          data: {
            landCategory,
            landCategoryCode,
            slopeCode: item.tpgrphHgCode ?? null,
            shapeCode: item.tpgrphFrmCode ?? null,
            roadSideCode,
            roadSideName,
            heightCode: item.tpgrphHgCode ?? null,
          },
          rawSnapshotId: `landchar-${Date.now()}`,
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

function emptyResult(warning: string): ConnectorResult<LandCharacteristicsOutput> {
  return {
    data: null,
    rawSnapshotId: `landchar-err-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}
