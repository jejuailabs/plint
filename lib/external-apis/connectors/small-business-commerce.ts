import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { buildDataGoKrUrl, fetchWithRetry, HttpError } from '@/lib/external-apis/http-client';

export type CommerceInput = { latitude: number; longitude: number; radiusM?: number };
export type CommerceOutput = { count: number; radiusM: number; referenceMonth: string | null; topCategories: string[] };
type Item = { indsLclsNm?: string };
type Response = { header?: { resultCode?: string; resultMsg?: string; stdrYm?: string }; body?: { totalCount?: number; items?: Item[] } };
const CONNECTOR_ID = 'small-business-commerce';

export function createSmallBusinessCommerceConnector(): Connector<CommerceInput, CommerceOutput> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);
  return { manifest, async execute(input, signal) {
    const key = process.env.DATA_GO_KR_API_KEY;
    if (!key) return emptyResult('DATA_GO_KR_API_KEY가 설정되지 않았습니다.');
    const radiusM = input.radiusM ?? 500;
    const url = buildDataGoKrUrl('https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius', 'serviceKey', key, { pageNo: '1', numOfRows: '1000', radius: String(radiusM), cx: String(input.longitude), cy: String(input.latitude), type: 'json' });
    try {
      const raw = await fetchWithRetry<Response>(url, { timeoutMs: manifest.timeoutMs, signal });
      if (raw.header?.resultCode !== '00') return emptyResult(raw.header?.resultMsg ?? '상권 API 응답 오류');
      const counts = new Map<string, number>();
      for (const item of raw.body?.items ?? []) if (item.indsLclsNm) counts.set(item.indsLclsNm, (counts.get(item.indsLclsNm) ?? 0) + 1);
      return { data: { count: Number(raw.body?.totalCount ?? 0), radiusM, referenceMonth: raw.header?.stdrYm ?? null, topCategories: [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0,3).map(([name,count]) => `${name} ${count}개`) }, rawSnapshotId: `commerce-${Date.now()}`, observedAt: new Date().toISOString(), warnings: Number(raw.body?.totalCount ?? 0) > 1000 ? ['반경 내 업소가 1,000건을 넘어 업종 구성은 일부 표본입니다.'] : [] };
    } catch (error) { const message = error instanceof HttpError ? error.message : String(error); return emptyResult(message); }
  }};
}
function emptyResult(warning: string): ConnectorResult<CommerceOutput> { return { data: null, rawSnapshotId: `commerce-err-${Date.now()}`, observedAt: new Date().toISOString(), warnings: [warning] }; }
