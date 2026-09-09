/**
 * 도로명주소 API connector.
 *
 * Endpoint: https://business.juso.go.kr/addrlink/addrLinkApi.do
 * Env:      JUSO_API_KEY
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { fetchWithRetry, HttpError } from '@/lib/external-apis/http-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JusoAddressInput = {
  address: string;
  detailAddress?: {
    buildingName?: string;
    dong?: string;
    floor?: string;
    unit?: string;
    rawInput?: string;
  };
};

export type JusoAddressOutput = {
  pnuCode: string;
  jibunAddress: string;
  roadAddress: string;
  latitude: number;
  longitude: number;
  administrativeCode: string;
  buildingManagementNo?: string;
  postalCode?: string;
  buildingName?: string;
  detailedBuildingNames: string[];
  sourceCoordinate: {
    x: number;
    y: number;
    coordinateSystem: 'GRS80_UTMK' | 'EPSG:4326';
  };
  detailAddress?: JusoAddressInput['detailAddress'] & {
    verification: 'user_confirmed' | 'unverified';
  };
};

/** Shape of the raw API JSON response. */
type JusoApiResponse = {
  results: {
    common: { errorCode: string; errorMessage: string; totalCount: string };
    juso?: Array<{
      admCd: string;
      rnMgtSn: string;
      lnbrMnnm: string;
      lnbrSlno: string;
      jibunAddr: string;
      roadAddr: string;
      entX?: string;
      entY?: string;
      bdMgtSn: string;
      zipNo?: string;
      bdNm?: string;
      detBdNmList?: string;
      mtYn?: '0' | '1';
    }>;
  };
};

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

const CONNECTOR_ID = 'juso-coordinate';

export function createJusoAddressConnector(): Connector<
  JusoAddressInput,
  JusoAddressOutput
> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);

  return {
    manifest,

    async execute(input, signal) {
      const exactParcel = await findParcelWithVWorld(input.address, signal);
      if (exactParcel) {
        return {
          data: exactParcel,
          rawSnapshotId: `vworld-parcel-search-${Date.now()}`,
          observedAt: new Date().toISOString(),
          warnings: [
            'VWorld 필지 검색에서 정확 지번과 PNU를 우선 사용했습니다.',
          ],
        };
      }
      const apiKey = process.env.JUSO_API_KEY;
      if (!apiKey) {
        return emptyResult('JUSO_API_KEY is not configured');
      }

      const url = new URL(
        'https://business.juso.go.kr/addrlink/addrLinkApi.do',
      );
      url.searchParams.set('confmKey', apiKey);
      url.searchParams.set('currentPage', '1');
      url.searchParams.set('countPerPage', '1');
      url.searchParams.set('keyword', input.address);
      url.searchParams.set('resultType', 'json');

      try {
        const raw = await fetchWithRetry<JusoApiResponse>(url.toString(), {
          timeoutMs: manifest.timeoutMs,
          signal,
        });

        const common = raw.results?.common;
        if (!common || common.errorCode !== '0') {
          const msg = common?.errorMessage ?? 'Unknown error from JUSO API';
          console.error(`[${CONNECTOR_ID}] API error: ${msg}`);
          return emptyResult(msg);
        }

        const juso = raw.results.juso?.[0];
        if (!juso) {
          const parcel = await resolveParcelWithVWorld(input.address, signal);
          if (parcel) {
            return {
              data: parcel,
              rawSnapshotId: `vworld-parcel-${Date.now()}`,
              observedAt: new Date().toISOString(),
              warnings: [
                '도로명주소 결과 없이 VWorld 필지 좌표·PNU로 해석했습니다.',
              ],
            };
          }
          return emptyResult('No address results found');
        }

        // Construct PNU code: admCd(10) + mountain-flag(1) + bon(4) + bu(4) = 19 digits.
        // The candidate still needs cadastral geometry validation before it is an
        // authoritative parcel selection (especially for collective buildings).
        const bon = juso.lnbrMnnm.padStart(4, '0');
        const bu = juso.lnbrSlno.padStart(4, '0');
        const mountainFlag = juso.mtYn === '1' ? '2' : '1';
        const pnuCode = `${juso.admCd}${mountainFlag}${bon}${bu}`;

        let latitude = juso.entY ? parseFloat(juso.entY) : 0;
        let longitude = juso.entX ? parseFloat(juso.entX) : 0;

        // Fallback: VWorld geocoding when JUSO doesn't return coordinates
        if (
          !(
            latitude >= 33 &&
            latitude <= 39 &&
            longitude >= 124 &&
            longitude <= 132
          ) &&
          process.env.VWORLD_API_KEY
        ) {
          try {
            const geoUrl = new URL('https://api.vworld.kr/req/address');
            geoUrl.searchParams.set('service', 'address');
            geoUrl.searchParams.set('request', 'getcoord');
            geoUrl.searchParams.set('version', '2.0');
            geoUrl.searchParams.set('crs', 'epsg:4326');
            geoUrl.searchParams.set('type', 'PARCEL');
            geoUrl.searchParams.set('address', juso.jibunAddr);
            if (process.env.VWORLD_DOMAIN)
              geoUrl.searchParams.set('domain', process.env.VWORLD_DOMAIN);
            geoUrl.searchParams.set('format', 'json');
            geoUrl.searchParams.set('key', process.env.VWORLD_API_KEY);
            const geoRes = await fetchWithRetry<{
              response?: {
                status?: string;
                result?: { point?: { x?: string; y?: string } };
              };
            }>(geoUrl.toString(), { timeoutMs: 5000, signal });
            const pt = geoRes.response?.result?.point;
            if (pt?.x && pt?.y) {
              longitude = parseFloat(pt.x);
              latitude = parseFloat(pt.y);
            }
          } catch {
            // VWorld geocoding failed, continue with 0,0
          }
        }
        if (
          !(
            latitude >= 33 &&
            latitude <= 39 &&
            longitude >= 124 &&
            longitude <= 132
          )
        ) {
          latitude = 0;
          longitude = 0;
        }
        const detailedBuildingNames = (juso.detBdNmList ?? '')
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean);

        const result: ConnectorResult<JusoAddressOutput> = {
          data: {
            pnuCode,
            jibunAddress: juso.jibunAddr,
            roadAddress: juso.roadAddr,
            latitude,
            longitude,
            administrativeCode: juso.admCd,
            buildingManagementNo: juso.bdMgtSn || undefined,
            postalCode: juso.zipNo,
            buildingName: juso.bdNm,
            detailedBuildingNames,
            sourceCoordinate: {
              x: longitude,
              y: latitude,
              coordinateSystem: 'EPSG:4326',
            },
            detailAddress: input.detailAddress
              ? { ...input.detailAddress, verification: 'user_confirmed' }
              : undefined,
          },
          rawSnapshotId: `juso-${Date.now()}`,
          observedAt: new Date().toISOString(),
          warnings: [],
        };

        if (latitude === 0 || longitude === 0) {
          result.warnings.push(
            '좌표 정보가 반환되지 않았습니다. 좌표변환 API를 추가 호출하세요.',
          );
        }

        return result;
      } catch (error) {
        const message =
          error instanceof HttpError ? error.message : String(error);
        console.error(`[${CONNECTOR_ID}] ${message}`);
        return emptyResult(message);
      }
    },
  };
}

