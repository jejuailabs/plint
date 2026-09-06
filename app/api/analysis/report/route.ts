import { z } from 'zod';

import { generateAIReport } from '@/lib/ai/report-generator';
import type { ParcelIntelligence } from '@/lib/domain/parcel-intelligence';

const requestSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'INVALID_BODY', message: '분석 데이터가 필요합니다.' } },
      { status: 400 },
    );
  }

  try {
    const report = await generateAIReport(parsed.data.data as unknown as ParcelIntelligence);
    return Response.json(report, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const requestId = crypto.randomUUID();
    console.error('AI report generation failed', requestId, err instanceof Error ? err.message : err);
    return Response.json(
      {
        error: {
          code: 'REPORT_GENERATION_FAILED',
          message: err instanceof Error ? err.message : 'AI 보고서 생성에 실패했습니다.',
          requestId,
        },
      },
      { status: 500 },
    );
  }
}
