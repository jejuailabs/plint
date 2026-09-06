import { fact, type Evidence } from '@/lib/domain/evidence';
import type { AnalysisPreviewResponse, ParcelIntelligence, Polygon } from '@/lib/domain/parcel-intelligence';
import { createMockSourceData } from '@/lib/external-apis/mock-provider';
import { calculateScenarios } from '@/lib/pipeline/regulations/calculate-envelope';
import { fetchLiveSourceData, liveEvidence } from '@/lib/pipeline/live-source';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function factsIn(value: unknown): { evidence: Evidence[] }[] {
  if (!value || typeof value !== 'object') return [];
  if ('value' in value && 'evidence' in value && 'warnings' in value) return [value as { evidence: Evidence[] }];
  if (Array.isArray(value)) return value.flatMap(factsIn);
  return Object.values(value).flatMap(factsIn);
}

function calculateCoverage(value: Omit<ParcelIntelligence, 'coverage'>) {
  const facts = factsIn(value);
  const counts = { verifiedFacts: 0, derivedFacts: 0, estimatedFacts: 0, missingFacts: 0 };
  for (const current of facts) {
    const confidence = current.evidence[0]?.confidence ?? 'missing';
    if (confidence === 'verified') counts.verifiedFacts += 1;
    if (confidence === 'derived') counts.derivedFacts += 1;
    if (confidence === 'estimated') counts.estimatedFacts += 1;
    if (confidence === 'missing') counts.missingFacts += 1;
  }
  const weighted = counts.verifiedFacts + counts.derivedFacts * 0.85 + counts.estimatedFacts * 0.55;
  const percent = facts.length === 0 ? 0 : Math.round((weighted / facts.length) * 100);
  return { percent, ...counts };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runPreviewAnalysis(address: string): Promise<AnalysisPreviewResponse> {
  if (process.env.USE_MOCK_EXTERNAL_API === 'true') {
    return runMockPreview(address);
  }
  return runLivePreview(address);
}

// ---------------------------------------------------------------------------
// Mock path (unchanged logic, kept as fallback)
// ---------------------------------------------------------------------------

async function runMockPreview(address: string): Promise<AnalysisPreviewResponse> {
  const startedAt = performance.now();
  const source = createMockSourceData(address);
  const { evidence, suffix } = source;
  const buildingCoverageLimit = 60;
  const floorAreaRatioLimit = 200;
  const scenarios = calculateScenarios({
    areaSqm: source.areaSqm,
    buildingCoverageLimit,
    floorAreaRatioLimit,
    comparablePricePerSqm: source.comparablePrice,
    landPricePerSqm: source.officialLandPrice,
  });

  const partial: Omit<ParcelIntelligence, 'coverage'> = {
    identity: {
      pnu: fact(`11${String(source.seed).padStart(17, '0').slice(0, 17)}`, [evidence('juso-coordinate', suffix)]),
      jibunAddress: fact(address, [evidence('juso-coordinate', suffix)]),
      roadAddress: fact(address.replace(/동\s*/, '로 '), [evidence('juso-coordinate', suffix, 'estimated')], {
        warnings: ['미리보기에서는 실제 주소 변환 API 대신 예시 변환을 표시합니다.'],
      }),
      center: fact({ latitude: source.latitude, longitude: source.longitude }, [evidence('juso-coordinate', suffix)]),
    },
    geometry: {
      areaSqm: fact(source.areaSqm, [evidence('continuous-cadastral', suffix)]),
      landCategory: fact('대', [evidence('continuous-cadastral', suffix)]),
      boundary: fact(source.boundary, [evidence('continuous-cadastral', suffix)]),
      frontageM: fact(18.4, [evidence('land-characteristics', suffix, 'derived')], { derivation: 'parcel-road-intersection:v1' }),
      roadWidthM: fact(8, [evidence('land-characteristics', suffix, 'derived')], {
        derivation: 'road-width-fusion:v1',
        warnings: ['건축법상 도로 확정은 현황도면과 관할기관 확인이 필요합니다.'],
      }),
      slopePercent: fact(2.8, [evidence('land-characteristics', suffix, 'estimated')], {
        warnings: ['DEM 미연결 미리보기에서는 토지특성 기반 추정값입니다.'],
      }),
    },
    planning: [
      {
        code: 'UQA122', name: '제2종일반주거지역', category: 'zoning', status: 'confirmed',
        summary: fact(`건폐율 ${buildingCoverageLimit}% · 용적률 ${floorAreaRatioLimit}% 상한 후보`, [evidence('land-use-plan', suffix, 'verified')]),
      },
      {
        code: 'ROAD-ACCESS', name: '접도 검토', category: 'road', status: 'conditional',
        summary: fact('폭 8m 도로에 약 18.4m 접한 것으로 추정', [evidence('land-characteristics', suffix, 'derived')], {
          derivation: 'road-access:v1', warnings: ['현황도로와 건축법상 도로 지정 여부를 별도로 확인해야 합니다.'],
        }),
      },
      {
        code: 'SUNLIGHT-PRELIMINARY', name: '일조 사선', category: 'sunlight', status: 'review_required',
        summary: fact('정북방향 경계와 단순 매스를 기준으로 개략 검토', [evidence('land-use-plan', suffix, 'estimated')], {
          derivation: 'sunlight-envelope:preliminary-v1', warnings: ['인허가 심의용 정밀 분석이 아닙니다.'],
        }),
      },
    ],
    existing: [{
      id: 'building-1',
      use: fact('제2종근린생활시설', [evidence('building-ledger', suffix)]),
      floorsAbove: fact(3, [evidence('building-ledger', suffix)]),
      totalFloorAreaSqm: fact(612.4, [evidence('building-ledger', suffix)]),
      approvedAt: fact('1998-11-23', [evidence('building-ledger', suffix)]),
    }],
    context: source.context,
    market: {
      officialLandPricePerSqm: fact(source.officialLandPrice, [evidence('land-characteristics', suffix)]),
      comparableMedianPerSqm: fact(Math.round(source.comparablePrice), [evidence('land-transactions', suffix, 'derived')], {
        derivation: 'comparable-median:v1:district,use,area,time',
      }),
      comparableCount: fact(17, [evidence('land-transactions', suffix)]),
      trendPercent: fact(4.8, [evidence('land-transactions', suffix, 'derived')], { derivation: 'twelve-month-median-change:v1' }),
    },
    demand: {
      population1km: fact(28_430, [], { warnings: ['SGIS 운영 키 연결 전 미리보기 값입니다.'] }),
      households1km: fact(13_240, [], { warnings: ['SGIS 운영 키 연결 전 미리보기 값입니다.'] }),
      businesses500m: fact(1_842, [], { warnings: ['상권 API 연결 전 미리보기 값입니다.'] }),
      transitStops500m: fact(14, [], { warnings: ['교통 API 연결 전 미리보기 값입니다.'] }),
    },
    climate: {
      annualSunlightHours: fact(2_151, [evidence('asos-daily', suffix, 'estimated')], { warnings: ['최근접 관측소 기반 값입니다.'] }),
      solarRadiationKwhM2: fact(1_338, [evidence('asos-daily', suffix, 'estimated')], { warnings: ['최근접 관측소 기반 값입니다.'] }),
      prevailingWind: fact('서북서', [evidence('asos-daily', suffix, 'estimated')]),
    },
    risks: [
      { code: 'FLOOD', label: '도시침수', level: 'unknown', finding: fact<string>(null, [], { warnings: ['상업 이용 조건 검토 후 레이어를 연결합니다.'] }), nextAction: '공식 홍수위험지도에서 대상 필지 확인' },
      { code: 'HERITAGE', label: '국가유산', level: 'low', finding: fact('500m 내 규제 대상 없음', [evidence('heritage-spatial', suffix, 'estimated')]), nextAction: '인허가 전 최신 공간규제 재조회' },
      { code: 'GROUND', label: '지하안전', level: 'medium', finding: fact('인접 블록 지하개발 이력 확인 필요', [], { warnings: ['지하안전 API 연결 전 체크리스트 결과입니다.'] }), nextAction: '지반조사 및 인접 굴착계획 확인' },
    ],
    scenarios,
  };

  const data: ParcelIntelligence = { ...partial, coverage: calculateCoverage(partial) };
  return {
    data,
    meta: {
      requestId: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      mode: 'mock',
      durationMs: Math.round(performance.now() - startedAt),
    },
  };
}

// ---------------------------------------------------------------------------
// Live path — real API connectors
// ---------------------------------------------------------------------------

/** Approximate boundary rectangle from center + estimated area (lon/lat). */
function approxBoundary(lat: number, lon: number, areaSqm: number): Polygon {
  const side = Math.sqrt(areaSqm);
  const dLat = (side / 2) / 111_320;
  const dLon = (side / 2) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    type: 'Polygon',
    coordinates: [[
      [lon - dLon, lat - dLat],
      [lon + dLon, lat - dLat],
      [lon + dLon, lat + dLat],
      [lon - dLon, lat + dLat],
      [lon - dLon, lat - dLat],
    ]],
  };
}

