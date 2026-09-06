'use client';

import { Environment, Grid, OrbitControls, Text } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';

import type {
  ContextBuilding,
  DevelopmentScenario,
  Polygon,
} from '@/lib/domain/parcel-intelligence';
import type { Fact } from '@/lib/domain/evidence';

export type AnalysisSceneProps = {
  address: string;
  center: { latitude: number; longitude: number };
  boundary: Fact<Polygon>;
  areaSqm: number;
  scenario: DevelopmentScenario;
  context?: ContextBuilding[];
};

const DEG_TO_M = 111_320;

function geoToLocal(
  lon: number,
  lat: number,
  centerLon: number,
  centerLat: number,
): [number, number] {
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const x = (lon - centerLon) * DEG_TO_M * cosLat;
  const z = -(lat - centerLat) * DEG_TO_M;
  return [x, z];
}

function ParcelBoundary({
  boundary,
  centerLon,
  centerLat,
}: {
  boundary: Polygon;
  centerLon: number;
  centerLat: number;
}) {
  const shape = useMemo(() => {
    const ring = boundary.coordinates[0];
    if (!ring || ring.length < 3) return null;

    const s = new THREE.Shape();
    const [sx, sz] = geoToLocal(ring[0][0], ring[0][1], centerLon, centerLat);
    s.moveTo(sx, -sz);
    for (let i = 1; i < ring.length; i++) {
      const [px, pz] = geoToLocal(ring[i][0], ring[i][1], centerLon, centerLat);
      s.lineTo(px, -pz);
    }
    s.closePath();
    return s;
  }, [boundary, centerLon, centerLat]);

  if (!shape) return null;

  const linePoints = useMemo(() => {
    const ring = boundary.coordinates[0];
    if (!ring) return [];
    return ring.map(([lon, lat]) => {
      const [x, z] = geoToLocal(lon, lat, centerLon, centerLat);
      return new THREE.Vector3(x, 0.15, z);
    });
  }, [boundary, centerLon, centerLat]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color="#bef264"
          transparent
          opacity={0.18}
          roughness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      {linePoints.length > 2 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(linePoints.flatMap((p) => [p.x, p.y, p.z])), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#bef264" transparent opacity={0.85} />
        </line>
      )}
    </group>
  );
}

