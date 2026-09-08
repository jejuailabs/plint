import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisOptions } from '@/lib/pipeline/progress';
import { readAnalysisStream } from '@/lib/pipeline/progress';
import type { AnalysisPreviewResponse } from '@/lib/domain/parcel-intelligence';

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@/lib/pipeline/preview', () => ({ runPreviewAnalysis: run }));
import { POST } from '@/app/api/analysis/preview/route';

const request = (stream = true) =>
  new Request('http://localhost/api/analysis/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: stream ? 'application/x-ndjson' : 'application/json',
    },
    body: JSON.stringify({ address: '서울특별시 강남구 역삼동 123' }),
  });
afterEach(() => vi.resetAllMocks());

describe('streaming preview route', () => {
  it('delivers progress before the analysis result exists', async () => {
    let finish!: (result: AnalysisPreviewResponse) => void;
    run.mockImplementation((_address: string, options: AnalysisOptions) => {
      options.onProgress?.({
        step: 'address',
        status: 'running',
        message: '주소 조회 중',
      });
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const response = await POST(request());
    expect(response.headers.get('content-type')).toContain(
      'application/x-ndjson',
    );
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain('주소 조회 중');
    finish({ data: {}, meta: { mode: 'mock' } } as AnalysisPreviewResponse);
    const last = await reader.read();
    expect(JSON.parse(new TextDecoder().decode(last.value)).type).toBe(
      'result',
    );
    expect((await reader.read()).done).toBe(true);
  });

  it('passes cancellation down to the analysis pipeline', async () => {
    let signal: AbortSignal | undefined;
    run.mockImplementation((_address: string, options: AnalysisOptions) => {
      signal = options.signal;
      return new Promise((_resolve, reject) =>
        signal?.addEventListener(
          'abort',
          () => reject(new Error('cancelled')),
          { once: true },
        ),
      );
    });
    const response = await POST(request());
    await response.body!.cancel();
    expect(signal?.aborted).toBe(true);
  });

  it('sends an error event after a pipeline failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    run.mockRejectedValue(new Error('upstream failure'));
    const response = await POST(request());
    await expect(readAnalysisStream(response, () => {})).rejects.toThrow(
      '분석을 완료하지 못했습니다',
    );
    vi.restoreAllMocks();
  });

  it('retains the existing JSON API for other callers', async () => {
    run.mockResolvedValue({ data: {}, meta: { mode: 'mock' } });
    const response = await POST(request(false));
    expect(response.headers.get('content-type')).toContain('application/json');
    expect((await response.json()).meta.mode).toBe('mock');
  });
});
