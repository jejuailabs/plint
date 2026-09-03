'use client';

import { Environment, Float, Grid, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';

import type { ContextBuilding, DevelopmentScenario } from '@/lib/domain/parcel-intelligence';

type SceneBuilding = [number, number, number, number, number, number];

const fallbackBuildings: SceneBuilding[] = [
  [-5.1, 0.75, -3.4, 1.8, 1.5, 2.1], [-3.1, 1.15, -3.8, 1.25, 2.3, 1.6],
  [3.9, 0.95, -3.9, 1.9, 1.9, 1.55], [5.4, 1.5, -1.5, 1.35, 3, 1.7],
  [-5.4, 1.25, 0.3, 1.4, 2.5, 1.4], [-4.7, 0.85, 3.1, 2.2, 1.7, 1.5],
  [4.5, 1.1, 2.8, 1.6, 2.2, 2],
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
    const height = Math.max(0.8, (building.heightM.value ?? 6.4) * 0.24);
    return [
      ((minX + maxX) / 2) * 0.105,
      height / 2,
      ((minZ + maxZ) / 2) * 0.105,
      Math.max(0.8, (maxX - minX) * 0.15),
      height,
      Math.max(0.8, (maxZ - minZ) * 0.15),
    ];
  });
}

function ContextBuildings({ context }: { context?: ContextBuilding[] }) {
  const buildings = useMemo(() => normalizeContext(context), [context]);
  return (
    <group>
      {buildings.map(([x, y, z, width, height, depth], index) => (
        <mesh key={index} position={[x, y, z]} castShadow receiveShadow>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color="#182334" roughness={0.78} metalness={0.16} />
        </mesh>
      ))}
    </group>
  );
}

function DevelopmentMass({ scenario }: { scenario?: DevelopmentScenario }) {
  const floors = scenario?.floors ?? [
    { floor: 1, footprintScale: 1, heightM: 3.3 },
    { floor: 2, footprintScale: 0.86, heightM: 3.3 },
    { floor: 3, footprintScale: 0.7, heightM: 3.3 },
  ];
  const baseWidth = 3.5 * Math.sqrt((scenario?.buildingCoverageRatio ?? 54) / 54);

  return (
    <Float speed={0.55} rotationIntensity={0.04} floatIntensity={0.08}>
      <group position={[0, 0.24, 0]} rotation={[0, -0.32, 0]}>
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <boxGeometry args={[4.55, 0.12, 4.15]} />
          <meshStandardMaterial color="#2dd4bf" transparent opacity={0.22} roughness={0.35} />
        </mesh>
        {floors.map((floor, index) => {
          const visualHeight = Math.max(0.48, floor.heightM * 0.23);
          return (
            <mesh key={floor.floor} position={[index * 0.035, 0.22 + visualHeight / 2 + index * visualHeight, -index * 0.03]} castShadow receiveShadow>
              <boxGeometry args={[baseWidth * floor.footprintScale, visualHeight, baseWidth * 0.88 * floor.footprintScale]} />
              <meshPhysicalMaterial color="#c8fbff" transparent opacity={0.8} roughness={0.16} metalness={0.1} transmission={0.06} emissive="#0891b2" emissiveIntensity={0.17} />
            </mesh>
          );
        })}
        <lineSegments position={[0, 0.01, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(4.65, 0.08, 4.25)]} />
          <lineBasicMaterial color="#bef264" transparent opacity={0.92} />
        </lineSegments>
      </group>
    </Float>
  );
}

function Scene({ scenario, context }: { scenario?: DevelopmentScenario; context?: ContextBuilding[] }) {
  return (
    <>
      <color attach="background" args={['#07101c']} />
      <fog attach="fog" args={['#07101c', 10, 23]} />
      <ambientLight intensity={0.62} />
      <directionalLight position={[5, 9, 4]} intensity={2.6} color="#d8fbff" castShadow />
      <pointLight position={[-5, 4, -4]} intensity={22} distance={12} color="#22d3ee" />
      <pointLight position={[4, 3, 5]} intensity={10} distance={10} color="#bef264" />
      <DevelopmentMass scenario={scenario} />
      <ContextBuildings context={context} />
      <Grid position={[0, 0, 0]} args={[24, 24]} cellSize={0.6} cellThickness={0.45} cellColor="#164e63" sectionSize={3} sectionThickness={0.75} sectionColor="#0e7490" fadeDistance={18} fadeStrength={1.5} infiniteGrid />
      <Environment preset="city" />
      <OrbitControls enablePan={false} minDistance={8} maxDistance={15} minPolarAngle={0.72} maxPolarAngle={1.35} autoRotate autoRotateSpeed={0.32} />
    </>
  );
}

export type ParcelSceneProps = { address: string; scenario?: DevelopmentScenario; context?: ContextBuilding[] };

export function ParcelScene({ address, scenario, context }: ParcelSceneProps) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit]" aria-label={`${address} 3D 개발 시나리오`}>
      <Canvas shadows camera={{ position: [8.2, 6.8, 9.4], fov: 39 }} dpr={[1, 1.6]}>
        <Suspense fallback={null}><Scene scenario={scenario} context={context} /></Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_28%,rgba(3,7,18,.46)_100%)]" />
    </div>
  );
}