function AnalysisMass({
  scenario,
  areaSqm,
}: {
  scenario: DevelopmentScenario;
  areaSqm: number;
}) {
  const baseSide = Math.sqrt(areaSqm * (scenario.buildingCoverageRatio / 100));

  return (
    <group position={[0, 0, 0]}>
      {scenario.floors.map((floor, i) => {
        const w = baseSide * floor.footprintScale;
        const d = baseSide * 0.85 * floor.footprintScale;
        const h = floor.heightM;
        const yBase = scenario.floors
          .slice(0, i)
          .reduce((sum, f) => sum + f.heightM, 0);

        return (
          <mesh
            key={floor.floor}
            position={[0, yBase + h / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[w, h, d]} />
            <meshPhysicalMaterial
              color="#c8fbff"
              transparent
              opacity={0.72}
              roughness={0.18}
              metalness={0.08}
              transmission={0.08}
              emissive="#0891b2"
              emissiveIntensity={0.15}
            />
          </mesh>
        );
      })}
      <Text
        position={[0, scenario.floors.reduce((s, f) => s + f.heightM, 0) + 2, 0]}
        fontSize={1.5}
        color="#bef264"
        anchorX="center"
        anchorY="bottom"
      >
        {scenario.name}
      </Text>
    </group>
  );
}

function ContextMeshes({
  buildings,
  centerLon,
  centerLat,
}: {
  buildings: ContextBuilding[];
  centerLon: number;
  centerLat: number;
}) {
  const meshes = useMemo(() => {
    return buildings.map((b) => {
      const ring = b.footprint.coordinates[0];
      const xs = ring.map(([lon]) => {
        const [x] = geoToLocal(lon, ring[0][1], centerLon, centerLat);
        return x;
      });
      const zs = ring.map(([, lat]) => {
        const [, z] = geoToLocal(ring[0][0], lat, centerLon, centerLat);
        return z;
      });
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      const w = Math.max(2, Math.max(...xs) - Math.min(...xs));
      const d = Math.max(2, Math.max(...zs) - Math.min(...zs));
      const h = Math.max(3, b.heightM.value ?? 9);
      return { cx, cz, w, d, h, id: b.id };
    });
  }, [buildings, centerLon, centerLat]);

  return (
    <group>
      {meshes.map((m) => (
        <mesh
          key={m.id}
          position={[m.cx, m.h / 2, m.cz]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[m.w, m.h, m.d]} />
          <meshStandardMaterial
            color="#365172"
            emissive="#102a43"
            emissiveIntensity={0.3}
            roughness={0.75}
            metalness={0.08}
          />
        </mesh>
      ))}
    </group>
  );
}

function AnalysisSceneContent({
  center,
  boundary,
  areaSqm,
  scenario,
  context,
}: Omit<AnalysisSceneProps, 'address'>) {
  const gridSize = Math.max(80, Math.sqrt(areaSqm) * 4);

  return (
    <>
      <color attach="background" args={['#07101c']} />
      <fog attach="fog" args={['#07101c', gridSize * 0.7, gridSize * 1.5]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#bdeeff', '#07121f', 1]} />
      <directionalLight
        position={[gridSize * 0.3, gridSize * 0.5, gridSize * 0.3]}
        intensity={3.2}
        color="#d8fbff"
        castShadow
      />
      <pointLight position={[-20, 15, -15]} intensity={40} distance={60} color="#22d3ee" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[gridSize, gridSize]} />
        <meshStandardMaterial color="#0c1e2f" roughness={0.9} metalness={0.05} />
      </mesh>

      {boundary.value && (
        <ParcelBoundary
          boundary={boundary.value}
          centerLon={center.longitude}
          centerLat={center.latitude}
        />
      )}

      <AnalysisMass scenario={scenario} areaSqm={areaSqm} />

      {context && context.length > 0 && (
        <ContextMeshes
          buildings={context}
          centerLon={center.longitude}
          centerLat={center.latitude}
        />
      )}

      <Grid
        position={[0, 0.02, 0]}
        args={[gridSize, gridSize]}
        cellSize={2}
        cellThickness={0.3}
        cellColor="#164e63"
        sectionSize={10}
        sectionThickness={0.5}
        sectionColor="#0e7490"
        fadeDistance={gridSize * 0.6}
        fadeStrength={1.2}
        infiniteGrid
      />
      <Environment preset="city" />
      <OrbitControls
        target={[0, scenario.floors.reduce((s, f) => s + f.heightM, 0) / 3, 0]}
        enablePan
        minDistance={Math.sqrt(areaSqm) * 0.8}
        maxDistance={gridSize * 0.5}
        minPolarAngle={0.3}
        maxPolarAngle={1.4}
        autoRotate
        autoRotateSpeed={0.12}
      />
    </>
  );
}

export function AnalysisScene(props: AnalysisSceneProps) {
  const camDist = Math.max(30, Math.sqrt(props.areaSqm) * 2);

  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-[inherit]"
      aria-label={`${props.address} 분석 3D 씬`}
    >
      <Canvas
        shadows
        camera={{
          position: [camDist * 0.65, camDist * 0.55, camDist * 0.7],
          fov: 42,
        }}
        dpr={[1, 1.6]}
      >
        <Suspense fallback={null}>
          <AnalysisSceneContent
            center={props.center}
            boundary={props.boundary}
            areaSqm={props.areaSqm}
            scenario={props.scenario}
            context={props.context}
          />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_38%,rgba(3,7,18,.25)_100%)]" />
    </div>
  );
}
