import { describe, expect, it } from 'vitest';
import {
  createProgressTracker,
  readAnalysisStream,
  type AnalysisProgress,
} from '@/lib/pipeline/progress';
import type { ConnectorResult } from '@/lib/external-apis/connector';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const found: ConnectorResult<number> = {
  data: 1,
  warnings: [],
  rawSnapshotId: 'test',
  observedAt: '2026-09-08',
};

describe('actual connector progress', () => {
  it('keeps a group running until its slowest request settles, while other groups finish', async () => {
    const events: AnalysisProgress[] = [];
    const tracker = createProgressTracker((event) => events.push(event));
    const slow = deferred<ConnectorResult<number>>();
    tracker.start('market', 2);
    tracker.start('weather', 1);
    const pending = tracker.track('market', () => slow.promise);
    await tracker.track('market', async () => found);
    await tracker.track('weather', async () => found);
    expect(
      events.filter((event) => event.step === 'market').at(-1),
    ).toMatchObject({ status: 'running', message: '조회 중 · 1/2' });
    expect(events.at(-1)).toMatchObject({
      step: 'weather',
      status: 'completed',
    });
    slow.resolve(found);
    await pending;
    expect(events.at(-1)).toMatchObject({
      step: 'market',
      status: 'completed',
    });
  });

  it('never marks missing data or a rejected request as successfully completed', async () => {
    const events: AnalysisProgress[] = [];
    const tracker = createProgressTracker((event) => events.push(event));
    tracker.start('planning', 2);
    await tracker.track('planning', async () => ({ ...found, data: null }));
    await expect(
      tracker.track('planning', async () => {
        throw new Error('timeout');
      }),
    ).rejects.toThrow('timeout');
    expect(events.at(-1)?.status).toBe('warning');
    tracker.start('address', 1);
    await expect(
      tracker.track('address', async () => {
        throw new Error('network');
      }),
    ).rejects.toThrow();
    expect(events.at(-1)?.status).toBe('failed');
  });
});

describe('stream reader', () => {
  it('handles chunk boundaries inside Korean characters and a final line without a newline', async () => {
    const bytes = new TextEncoder().encode(
      [
        JSON.stringify({
          type: 'progress',
          progress: {
            step: 'address',
            status: 'running',
            message: '주소 해석 중',
          },
        }),
        JSON.stringify({
          type: 'result',
          result: { data: {}, meta: { mode: 'mock' } },
        }),
      ].join('\n'),
    );
    const events: AnalysisProgress[] = [];
    let index = 0;
    const response = new Response(
      new ReadableStream({
        pull(controller) {
          if (index === bytes.length) controller.close();
          else controller.enqueue(bytes.slice(index, ++index));
        },
      }),
    );
    const result = await readAnalysisStream(response, (event) =>
      events.push(event),
    );
    expect(events[0].message).toBe('주소 해석 중');
    expect(result.meta.mode).toBe('mock');
  });

  it('rejects a disconnected stream without presenting a partial result as success', async () => {
    const response = new Response(
      JSON.stringify({
        type: 'progress',
        progress: { step: 'address', status: 'completed' },
      }) + '\n',
    );
    await expect(readAnalysisStream(response, () => {})).rejects.toThrow(
      '중단',
    );
  });

  it('surfaces server failures and validation errors', async () => {
    await expect(
      readAnalysisStream(
        new Response('{"type":"error","message":"분석 실패"}\n'),
        () => {},
      ),
    ).rejects.toThrow('분석 실패');
    await expect(
      readAnalysisStream(
        Response.json({ error: { message: '주소 확인' } }, { status: 400 }),
        () => {},
      ),
    ).rejects.toThrow('주소 확인');
  });
});
