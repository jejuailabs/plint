import { LoaderCircle } from 'lucide-react';
import {
  analysisSteps,
  type AnalysisProgress,
  type StepId,
} from '@/lib/pipeline/progress';

export function AnalysisProgressView({
  progress,
}: {
  progress: Partial<Record<StepId, AnalysisProgress>>;
}) {
  const settled = analysisSteps.filter(
    ({ id }) =>
      progress[id] && !['pending', 'running'].includes(progress[id].status),
  ).length;
  return (
    <div className="mt-6 text-left">
      <div className="space-y-3">
        {analysisSteps.map(({ id, label }, i) => {
          const step = progress[id];
          const status = step?.status ?? 'pending';
          const color =
            status === 'completed'
              ? 'text-cyan-200'
              : status === 'failed'
                ? 'text-rose-300'
                : status === 'warning'
                  ? 'text-amber-200'
                  : status === 'running'
                    ? 'text-white'
                    : 'text-slate-400';
          return (
            <div key={id} className={`flex items-start gap-3 ${color}`}>
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-current text-xs">
                {status === 'running' ? (
                  <LoaderCircle className="size-3 animate-spin" />
                ) : status === 'completed' ? (
                  '✓'
                ) : status === 'warning' || status === 'failed' ? (
                  '!'
                ) : status === 'skipped' ? (
                  '−'
                ) : (
                  i + 1
                )}
              </span>
              <div>
                <p className="text-sm">{label}</p>
                <p className="mt-0.5 text-xs opacity-80">
                  {step?.message ?? '대기 중'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-slate-400" aria-live="polite">
        {settled}/{analysisSteps.length}개 단계 처리됨 · 자료 조회는 동시에
        진행됩니다.
      </p>
      <progress
        aria-label="분석 단계 처리 현황"
        max={analysisSteps.length}
        value={settled}
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-white/[0.06] [&::-webkit-progress-value]:bg-cyan-300 [&::-moz-progress-bar]:bg-cyan-300"
      />
    </div>
  );
}
