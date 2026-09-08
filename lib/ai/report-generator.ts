import Anthropic from '@anthropic-ai/sdk';

import type { ParcelIntelligence } from '@/lib/domain/parcel-intelligence';

export type AIReportSection = {
  title: string;
  body: string;
};

export type AIReport = {
  summary: string;
  feasibility: AIReportSection;
  regulations: AIReportSection;
  market: AIReportSection;
  risks: AIReportSection;
  recommendation: AIReportSection;
  generatedAt: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export function buildPrompt(data: ParcelIntelligence): string {
  const identity = data.identity;
  const geometry = data.geometry;
  const market = data.market;
  const planning = data.planning;
  const scenarios = data.scenarios;
  const risks = data.risks;
  const coverage = data.coverage;
  const existing = data.existing;
  const climate = data.climate;

  return `당신은 한국 부동산 개발 사전검토 전문가입니다. 아래 필지 데이터를 분석하여 개발 타당성 보고서를 작성해 주세요.

## 대상 필지 정보

- 지번주소: ${identity.jibunAddress.value ?? '미확인'}
- 도로명주소: ${identity.roadAddress.value ?? '미확인'}
- PNU: ${identity.pnu.value ?? '미확인'}
- 좌표: ${identity.center.value ? `${identity.center.value.latitude}, ${identity.center.value.longitude}` : '미확인'}

## 토지 현황

- 면적: ${geometry.areaSqm.value != null ? `${geometry.areaSqm.value}㎡` : '미확인'}
- 지목: ${geometry.landCategory.value ?? '미확인'}
- 전면도로폭: ${geometry.roadWidthM.value != null ? `${geometry.roadWidthM.value}m` : '미확인'}
- 경사도: ${geometry.slopePercent.value != null ? `${geometry.slopePercent.value}%` : '미확인'}

## 용도지역 및 규제

${planning.length > 0 ? planning.map((p) => `- ${p.name} (${p.category}, ${p.status}): ${p.summary.value ?? '요약 없음'}`).join('\n') : '- 용도지역 정보 미확인'}

## 기존 건물

${existing.length > 0 ? existing.map((b) => `- 용도: ${b.use.value ?? '미확인'}, 층수: ${b.floorsAbove.value ?? '미확인'}층, 연면적: ${b.totalFloorAreaSqm.value ?? '미확인'}㎡, 사용승인: ${b.approvedAt.value ?? '미확인'}`).join('\n') : '- 기존 건물 없음 또는 미확인'}

## 시장 데이터

- 공시지가: ${market.officialLandPricePerSqm.value != null ? `${market.officialLandPricePerSqm.value.toLocaleString('ko-KR')}원/㎡` : '미연결'}
- 실거래 중위가: ${market.comparableMedianPerSqm.value != null ? `${market.comparableMedianPerSqm.value.toLocaleString('ko-KR')}원/㎡` : '미연결'}
- 실거래 건수: ${market.comparableCount.value ?? 0}건
- 12개월 추세: ${market.trendPercent.value != null ? `${market.trendPercent.value > 0 ? '+' : ''}${market.trendPercent.value}%` : '미확인'}

## 기후

- 연간 일조시간: ${climate.annualSunlightHours.value ?? '미확인'}시간
- 일사량: ${climate.solarRadiationKwhM2.value ?? '미확인'} kWh/㎡

## 개발 시나리오 (3안)

${scenarios
  .map(
    (s) => `### ${s.name} (${s.strategy})
- 건폐율/용적률: ${s.buildingCoverageRatio}% / ${s.floorAreaRatio}%
- 연면적: ${s.grossFloorAreaSqm.toLocaleString('ko-KR')}㎡
- 층수: ${s.floors.length}층
- 예상 매출: ${s.estimatedRevenueKrw > 0 ? (s.estimatedRevenueKrw / 100_000_000).toFixed(1) + '억원' : '미산정 (0원 매출을 뜻하지 않음)'}
- 예상 비용: ${(s.estimatedCostKrw / 100_000_000).toFixed(1)}억원
- 예상 수익률: ${s.estimatedRevenueKrw > 0 ? s.estimatedProfitRatePercent + '%' : '미산정'}`,
  )
  .join('\n\n')}

## 리스크 항목

${risks.map((r) => `- [${r.level}] ${r.label}: ${r.finding.value ?? '미확인'}${r.nextAction ? ` → ${r.nextAction}` : ''}`).join('\n')}

## 데이터 커버리지: ${coverage.percent}%
- 확인: ${coverage.verifiedFacts}건, 계산: ${coverage.derivedFacts}건, 추정: ${coverage.estimatedFacts}건, 미연결: ${coverage.missingFacts}건

---

위 데이터를 기반으로 아래 5개 섹션으로 구성된 분석 보고서를 JSON 형식으로 작성해 주세요.

반드시 아래 JSON 형식만 출력하세요. 다른 텍스트를 포함하지 마세요.

{
  "summary": "3~4문장의 핵심 요약. 이 필지가 개발 가능한지, 어떤 전략이 적합한지 결론.",
  "feasibility": {
    "title": "개발 타당성 평가",
    "body": "필지 조건(면적, 도로, 경사 등)과 용도지역을 기준으로 어떤 개발이 가능한지, 법적 한도와 실현 가능한 규모를 분석. 3~5문단."
  },
  "regulations": {
    "title": "법규 검토 요약",
    "body": "용도지역, 건폐율/용적률, 도로 조건, 높이 제한 등 핵심 규제를 정리하고, 주의사항과 추가 확인 사항을 제시. 3~5문단."
  },
  "market": {
    "title": "시장 분석",
    "body": "공시지가, 실거래 추세, 주변 시장 상황을 분석하고, 투자 관점에서의 시사점을 제시. 2~4문단."
  },
  "risks": {
    "title": "리스크 평가",
    "body": "확인된 리스크와 미확인 항목을 정리하고, 각각의 영향도와 대응 방안을 제시. 3~5문단."
  },
  "recommendation": {
    "title": "투자 권고",
    "body": "3개 시나리오 비교를 바탕으로 최적 전략을 권고하고, 다음 단계(정밀 검토, 인허가, 설계 등)를 제안. 3~5문단."
  }
}

중요: 이 보고서는 사전검토용이며, 인허가 심의를 대체하지 않습니다. 이를 보고서 내에서도 명시해 주세요.`;
}

export async function generateAIReport(
  data: ParcelIntelligence,
): Promise<AIReport> {
  // Without verified prerequisites, a grounded assessment is safer than invented legal/market conclusions.
  const zoning = data.planning.filter((p) => p.category === 'zoning');
  if (
    !data.geometry.boundary.value ||
    !data.identity.center.value ||
    zoning.length !== 1 ||
    zoning[0].status !== 'confirmed' ||
    !data.market.comparableMedianPerSqm.value
  ) {
    const unavailable =
      data.sourceStatus
        ?.filter((s) => s.status === 'unavailable')
        .map((s) => `${s.label}: ${s.detail}`)
        .join('\n\n') ?? '원자료 추가 확인 필요';
    return {
      summary:
        '현황 자료와 배치 비교안입니다. 적용 규제와 수익 모델이 확정되지 않아 개발 가능 규모·투자 수익률을 확정할 수 없습니다.',
      feasibility: {
        title: '개발 검토 조건',
        body: `대지면적 ${data.geometry.areaSqm.value ?? '미확인'}㎡. 면적 출처와 경계의 일치 여부를 확인해야 합니다. 실제 필지 내부의 기하학적 배치안이며 건축선·주차·고도 조건 검증 전입니다.`,
      },
      regulations: {
        title: '확인된 계획 항목',
        body: data.planning
          .map((p) => `${p.name}: ${p.summary.value ?? '추가 확인 필요'}`)
          .join('\n\n'),
      },
      market: {
        title: '시장 자료',
        body: `공시지가 ${data.market.officialLandPricePerSqm.value?.toLocaleString('ko-KR') ?? '미확인'}원/㎡. 공시지가는 거래시세나 분양가격이 아닙니다. 실거래 표본·기간·용도 및 수익 모델 검증 전 매출과 수익률은 산정하지 않습니다.`,
      },
      risks: {
        title: '자료 누락과 확인 절차',
        body:
          unavailable +
          '\n\n' +
          data.risks
            .map(
              (r) =>
                `${r.label}: ${r.finding.value ?? '미확인'} · ${r.nextAction ?? '공식 자료/현장 확인'}`,
            )
            .join('\n\n'),
      },
      recommendation: {
        title: '다음 검토 단계',
        body: (
          data.reviewNotes ?? [
            '조례·현황측량·접도·주차·기존 건물 상태·총사업비와 수익 가정을 확인하세요.',
          ]
        ).join('\n\n'),
      },
      generatedAt: new Date().toISOString(),
      model: '근거 기반 검토문 (AI 추론 없음)',
      inputTokens: 0,
      outputTokens: 0,
    };
  }
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY is not configured');

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(data);

  const str = { type: 'string' as const };
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8192,
    tools: [
      {
        name: 'submit_report',
        description:
          '근거 기반 보고서를 제출합니다. 본문에 실제 문단 구분을 사용하세요.',
        input_schema: {
          type: 'object' as const,
          properties: {
            summary: { ...str, description: '3~4문장 핵심 요약' },
            feasibility_body: {
              ...str,
              description: '개발 타당성 평가 본문 (3~5문단)',
            },
            regulations_body: {
              ...str,
              description: '법규 검토 요약 본문 (3~5문단)',
            },
            market_body: { ...str, description: '시장 분석 본문 (2~4문단)' },
            risks_body: { ...str, description: '리스크 평가 본문 (3~5문단)' },
            recommendation_body: {
              ...str,
              description: '투자 권고 본문 (3~5문단)',
            },
          },
          required: [
            'summary',
            'feasibility_body',
            'regulations_body',
            'market_body',
            'risks_body',
            'recommendation_body',
          ],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_report' },
    system:
      '제공된 자료만 사용하세요. 근거가 없는 법령명·기준수치·시장동향·공사비 가산율·건축가능 판정을 만들지 마세요. 지목 대는 건축허가 보장이 아닙니다. 기본값은 법정 한도가 아닙니다. 커버리지 퍼센트는 투자정보 누락률이나 정확도가 아닙니다. 미산정은 0원이 아닙니다. 미확인 항목은 확인 절차로 명시하세요.',
    messages: [{ role: 'user', content: prompt }],
  });

  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolBlock) throw new Error('AI 응답에서 보고서를 파싱할 수 없습니다.');

  const raw = toolBlock.input as Record<string, string>;
  if (
    response.stop_reason === 'max_tokens' ||
    [
      'summary',
      'feasibility_body',
      'regulations_body',
      'market_body',
      'risks_body',
      'recommendation_body',
    ].some((key) => typeof raw[key] !== 'string' || !raw[key].trim())
  ) {
    throw new Error(
      '보고서 생성이 중단되거나 필수 본문이 비어 있습니다. 다시 시도해 주세요.',
    );
  }

  const parsed = {
    summary: raw.summary ?? '',
    feasibility: {
      title: '개발 타당성 평가',
      body: raw.feasibility_body ?? '',
    },
    regulations: { title: '법규 검토 요약', body: raw.regulations_body ?? '' },
    market: { title: '시장 분석', body: raw.market_body ?? '' },
    risks: { title: '리스크 평가', body: raw.risks_body ?? '' },
    recommendation: { title: '투자 권고', body: raw.recommendation_body ?? '' },
  };

  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
