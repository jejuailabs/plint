import { placeMassing, polygonArea } from '@/lib/pipeline/massing';
import { analysisSteps, type AnalysisOptions } from '@/lib/pipeline/progress';
import { fact, type Evidence } from '@/lib/domain/evidence';
import type {
  AnalysisPreviewResponse,
  ParcelIntelligence,
  Polygon,
} from '@/lib/domain/parcel-intelligence';
import { createMockSourceData } from '@/lib/external-apis/mock-provider';
import { calculateScenarios } from '@/lib/pipeline/regulations/calculate-envelope';
import { fetchLiveSourceData, liveEvidence } from '@/lib/pipeline/live-source';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function factsIn(value: unknown): { value: unknown; evidence: Evidence[] }[] {
  if (!value || typeof value !== 'object') return [];
  if ('value' in value && 'evidence' in value && 'warnings' in value)
    return [value as { value: unknown; evidence: Evidence[] }];
  if (Array.isArray(value)) return value.flatMap(factsIn);
  return Object.values(value).flatMap(factsIn);
}

function calculateCoverage(value: Omit<ParcelIntelligence, 'coverage'>) {
  const facts = factsIn({
    ...value,
    context: [],
    planning: value.planning.filter((p) => p.category === 'zoning').slice(0, 1),
  });
  const counts = {
    verifiedFacts: 0,
    derivedFacts: 0,
    estimatedFacts: 0,
    missingFacts: 0,
  };
  for (const current of facts) {
    const confidence =
      current.value == null
        ? 'missing'
        : (current.evidence[0]?.confidence ?? 'missing');
    if (confidence === 'verified') counts.verifiedFacts += 1;
    if (confidence === 'derived') counts.derivedFacts += 1;
    if (confidence === 'estimated') counts.estimatedFacts += 1;
    if (confidence === 'missing') counts.missingFacts += 1;
  }
  const weighted =
    counts.verifiedFacts +
    counts.derivedFacts * 0.85 +
    counts.estimatedFacts * 0.55;
  const percent =
    facts.length === 0 ? 0 : Math.round((weighted / facts.length) * 100);
  return { percent, ...counts };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runPreviewAnalysis(
  address: string,
  options: AnalysisOptions = {},
): Promise<AnalysisPreviewResponse> {
  options.signal?.throwIfAborted();
  if (process.env.USE_MOCK_EXTERNAL_API === 'true') {
    for (const { id } of analysisSteps) {
      if (id !== 'scenarios')
        options.onProgress?.({
          step: id,
          status: 'skipped',
          message: '예시 모드 · 외부 자료 조회 안 함',
        });
    }
    options.onProgress?.({
      step: 'scenarios',
      status: 'running',
      message: '예시 데이터로 시나리오 계산 중',
    });
    const result = await runMockPreview(address);
    options.onProgress?.({
      step: 'scenarios',
      status: 'completed',
      message: '예시 시나리오 계산 완료',
    });
    return result;
  }
  return runLivePreview(address, options);
}

// ---------------------------------------------------------------------------
// Mock path (unchanged logic, kept as fallback)
// ---------------------------------------------------------------------------

async function runMockPreview(
  address: string,
): Promise<AnalysisPreviewResponse> {
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
      pnu: fact(`11${String(source.seed).padStart(17, '0').slice(0, 17)}`, [
        evidence('juso-coordinate', suffix),
      ]),
      jibunAddress: fact(address, [evidence('juso-coordinate', suffix)]),
      roadAddress: fact(
        address.replace(/동\s*/, '로 '),
        [evidence('juso-coordinate', suffix, 'estimated')],
        {
          warnings: [
            '미리보기에서는 실제 주소 변환 API 대신 예시 변환을 표시합니다.',
          ],
        },
      ),
      center: fact({ latitude: source.latitude, longitude: source.longitude }, [
        evidence('juso-coordinate', suffix),
      ]),
    },
    geometry: {
      areaSqm: fact(source.areaSqm, [evidence('continuous-cadastral', suffix)]),
      landCategory: fact('대', [evidence('continuous-cadastral', suffix)]),
      boundary: fact(source.boundary, [
        evidence('continuous-cadastral', suffix),
      ]),
      frontageM: fact(
        18.4,
        [evidence('land-characteristics', suffix, 'derived')],
        { derivation: 'parcel-road-intersection:v1' },
      ),
      roadWidthM: fact(
        8,
        [evidence('land-characteristics', suffix, 'derived')],
        {
          derivation: 'road-width-fusion:v1',
          warnings: [
            '건축법상 도로 확정은 현황도면과 관할기관 확인이 필요합니다.',
          ],
        },
      ),
      slopePercent: fact(
        2.8,
        [evidence('land-characteristics', suffix, 'estimated')],
        {
          warnings: ['DEM 미연결 미리보기에서는 토지특성 기반 추정값입니다.'],
        },
      ),
    },
    planning: [
      {
        code: 'UQA122',
        name: '제2종일반주거지역',
        category: 'zoning',
        status: 'confirmed',
        summary: fact(
          `건폐율 ${buildingCoverageLimit}% · 용적률 ${floorAreaRatioLimit}% 상한 후보`,
          [evidence('land-use-plan', suffix, 'verified')],
        ),
      },
      {
        code: 'ROAD-ACCESS',
        name: '접도 검토',
        category: 'road',
        status: 'conditional',
        summary: fact(
          '폭 8m 도로에 약 18.4m 접한 것으로 추정',
          [evidence('land-characteristics', suffix, 'derived')],
          {
            derivation: 'road-access:v1',
            warnings: [
              '현황도로와 건축법상 도로 지정 여부를 별도로 확인해야 합니다.',
            ],
          },
        ),
      },
      {
        code: 'SUNLIGHT-PRELIMINARY',
        name: '일조 사선',
        category: 'sunlight',
        status: 'review_required',
        summary: fact(
          '정북방향 경계와 단순 매스를 기준으로 개략 검토',
          [evidence('land-use-plan', suffix, 'estimated')],
          {
            derivation: 'sunlight-envelope:preliminary-v1',
            warnings: ['인허가 심의용 정밀 분석이 아닙니다.'],
          },
        ),
      },
    ],
    existing: [
      {
        id: 'building-1',
        use: fact('제2종근린생활시설', [evidence('building-ledger', suffix)]),
        floorsAbove: fact(3, [evidence('building-ledger', suffix)]),
        totalFloorAreaSqm: fact(612.4, [evidence('building-ledger', suffix)]),
        approvedAt: fact('1998-11-23', [evidence('building-ledger', suffix)]),
      },
    ],
    context: source.context,
    market: {
      officialLandPricePerSqm: fact(source.officialLandPrice, [
        evidence('land-characteristics', suffix),
      ]),
      comparableMedianPerSqm: fact(
        Math.round(source.comparablePrice),
        [evidence('land-transactions', suffix, 'derived')],
        {
          derivation:
            'comparable-median:v2:same-legal-neighborhood,land-category,zoning,last-six-months',
        },
      ),
      comparableCount: fact(17, [evidence('land-transactions', suffix)]),
      trendPercent: fact(
        4.8,
        [evidence('land-transactions', suffix, 'derived')],
        { derivation: 'twelve-month-median-change:v1' },
      ),
    },
    demand: {
      populationAdministrativeArea: fact(28_430, [], {
        warnings: ['SGIS 운영 키 연결 전 미리보기 값입니다.'],
      }),
      householdsAdministrativeArea: fact(13_240, [], {
        warnings: ['SGIS 운영 키 연결 전 미리보기 값입니다.'],
      }),
      businessesAdministrativeArea: fact(1_842, [], {
        warnings: ['상권 API 연결 전 미리보기 값입니다.'],
      }),
      administrativeArea: fact('예시 행정동', [], {
        warnings: ['SGIS 운영 키 연결 전 미리보기 값입니다.'],
      }),
      transitStops500m: fact(14, [], {
        warnings: ['교통 API 연결 전 미리보기 값입니다.'],
      }),
    },
    climate: {
      annualSunlightHours: fact(
        2_151,
        [evidence('asos-daily', suffix, 'estimated')],
        { warnings: ['최근접 관측소 기반 값입니다.'] },
      ),
      solarRadiationKwhM2: fact(
        1_338,
        [evidence('asos-daily', suffix, 'estimated')],
        { warnings: ['최근접 관측소 기반 값입니다.'] },
      ),
      prevailingWind: fact('서북서', [
        evidence('asos-daily', suffix, 'estimated'),
      ]),
    },
    risks: [
      {
        code: 'FLOOD',
        label: '도시침수',
        level: 'unknown',
        finding: fact<string>(null, [], {
          warnings: ['상업 이용 조건 검토 후 레이어를 연결합니다.'],
        }),
        nextAction: '공식 홍수위험지도에서 대상 필지 확인',
      },
      {
        code: 'HERITAGE',
        label: '국가유산',
        level: 'low',
        finding: fact('500m 내 규제 대상 없음', [
          evidence('heritage-spatial', suffix, 'estimated'),
        ]),
        nextAction: '인허가 전 최신 공간규제 재조회',
      },
      {
        code: 'GROUND',
        label: '지하안전',
        level: 'medium',
        finding: fact('인접 블록 지하개발 이력 확인 필요', [], {
          warnings: ['지하안전 API 연결 전 체크리스트 결과입니다.'],
        }),
        nextAction: '지반조사 및 인접 굴착계획 확인',
      },
    ],
    scenarios,
  };

  const data: ParcelIntelligence = {
    ...partial,
    coverage: calculateCoverage(partial),
  };
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

