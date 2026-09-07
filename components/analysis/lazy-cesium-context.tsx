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
      <div className="absolute inset-0 grid place-items-center rounded-[inherit] bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.12),transparent_52%),#07101c]">
        <div className="text-center">
          <div className="mx-auto size-7 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
          <p className="mt-3 text-xs text-slate-300">3D 도면 로딩중입니다</p>
        </div>
      </div>
    ),
  },
);

export function LazyCesiumContext(props: CesiumContextProps) {
  return <DynamicCesiumContext {...props} />;
}