/** Map Korean land-slope code to approximate percent. */
function slopeFromCode(code: string | null): number | null {
  if (!code) return null;
  const map: Record<string, number> = { '01': 1.5, '02': 9, '03': 22.5, '04': 35 };
  return map[code] ?? null;
}

/** Compute median price-per-sqm from transaction list. */
function medianPricePerSqm(items: { price: number; areaSqm: number }[]): number {
  const vals = items.filter((t) => t.areaSqm > 0).map((t) => t.price / t.areaSqm).sort((a, b) => a - b);
  if (vals.length === 0) return 0;
  const mid = Math.floor(vals.length / 2);
  return Math.round(vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2);
}

async function runLivePreview(address: string): Promise<AnalysisPreviewResponse> {
  const startedAt = performance.now();
  const src = await fetchLiveSourceData(address);

  const jusoData = src.juso.data;
  const bldgData = src.building.data;
  const priceData = src.landPrice.data;
  const txData = src.transactions.data;
  const wxData = src.weather.data;

  // Evidence shorthand — returns [] when the connector produced no data.
  const ev = (id: string, r: { data: unknown; rawSnapshotId: string; observedAt: string }, c?: Evidence['confidence']) =>
    r.data ? [liveEvidence(id, r, c)] : [];

  // Estimate parcel area from building data when available.
  let estimatedArea = 500;
  if (bldgData?.exists && bldgData.totalFloorAreaSqm && bldgData.floorsAbove && bldgData.floorsAbove > 0) {
    estimatedArea = Math.round((bldgData.totalFloorAreaSqm / bldgData.floorsAbove) / 0.55);
  }

  const officialPrice = priceData?.officialPricePerSqm ?? 0;
  const compMedian = txData ? medianPricePerSqm(txData) : 0;
  const compCount = txData?.filter((t) => t.areaSqm > 0).length ?? 0;

  const buildingCoverageLimit = 60;
  const floorAreaRatioLimit = 200;

  const scenarios = calculateScenarios({
    areaSqm: estimatedArea,
    buildingCoverageLimit,
    floorAreaRatioLimit,
    comparablePricePerSqm: compMedian || officialPrice * 2.35,
    landPricePerSqm: officialPrice,
  });

  const lat = jusoData?.latitude ?? 0;
  const lon = jusoData?.longitude ?? 0;

  const partial: Omit<ParcelIntelligence, 'coverage'> = {
    // -- identity (from juso) ------------------------------------------------
    identity: {
      pnu: fact(src.pnuCode, ev('juso-coordinate', src.juso)),
      jibunAddress: fact(jusoData?.jibunAddress ?? address, ev('juso-coordinate', src.juso)),
      roadAddress: fact(jusoData?.roadAddress ?? null, ev('juso-coordinate', src.juso)),
      center: fact({ latitude: lat, longitude: lon }, ev('juso-coordinate', src.juso)),
    },

    // -- geometry (cadastral WFS not yet connected — estimated) ---------------
    geometry: {
      areaSqm: fact(estimatedArea, [], {
        derivation: 'building-footprint-estimate:v1',
        warnings: ['연속지적도 연결 전 건축물대장 기반 추정값입니다.'],
      }),
      landCategory: fact('대', [], { warnings: ['토지이용계획 연결 전 기본값입니다.'] }),
      boundary: fact(approxBoundary(lat, lon, estimatedArea), [], {
        warnings: ['연속지적도 연결 전 좌표 기반 근사 경계입니다.'],
      }),
      frontageM: fact<number>(null, [], { warnings: ['연속지적도·도로 데이터 연결 전 산출 불가'] }),
      roadWidthM: fact<number>(null, [], { warnings: ['도로 데이터 연결 전 산출 불가'] }),
      slopePercent: fact(
        slopeFromCode(priceData?.slopeCode ?? null),
        ev('land-characteristics', src.landPrice, 'derived'),
        priceData?.slopeCode ? { derivation: 'slope-code-midpoint:v1' } : { warnings: ['경사도 정보 없음'] },
      ),
    },

    // -- planning (land-use-plan not yet connected) --------------------------
    planning: [
      {
        code: 'UQA-PENDING', name: '용도지역 확인 필요', category: 'zoning', status: 'review_required',
        summary: fact(
          `건폐율 ${buildingCoverageLimit}% · 용적률 ${floorAreaRatioLimit}% (기본값 적용)`,
          [],
          { warnings: ['토지이용계획 연결 전 기본 용도지역 한도를 적용합니다. 실제 용도지역에 따라 달라질 수 있습니다.'] },
        ),
      },
      {
        code: 'ROAD-ACCESS', name: '접도 검토', category: 'road', status: 'review_required',
        summary: fact<string>(null, [], { warnings: ['도로 데이터 연결 전 접도 검토 불가'] }),
      },
    ],

    // -- existing buildings (from building ledger) ---------------------------
    existing: bldgData?.exists
      ? [{
          id: 'building-1',
          use: fact(bldgData.use, ev('building-ledger', src.building)),
          floorsAbove: fact(bldgData.floorsAbove, ev('building-ledger', src.building)),
          totalFloorAreaSqm: fact(bldgData.totalFloorAreaSqm, ev('building-ledger', src.building)),
          approvedAt: fact(
            bldgData.completionYear ? `${bldgData.completionYear}-01-01` : null,
            ev('building-ledger', src.building),
          ),
        }]
      : [],

    // -- context buildings (GIS building layer not connected) -----------------
    context: [],

    // -- market (from land-price + transactions) -----------------------------
    market: {
      officialLandPricePerSqm: fact(
        officialPrice || null,
        ev('land-characteristics', src.landPrice),
      ),
      comparableMedianPerSqm: fact(
        compMedian || null,
        ev('land-transactions', src.transactions, 'derived'),
        { derivation: 'comparable-median:v1:district,use,area,time' },
      ),
      comparableCount: fact(compCount, ev('land-transactions', src.transactions)),
      trendPercent: fact<number>(null, [], {
        warnings: ['복수 월 거래 데이터 비교 전 추세 산출 불가'],
      }),
    },

    // -- demand (SGIS not connected) -----------------------------------------
    demand: {
      population1km: fact<number>(null, [], { warnings: ['SGIS 연결 전 조회 불가'] }),
      households1km: fact<number>(null, [], { warnings: ['SGIS 연결 전 조회 불가'] }),
      businesses500m: fact<number>(null, [], { warnings: ['상권 API 연결 전 조회 불가'] }),
      transitStops500m: fact<number>(null, [], { warnings: ['교통 API 연결 전 조회 불가'] }),
    },

    // -- climate (from KMA weather, optional) --------------------------------
    climate: {
      annualSunlightHours: fact(
        wxData?.annualSunlightHours ?? null,
        ev('asos-daily', src.weather, 'estimated'),
        { warnings: wxData ? ['최근접 관측소 기반 값입니다.'] : ['기상 API 미연결'] },
      ),
      solarRadiationKwhM2: fact(
        wxData?.solarRadiation ?? null,
        ev('asos-daily', src.weather, 'estimated'),
        { warnings: wxData ? ['최근접 관측소 기반 값입니다.'] : ['기상 API 미연결'] },
      ),
      prevailingWind: fact(
        wxData?.prevailingWind ?? null,
        ev('asos-daily', src.weather, 'estimated'),
      ),
    },

    // -- risks (dedicated connectors not connected) --------------------------
    risks: [
      { code: 'FLOOD', label: '도시침수', level: 'unknown', finding: fact<string>(null, [], { warnings: ['침수 위험지도 연결 전'] }), nextAction: '공식 홍수위험지도에서 대상 필지 확인' },
      { code: 'HERITAGE', label: '국가유산', level: 'unknown', finding: fact<string>(null, [], { warnings: ['유산 공간규제 연결 전'] }), nextAction: '인허가 전 최신 공간규제 재조회' },
      { code: 'GROUND', label: '지하안전', level: 'unknown', finding: fact<string>(null, [], { warnings: ['지하안전 API 연결 전'] }), nextAction: '지반조사 및 인접 굴착계획 확인' },
    ],

    scenarios,
  };

  const data: ParcelIntelligence = { ...partial, coverage: calculateCoverage(partial) };

  // Determine mode: live if primary connectors returned data, hybrid if partial.
  const primaryOk = !!(jusoData && bldgData && priceData && txData);
  const anyOk = !!(jusoData || bldgData || priceData || txData || wxData);

  return {
    data,
    meta: {
      requestId: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      mode: primaryOk ? 'live' : anyOk ? 'hybrid' : 'mock',
      durationMs: Math.round(performance.now() - startedAt),
    },
  };
}
