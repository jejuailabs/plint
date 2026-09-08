/**
 * VWorld WFS 건물통합 — 대상 필지 주변 건물 폴리곤·높이를 조회한다.
 *
 * Endpoint: https://api.vworld.kr/req/wfs
 * TypeName: lt_c_spbdbuilding (건물통합정보마스터)
 * Env:      VWORLD_API_KEY
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { fetchWithRetry, HttpError } from '@/lib/external-apis/http-client';

export type ContextBuildingsInput = {
  centerLat: number;
  centerLon: number;
  radiusM?: number;
};

export type ContextBuildingItem = {
  id: string;
  footprint: [number, number][][];
  heightM: number;
  floorsAbove: number | null;
  use: string | null;
};

export type ContextBuildingsOutput = ContextBuildingItem[];

type WfsFeature = {
  type: 'Feature';
  geometry?: { type: string; coordinates: unknown };
  properties?: Record<string, unknown>;
};

type WfsResponse = {
  type: 'FeatureCollection';
  features?: WfsFeature[];
  totalFeatures?: number;
  response?: { status?: string; error?: { text?: string } };
};

const CONNECTOR_ID = 'gis-building';
const DEG_PER_M = 1 / 111_320;

export function createContextBuildingsConnector(): Connector<ContextBuildingsInput, ContextBuildingsOutput> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);

  return {
    manifest,

    async execute(input, signal) {
      const apiKey = process.env.VWORLD_API_KEY;
      if (!apiKey) return emptyResult('VWORLD_API_KEY is not configured');

      const radius = input.radiusM ?? 150;
      const dLat = radius * DEG_PER_M;
      const dLon = radius * DEG_PER_M / Math.cos((input.centerLat * Math.PI) / 180);

      const bbox = [
        input.centerLon - dLon,
        input.centerLat - dLat,
        input.centerLon + dLon,
        input.centerLat + dLat,
      ].join(',');

      const url = new URL('https://api.vworld.kr/req/wfs');
      url.searchParams.set('service', 'WFS');
      url.searchParams.set('version', '2.0.0');
      url.searchParams.set('request', 'GetFeature');
      url.searchParams.set('typeName', 'lt_c_spbdbuilding');
      url.searchParams.set('crs', 'EPSG:4326');
      url.searchParams.set('output', 'application/json');
      url.searchParams.set('bbox', bbox);
      url.searchParams.set('maxFeatures', '80');
      url.searchParams.set('key', apiKey);
      if (process.env.VWORLD_DOMAIN) {
        url.searchParams.set('domain', process.env.VWORLD_DOMAIN);
      }

      try {
        const raw = await fetchWithRetry<WfsResponse>(url.toString(), {
          timeoutMs: manifest.timeoutMs,
          signal,
        });

        if (raw.response?.status === 'ERROR') {
          return emptyResult(raw.response.error?.text ?? 'VWorld WFS building error');
        }

        const features = raw.features ?? [];
        if (features.length === 0) {
          return emptyResult('No buildings found in this area');
        }

        const buildings: ContextBuildingItem[] = [];

        for (const feat of features) {
          if (!feat.geometry) continue;

          let coords: [number, number][][];
          if (feat.geometry.type === 'Polygon') {
            coords = feat.geometry.coordinates as [number, number][][];
          } else if (feat.geometry.type === 'MultiPolygon') {
            const multi = feat.geometry.coordinates as [number, number][][][];
            coords = multi[0] ?? [];
          } else {
            continue;
          }

          const props = feat.properties ?? {};
          const floors = parseNum(props.grnd_flr_co) ?? parseNum(props.gro_flo_co);
          const height = parseNum(props.height) ?? (floors ? floors * 3.2 : 9);
          const id = String(props.buld_se_cd ?? props.bd_mgt_sn ?? `bldg-${buildings.length}`);

          buildings.push({
            id,
            footprint: coords,
            heightM: height,
            floorsAbove: floors,
            use: (props.bdtyp_cd_nm ?? props.main_purps_cd_nm ?? null) as string | null,
          });
        }

        return {
          data: buildings,
          rawSnapshotId: `ctx-bldg-${Date.now()}`,
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

function parseNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function emptyResult(warning: string): ConnectorResult<ContextBuildingsOutput> {
  return {
    data: null,
    rawSnapshotId: `ctx-bldg-err-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}
