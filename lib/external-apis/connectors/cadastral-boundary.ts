/**
 * 연속지적도 WFS connector.
 *
 * Endpoint: https://api.vworld.kr/req/wfs
 * Env:      VWORLD_API_KEY
 *
 * Returns parcel boundary polygon for a given PNU code.
 */

import type { Connector, ConnectorResult } from '@/lib/external-apis/connector';
import { getConnectorManifest } from '@/lib/external-apis/registry';
import { fetchWithRetry, HttpError } from '@/lib/external-apis/http-client';

export type CadastralBoundaryInput = {
  pnuCode: string;
};

export type CadastralBoundaryOutput = {
  type: 'Polygon';
  coordinates: [number, number][][];
  crs: string;
  areaSqm: number | null;
};

type WfsFeature = {
  type: 'Feature';
  geometry?: {
    type: string;
    coordinates: unknown;
  };
  properties?: Record<string, unknown>;
};

type WfsResponse = {
  type: 'FeatureCollection';
  features?: WfsFeature[];
  totalFeatures?: number;
  response?: { status?: string; error?: { text?: string } };
};

const CONNECTOR_ID = 'continuous-cadastral';

export function createCadastralBoundaryConnector(): Connector<
  CadastralBoundaryInput,
  CadastralBoundaryOutput
> {
  const manifest = getConnectorManifest(CONNECTOR_ID);
  if (!manifest) throw new Error(`Manifest not found: ${CONNECTOR_ID}`);

  return {
    manifest,

    async execute(input, signal) {
      const apiKey = process.env.VWORLD_API_KEY;
      if (!apiKey) return emptyResult('VWORLD_API_KEY is not configured');

      const pnu = input.pnuCode;
      if (!pnu || pnu.length !== 19) return emptyResult('Invalid PNU code');

      const url = new URL('https://api.vworld.kr/req/wfs');
      url.searchParams.set('service', 'WFS');
      url.searchParams.set('version', '1.1.0');
      url.searchParams.set('request', 'GetFeature');
      url.searchParams.set('typeName', 'lt_c_landinfobasemap');
      url.searchParams.set('srsName', 'EPSG:4326');
      url.searchParams.set('output', 'application/json');
      url.searchParams.set(
        'filter',
        `<Filter><PropertyIsEqualTo><PropertyName>pnu</PropertyName><Literal>${pnu}</Literal></PropertyIsEqualTo></Filter>`,
      );
      url.searchParams.set('maxFeatures', '1');
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
          return emptyResult(raw.response.error?.text ?? 'VWorld WFS error');
        }

        const feature = raw.features?.[0];
        if (!feature?.geometry) {
          return emptyResult('No cadastral boundary found for this PNU');
        }

        const geom = feature.geometry;
        let coordinates: [number, number][][];

        if (geom.type === 'Polygon') {
          coordinates = geom.coordinates as [number, number][][];
        } else if (geom.type === 'MultiPolygon') {
          const multi = geom.coordinates as [number, number][][][];
          coordinates = multi[0] ?? [];
        } else {
          return emptyResult(`Unexpected geometry type: ${geom.type}`);
        }

        const areaSqm =
          typeof feature.properties?.a17 === 'number'
            ? feature.properties.a17
            : typeof feature.properties?.area === 'number'
              ? feature.properties.area
              : null;

        return {
          data: {
            type: 'Polygon',
            coordinates,
            crs: 'EPSG:4326',
            areaSqm,
          },
          rawSnapshotId: `cadastral-${pnu}-${Date.now()}`,
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

function emptyResult(
  warning: string,
): ConnectorResult<CadastralBoundaryOutput> {
  return {
    data: null,
    rawSnapshotId: `cadastral-err-${Date.now()}`,
    observedAt: new Date().toISOString(),
    warnings: [warning],
  };
}
