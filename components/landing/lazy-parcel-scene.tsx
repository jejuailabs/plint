'use client';

import dynamic from 'next/dynamic';

import type { ParcelSceneProps } from '@/components/landing/parcel-scene';

const DynamicParcelScene = dynamic(
  () => import('@/components/landing/parcel-scene').then((module) => module.ParcelScene),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 animate-pulse rounded-[inherit] bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.12),transparent_52%),#07101c]" />
    ),
  },
);

export function LazyParcelScene(props: ParcelSceneProps) {
  return <DynamicParcelScene {...props} />;
}
