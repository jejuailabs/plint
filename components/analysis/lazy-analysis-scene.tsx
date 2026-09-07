'use client';

import dynamic from 'next/dynamic';

import type { AnalysisSceneProps } from '@/components/analysis/analysis-scene';

const DynamicAnalysisScene = dynamic(
  () =>
    import('@/components/analysis/analysis-scene').then(
      (module) => module.AnalysisScene,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 grid place-items-center rounded-[inherit] bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.12),transparent_52%),#07101c]">
        <div className="text-center">
          <div className="mx-auto size-7 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
          <p className="mt-3 text-xs text-slate-300">3D 도면 로딩중입니다</p>
        </div>
      </div>
    ),
  },
);

export function LazyAnalysisScene(props: AnalysisSceneProps) {
  return <DynamicAnalysisScene {...props} />;
}
