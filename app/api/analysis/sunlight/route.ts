import { z } from 'zod';

import { analyzeSunlight } from '@/lib/pipeline/sunlight/sunlight-analysis';

const requestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'INVALID_BODY', message: '좌표가 필요합니다.' } },
      { status: 400 },
    );
  }

  const result = analyzeSunlight(parsed.data.latitude, parsed.data.longitude);
  return Response.json(result, { status: 200, headers: { 'Cache-Control': 'public, max-age=86400' } });
}
