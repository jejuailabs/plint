import { z } from 'zod';

import { runPreviewAnalysis } from '@/lib/pipeline/preview';
import type { AnalysisEvent } from '@/lib/pipeline/progress';

export const maxDuration = 120;
export const runtime = 'edge';
// VWorld's public spatial APIs are intended for domestic access. Keeping this
// route in Seoul prevents a US default function region from losing all parcel
// geometry while the rest of the analysis still succeeds.
export const preferredRegion = 'icn1';

const requestSchema = z.object({
  address: z
    .string()
    .trim()
    .min(5, '주소를 5자 이상 입력해 주세요.')
    .max(160, '주소가 너무 깁니다.'),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: 'INVALID_ADDRESS',
          message: parsed.error.issues[0]?.message ?? '주소를 확인해 주세요.',
        },
      },
      { status: 400 },
    );
  }

  if (request.headers.get('accept')?.includes('application/x-ndjson')) {
    const abort = new AbortController();
    const signal = AbortSignal.any([request.signal, abort.signal]);
    const encoder = new TextEncoder();
    let closed = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: AnalysisEvent) => {
          if (!closed && !signal.aborted)
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        void (async () => {
          try {
            const result = await runPreviewAnalysis(parsed.data.address, {
              signal,
              onProgress: (progress) => send({ type: 'progress', progress }),
            });
            send({ type: 'result', result });
          } catch (error) {
            if (!signal.aborted) {
              console.error('Streaming analysis failed', error);
              send({
                type: 'error',
                message:
                  '분석을 완료하지 못했습니다. 주소와 연결 상태를 확인하고 다시 시도해 주세요.',
              });
            }
          } finally {
            if (!closed) {
              closed = true;
              controller.close();
            }
          }
        })();
      },
      cancel() {
        closed = true;
        abort.abort();
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  try {
    const result = await runPreviewAnalysis(parsed.data.address);
    return Response.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error('Preview analysis failed', { requestId, error });
    return Response.json(
      {
        error: {
          code: 'ANALYSIS_FAILED',
          message: '미리보기 분석을 완료하지 못했습니다.',
          requestId,
        },
      },
      { status: 500 },
    );
  }
}
