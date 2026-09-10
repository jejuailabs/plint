/**
 * SGIS 생활권 수요 connector.
 *
 * A parcel's WGS84 point is converted to GRS80 / UTM-K, reverse-geocoded to
 * an SGIS administrative dong, then joined to the latest census population
 * and establishment statistics. The result is intentionally labelled as an
 * administrative-dong aggregate, never as an artificial 500m/1km buffer.
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { fetchWithRetry, HttpError } from '@/lib/external-apis/http-client';

export type SgisDemandInput = { latitude: number; longitude: number };

export type SgisDemandOutput = {
  administrativeDongCode: string;
  administrativeDongName: string;
  population: number | null;
  households: number | null;
  businesses: number | null;
  referenceYear: number;
};

type SgisEnvelope<T> = { errCd?: number | string; errMsg?: string; result?: T };
type ReverseAddress = {
  sido_cd?: string;
  sgg_cd?: string;
  emdong_cd?: string;
  full_addr?: string;
  emdong_nm?: string;
};
type PopulationStat = { tot_ppltn?: string | number; tot_family?: string | number };
type CompanyStat = { all_corp_cnt?: string | number; corp_cnt?: string | number };

const CONNECTOR_ID = 'sgis-census';
const BASE = 'https://sgisapi.kostat.go.kr/OpenAPI3';
const CENSUS_YEAR = 2022;

export function createSgisDemandConnector(): Connector<SgisDemandInput, SgisDemandOutput> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);

  return {
    manifest,
    async execute(input, signal) {
      const consumerKey = process.env.SGIS_CONSUMER_KEY;
      const consumerSecret = process.env.SGIS_CONSUMER_SECRET;
      if (!consumerKey || !consumerSecret) {
        return emptyResult('SGIS_CONSUMER_KEY 또는 SGIS_CONSUMER_SECRET이 설정되지 않았습니다.');
      }

      try {
        const authUrl = new URL(`${BASE}/auth/authentication.json`);
        authUrl.searchParams.set('consumer_key', consumerKey);
        authUrl.searchParams.set('consumer_secret', consumerSecret);
        const auth = await fetchWithRetry<SgisEnvelope<{ accessToken?: string }>>(
          authUrl.toString(), { timeoutMs: manifest.timeoutMs, signal },
        );
        const token = auth.result?.accessToken;
        if (String(auth.errCd) !== '0' || !token) {
          return emptyResult(auth.errMsg ?? 'SGIS 인증 토큰을 발급하지 못했습니다.');
        }

        const point = wgs84ToUtmK(input.latitude, input.longitude);
        const reverseUrl = new URL(`${BASE}/addr/rgeocode.json`);
        reverseUrl.searchParams.set('accessToken', token);
        reverseUrl.searchParams.set('x_coor', String(point.x));
        reverseUrl.searchParams.set('y_coor', String(point.y));
        reverseUrl.searchParams.set('addr_type', '20');
        const reverse = await fetchWithRetry<SgisEnvelope<ReverseAddress[]>>(
          reverseUrl.toString(), { timeoutMs: manifest.timeoutMs, signal },
        );
        const area = reverse.result?.[0];
        const administrativeDongCode = [area?.sido_cd, area?.sgg_cd, area?.emdong_cd]
          .map((part, index) => String(part ?? '').padStart(index === 0 ? 2 : 3, '0'))
          .join('');
        if (String(reverse.errCd) !== '0' || !/^\d{8}$/.test(administrativeDongCode)) {
          return emptyResult(reverse.errMsg ?? 'SGIS 행정동 좌표 변환에 실패했습니다.');
        }

        const statisticsUrl = (path: string) => {
          const url = new URL(`${BASE}/${path}`);
          url.searchParams.set('accessToken', token);
          url.searchParams.set('year', String(CENSUS_YEAR));
          url.searchParams.set('adm_cd', administrativeDongCode);
          url.searchParams.set('low_search', '0');
          return url.toString();
        };
        const [population, company] = await Promise.all([
          fetchWithRetry<SgisEnvelope<PopulationStat[]>>(
            statisticsUrl('stats/population.json'),
            { timeoutMs: manifest.timeoutMs, signal },
          ),
          fetchWithRetry<SgisEnvelope<CompanyStat[]>>(
            statisticsUrl('stats/company.json'),
            { timeoutMs: manifest.timeoutMs, signal },
          ),
        ]);
        const populationStat = population.result?.[0];
        const companyStat = company.result?.[0];
        if (String(population.errCd) !== '0' && String(company.errCd) !== '0') {
          return emptyResult(population.errMsg ?? company.errMsg ?? 'SGIS 통계 조회에 실패했습니다.');
        }

        return {
          data: {
            administrativeDongCode,
            administrativeDongName: area?.full_addr ?? area?.emdong_nm ?? administrativeDongCode,
            population: toNumber(populationStat?.tot_ppltn),
            households: toNumber(populationStat?.tot_family),
            businesses: toNumber(companyStat?.all_corp_cnt ?? companyStat?.corp_cnt),
            referenceYear: CENSUS_YEAR,
          },
          rawSnapshotId: `sgis-demand-${Date.now()}`,
          observedAt: new Date().toISOString(),
          warnings: [
            '행정동 단위 센서스 통계입니다. 대상 필지 반경 500m·1km 수요로 해석하지 마세요.',
          ],
        };
      } catch (error) {
        const message = error instanceof HttpError ? error.message : String(error);
        console.error(`[${CONNECTOR_ID}] ${message}`);
        return emptyResult(message);
      }
    },
  };
}

function toNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function emptyResult(warning: string): ConnectorResult<SgisDemandOutput> {
  return { data: null, rawSnapshotId: `sgis-demand-err-${Date.now()}`, observedAt: new Date().toISOString(), warnings: [warning] };
}

function wgs84ToUtmK(latitude: number, longitude: number) {
  const semiMajor = 6378137;
  const flattening = 1 / 298.257222101;
  const eccentricitySquared = 2 * flattening - flattening * flattening;
  const secondaryEccentricitySquared = eccentricitySquared / (1 - eccentricitySquared);
  const scale = 0.9996;
  const rad = Math.PI / 180;
  const latitudeRad = latitude * rad;
  const longitudeRad = longitude * rad;
  const originLatitude = 38 * rad;
  const originLongitude = 127.5 * rad;
  const meridianArc = (lat: number) => semiMajor * (
    (1 - eccentricitySquared / 4 - (3 * eccentricitySquared ** 2) / 64 - (5 * eccentricitySquared ** 3) / 256) * lat
    - (3 * eccentricitySquared / 8 + (3 * eccentricitySquared ** 2) / 32 + (45 * eccentricitySquared ** 3) / 1024) * Math.sin(2 * lat)
    + ((15 * eccentricitySquared ** 2) / 256 + (45 * eccentricitySquared ** 3) / 1024) * Math.sin(4 * lat)
    - ((35 * eccentricitySquared ** 3) / 3072) * Math.sin(6 * lat)
  );
  const n = semiMajor / Math.sqrt(1 - eccentricitySquared * Math.sin(latitudeRad) ** 2);
  const tangentSquared = Math.tan(latitudeRad) ** 2;
  const c = secondaryEccentricitySquared * Math.cos(latitudeRad) ** 2;
  const a = Math.cos(latitudeRad) * (longitudeRad - originLongitude);

  return {
    x: 1_000_000 + scale * n * (a + ((1 - tangentSquared + c) * a ** 3) / 6 + ((5 - 18 * tangentSquared + tangentSquared ** 2 + 72 * c - 58 * secondaryEccentricitySquared) * a ** 5) / 120),
    y: 2_000_000 + scale * (meridianArc(latitudeRad) - meridianArc(originLatitude) + n * Math.tan(latitudeRad) * (a ** 2 / 2 + ((5 - tangentSquared + 9 * c + 4 * c ** 2) * a ** 4) / 24 + ((61 - 58 * tangentSquared + tangentSquared ** 2 + 600 * c - 330 * secondaryEccentricitySquared) * a ** 6) / 720)),
  };
}
