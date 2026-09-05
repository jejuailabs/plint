'use client';

import dynamic from 'next/dynamic';

import type { CesiumContextProps } from '@/components/analysis/cesium-context';

const DynamicCesiumContext = dynamic(
  () =>
    import('@/components/analysis/cesium-context').then(
      (module) => module.CesiumContext,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 animate-pulse rounded-[inherit] bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.12),transparent_52%),#07101c]" />
    ),
  },
);

export function LazyCesiumContext(props: CesiumContextProps) {
  return <DynamicCesiumContext {...props} />;
}
