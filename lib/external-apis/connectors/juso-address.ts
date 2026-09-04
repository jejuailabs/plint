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
    coordinateSystem: 'GRS80_UTMK';
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
          return emptyResult('No address results found');
        }

        // Construct PNU code: admCd(10) + mountain-flag(1) + bon(4) + bu(4) = 19 digits.
        // The candidate still needs cadastral geometry validation before it is an
        // authoritative parcel selection (especially for collective buildings).
        const bon = juso.lnbrMnnm.padStart(4, '0');
        const bu = juso.lnbrSlno.padStart(4, '0');
        const mountainFlag = juso.mtYn === '1' ? '2' : '1';
        const pnuCode = `${juso.admCd}${mountainFlag}${bon}${bu}`;

        const latitude = juso.entY ? parseFloat(juso.entY) : 0;
        const longitude = juso.entX ? parseFloat(juso.entX) : 0;
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
              coordinateSystem: 'GRS80_UTMK',
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

function emptyResult(warning: string): ConnectorResult<JusoAddressOutput> {
  return {
    data: null,
    rawSnapshotId: `juso-err-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}
