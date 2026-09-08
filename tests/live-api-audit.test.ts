import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { runPreviewAnalysis } from '@/lib/pipeline/preview';
import { GET as map } from '@/app/api/map/static/route';
it.skipIf(process.env.PLINT_LIVE_AUDIT !== '1')(
  'audits the authorized Jeju parcel through real connectors',
  async () => {
    process.env.USE_MOCK_EXTERNAL_API = 'false';
    const result = await runPreviewAnalysis(
      '제주특별자치도 제주시 애월읍 애월해안로 255',
    );
    writeFileSync(
      'docs/jeju-live-analysis.json',
      JSON.stringify(result, null, 2),
    );
    const d = result.data;
    console.log(
      JSON.stringify(
        {
          area: d.geometry.areaSqm.value,
          center: d.identity.center.value,
          pnu: d.identity.pnu.value,
          planning: d.planning.map((p) => p.name),
          context: d.context.length,
          price: d.market.officialLandPricePerSqm.value,
          sources: d.sourceStatus,
          scenarios: d.scenarios.map((s) => ({
            name: s.name,
            area: s.grossFloorAreaSqm,
            placed: !!s.massing,
          })),
        },
        null,
        2,
      ),
    );
    expect(d.geometry.areaSqm.value).toBe(904);
    expect(d.identity.pnu.value).toBe('5011025333111050001');
    expect(d.identity.center.value?.longitude).toBeCloseTo(126.339, 2);
    expect(d.geometry.boundary.value).not.toBeNull();
    expect(d.context.length).toBeGreaterThan(0);
    expect(d.scenarios.every((s) => !!s.massing)).toBe(true);
    const response = await map(
      new NextRequest(
        'http://localhost/api/map/static?lat=33.4675&lon=126.3389&basemap=SATELLITE',
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  },
  120000,
);
