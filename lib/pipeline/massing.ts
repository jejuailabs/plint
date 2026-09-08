import type {
  DevelopmentScenario,
  Polygon,
} from '@/lib/domain/parcel-intelligence';
export type MassPlacement = {
  center: { latitude: number; longitude: number };
  widthM: number;
  depthM: number;
  rotationRad: number;
  footprint: Polygon;
  floorAreasSqm: number[];
  notes: string[];
};
type P = [number, number];
const M = 111320;
function inside(p: P, ring: P[]) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function cross(a: P, b: P, c: P) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function intersects(a: P, b: P, c: P, d: P) {
  return (
    cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0
  );
}
export function polygonArea(polygon: Polygon): number {
  const origin = polygon.coordinates[0]?.[0];
  if (!origin) return 0;
  const cos = Math.cos((origin[1] * Math.PI) / 180);
  return polygon.coordinates.reduce((total, ring, index) => {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      sum +=
        (a[0] - origin[0]) * M * cos * (b[1] - origin[1]) * M -
        (b[0] - origin[0]) * M * cos * (a[1] - origin[1]) * M;
    }
    return total + (index === 0 ? 1 : -1) * Math.abs(sum / 2);
  }, 0);
}
/** Conservative rectangle search, not a statutory buildable envelope or optimal design. */
export function placeMassing(
  boundary: Polygon | null,
  areaSqm: number,
  scenario: DevelopmentScenario,
): MassPlacement | null {
  if (!boundary || !boundary.coordinates[0]?.length || areaSqm <= 0)
    return null;
  const origin = boundary.coordinates[0][0],
    cos = Math.cos((origin[1] * Math.PI) / 180);
  const rings = boundary.coordinates.map((r) =>
    r.map(([x, y]) => [(x - origin[0]) * M * cos, (y - origin[1]) * M] as P),
  );
  const ring = rings[0];
  const xs = ring.map((p) => p[0]),
    ys = ring.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const maxArea = Math.min(
    (areaSqm * scenario.buildingCoverageRatio) / 100,
    polygonArea(boundary),
  );
  const desiredW = Math.sqrt(maxArea / 0.85),
    desiredD = desiredW * 0.85;
  let best: {
    x: number;
    y: number;
    w: number;
    d: number;
    angle: number;
    corners: P[];
  } | null = null;
  const contains = (corners: P[]) =>
    corners.every(
      (p) => inside(p, ring) && !rings.slice(1).some((h) => inside(p, h)),
    ) &&
    !rings.some((r) =>
      r.some((p, i) =>
        corners.some((a, j) =>
          intersects(a, corners[(j + 1) % 4], p, r[(i + 1) % r.length]),
        ),
      ),
    ) &&
    !rings.slice(1).some((h) => h.some((p) => inside(p, corners)));
  for (let ix = 1; ix < 10; ix++)
    for (let iy = 1; iy < 10; iy++)
      for (let ai = 0; ai < 12; ai++) {
        const x = minX + ((maxX - minX) * ix) / 10,
          y = minY + ((maxY - minY) * iy) / 10,
          angle = (ai * Math.PI) / 12;
        if (!inside([x, y], ring)) continue;
        let lo = 0,
          hi = 1;
        const corners = (scale: number) =>
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(
            ([sx, sy]) =>
              [
                x +
                  ((sx * desiredW * scale) / 2) * Math.cos(angle) -
                  ((sy * desiredD * scale) / 2) * Math.sin(angle),
                y +
                  ((sx * desiredW * scale) / 2) * Math.sin(angle) +
                  ((sy * desiredD * scale) / 2) * Math.cos(angle),
              ] as P,
          );
        for (let i = 0; i < 10; i++) {
          const mid = (lo + hi) / 2;
          if (contains(corners(mid))) lo = mid;
          else hi = mid;
        }
        if (lo > 0 && (!best || lo * lo * maxArea > best.w * best.d))
          best = {
            x,
            y,
            w: desiredW * lo,
            d: desiredD * lo,
            angle,
            corners: corners(lo),
          };
      }
  if (!best || best.w * best.d < 4) return null;
  const toGeo = ([x, y]: P): P => [
    origin[0] + x / (M * cos),
    origin[1] + y / M,
  ];
  const center = toGeo([best.x, best.y]);
  const footprint = best.w * best.d;
  let remaining = scenario.grossFloorAreaSqm;
  const floorAreasSqm = scenario.floors.map((f) => {
    const a = Math.min(
      remaining,
      footprint * f.footprintScale * f.footprintScale,
    );
    remaining = Math.max(0, remaining - a);
    return a;
  });
  const coords = best.corners.map(toGeo);
  coords.push(coords[0]);
  return {
    center: { longitude: center[0], latitude: center[1] },
    widthM: best.w,
    depthM: best.d,
    rotationRad: best.angle,
    footprint: { type: 'Polygon', coordinates: [coords] },
    floorAreasSqm,
    notes: [
      '실제 경계 내부 직사각형 배치 탐색 · 법정 이격·주차·높이 검증 전',
      ...(remaining > 1
        ? ['필지 형상으로 인해 목표 연면적을 모두 배치하지 못했습니다.']
        : []),
    ],
  };
}
