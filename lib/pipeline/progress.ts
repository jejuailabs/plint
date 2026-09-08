import type { AnalysisPreviewResponse } from '@/lib/domain/parcel-intelligence';
import type { ConnectorResult } from '@/lib/external-apis/connector';

export const analysisSteps = [
  { id: 'address', label: '주소 해석' },
  { id: 'building', label: '건축물대장' },
  { id: 'market', label: '공시지가·실거래' },
  { id: 'planning', label: '토지이용계획·필지·주변 건물' },
  { id: 'weather', label: '기상 자료' },
  { id: 'scenarios', label: '시나리오 산출' },
] as const;

export type StepId = (typeof analysisSteps)[number]['id'];
export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'warning'
  | 'failed'
  | 'skipped';
export type AnalysisProgress = {
  step: StepId;
  status: StepStatus;
  message: string;
};
export type ProgressReporter = (progress: AnalysisProgress) => void;
export type AnalysisOptions = {
  onProgress?: ProgressReporter;
  signal?: AbortSignal;
};
export type AnalysisEvent =
  | { type: 'progress'; progress: AnalysisProgress }
  | { type: 'result'; result: AnalysisPreviewResponse }
  | { type: 'error'; message: string };

/** Each group finishes only after every actual request settles. */
export function createProgressTracker(onProgress?: ProgressReporter) {
  const groups = new Map<
    StepId,
    { total: number; settled: number; missing: number; failed: number }
  >();
  function start(step: StepId, total: number) {
    groups.set(step, { total, settled: 0, missing: 0, failed: 0 });
    onProgress?.({ step, status: 'running', message: `조회 중 · 0/${total}` });
  }
  async function track<T>(
    step: StepId,
    task: () => Promise<ConnectorResult<T>>,
  ): Promise<ConnectorResult<T>> {
    const group = groups.get(step);
    if (!group) throw new Error('Progress group has not started');
    try {
      const result = await task();
      if (
        result.data === null ||
        (Array.isArray(result.data) && result.data.length === 0) ||
        result.warnings.length > 0
      )
        group.missing++;
      return result;
    } catch (error) {
      group.failed++;
      throw error;
    } finally {
      group.settled++;
      const done = group.settled === group.total;
      onProgress?.({
        step,
        status: !done
          ? 'running'
          : group.failed === group.total
            ? 'failed'
            : group.missing + group.failed > 0
              ? 'warning'
              : 'completed',
        message: !done
          ? `조회 중 · ${group.settled}/${group.total}`
          : group.failed === group.total
            ? '조회 실패'
            : group.missing + group.failed > 0
              ? '조회 종료 · 일부 자료 없음 또는 확인 필요'
              : '조회 완료',
      });
    }
  }
  return { start, track };
}

/** NDJSON chunks may split anywhere, including inside Korean characters. */
export async function readAnalysisStream(
  response: Response,
  onProgress: ProgressReporter,
): Promise<AnalysisPreviewResponse> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? '분석을 완료하지 못했습니다.');
  }
  if (!response.body) throw new Error('분석 진행 상태를 수신하지 못했습니다.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: AnalysisPreviewResponse | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AnalysisEvent;
    if (event.type === 'progress') onProgress(event.progress);
    else if (event.type === 'result') result = event.result;
    else if (event.type === 'error') throw new Error(event.message);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(consume);
      if (done) break;
    }
    consume(buffer);
    if (!result)
      throw new Error('분석 연결이 중단되었습니다. 다시 시도해 주세요.');
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
