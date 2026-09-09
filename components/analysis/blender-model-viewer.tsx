'use client';

import { Center, OrbitControls, Stage, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';

function Model({ src }: { src: string }) {
  const gltf = useGLTF(src);
  const scene = useMemo(() => gltf.scene.clone(), [gltf.scene]);
  return <primitive object={scene} />;
}

export function BlenderModelViewer({ src }: { src: string }) {
  return (
    <div className="h-[420px] overflow-hidden rounded-xl border border-white/10 bg-[#06101b]">
      <Canvas camera={{ position: [10, 9, 12], fov: 42 }} dpr={[1, 2]}>
        <color attach="background" args={['#06101b']} />
        <ambientLight intensity={0.65} />
        <Suspense fallback={null}>
          <Center>
            <Stage intensity={0.7} environment="city" shadows={false}>
              <Model src={src} />
            </Stage>
          </Center>
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          minDistance={2}
          maxDistance={60}
        />
      </Canvas>
      <p className="pointer-events-none -mt-8 px-3 text-[10px] text-slate-300">
        좌클릭 회전 · 휠 확대/축소 · 우클릭 이동
      </p>
    </div>
  );
}