/** Map Korean zoning name to building-coverage / floor-area-ratio limits. */
function zoningLimits(zoneName: string | null): {
  buildingCoverageLimit: number;
  floorAreaRatioLimit: number;
} {
  if (!zoneName) return { buildingCoverageLimit: 60, floorAreaRatioLimit: 200 };
  if (zoneName.includes('전용주거'))
    return zoneName.includes('1종')
      ? { buildingCoverageLimit: 50, floorAreaRatioLimit: 100 }
      : { buildingCoverageLimit: 50, floorAreaRatioLimit: 150 };
  if (zoneName.includes('일반주거')) {
    if (zoneName.includes('1종'))
      return { buildingCoverageLimit: 60, floorAreaRatioLimit: 200 };
    if (zoneName.includes('2종'))
      return { buildingCoverageLimit: 60, floorAreaRatioLimit: 250 };
    if (zoneName.includes('3종'))
      return { buildingCoverageLimit: 50, floorAreaRatioLimit: 300 };
  }
  if (zoneName.includes('준주거'))
    return { buildingCoverageLimit: 70, floorAreaRatioLimit: 500 };
  if (zoneName.includes('중심상업'))
    return { buildingCoverageLimit: 90, floorAreaRatioLimit: 1500 };
  if (zoneName.includes('일반상업'))
    return { buildingCoverageLimit: 80, floorAreaRatioLimit: 1300 };
  if (zoneName.includes('근린상업'))
    return { buildingCoverageLimit: 70, floorAreaRatioLimit: 900 };
  if (zoneName.includes('유통상업'))
    return { buildingCoverageLimit: 80, floorAreaRatioLimit: 1100 };
  if (zoneName.includes('전용공업'))
    return { buildingCoverageLimit: 70, floorAreaRatioLimit: 300 };
  if (zoneName.includes('일반공업'))
    return { buildingCoverageLimit: 70, floorAreaRatioLimit: 350 };
  if (zoneName.includes('준공업'))
    return { buildingCoverageLimit: 70, floorAreaRatioLimit: 400 };
  if (zoneName.includes('보전녹지'))
    return { buildingCoverageLimit: 20, floorAreaRatioLimit: 80 };
  if (zoneName.includes('생산녹지'))
    return { buildingCoverageLimit: 20, floorAreaRatioLimit: 100 };
  if (zoneName.includes('자연녹지'))
    return { buildingCoverageLimit: 20, floorAreaRatioLimit: 100 };
  if (zoneName.includes('보전관리'))
    return { buildingCoverageLimit: 20, floorAreaRatioLimit: 80 };
  if (zoneName.includes('생산관리'))
    return { buildingCoverageLimit: 20, floorAreaRatioLimit: 80 };
  if (zoneName.includes('계획관리'))
    return { buildingCoverageLimit: 40, floorAreaRatioLimit: 100 };
  return { buildingCoverageLimit: 60, floorAreaRatioLimit: 200 };
}