async function findParcelWithVWorld(
  address: string,
  signal?: AbortSignal,
): Promise<JusoAddressOutput | null> {
  const key = process.env.VWORLD_API_KEY;
  if (!key) return null;
  try {
    const url = new URL('https://api.vworld.kr/req/search');
    for (const [name, value] of Object.entries({
      service: 'search',
      request: 'search',
      version: '2.0',
      crs: 'EPSG:4326',
      size: '20',
      page: '1',
      query: address,
      type: 'address',
      category: 'parcel',
      format: 'json',
      key,
    }))
      url.searchParams.set(name, value);
    const raw = await fetchWithRetry<{
      response?: {
        result?: {
          items?: Array<{
            id?: string;
            address?: {
              parcel?: string;
              road?: string;
              zipcode?: string;
              bldnm?: string;
            };
            point?: { x?: string; y?: string };
          }>;
        };
      };
    }>(url.toString(), { timeoutMs: 5000, signal });
    const normalized = address.replace(/\s+/g, '');
    const item = raw.response?.result?.items?.find((candidate) =>
      candidate.address?.parcel?.replace(/\s+/g, '').endsWith(normalized),
    );
    const pnu = item?.id ?? '';
    const lon = Number(item?.point?.x);
    const lat = Number(item?.point?.y);
    if (!/^\d{19}$/.test(pnu) || !Number.isFinite(lon) || !Number.isFinite(lat))
      return null;
    return {
      pnuCode: pnu,
      jibunAddress: item?.address?.parcel ?? address,
      roadAddress: item?.address?.road ?? '',
      latitude: lat,
      longitude: lon,
      administrativeCode: pnu.slice(0, 10),
      postalCode: item?.address?.zipcode || undefined,
      buildingName: item?.address?.bldnm || undefined,
      detailedBuildingNames: [],
      sourceCoordinate: { x: lon, y: lat, coordinateSystem: 'EPSG:4326' },
    };
  } catch {
    return null;
  }
}

async function resolveParcelWithVWorld(
  address: string,
  signal?: AbortSignal,
): Promise<JusoAddressOutput | null> {
  const key = process.env.VWORLD_API_KEY;
  if (!key) return null;
  try {
    const geoUrl = new URL('https://api.vworld.kr/req/address');
    geoUrl.searchParams.set('service', 'address');
    geoUrl.searchParams.set('request', 'getcoord');
    geoUrl.searchParams.set('version', '2.0');
    geoUrl.searchParams.set('crs', 'epsg:4326');
    geoUrl.searchParams.set('type', 'PARCEL');
    geoUrl.searchParams.set('address', address);
    geoUrl.searchParams.set('format', 'json');
    geoUrl.searchParams.set('key', key);
    if (process.env.VWORLD_DOMAIN)
      geoUrl.searchParams.set('domain', process.env.VWORLD_DOMAIN);
    const geo = await fetchWithRetry<{
      response?: { result?: { point?: { x?: string; y?: string } } };
    }>(geoUrl.toString(), { timeoutMs: 5000, signal });
    const lon = Number(geo.response?.result?.point?.x);
    const lat = Number(geo.response?.result?.point?.y);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

    const delta = 0.00008;
    const wfsUrl = new URL('https://api.vworld.kr/req/wfs');
    wfsUrl.searchParams.set('service', 'WFS');
    wfsUrl.searchParams.set('version', '1.1.0');
    wfsUrl.searchParams.set('request', 'GetFeature');
    wfsUrl.searchParams.set('typeName', 'lt_c_landinfobasemap');
    wfsUrl.searchParams.set('srsName', 'EPSG:4326');
    wfsUrl.searchParams.set('output', 'application/json');
    wfsUrl.searchParams.set(
      'bbox',
      `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`,
    );
    wfsUrl.searchParams.set('maxFeatures', '8');
    wfsUrl.searchParams.set('key', key);
    if (process.env.VWORLD_DOMAIN)
      wfsUrl.searchParams.set('domain', process.env.VWORLD_DOMAIN);
    const wfs = await fetchWithRetry<{
      features?: Array<{ properties?: Record<string, unknown> }>;
    }>(wfsUrl.toString(), { timeoutMs: 5000, signal });
    const pnu = wfs.features
      ?.map((feature) => {
        const value = feature.properties?.pnu;
        return typeof value === 'string' || typeof value === 'number'
          ? String(value)
          : '';
      })
      .find((value) => /^\d{19}$/.test(value));
    if (!pnu) return null;
    return {
      pnuCode: pnu,
      jibunAddress: address,
      roadAddress: '',
      latitude: lat,
      longitude: lon,
      administrativeCode: pnu.slice(0, 10),
      detailedBuildingNames: [],
      sourceCoordinate: { x: lon, y: lat, coordinateSystem: 'EPSG:4326' },
    };
  } catch {
    return null;
  }
}

function emptyResult(warning: string): ConnectorResult<JusoAddressOutput> {
  return {
    data: null,
    rawSnapshotId: `juso-err-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}
