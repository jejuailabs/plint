/** Target-parcel building permit and approval history from 건축HUB. */
import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { buildDataGoKrUrl, fetchWithRetry, HttpError } from '@/lib/external-apis/http-client';

export type BuildingPermitInput = { sigunguCode: string; bjdongCode: string; bun: string; ji: string };
export type BuildingPermitRecord = {
  purpose: string | null;
  permitDate: string | null;
  constructionStartDate: string | null;
  approvalDate: string | null;
  totalAreaSqm: number | null;
};
export type BuildingPermitOutput = BuildingPermitRecord[];

type RawItem = {
  mainPurpsCdNm?: string; pmsDay?: string; stcnsDay?: string; useAprDay?: string; totArea?: string | number;
};
type DataGoKrResponse = { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { totalCount?: number; items?: { item?: RawItem | RawItem[] } } } };
const CONNECTOR_ID = 'building-permit';

export function createBuildingPermitConnector(): Connector<BuildingPermitInput, BuildingPermitOutput> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);
  return {
    manifest,
    async execute(input, signal) {
      const key = process.env.DATA_GO_KR_API_KEY;
      if (!key) return emptyResult('DATA_GO_KR_API_KEY가 설정되지 않았습니다.');
      const url = buildDataGoKrUrl(
        'https://apis.data.go.kr/1613000/ArchPmsHubService/getApBasisOulnInfo',
        'serviceKey', key,
        { sigunguCd: input.sigunguCode, bjdongCd: input.bjdongCode, bun: input.bun.padStart(4, '0'), ji: input.ji.padStart(4, '0'), numOfRows: '100', pageNo: '1', _type: 'json' },
      );
      try {
        const raw = await fetchWithRetry<DataGoKrResponse>(url, { timeoutMs: manifest.timeoutMs, signal });
        const header = raw.response?.header;
        if (header?.resultCode !== '00') return emptyResult(header?.resultMsg ?? '건축 인허가 API 응답 오류');
        const items = raw.response?.body?.items?.item;
        const list = items ? (Array.isArray(items) ? items : [items]) : [];
        return {
          data: list.map((item) => ({
            purpose: item.mainPurpsCdNm ?? null,
            permitDate: normalizeDate(item.pmsDay),
            constructionStartDate: normalizeDate(item.stcnsDay),
            approvalDate: normalizeDate(item.useAprDay),
            totalAreaSqm: finiteNumber(item.totArea),
          })),
          rawSnapshotId: `permit-${Date.now()}`,
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
function finiteNumber(value: unknown) { const result = Number(value); return Number.isFinite(result) && result > 0 ? result : null; }
function normalizeDate(value: unknown) { const date = String(value ?? '').replace(/\D/g, ''); return /^\d{8}$/.test(date) ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}` : null; }
function emptyResult(warning: string): ConnectorResult<BuildingPermitOutput> { return { data: null, rawSnapshotId: `permit-err-${Date.now()}`, observedAt: new Date().toISOString(), warnings: [warning] }; }
