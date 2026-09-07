'use client';

import { Grid, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';

import type { ContextBuilding, DevelopmentScenario } from '@/lib/domain/parcel-intelligence';

type SceneBuilding = [number, number, number, number, number, number];

const fallbackBuildings: SceneBuilding[] = [
  [-8, 3.5, -7, 4, 7, 4.5],
  [-5, 2.5, -9, 3.5, 5, 3],
  [7, 4, -7, 5, 8, 3.5],
  [10, 5.5, -2, 3, 11, 4],
  [-10, 3, 2, 3.5, 6, 3],
  [-8, 2, 7, 5, 4, 3.5],
  [8, 3, 6, 4, 6, 4.5],
  [-3, 1.5, -10, 3, 3, 3],
  [5, 4.5, 10, 3, 9, 3],
  [-11, 2.5, -3, 2.5, 5, 3],
  [11, 3.5, 5, 3.5, 7, 2.5],
  [-6, 2, 11, 4, 4, 2.5],
];

function normalizeContext(context?: ContextBuilding[]): SceneBuilding[] {
  if (!context?.length) return fallbackBuildings;
  return context.map((building) => {
    const ring = building.footprint.coordinates[0];
    const xs = ring.map(([x]) => x);
    const zs = ring.map(([, z]) => z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const height = Math.max(1.5, (building.heightM.value ?? 8) * 0.24);
    return [
      ((minX + maxX) / 2) * 0.105,
      height / 2,
      ((minZ + maxZ) / 2) * 0.105,
      Math.max(1.5, (maxX - minX) * 0.15),
      height,
      Math.max(1.5, (maxZ - minZ) * 0.15),
    ];
  });
}

function ContextBuildings({ context }: { context?: ContextBuilding[] }) {
  const buildings = useMemo(() => normalizeContext(context), [context]);
  return (
    <group>
      {buildings.map(([x, y, z, width, height, depth], index) => {
        const t = Math.min(1, height / 10);
        const color = new THREE.Color().lerpColors(
          new THREE.Color('#263e58'),
          new THREE.Color('#3d6080'),
          t,
        );
        return (
          <group key={index}>
            <mesh position={[x, y, z]} castShadow receiveShadow>
              <boxGeometry args={[width, height, depth]} />
              <meshStandardMaterial
                color={color}
                emissive="#0c1a2e"
                emissiveIntensity={0.15}
                roughness={0.72}
                metalness={0.08}
              />
            </mesh>
            <lineSegments position={[x, y, z]}>
              <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
              <lineBasicMaterial color="#4a7ca0" transparent opacity={0.22} />
            </lineSegments>
          </group>
        );
      })}
    </group>
  );
}

function UrbanContext() {
  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[64, 64]} />
        <meshStandardMaterial color="#0a1a2a" roughness={0.88} metalness={0.08} />
      </mesh>
      {/* Roads */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[60, 0.04, 2.2]} />
        <meshStandardMaterial color="#1e3a52" roughness={0.92} />
      </mesh>
      <mesh position={[-7.2, 0.04, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.04, 60]} />
        <meshStandardMaterial color="#1e3a52" roughness={0.92} />
      </mesh>
      <mesh position={[7, 0.04, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.04, 60]} />
        <meshStandardMaterial color="#1e3a52" roughness={0.92} />
      </mesh>
      {/* Parcel boundary (lime outline) */}
      <lineSegments position={[0, 0.12, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(6.2, 0.03, 5.6)]} />
        <lineBasicMaterial color="#bef264" transparent opacity={0.9} />
      </lineSegments>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <planeGeometry args={[6.2, 5.6]} />
        <meshStandardMaterial color="#bef264" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

const SLAB_T = 0.14;
const SLAB_OVER = 0.22;
const GAP = 0.04;

function DevelopmentMass({ scenario }: { scenario?: DevelopmentScenario }) {
  const floors = scenario?.floors ?? [
    { floor: 1, footprintScale: 1, heightM: 3.3 },
    { floor: 2, footprintScale: 0.88, heightM: 3.3 },
    { floor: 3, footprintScale: 0.74, heightM: 3.3 },
    { floor: 4, footprintScale: 0.62, heightM: 3.0 },
  ];
  const baseWidth = 2.85 * Math.sqrt((scenario?.buildingCoverageRatio ?? 54) / 54);
  const nFloors = floors.length;

  const floorColors = useMemo(() => {
    return floors.map((_, i) => {
      const t = i / Math.max(1, nFloors - 1);
      return new THREE.Color().lerpColors(
        new THREE.Color('#7dd3fc'),
        new THREE.Color('#e0f7ff'),
        t,
      );
    });
  }, [floors, nFloors]);

  return (
    <group position={[0, 0.15, 0]} rotation={[0, -0.28, 0]}>
      {floors.map((floor, i) => {
        const w = baseWidth * floor.footprintScale;
        const d = baseWidth * 0.88 * floor.footprintScale;
        const h = Math.max(0.48, floor.heightM * 0.23);
        const yBase = floors
          .slice(0, i)
          .reduce((s, f) => s + Math.max(0.48, f.heightM * 0.23) + GAP, 0);
        const glassH = h - SLAB_T;

        return (
          <group key={floor.floor}>
            {/* Slab */}
            <mesh position={[0, yBase + SLAB_T / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w + SLAB_OVER, SLAB_T, d + SLAB_OVER]} />
              <meshStandardMaterial color="#cce8f4" roughness={0.35} metalness={0.12} />
            </mesh>
            <lineSegments position={[0, yBase + SLAB_T / 2, 0]}>
              <edgesGeometry args={[new THREE.BoxGeometry(w + SLAB_OVER, SLAB_T, d + SLAB_OVER)]} />
              <lineBasicMaterial color="#67e8f9" transparent opacity={0.2} />
            </lineSegments>

            {/* Glass */}
            <mesh position={[0, yBase + SLAB_T + glassH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, glassH, d]} />
              <meshPhysicalMaterial
                color={floorColors[i]}
                transparent
                opacity={0.5}
                roughness={0.06}
                metalness={0.18}
                transmission={0.12}
                emissive="#0e7490"
                emissiveIntensity={0.08}
              />
            </mesh>
            <lineSegments position={[0, yBase + SLAB_T + glassH / 2, 0]}>
              <edgesGeometry args={[new THREE.BoxGeometry(w, glassH, d)]} />
              <lineBasicMaterial color="#22d3ee" transparent opacity={0.35} />
            </lineSegments>
          </group>
        );
      })}

      {/* Roof */}
      {(() => {
        const totalH = floors.reduce(
          (s, f) => s + Math.max(0.48, f.heightM * 0.23) + GAP,
          0,
        );
        const lastScale = floors[nFloors - 1]?.footprintScale ?? 1;
        return (
          <mesh position={[0, totalH, 0]} castShadow>
            <boxGeometry args={[baseWidth * lastScale + SLAB_OVER, SLAB_T * 0.6, baseWidth * 0.88 * lastScale + SLAB_OVER]} />
            <meshStandardMaterial color="#a5d8ec" roughness={0.3} metalness={0.15} />
          </mesh>
        );
      })()}
    </group>
  );
}

function Scene({ scenario, context }: { scenario?: DevelopmentScenario; context?: ContextBuilding[] }) {
  return (
    <>
      <color attach="background" args={['#060e18']} />
      <fog attach="fog" args={['#060e18', 35, 72]} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#b0d8f5', '#050d16', 0.9]} />
      <directionalLight position={[6, 13, 6]} intensity={3.5} color="#d4f0ff" castShadow />
      <pointLight position={[-8, 7, -6]} intensity={38} distance={28} color="#22d3ee" />
      <pointLight position={[6, 6, 7]} intensity={22} distance={24} color="#bef264" />
      <UrbanContext />
      <DevelopmentMass scenario={scenario} />
      <ContextBuildings context={context} />
      <Grid
        position={[0, 0.015, 0]}
        args={[64, 64]}
        cellSize={0.75}
        cellThickness={0.25}
        cellColor="#0e3a50"
        sectionSize={3}
        sectionThickness={0.5}
        sectionColor="#0c6380"
        fadeDistance={32}
        fadeStrength={1.4}
        infiniteGrid
      />
      <OrbitControls
        target={[0, 0.6, 0]}
        enablePan={false}
        minDistance={18}
        maxDistance={38}
        minPolarAngle={0.65}
        maxPolarAngle={1.25}
        autoRotate
        autoRotateSpeed={0.15}
      />
    </>
  );
}

export type ParcelSceneProps = { address: string; scenario?: DevelopmentScenario; context?: ContextBuilding[] };

export function ParcelScene({ address, scenario, context }: ParcelSceneProps) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit]" aria-label={`${address} 3D 개발 시나리오`}>
      <Canvas shadows camera={{ position: [20, 18, 22], fov: 42 }} dpr={[1, 1.6]}>
        <Suspense fallback={null}><Scene scenario={scenario} context={context} /></Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_40%,rgba(3,7,18,.25)_100%)]" />
      <div className="pointer-events-none absolute right-5 top-5 rounded-lg border border-cyan-300/15 bg-slate-950/70 px-3 py-2 font-mono text-[9px] uppercase tracking-[.18em] text-cyan-100/80 backdrop-blur">
        Urban context · mock map
      </div>
    </div>
  );
}
