'use client';

import { Environment, Grid, OrbitControls, Text } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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

// ---------------------------------------------------------------------------
// Satellite Ground — loads VWorld aerial image as ground texture
// ---------------------------------------------------------------------------

const SAT_ZOOM = 18;
const SAT_PX = 800;

function computeGroundCoverage(lat: number): number {
  const mpp = (156543.03 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, SAT_ZOOM);
  return SAT_PX * mpp;
}

function SatelliteGround({
  center,
  coverage,
}: {
  center: { latitude: number; longitude: number };
  coverage: number;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const texRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    let disposed = false;
    const url = `/api/map/static?lat=${center.latitude}&lon=${center.longitude}&zoom=${SAT_ZOOM}&w=${SAT_PX}&h=${SAT_PX}&basemap=SATELLITE`;
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        texRef.current = tex;
        setTexture(tex);
      },
      undefined,
      () => {
        /* fallback: keep plain color */
      },
    );
    return () => {
      disposed = true;
      texRef.current?.dispose();
      texRef.current = null;
    };
  }, [center.latitude, center.longitude]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
      <planeGeometry args={[coverage, coverage]} />
      {texture ? (
        <meshStandardMaterial map={texture} roughness={0.82} metalness={0.0} />
      ) : (
        <meshStandardMaterial color="#111e2d" roughness={0.9} metalness={0.05} />
      )}
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Parcel Boundary — glowing lime outline + translucent fill
// ---------------------------------------------------------------------------

