import ExcelJS from 'exceljs';

import type { ParcelIntelligence } from '@/lib/domain/parcel-intelligence';
import type { AIReport } from '@/lib/ai/report-generator';

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1624' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const SECTION_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2B3C' } };
const SECTION_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF22D3EE' }, size: 11 };

function addSection(ws: ExcelJS.Worksheet, title: string) {
  const row = ws.addRow([title]);
  row.getCell(1).fill = SECTION_FILL;
  row.getCell(1).font = SECTION_FONT;
  ws.mergeCells(row.number, 1, row.number, 3);
}

function addPair(ws: ExcelJS.Worksheet, label: string, value: string | number | null) {
  ws.addRow([label, value ?? '미확인']);
}

function formatKrw(value: number) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억원`;
  return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만원`;
}

export async function generateExcelReport(
  data: ParcelIntelligence,
  aiReport: AIReport | null,
  address: string,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PLINT';
  wb.created = new Date();

  // ── Sheet 1: 분석 요약 ──
  const summary = wb.addWorksheet('분석 요약');
  summary.columns = [
    { header: '항목', key: 'label', width: 28 },
    { header: '값', key: 'value', width: 40 },
    { header: '비고', key: 'note', width: 30 },
  ];
  const headerRow = summary.getRow(1);
  headerRow.eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });

  addSection(summary, '필지 기본 정보');
  addPair(summary, '분석 대상 주소', address);
  addPair(summary, '지번주소', data.identity.jibunAddress.value);
  addPair(summary, '도로명주소', data.identity.roadAddress.value);
  addPair(summary, 'PNU', data.identity.pnu.value);
  addPair(summary, '좌표', data.identity.center.value ? `${data.identity.center.value.latitude}, ${data.identity.center.value.longitude}` : null);

  addSection(summary, '토지 현황');
  addPair(summary, '면적', data.geometry.areaSqm.value != null ? `${data.geometry.areaSqm.value}㎡` : null);
  addPair(summary, '지목', data.geometry.landCategory.value);
  addPair(summary, '전면도로폭', data.geometry.roadWidthM.value != null ? `${data.geometry.roadWidthM.value}m` : null);
  addPair(summary, '경사도', data.geometry.slopePercent.value != null ? `${data.geometry.slopePercent.value}%` : null);

  addSection(summary, '용도지역 및 규제');
  for (const p of data.planning) {
    summary.addRow([p.name, p.summary.value ?? '-', `${p.category} / ${p.status}`]);
  }

  addSection(summary, '기존 건물');
  if (data.existing.length === 0) {
    addPair(summary, '기존 건물', '없음 또는 미확인');
  } else {
    for (const b of data.existing) {
      summary.addRow([
        b.use.value ?? '미확인',
        `${b.floorsAbove.value ?? '-'}층 / ${b.totalFloorAreaSqm.value ?? '-'}㎡`,
        `사용승인: ${b.approvedAt.value ?? '미확인'}`,
      ]);
    }
  }

  addSection(summary, '시장 데이터');
  addPair(summary, '공시지가', data.market.officialLandPricePerSqm.value != null ? `${data.market.officialLandPricePerSqm.value.toLocaleString('ko-KR')}원/㎡` : null);
  addPair(summary, '실거래 중위가', data.market.comparableMedianPerSqm.value != null ? `${data.market.comparableMedianPerSqm.value.toLocaleString('ko-KR')}원/㎡` : null);
  addPair(summary, '실거래 건수', `${data.market.comparableCount.value ?? 0}건`);
  addPair(summary, '12개월 추세', data.market.trendPercent.value != null ? `${data.market.trendPercent.value > 0 ? '+' : ''}${data.market.trendPercent.value}%` : null);

  addSection(summary, '기후');
  addPair(summary, '연간 일조시간', data.climate.annualSunlightHours.value != null ? `${data.climate.annualSunlightHours.value}시간` : null);
  addPair(summary, '일사량', data.climate.solarRadiationKwhM2.value != null ? `${data.climate.solarRadiationKwhM2.value} kWh/㎡` : null);
  addPair(summary, '주풍향', data.climate.prevailingWind.value);

  addSection(summary, '데이터 커버리지');
  addPair(summary, '전체 신뢰도', `${data.coverage.percent}%`);
  summary.addRow(['확인/계산/추정/미연결', `${data.coverage.verifiedFacts} / ${data.coverage.derivedFacts} / ${data.coverage.estimatedFacts} / ${data.coverage.missingFacts}`]);

  // ── Sheet 2: 시나리오 비교 ──
  const scenarioSheet = wb.addWorksheet('시나리오 비교');
  scenarioSheet.columns = [
    { header: '항목', key: 'label', width: 22 },
    ...data.scenarios.map((s) => ({ header: s.name, key: s.id, width: 24 })),
  ];
  const scHeaderRow = scenarioSheet.getRow(1);
  scHeaderRow.eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });

  const scenarioMetrics: [string, (s: typeof data.scenarios[0]) => string][] = [
    ['전략', (s) => s.strategy === 'max_yield' ? '수익 극대화' : s.strategy === 'balanced' ? '균형안' : '공간 품질'],
    ['건폐율', (s) => `${s.buildingCoverageRatio}%`],
    ['용적률', (s) => `${s.floorAreaRatio}%`],
    ['연면적', (s) => `${s.grossFloorAreaSqm.toLocaleString('ko-KR')}㎡`],
    ['층수', (s) => `${s.floors.length}층`],
    ['예상 매출', (s) => formatKrw(s.estimatedRevenueKrw)],
    ['예상 비용', (s) => formatKrw(s.estimatedCostKrw)],
    ['개략 수익률', (s) => `${s.estimatedProfitRatePercent}%`],
  ];
  for (const [label, accessor] of scenarioMetrics) {
    scenarioSheet.addRow([label, ...data.scenarios.map(accessor)]);
  }

  // ── Sheet 3: 리스크 ──
  const riskSheet = wb.addWorksheet('리스크');
  riskSheet.columns = [
    { header: '코드', key: 'code', width: 16 },
    { header: '항목', key: 'label', width: 20 },
    { header: '위험도', key: 'level', width: 14 },
    { header: '분석 결과', key: 'finding', width: 40 },
    { header: '다음 조치', key: 'action', width: 40 },
  ];
  const riskHeaderRow = riskSheet.getRow(1);
  riskHeaderRow.eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });
  for (const r of data.risks) {
    riskSheet.addRow([r.code, r.label, r.level, r.finding.value ?? '미확인', r.nextAction ?? '-']);
  }

  // ── Sheet 4: AI 보고서 (optional) ──
  if (aiReport) {
    const aiSheet = wb.addWorksheet('AI 분석 보고서');
    aiSheet.columns = [
      { header: '섹션', key: 'section', width: 22 },
      { header: '내용', key: 'content', width: 100 },
    ];
    const aiHeaderRow = aiSheet.getRow(1);
    aiHeaderRow.eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });

    aiSheet.addRow(['요약', aiReport.summary]);
    const sections = [aiReport.feasibility, aiReport.regulations, aiReport.market, aiReport.risks, aiReport.recommendation];
    for (const section of sections) {
      if (section) {
        const bodyText = (section.body ?? '').replace(/\\n\\n/g, '\n\n').replace(/\\n/g, '\n');
        aiSheet.addRow([section.title, bodyText]);
        const lastRow = aiSheet.lastRow;
        if (lastRow) lastRow.getCell(2).alignment = { wrapText: true, vertical: 'top' };
      }
    }
    aiSheet.addRow([]);
    aiSheet.addRow(['모델', aiReport.model]);
    aiSheet.addRow(['생성일시', aiReport.generatedAt]);
    aiSheet.addRow(['', '본 분석은 사전검토용이며 인허가 심의를 대체하지 않습니다.']);
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(arrayBuffer);
}
