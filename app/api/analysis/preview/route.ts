import { z } from 'zod';

import { runPreviewAnalysis } from '@/lib/pipeline/preview';

const requestSchema = z.object({
  address: z.string().trim().min(5, '주소를 5자 이상 입력해 주세요.').max(160, '주소가 너무 깁니다.'),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'INVALID_ADDRESS', message: parsed.error.issues[0]?.message ?? '주소를 확인해 주세요.' } },
      { status: 400 },
    );
  }

  try {
    const result = await runPreviewAnalysis(parsed.data.address);
    return Response.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error('Preview analysis failed', { requestId, error });
    return Response.json(
      { error: { code: 'ANALYSIS_FAILED', message: '미리보기 분석을 완료하지 못했습니다.', requestId } },
      { status: 500 },
    );
  }
}