/** Compute median price-per-sqm from transaction list. */
function medianPricePerSqm(
  items: { price: number; areaSqm: number }[],
): number {
  const vals = items
    .filter((t) => t.areaSqm > 0)
    .map((t) => t.price / t.areaSqm)
    .sort((a, b) => a - b);
  if (vals.length === 0) return 0;
  const mid = Math.floor(vals.length / 2);
  return Math.round(
    vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2,
  );
}

async function runLivePreview(
  address: string,
  options: AnalysisOptions,
): Promise<AnalysisPreviewResponse> {
  const startedAt = performance.now();
  const src = await fetchLiveSourceData(address, options);
  options.signal?.throwIfAborted();
  if (!src.juso.data)
    throw new Error(
      '주소를 확인하지 못했습니다. 주소를 확인하고 다시 시도해 주세요.',
    );
  options.onProgress?.({
    step: 'scenarios',
    status: 'running',
    message: '수집된 자료로 시나리오 계산 중',
  });

  const jusoData = src.juso.data;
  const bldgData = src.building.data;
  const priceData = src.landPrice.data;
  const txData = src.transactions.data;
  const wxData = src.weather.data;
  const lupData = src.landUsePlan.data;
  const cadData = src.cadastralBoundary.data;
  const ctxData = src.contextBuildings.data;
  const charData = src.landCharacteristics.data;
  const demandData = src.demand.data;

  // Evidence shorthand — returns [] when the connector produced no data.
  const ev = (
    id: string,
    r: { data: unknown; rawSnapshotId: string; observedAt: string },
    c?: Evidence['confidence'],
  ) => (r.data ? [liveEvidence(id, r, c)] : []);

  // Parcel area: prefer cadastral → building ledger estimate → default
  let estimatedArea = 0;
  let areaSource: 'characteristics' | 'cadastral' | 'default' = 'default';
  if (charData?.areaSqm && charData.areaSqm > 0) {
    estimatedArea = charData.areaSqm;
    areaSource = 'characteristics';
  } else if (cadData?.coordinates?.[0]?.length) {
    estimatedArea = Math.round(
      polygonArea({ type: 'Polygon', coordinates: cadData.coordinates }),
    );
    areaSource = 'cadastral';
  } else if (cadData?.areaSqm != null && cadData.areaSqm > 0) {
    estimatedArea = Math.round(cadData.areaSqm);
    areaSource = 'cadastral';
  }

  const officialPrice = priceData?.officialPricePerSqm ?? 0;
  const neighborhood =
    jusoData?.jibunAddress.split(' ').slice(2, -1).join(' ') ?? '';
  const comparable =
    txData?.filter(
      (t) =>
        t.neighborhood === neighborhood &&
        !!charData?.landCategory &&
        t.landCategory === charData.landCategory &&
        (!lupData?.primaryZone || t.landUse === lupData.primaryZone.name),
    ) ?? [];
  const compMedian = comparable.length ? medianPricePerSqm(comparable) : 0;
  const compCount = comparable.length;
  const referenceDate = new Date();
  const sixMonthsAgo = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() - 6,
    1,
  );
  const recentComparables = comparable.filter((transaction) => {
    const date = new Date(`${transaction.date}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date >= sixMonthsAgo;
  });
  const priorComparables = comparable.filter((transaction) => {
    const date = new Date(`${transaction.date}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date < sixMonthsAgo;
  });
  const recentMedian = medianPricePerSqm(recentComparables);
  const priorMedian = medianPricePerSqm(priorComparables);
  const trendPercent =
    recentMedian > 0 && priorMedian > 0
      ? Number((((recentMedian - priorMedian) / priorMedian) * 100).toFixed(1))
      : null;

  // Determine zoning limits from land-use-plan or fallback
  const { buildingCoverageLimit, floorAreaRatioLimit } = zoningLimits(
    lupData?.primaryZone?.name ?? null,
  );

  const scenarios =
    estimatedArea > 0
      ? calculateScenarios({
          areaSqm: estimatedArea,
          buildingCoverageLimit,
          floorAreaRatioLimit,
          comparablePricePerSqm: compMedian,
          landPricePerSqm: officialPrice,
        })
      : [];

  const lat = jusoData?.latitude ?? 0;
  const lon = jusoData?.longitude ?? 0;
  const hasCenter = lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132;

  const partial: Omit<ParcelIntelligence, 'coverage'> = {
    // -- identity (from juso) ------------------------------------------------
    identity: {
      pnu: fact(src.pnuCode, ev('juso-coordinate', src.juso)),
      jibunAddress: fact(
        jusoData?.jibunAddress ?? address,
        ev('juso-coordinate', src.juso),
      ),
      roadAddress: fact(
        jusoData?.roadAddress ?? null,
        ev('juso-coordinate', src.juso),
      ),
      center: fact(
        hasCenter ? { latitude: lat, longitude: lon } : null,
        hasCenter ? ev('juso-coordinate', src.juso) : [],
        {
          warnings: hasCenter
            ? []
            : ['정확한 좌표 조회 실패 · 다른 지역 좌표로 대체하지 않습니다.'],
        },
      ),
    },

    geometry: {
      areaSqm: fact(
        estimatedArea > 0 ? estimatedArea : null,
        areaSource === 'characteristics'
          ? ev('land-characteristics', src.landCharacteristics)
          : areaSource === 'cadastral'
            ? ev('continuous-cadastral', src.cadastralBoundary, 'derived')
            : [],
        areaSource === 'cadastral' || areaSource === 'characteristics'
          ? undefined
          : {
              warnings: ['토지 면적 미확인 — 건물 면적으로 대체하지 않습니다.'],
            },
      ),
      landCategory: fact(
        charData?.landCategory ?? null,
        charData?.landCategory
          ? ev('land-characteristics', src.landCharacteristics, 'verified')
          : [],
        charData?.landCategory
          ? undefined
          : { warnings: ['토지특성 조회 실패 — 지목 확인 필요'] },
      ),
      boundary: cadData
        ? fact(
            { type: 'Polygon' as const, coordinates: cadData.coordinates },
            ev('continuous-cadastral', src.cadastralBoundary, 'verified'),
          )
        : fact<Polygon>(null, [], {
            warnings: ['연속지적도 조회 실패 — 경계를 표시하지 않습니다.'],
          }),
      frontageM: fact<number>(null, [], {
        warnings: ['도로 데이터 연결 전 산출 불가'],
      }),
      roadWidthM: fact<number>(
        null,
        [],
        charData?.roadSideCode
          ? {
              derivation: 'road-side-code:v1',
              warnings: [
                charData.roadSideName
                  ? `도로접면: ${charData.roadSideName}`
                  : undefined,
              ].filter(Boolean) as string[],
            }
          : { warnings: ['도로 접면 정보 없음'] },
      ),
      slopePercent: fact<number>(
        null,
        [],
        charData?.slopeCode || priceData?.slopeCode
          ? { derivation: 'slope-code-midpoint:v1' }
          : { warnings: ['경사도 정보 없음'] },
      ),
    },

    // -- planning (from land-use-plan + defaults) ----------------------------
    planning: [
      ...(lupData?.primaryZone
        ? [
            {
              code: lupData.primaryZone.code,
              name: lupData.primaryZone.name,
              category: 'zoning' as const,
              status: 'review_required' as const,
              summary: fact(
                `검토 가정: 건폐율 ${buildingCoverageLimit}% · 용적률 ${floorAreaRatioLimit}% (조례·중첩구역 검증 전)`,
                ev('land-use-plan', src.landUsePlan, 'verified'),
              ),
            },
          ]
        : [
            {
              code: 'UQA-PENDING',
              name: '용도지역 확인 필요',
              category: 'zoning' as const,
              status: 'review_required' as const,
              summary: fact(
                `건폐율 ${buildingCoverageLimit}% · 용적률 ${floorAreaRatioLimit}% (기본값 적용)`,
                [],
                {
                  warnings: [
                    '토지이용계획 조회 실패 — 기본 용도지역 한도를 적용합니다.',
                  ],
                },
              ),
            },
          ]),
      ...(lupData?.zones
        .filter((z) => z.code !== lupData.primaryZone?.code)
        .map((z) => ({
          code: z.code,
          name: z.name,
          category: (z.category === 'zoning' ? 'zoning' : 'district') as
            | 'zoning'
            | 'district',
          status: 'confirmed' as const,
          summary: fact(
            `${z.name} · ${z.relation ?? '관계 확인 필요'}`,
            ev('land-use-plan', src.landUsePlan, 'verified'),
          ),
        })) ?? []),
      {
        code: 'ROAD-ACCESS',
        name: '접도 검토',
        category: 'road' as const,
        status: 'review_required' as const,
        summary: fact<string>(null, [], {
          warnings: ['도로 데이터 연결 전 접도 검토 불가'],
        }),
      },
    ],

    // -- existing buildings (from building ledger) ---------------------------
    existing: bldgData?.exists
      ? [
          {
            id: 'building-1',
            use: fact(bldgData.use, ev('building-ledger', src.building)),
            floorsAbove: fact(
              bldgData.floorsAbove,
              ev('building-ledger', src.building),
            ),
            totalFloorAreaSqm: fact(
              bldgData.totalFloorAreaSqm,
              ev('building-ledger', src.building),
            ),
            approvedAt: fact(
              bldgData.completionYear
                ? `${bldgData.completionYear}-01-01`
                : null,
              ev('building-ledger', src.building),
            ),
          },
        ]
      : [],

    // -- context buildings (from VWorld WFS building layer) -------------------
    context: ctxData
      ? ctxData.map((b) => ({
          id: b.id,
          footprint: { type: 'Polygon' as const, coordinates: b.footprint },
          heightM: fact(
            b.heightM,
            ev('gis-building', src.contextBuildings, 'derived'),
          ),
        }))
      : [],

    // -- market (from land-price + transactions) -----------------------------
    market: {
      officialLandPricePerSqm: fact(
        officialPrice || null,
        ev('land-characteristics', src.landPrice),
      ),
      comparableMedianPerSqm: fact(
        compMedian || null,
        ev('land-transactions', src.transactions, 'derived'),
        {
          derivation:
            'comparable-median:v3:same-legal-neighborhood,land-category,zoning,last-twelve-full-months',
        },
      ),
      comparableCount: fact(
        compCount,
        ev('land-transactions', src.transactions),
      ),
      trendPercent: fact(
        trendPercent,
        trendPercent != null
          ? ev('land-transactions', src.transactions, 'derived')
          : [],
        trendPercent != null
          ? {
              derivation:
                'comparable-trend:v1:recent-six-full-months-vs-prior-six-full-months',
              warnings:
                recentComparables.length < 2 || priorComparables.length < 2
                  ? [
                      `표본 수가 적습니다(최근 6개월 ${recentComparables.length}건 · 이전 6개월 ${priorComparables.length}건). 추세는 참고용입니다.`,
                    ]
                  : [],
            }
          : {
              warnings: [
                `12개월 조회 결과 동일 조건 비교 표본이 부족합니다(최근 6개월 ${recentComparables.length}건 · 이전 6개월 ${priorComparables.length}건).`,
              ],
            },
      ),
    },

    // -- demand (from SGIS administrative-dong census) -----------------------
    demand: {
      populationAdministrativeArea: fact(
        demandData?.population ?? null,
        demandData?.population != null
          ? ev('sgis-census', src.demand, 'verified')
          : [],
        { warnings: src.demand.warnings },
      ),
      householdsAdministrativeArea: fact(
        demandData?.households ?? null,
        demandData?.households != null
          ? ev('sgis-census', src.demand, 'verified')
          : [],
        { warnings: src.demand.warnings },
      ),
      businessesAdministrativeArea: fact(
        demandData?.businesses ?? null,
        demandData?.businesses != null
          ? ev('sgis-census', src.demand, 'verified')
          : [],
        { warnings: src.demand.warnings },
      ),
      administrativeArea: fact(
        demandData?.administrativeDongName ?? null,
        demandData?.administrativeDongName
          ? ev('sgis-census', src.demand, 'verified')
          : [],
        {
          warnings: demandData
            ? [`기준연도 ${demandData.referenceYear}년 행정동 집계입니다.`]
            : src.demand.warnings,
        },
      ),
      transitStops500m: fact<number>(null, [], {
        warnings: ['교통 API 연결 전 조회 불가'],
      }),
    },

    // -- climate (from KMA weather, optional) --------------------------------
    climate: {
      annualSunlightHours: fact(
        wxData?.annualSunlightHours ?? null,
        ev('asos-daily', src.weather, 'estimated'),
        {
          warnings: wxData
            ? ['최근접 관측소 기반 값입니다.']
            : ['기상 API 미연결'],
        },
      ),
      solarRadiationKwhM2: fact(
        wxData?.solarRadiation ?? null,
        ev('asos-daily', src.weather, 'estimated'),
        {
          warnings: wxData
            ? ['최근접 관측소 기반 값입니다.']
            : ['기상 API 미연결'],
        },
      ),
      prevailingWind: fact(
        wxData?.prevailingWind ?? null,
        ev('asos-daily', src.weather, 'estimated'),
      ),
    },

    // -- risks (dedicated connectors not connected) --------------------------
    risks: [
      {
        code: 'FLOOD',
        label: '도시침수',
        level: 'unknown',
        finding: fact<string>(null, [], {
          warnings: ['침수 위험지도 연결 전'],
        }),
        nextAction: '공식 홍수위험지도에서 대상 필지 확인',
      },
      {
        code: 'HERITAGE',
        label: '국가유산',
        level: 'unknown',
        finding: fact<string>(null, [], {
          warnings: ['유산 공간규제 연결 전'],
        }),
        nextAction: '인허가 전 최신 공간규제 재조회',
      },
      {
        code: 'GROUND',
        label: '지하안전',
        level: 'unknown',
        finding: fact<string>(null, [], { warnings: ['지하안전 API 연결 전'] }),
        nextAction: '지반조사 및 인접 굴착계획 확인',
      },
    ],

    scenarios,
  };

  const fittedScenarios = scenarios.map((scenario) => {
    const massing = cadData
      ? placeMassing(
          { type: 'Polygon', coordinates: cadData.coordinates },
          estimatedArea,
          scenario,
        )
      : null;
    const gross = massing
      ? Math.round(massing.floorAreasSqm.reduce((a, b) => a + b, 0))
      : scenario.grossFloorAreaSqm;
    return {
      ...scenario,
      ...(massing ? { massing } : {}),
      grossFloorAreaSqm: gross,
      buildingCoverageRatio: massing
        ? Number(
            (((massing.widthM * massing.depthM) / estimatedArea) * 100).toFixed(
              1,
            ),
          )
        : scenario.buildingCoverageRatio,
      floorAreaRatio: Number(((gross / estimatedArea) * 100).toFixed(1)),
      estimatedRevenueKrw: 0,
      estimatedProfitRatePercent: 0,
      estimatedCostKrw: Math.round(gross * 3_250_000),
    };
  });
  const sources = [
    ['juso', '주소·좌표', src.juso],
    ['cadastral', '필지 경계', src.cadastralBoundary],
    ['characteristics', '토지특성', src.landCharacteristics],
    ['building', '건축물대장', src.building],
    ['context', '주변 건물', src.contextBuildings],
    ['price', '공시지가', src.landPrice],
    ['planning', '토지이용계획', src.landUsePlan],
    ['transactions', '토지 실거래', src.transactions],
    ['weather', 'ASOS 기상', src.weather],
    ['demand', 'SGIS 생활권 통계', src.demand],
  ] as const;
  const sourceStatus: NonNullable<ParcelIntelligence['sourceStatus']> =
    sources.map(([id, label, r]) => ({
      id,
      label,
      status:
        r.data == null
          ? 'unavailable'
          : Array.isArray(r.data) && r.data.length === 0
            ? 'empty'
            : r.warnings.length
              ? 'partial'
              : 'available',
      detail: r.warnings.join(' · ') || '조회 완료',
      observedAt: r.observedAt,
    }));
  const reviewNotes = [
    '자료 커버리지는 주요 항목 기준이며 주변 건물 수와 중복 규제 항목은 가중하지 않습니다. 투자 신뢰도 점수가 아닙니다.',
    '모든 배치안은 규제 검증 전 기하학적 비교안입니다. 건축 가능 규모나 투자 권고가 아닙니다.',
    '토지이용계획의 포함·저촉·접함과 조례·고도·경관·어항 등 조건을 건축사가 확인해야 합니다.',
    '주차대수·차량 진입·회차·건축선·이격거리·피난·철거/리모델링 가능성은 자동 검증되지 않았습니다.',
    '건설비는 연면적×325만원/㎡ 가정의 공사비입니다. 토지·철거·설계·세금·금융·예비비는 별도입니다.',
    '토지 실거래 단가를 신축 건물 매출로 환산하지 않습니다. 용도·분양가/임대료·가동률 입력 후 사업성 검토가 필요합니다.',
    ...(lupData &&
    lupData.zones.filter((z) => z.category === 'zoning').length > 1
      ? [
          '여러 용도지역에 저촉됩니다. 구역별 면적과 적용기준 확인 전 단일 건폐율/용적률을 확정할 수 없습니다.',
        ]
      : []),
    ...(charData?.slopeName
      ? [
          `토지특성 지형 분류: ${charData.slopeName} · 측량 경사도(%)와 다릅니다.`,
        ]
      : []),
    ...(charData?.roadSideName
      ? [
          `도로접면 분류: ${charData.roadSideName} · 실제 도로 폭과 법정 접도는 별도 확인합니다.`,
        ]
      : []),
    '침수·국가유산·지하안전은 전용 조회 미구현입니다. 데이터가 없다는 사실을 위험 없음으로 해석하지 않습니다.',
    demandData
      ? `생활권 수요는 ${demandData.referenceYear}년 ${demandData.administrativeDongName} 행정동 집계입니다. 반경 500m·1km 수요로 해석하지 않습니다.`
      : '생활권 수요(SGIS) 조회에 실패했습니다. 데이터가 없다는 사실을 수요 없음으로 해석하지 않습니다.',
    '비교 표본은 최근 12개월 동일 법정동·지목·용도지역 토지 거래입니다. 해안 접근성·면적·도로 조건에 따른 보정은 미적용입니다.',
    trendPercent == null
      ? '12개월 가격 추세는 동일 조건의 시계열 표본이 부족해 제공하지 않습니다.'
      : `12개월 가격 추세는 최근 6개월과 이전 6개월의 동일 조건 표본 중앙값 비교입니다(최근 ${recentComparables.length}건 · 이전 ${priorComparables.length}건).`,
  ];
  const data: ParcelIntelligence = {
    ...partial,
    scenarios: fittedScenarios,
    sourceStatus,
    reviewNotes,
    pipelineVersion: 2,
    coverage: calculateCoverage(partial),
  };

  options.onProgress?.({
    step: 'scenarios',
    status: 'completed',
    message: '시나리오 계산 완료',
  });

  // Determine mode: live if primary connectors returned data, hybrid if partial.
  const primaryOk = !!(jusoData && bldgData && priceData && txData);
  const anyOk = !!(
    jusoData ||
    bldgData ||
    priceData ||
    txData ||
    wxData ||
    cadData ||
    ctxData ||
    charData
  );

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
