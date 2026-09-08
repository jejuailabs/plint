import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  conceptPrompt,
  conceptStyles,
  conceptUses,
} from '@/lib/report/concept';
export const maxDuration = 180;
const png = z
  .string()
  .max(8_000_000)
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
const schema = z.object({
  address: z.string().min(5).max(200),
  use: z.enum(conceptUses),
  style: z.enum(conceptStyles),
  floors: z.number().int().min(1).max(150),
  heightM: z.number().positive().max(600),
  grossArea: z.number().positive().max(10_000_000),
  massing: png,
  cesium: png,
});
export async function POST(request: Request) {
  try {
    await requireAuth();
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success)
      return Response.json(
        { error: '동일 시나리오의 현장·매스 PNG와 건축 조건이 필요합니다.' },
        { status: 400 },
      );
    const key = process.env.OPENAI_API_KEY;
    if (!key)
      return Response.json(
        { error: '이미지 생성용 OPENAI_API_KEY가 설정되지 않았습니다.' },
        { status: 503 },
      );
    const data = input.data,
      prompt = conceptPrompt(data),
      form = new FormData();
    form.set('model', 'gpt-image-2');
    form.set('prompt', prompt);
    form.set('size', '1536x1024');
    form.set('quality', 'medium');
    form.set('n', '1');
    form.set('output_format', 'jpeg');
    form.set('output_compression', '80');
    for (const [name, uri] of [
      ['site', data.cesium],
      ['massing', data.massing],
    ])
      form.append(
        'image[]',
        new Blob([Buffer.from(uri.split(',')[1], 'base64')], {
          type: 'image/png',
        }),
        name + '.png',
      );
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body: form,
      signal: AbortSignal.timeout(150000),
    });
    const payload = await response.json();
    if (!response.ok)
      return Response.json(
        {
          error: `이미지 생성 서비스 오류 (${response.status}). 모델 사용 권한·잔액 또는 서비스 상태를 확인해 주세요.`,
        },
        { status: 502 },
      );
    const base64 = payload.data?.[0]?.b64_json;
    if (typeof base64 !== 'string' || !base64)
      return Response.json(
        { error: '생성 이미지가 반환되지 않았습니다.' },
        { status: 502 },
      );
    return Response.json(
      {
        image: 'data:image/jpeg;base64,' + base64,
        prompt,
        model: 'gpt-image-2',
        generatedAt: new Date().toISOString(),
        reviewed: false,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        error: '이미지 생성이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: 502 },
    );
  }
}
