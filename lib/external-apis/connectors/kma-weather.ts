/**
 * 기상청 종관기상관측(ASOS) API connector.
 *
 * Endpoint: http://apis.data.go.kr/1360000/AsosHourlyInfoService/getWthrDataList
 * Env:      KMA_API_KEY
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { fetchWithRetry, HttpError } from '@/lib/external-apis/http-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KmaWeatherInput = {
  stationId: string;
  startDate: string; // YYYYMMDD
  endDate: string;   // YYYYMMDD
};

export type KmaWeatherOutput = {
  annualSunlightHours: number;
  solarRadiation: number;
  prevailingWind: string;
};

type RawItem = {
  ss?: string;  // sunshine duration (hours)
  icsr?: string; // solar radiation
  wd?: string;   // wind direction code
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

// Wind direction code to Korean label mapping.
const WIND_DIRECTION_MAP: Record<string, string> = {
  '0': 'N(북)', '22.5': 'NNE(북북동)', '45': 'NE(북동)', '67.5': 'ENE(동북동)',
  '90': 'E(동)', '112.5': 'ESE(동남동)', '135': 'SE(남동)', '157.5': 'SSE(남남동)',
  '180': 'S(남)', '202.5': 'SSW(남남서)', '225': 'SW(남서)', '247.5': 'WSW(서남서)',
  '270': 'W(서)', '292.5': 'WNW(서북서)', '315': 'NW(북서)', '337.5': 'NNW(북북서)',
};

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

const CONNECTOR_ID = 'asos-daily';

export function createKmaWeatherConnector(): Connector<KmaWeatherInput, KmaWeatherOutput> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);

  return {
    manifest,

    async execute(input, signal) {
      const apiKey = process.env.KMA_API_KEY;
      if (!apiKey) {
        return emptyResult('KMA_API_KEY is not configured');
      }

      const url = new URL(
        'http://apis.data.go.kr/1360000/AsosHourlyInfoService/getWthrDataList',
      );
      url.searchParams.set('serviceKey', apiKey);
      url.searchParams.set('numOfRows', '999');
      url.searchParams.set('pageNo', '1');
      url.searchParams.set('dataType', 'JSON');
      url.searchParams.set('dataCd', 'ASOS');
      url.searchParams.set('dateCd', 'DAY');
      url.searchParams.set('startDt', input.startDate);
      url.searchParams.set('endDt', input.endDate);
      url.searchParams.set('stnIds', input.stationId);

      try {
        const raw = await fetchWithRetry<DataGoKrResponse>(url.toString(), {
          timeoutMs: manifest.timeoutMs,
          signal,
        });

        const header = raw.response?.header;
        if (!header || header.resultCode !== '00') {
          const msg = header?.resultMsg ?? 'Unknown error from KMA API';
          console.error(`[${CONNECTOR_ID}] API error: ${msg}`);
          return emptyResult(msg);
        }

        const rawItems = raw.response.body?.items?.item;
        if (!rawItems) {
          return emptyResult('No weather data returned');
        }

        const items = Array.isArray(rawItems) ? rawItems : [rawItems];

        // Aggregate values across all returned daily records.
        let totalSunshine = 0;
        let totalRadiation = 0;
        let radiationCount = 0;
        const windCounts = new Map<string, number>();

        for (const item of items) {
          if (item.ss) {
            const hours = parseFloat(item.ss);
            if (!isNaN(hours)) totalSunshine += hours;
          }
          if (item.icsr) {
            const radiation = parseFloat(item.icsr);
            if (!isNaN(radiation)) {
              totalRadiation += radiation;
              radiationCount += 1;
            }
          }
          if (item.wd) {
            windCounts.set(item.wd, (windCounts.get(item.wd) ?? 0) + 1);
          }
        }

        // Find the prevailing wind direction.
        let prevailingCode = '';
        let maxCount = 0;
        for (const [code, count] of windCounts) {
          if (count > maxCount) {
            maxCount = count;
            prevailingCode = code;
          }
        }
        const prevailingWind = WIND_DIRECTION_MAP[prevailingCode] ?? (prevailingCode || '미확인');

        return {
          data: {
            annualSunlightHours: Math.round(totalSunshine),
            solarRadiation: radiationCount > 0 ? Math.round(totalRadiation / radiationCount) : 0,
            prevailingWind,
          },
          rawSnapshotId: `kma-${Date.now()}`,
          observedAt: new Date().toISOString(),
          warnings: ['최근접 관측소 기반 집계입니다.'],
        };
      } catch (error) {
        const message = error instanceof HttpError ? error.message : String(error);
        console.error(`[${CONNECTOR_ID}] ${message}`);
        return emptyResult(message);
      }
    },
  };
}

function emptyResult(warning: string): ConnectorResult<KmaWeatherOutput> {
  return {
    data: null,
    rawSnapshotId: `kma-err-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}
