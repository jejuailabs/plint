import { z } from 'zod';

import { generateExcelReport } from '@/lib/report/excel-generator';
import type { ParcelIntelligence } from '@/lib/domain/parcel-intelligence';
import type { AIReport } from '@/lib/ai/report-generator';

const requestSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  aiReport: z.record(z.string(), z.unknown()).nullable().optional(),
  address: z.string().min(1),
  format: z.enum(['excel']),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'INVALID_BODY', message: '분석 데이터와 포맷이 필요합니다.' } },
      { status: 400 },
    );
  }

  try {
    const { data, aiReport, address, format } = parsed.data;

    if (format === 'excel') {
      const buffer = await generateExcelReport(
        data as unknown as ParcelIntelligence,
        (aiReport as unknown as AIReport) ?? null,
        address,
      );

      const filename = `PLINT_분석보고서_${address.replace(/\s+/g, '_').slice(0, 30)}.xlsx`;

      return new Response(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return Response.json({ error: { code: 'UNSUPPORTED_FORMAT', message: '지원하지 않는 포맷입니다.' } }, { status: 400 });
  } catch (err) {
    console.error('Report download failed', err instanceof Error ? err.message : err);
    return Response.json(
      { error: { code: 'DOWNLOAD_FAILED', message: '보고서 다운로드에 실패했습니다.' } },
      { status: 500 },
    );
  }
}
