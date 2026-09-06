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
      <div className="absolute inset-0 animate-pulse rounded-[inherit] bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.12),transparent_52%),#07101c]" />
    ),
  },
);

export function LazyAnalysisScene(props: AnalysisSceneProps) {
  return <DynamicAnalysisScene {...props} />;
}
