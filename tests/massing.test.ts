import { describe, it, expect } from 'vitest';
import { placeMassing, polygonArea } from '@/lib/pipeline/massing';
import { calculateScenarios } from '@/lib/pipeline/regulations/calculate-envelope';
import type { Polygon } from '@/lib/domain/parcel-intelligence';
const origin = [126.3389, 33.4675],
  mx = 111320 * Math.cos((origin[1] * Math.PI) / 180);
const geo = (ring: number[][]) =>
  ring.map(
    ([x, y]) =>
      [origin[0] + x / mx, origin[1] + y / 111320] as [number, number],
  );
const scenario = calculateScenarios({
  areaSqm: 900,
  buildingCoverageLimit: 60,
  floorAreaRatioLimit: 200,
  comparablePricePerSqm: 0,
  landPricePerSqm: 0,
})[1];
describe('geolocated massing', () => {
  it('does not fabricate a parcel when geometry is missing', () =>
    expect(placeMassing(null, 900, scenario)).toBeNull());
  it('keeps a mass inside an L shaped parcel and preserves its floor area', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        geo([
          [0, 0],
          [40, 0],
          [40, 10],
          [10, 10],
          [10, 40],
          [0, 40],
          [0, 0],
        ]),
      ],
    };
    const mass = placeMassing(polygon, 700, scenario)!;
    expect(mass).not.toBeNull();
    for (const [lon, lat] of mass.footprint.coordinates[0]) {
      const x = (lon - origin[0]) * mx,
        y = (lat - origin[1]) * 111320;
      expect(
        x >= -0.01 &&
          x <= 40.01 &&
          y >= -0.01 &&
          y <= 40.01 &&
          (x <= 10.01 || y <= 10.01),
      ).toBe(true);
    }
    expect(polygonArea(mass.footprint)).toBeCloseTo(
      mass.widthM * mass.depthM,
      1,
    );
    expect(mass.floorAreasSqm.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(
      scenario.grossFloorAreaSqm,
    );
  });
  it('does not cover a courtyard hole', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        geo([
          [0, 0],
          [40, 0],
          [40, 40],
          [0, 40],
          [0, 0],
        ]),
        geo([
          [10, 10],
          [30, 10],
          [30, 30],
          [10, 30],
          [10, 10],
        ]),
      ],
    };
    expect(polygonArea(polygon)).toBeCloseTo(1200, 0);
    const mass = placeMassing(polygon, 1200, scenario)!;
    expect(mass).not.toBeNull();
    expect(mass.widthM * mass.depthM).toBeLessThan(400);
  });
  it('floor areas sum to the reported target before boundary fitting', () => {
    const base = (900 * scenario.buildingCoverageRatio) / 100;
    expect(
      scenario.floors.reduce((a, f) => a + base * f.footprintScale ** 2, 0),
    ).toBeCloseTo(scenario.grossFloorAreaSqm, 4);
  });
});
