import { it, expect, vi, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import { generateExcelReport } from '@/lib/report/excel-generator';
import { generateAIReport } from '@/lib/ai/report-generator';
import { runPreviewAnalysis } from '@/lib/pipeline/preview';
import { conceptPrompt } from '@/lib/report/concept';
afterEach(() => vi.unstubAllEnvs());
it('exports both captured images as workbook media', async () => {
  vi.stubEnv('USE_MOCK_EXTERNAL_API', 'true');
  const { data } = await runPreviewAnalysis(
    '서울특별시 성동구 성수동2가 277-17',
  );
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfWQAAAAASUVORK5CYII=';
  const output = await generateExcelReport(data, null, '성수동', {
    massing: png,
    cesium: png,
    capturedAt: new Date().toISOString(),
    scenarioId: 'balanced',
    attribution: 'VWorld',
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(output) as never);
  expect(workbook.getWorksheet('배치·현장 이미지')?.getImages()).toHaveLength(
    2,
  );
});
it('writes complete grounded sections when legal and market evidence is missing', async () => {
  vi.stubEnv('USE_MOCK_EXTERNAL_API', 'true');
  const { data } = await runPreviewAnalysis(
    '서울특별시 성동구 성수동2가 277-17',
  );
  data.geometry.boundary.value = null;
  data.reviewNotes = ['경계 조회 실패'];
  const report = await generateAIReport(data);
  for (const section of [
    report.feasibility,
    report.regulations,
    report.market,
    report.risks,
    report.recommendation,
  ])
    expect(section.body.trim().length).toBeGreaterThan(0);
  expect(report.model).toContain('근거');
});
it('anchors the image brief to the scenario without inventing a neighborhood', () => {
  const prompt = conceptPrompt({
    address: '애월해안로 255',
    use: '카페·소매점',
    style: '백색 건축 모형',
    floors: 3,
    heightM: 10.6,
    grossArea: 1200,
  });
  expect(prompt).toContain('Exactly 3 floors');
  expect(prompt).toContain('Do not invent surrounding buildings');
  expect(prompt).toContain('Image 1');
  expect(prompt).toContain('image 2');
});