function ParcelBoundary({
  boundary,
  centerLon,
  centerLat,
}: {
  boundary: Polygon;
  centerLon: number;
  centerLat: number;
}) {
  const { shape, linePoints } = useMemo(() => {
    const ring = boundary.coordinates[0];
    if (!ring || ring.length < 3) return { shape: null, linePoints: [] };

    const s = new THREE.Shape();
    const [sx, sz] = geoToLocal(ring[0][0], ring[0][1], centerLon, centerLat);
    s.moveTo(sx, -sz);
    for (let i = 1; i < ring.length; i++) {
      const [px, pz] = geoToLocal(ring[i][0], ring[i][1], centerLon, centerLat);
      s.lineTo(px, -pz);
    }
    s.closePath();

    const lp = ring.map(([lon, lat]) => {
      const [x, z] = geoToLocal(lon, lat, centerLon, centerLat);
      return new THREE.Vector3(x, 0.2, z);
    });

    return { shape: s, linePoints: lp };
  }, [boundary, centerLon, centerLat]);

  if (!shape) return null;

  return (
    <group>
      {/* Translucent fill */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} receiveShadow>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color="#bef264"
          transparent
          opacity={0.12}
          roughness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Bright outline */}
      {linePoints.length > 2 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array(linePoints.flatMap((p) => [p.x, p.y, p.z])),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#bef264" transparent opacity={0.9} linewidth={1} />
        </line>
      )}
      {/* Glow ring (slightly larger, more transparent) */}
      {linePoints.length > 2 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array(
                  linePoints.flatMap((p) => [p.x, 0.12, p.z]),
                ),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#d9f99d" transparent opacity={0.35} linewidth={1} />
        </line>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Building Mass — floor slabs + glass walls + edge outlines
// ---------------------------------------------------------------------------

const SLAB_THICKNESS = 0.22;
const SLAB_OVERHANG = 0.35;
const FLOOR_GAP = 0.06;

function AnalysisMass({
  scenario,
  areaSqm,
}: {
  scenario: DevelopmentScenario;
  areaSqm: number;
}) {
  const baseSide = Math.sqrt(areaSqm * (scenario.buildingCoverageRatio / 100));
  const nFloors = scenario.floors.length;

  const floorColors = useMemo(() => {
    return scenario.floors.map((_, i) => {
      const t = i / Math.max(1, nFloors - 1);
      return new THREE.Color().lerpColors(
        new THREE.Color('#7dd3fc'),
        new THREE.Color('#e0f7ff'),
        t,
      );
    });
  }, [scenario.floors, nFloors]);

  const totalHeight = scenario.floors.reduce(
    (s, f) => s + f.heightM + FLOOR_GAP,
    0,
  );

  const lastFloor = scenario.floors[nFloors - 1];
  const roofW =
    baseSide * (lastFloor?.footprintScale ?? 1) + SLAB_OVERHANG;
  const roofD =
    baseSide * 0.85 * (lastFloor?.footprintScale ?? 1) + SLAB_OVERHANG;

  return (
    <group>
      {scenario.floors.map((floor, i) => {
        const w = baseSide * floor.footprintScale;
        const d = baseSide * 0.85 * floor.footprintScale;
        const h = floor.heightM;
        const yBase = scenario.floors
          .slice(0, i)
          .reduce((s, f) => s + f.heightM + FLOOR_GAP, 0);
        const glassH = h - SLAB_THICKNESS;
        const glassY = yBase + SLAB_THICKNESS + glassH / 2;

        return (
          <group key={floor.floor}>
            {/* Concrete floor slab */}
            <mesh
              position={[0, yBase + SLAB_THICKNESS / 2, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry
                args={[w + SLAB_OVERHANG, SLAB_THICKNESS, d + SLAB_OVERHANG]}
              />
              <meshStandardMaterial
                color="#cce8f4"
                roughness={0.4}
                metalness={0.12}
              />
            </mesh>
            {/* Slab edge outline */}
            <lineSegments position={[0, yBase + SLAB_THICKNESS / 2, 0]}>
              <edgesGeometry
                args={[
                  new THREE.BoxGeometry(
                    w + SLAB_OVERHANG,
                    SLAB_THICKNESS,
                    d + SLAB_OVERHANG,
                  ),
                ]}
              />
              <lineBasicMaterial
                color="#67e8f9"
                transparent
                opacity={0.25}
              />
            </lineSegments>

            {/* Glass curtain wall */}
            <mesh position={[0, glassY, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, glassH, d]} />
              <meshPhysicalMaterial
                color={floorColors[i]}
                transparent
                opacity={0.48}
                roughness={0.06}
                metalness={0.2}
                transmission={0.15}
                emissive="#0e7490"
                emissiveIntensity={0.08}
              />
            </mesh>
            {/* Glass edge outline */}
            <lineSegments position={[0, glassY, 0]}>
              <edgesGeometry
                args={[new THREE.BoxGeometry(w, glassH, d)]}
              />
              <lineBasicMaterial
                color="#22d3ee"
                transparent
                opacity={0.4}
              />
            </lineSegments>

            {/* Floor number label (right side) */}
            <Text
              position={[w / 2 + 1.5, glassY, 0]}
              fontSize={0.9}
              color="#94a3b8"
              anchorX="left"
              anchorY="middle"
            >
              {floor.floor}F
            </Text>
          </group>
        );
      })}

      {/* Roof slab */}
      <mesh position={[0, totalHeight - FLOOR_GAP + SLAB_THICKNESS / 2, 0]} castShadow>
        <boxGeometry args={[roofW, SLAB_THICKNESS * 0.7, roofD]} />
        <meshStandardMaterial color="#a5d8ec" roughness={0.3} metalness={0.15} />
      </mesh>

      {/* Building name label */}
      <Text
        position={[0, totalHeight + 2.5, 0]}
        fontSize={1.6}
        color="#bef264"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.06}
        outlineColor="#1a2e05"
      >
        {scenario.name}
      </Text>
      {/* Dimensions label */}
      <Text
        position={[0, totalHeight + 0.8, 0]}
        fontSize={0.9}
        color="#67e8f9"
        anchorX="center"
        anchorY="bottom"
      >
        {nFloors}F · {Math.round(totalHeight - FLOOR_GAP)}m · {scenario.floorAreaRatio}%
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Context Buildings — boxes with edge outlines and height-based color
// ---------------------------------------------------------------------------

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
      const points = ring.map(([lon, lat]) =>
        geoToLocal(lon, lat, centerLon, centerLat),
      );
      const xs = points.map(([x]) => x);
      const zs = points.map(([, z]) => z);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      const w = Math.max(3, Math.max(...xs) - Math.min(...xs));
      const d = Math.max(3, Math.max(...zs) - Math.min(...zs));
      const h = Math.max(3, b.heightM.value ?? 9);
      return { cx, cz, w, d, h, id: b.id };
    });
  }, [buildings, centerLon, centerLat]);

  return (
    <group>
      {meshes.map((m) => {
        const t = Math.min(1, m.h / 35);
        const baseColor = new THREE.Color().lerpColors(
          new THREE.Color('#263e58'),
          new THREE.Color('#3d6080'),
          t,
        );
        return (
          <group key={m.id}>
            <mesh
              position={[m.cx, m.h / 2, m.cz]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[m.w, m.h, m.d]} />
              <meshStandardMaterial
                color={baseColor}
                emissive="#0c1a2e"
                emissiveIntensity={0.15}
                roughness={0.72}
                metalness={0.08}
              />
            </mesh>
            {/* Edge outline */}
            <lineSegments position={[m.cx, m.h / 2, m.cz]}>
              <edgesGeometry
                args={[new THREE.BoxGeometry(m.w, m.h, m.d)]}
              />
              <lineBasicMaterial
                color="#4a7ca0"
                transparent
                opacity={0.28}
              />
            </lineSegments>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Procedural surroundings — used when no context buildings from API
// ---------------------------------------------------------------------------

function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ProceduralContext({ areaSqm, seed }: { areaSqm: number; seed: number }) {
  const meshes = useMemo(() => {
    const rng = mulberry32(seed);
    const parcelSide = Math.sqrt(areaSqm);
    const result: { x: number; z: number; w: number; d: number; h: number }[] = [];

    for (let i = 0; i < 30; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = parcelSide * 0.8 + rng() * parcelSide * 2.5;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      if (Math.abs(x) < parcelSide * 0.6 && Math.abs(z) < parcelSide * 0.6) continue;
      const w = 8 + rng() * 16;
      const d = 8 + rng() * 12;
      const h = 4 + rng() * 25;
      result.push({ x, z, w, d, h });
    }
    return result;
  }, [areaSqm, seed]);

  return (
    <group>
      {meshes.map((m, i) => (
        <group key={i}>
          <mesh position={[m.x, m.h / 2, m.z]} castShadow receiveShadow>
            <boxGeometry args={[m.w, m.h, m.d]} />
            <meshStandardMaterial
              color="#3a5570"
              emissive="#142838"
              emissiveIntensity={0.18}
              roughness={0.68}
              metalness={0.08}
            />
          </mesh>
          <lineSegments position={[m.x, m.h / 2, m.z]}>
            <edgesGeometry args={[new THREE.BoxGeometry(m.w, m.h, m.d)]} />
            <lineBasicMaterial color="#5a8aaa" transparent opacity={0.35} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Main Scene Content
// ---------------------------------------------------------------------------

function AnalysisSceneContent({
  center,
  boundary,
  areaSqm,
  scenario,
  context,
}: Omit<AnalysisSceneProps, 'address'>) {
  const coverage = useMemo(
    () => computeGroundCoverage(center.latitude),
    [center.latitude],
  );
  const gridSize = Math.max(coverage, Math.sqrt(areaSqm) * 5);
  const hasContext = context && context.length > 0;
  const seed = useMemo(
    () => Math.round(center.latitude * 10000 + center.longitude * 10000),
    [center.latitude, center.longitude],
  );

  return (
    <>
      <color attach="background" args={['#060e18']} />
      <fog attach="fog" args={['#060e18', gridSize * 0.6, gridSize * 1.4]} />

      {/* Lighting */}
      <ambientLight intensity={1.2} />
      <hemisphereLight args={['#c0e0f8', '#0a1520', 1.1]} />
      <directionalLight
        position={[gridSize * 0.25, gridSize * 0.45, gridSize * 0.2]}
        intensity={3.5}
        color="#d4f0ff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-gridSize * 0.3}
        shadow-camera-right={gridSize * 0.3}
        shadow-camera-top={gridSize * 0.3}
        shadow-camera-bottom={-gridSize * 0.3}
      />
      <pointLight
        position={[-25, 18, -20]}
        intensity={45}
        distance={70}
        color="#22d3ee"
      />
      <pointLight
        position={[20, 12, 25]}
        intensity={25}
        distance={50}
        color="#bef264"
      />

      {/* Dark base ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[gridSize * 1.5, gridSize * 1.5]} />
        <meshStandardMaterial color="#0a1a2a" roughness={0.95} metalness={0.02} />
      </mesh>

      {/* Satellite ground texture (on top) */}
      <SatelliteGround center={center} coverage={coverage} />

      {/* Parcel boundary */}
      {boundary.value && (
        <ParcelBoundary
          boundary={boundary.value}
          centerLon={center.longitude}
          centerLat={center.latitude}
        />
      )}

      {/* Development mass */}
      <AnalysisMass scenario={scenario} areaSqm={areaSqm} />

      {/* Context buildings */}
      {hasContext ? (
        <ContextMeshes
          buildings={context}
          centerLon={center.longitude}
          centerLat={center.latitude}
        />
      ) : (
        <ProceduralContext areaSqm={areaSqm} seed={seed} />
      )}

      {/* Reference grid */}
      <Grid
        position={[0, 0.03, 0]}
        args={[gridSize, gridSize]}
        cellSize={2}
        cellThickness={0.25}
        cellColor="#0e3a50"
        sectionSize={10}
        sectionThickness={0.45}
        sectionColor="#0c6380"
        fadeDistance={gridSize * 0.5}
        fadeStrength={1.4}
        infiniteGrid
      />

      <Environment preset="city" />

      <OrbitControls
        target={[
          0,
          scenario.floors.reduce((s, f) => s + f.heightM, 0) / 3,
          0,
        ]}
        enablePan
        minDistance={Math.max(15, Math.sqrt(areaSqm) * 0.7)}
        maxDistance={coverage * 0.45}
        minPolarAngle={0.25}
        maxPolarAngle={1.45}
        autoRotate
        autoRotateSpeed={0.1}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported Component
// ---------------------------------------------------------------------------

export function AnalysisScene(props: AnalysisSceneProps) {
  const camDist = Math.max(45, Math.sqrt(props.areaSqm) * 2.8);

  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-[inherit]"
      aria-label={`${props.address} 분석 3D 씬`}
    >
      <Canvas
        shadows
        camera={{
          position: [camDist * 0.55, camDist * 0.6, camDist * 0.6],
          fov: 42,
        }}
        dpr={[1, 1.8]}
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_42%,rgba(3,7,18,.3)_100%)]" />
    </div>
  );
}
