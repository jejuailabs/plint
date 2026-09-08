'use client';

import { Environment, Grid, OrbitControls, Text } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { labeledSnapshot } from '@/lib/report/capture';
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
  onCaptureReady?: (capture: () => Promise<string>) => void;
  onGroundStatus?: (status: 'ready' | 'error') => void;
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
  const mpp =
    (156543.03 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, SAT_ZOOM);
  return SAT_PX * mpp;
}

function SatelliteGround({
  center,
  coverage,
  onStatus,
}: {
  center: { latitude: number; longitude: number };
  coverage: number;
  onStatus?: (status: 'ready' | 'error') => void;
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
        onStatus?.('ready');
      },
      undefined,
      () => {
        if (!disposed) onStatus?.('error');
      },
    );
    return () => {
      disposed = true;
      texRef.current?.dispose();
      texRef.current = null;
    };
  }, [center.latitude, center.longitude, onStatus]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
      <planeGeometry args={[coverage, coverage]} />
      {texture ? (
        <meshBasicMaterial key="satellite" map={texture} toneMapped={false} />
      ) : (
        <meshStandardMaterial
          key="placeholder"
          color="#111e2d"
          roughness={0.9}
          metalness={0.05}
        />
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
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.08, 0]}
        receiveShadow
      >
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
          <lineBasicMaterial
            color="#bef264"
            transparent
            opacity={0.9}
            linewidth={1}
          />
        </line>
      )}
      {/* Glow ring (slightly larger, more transparent) */}
      {linePoints.length > 2 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array(linePoints.flatMap((p) => [p.x, 0.12, p.z])),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#d9f99d"
            transparent
            opacity={0.35}
            linewidth={1}
          />
        </line>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Building Mass — floor slabs + glass walls + edge outlines
// ---------------------------------------------------------------------------

const SLAB_THICKNESS = 0.22;
const SLAB_OVERHANG = 0;
const FLOOR_GAP = 0.06;

function AnalysisMass({
  scenario,
  areaSqm,
}: {
  scenario: DevelopmentScenario;
  areaSqm: number;
}) {
  const baseSide =
    scenario.massing?.widthM ??
    Math.sqrt((areaSqm * (scenario.buildingCoverageRatio / 100)) / 0.85);
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
  const roofScale = scenario.massing
    ? Math.sqrt(
        (scenario.massing.floorAreasSqm[nFloors - 1] ?? 0) /
          (scenario.massing.widthM * scenario.massing.depthM),
      )
    : (lastFloor?.footprintScale ?? 1);
  const roofW = baseSide * roofScale;
  const roofD = (scenario.massing?.depthM ?? baseSide * 0.85) * roofScale;

  return (
    <group>
      {scenario.floors.map((floor, i) => {
        const scale = scenario.massing
          ? Math.sqrt(
              (scenario.massing.floorAreasSqm[i] ?? 0) /
                (scenario.massing.widthM * scenario.massing.depthM),
            )
          : floor.footprintScale;
        const w = baseSide * scale;
        const d = (scenario.massing?.depthM ?? baseSide * 0.85) * scale;
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
              <lineBasicMaterial color="#67e8f9" transparent opacity={0.25} />
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
              <edgesGeometry args={[new THREE.BoxGeometry(w, glassH, d)]} />
              <lineBasicMaterial color="#22d3ee" transparent opacity={0.4} />
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
      <mesh
        position={[0, totalHeight - FLOOR_GAP + SLAB_THICKNESS / 2, 0]}
        castShadow
      >
        <boxGeometry args={[roofW, SLAB_THICKNESS * 0.7, roofD]} />
        <meshStandardMaterial
          color="#a5d8ec"
          roughness={0.3}
          metalness={0.15}
        />
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
        {nFloors}F · {Math.round(totalHeight - FLOOR_GAP)}m ·{' '}
        {scenario.floorAreaRatio}%
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
  const meshes = useMemo(
    () =>
      buildings.flatMap((b) => {
        if (!b.footprint.coordinates[0]?.length) return [];
        const rings = b.footprint.coordinates.map((r) =>
          r.map(([lon, lat]) => {
            const [x, z] = geoToLocal(lon, lat, centerLon, centerLat);
            return new THREE.Vector2(x, -z);
          }),
        );
        const shape = new THREE.Shape(rings[0]);
        rings.slice(1).forEach((r) => shape.holes.push(new THREE.Path(r)));
        return [{ id: b.id, shape, height: Math.max(3, b.heightM.value ?? 9) }];
      }),
    [buildings, centerLon, centerLat],
  );
  return (
    <group>
      {meshes.map((m) => (
        <mesh
          key={m.id}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        >
          <extrudeGeometry
            args={[m.shape, { depth: m.height, bevelEnabled: false }]}
          />
          <meshStandardMaterial color="#3a5570" roughness={0.8} />
        </mesh>
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
  onGroundStatus,
}: Omit<AnalysisSceneProps, 'address'>) {
  const coverage = useMemo(
    () => computeGroundCoverage(center.latitude),
    [center.latitude],
  );
  const gridSize = Math.max(coverage, Math.sqrt(areaSqm) * 5);
  const hasContext = context && context.length > 0;

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
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        receiveShadow
      >
        <planeGeometry args={[gridSize * 1.5, gridSize * 1.5]} />
        <meshStandardMaterial
          color="#0a1a2a"
          roughness={0.95}
          metalness={0.02}
        />
      </mesh>

      {/* Satellite ground texture (on top) */}
      <SatelliteGround
        center={center}
        coverage={coverage}
        onStatus={onGroundStatus}
      />

      {/* Parcel boundary */}
      {boundary.value && (
        <ParcelBoundary
          boundary={boundary.value}
          centerLon={center.longitude}
          centerLat={center.latitude}
        />
      )}

      {/* Development mass */}
      {scenario.massing && (
        <group
          position={
            scenario.massing
              ? ([
                  ...geoToLocal(
                    scenario.massing.center.longitude,
                    scenario.massing.center.latitude,
                    center.longitude,
                    center.latitude,
                  ).slice(0, 1),
                  0,
                  geoToLocal(
                    scenario.massing.center.longitude,
                    scenario.massing.center.latitude,
                    center.longitude,
                    center.latitude,
                  )[1],
                ] as [number, number, number])
              : [0, 0, 0]
          }
          rotation={[0, scenario.massing?.rotationRad ?? 0, 0]}
        >
          <AnalysisMass scenario={scenario} areaSqm={areaSqm} />
        </group>
      )}

      {/* Context buildings */}
      {hasContext ? (
        <ContextMeshes
          buildings={context}
          centerLon={center.longitude}
          centerLat={center.latitude}
        />
      ) : null}

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
        target={[0, scenario.floors.reduce((s, f) => s + f.heightM, 0) / 3, 0]}
        enablePan
        minDistance={Math.max(15, Math.sqrt(areaSqm) * 0.7)}
        maxDistance={coverage * 0.45}
        minPolarAngle={0.001}
        maxPolarAngle={1.45}
        autoRotateSpeed={0.1}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported Component
// ---------------------------------------------------------------------------

function CaptureScene({
  onReady,
}: {
  onReady?: (capture: () => Promise<string>) => void;
}) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    onReady?.(async () => {
      gl.render(scene, camera);
      return labeledSnapshot(
        gl.domElement,
        'PLINT 배치 매스 · VWorld 배경(연결 시) · 실제 경계 내 기하학적 배치, 높이·이격·주차 규제 미검증 · 위쪽이 북쪽인 평면 좌표계',
      );
    });
  }, [gl, scene, camera, onReady]);
  return null;
}

function ViewCamera({
  view,
  distance,
}: {
  view: 'perspective' | 'plan';
  distance: number;
}) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(
      ...((view === 'plan'
        ? [0, distance, 0.01]
        : [distance * 0.55, distance * 0.6, distance * 0.6]) as [
        number,
        number,
        number,
      ]),
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [view, distance, camera]);
  return null;
}

export function AnalysisScene(props: AnalysisSceneProps) {
  const [view, setView] = useState<'perspective' | 'plan'>('perspective');
  const [groundStatus, setGroundStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const camDist = Math.max(45, Math.sqrt(props.areaSqm) * 2.8);
  if (
    props.center.latitude < 33 ||
    props.center.latitude > 39 ||
    props.center.longitude < 124 ||
    props.center.longitude > 132
  )
    return (
      <p className="p-6">
        실제 좌표를 확인하지 못해 현장 매스를 표시할 수 없습니다.
      </p>
    );

  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-[inherit]"
      aria-label={`${props.address} 분석 3D 씬`}
    >
      <div className="pointer-events-none absolute bottom-24 left-4 z-10 max-w-sm rounded-lg bg-black/70 px-3 py-2 text-xs text-white">
        {groundStatus === 'error' && <p>위성영상 조회 실패 · 단색 배경</p>}
        <p>10m 격자 · 평탄한 지면 기준 · 규제 미검증 배치안</p>
        {props.scenario.massing && (
          <p>
            배치 {props.scenario.massing.widthM.toFixed(1)}×
            {props.scenario.massing.depthM.toFixed(1)}m ·{' '}
            {props.scenario.floors.length}층 ·{' '}
            {props.scenario.floors
              .reduce((a, f) => a + f.heightM, 0)
              .toFixed(1)}
            m
          </p>
        )}
        {!props.scenario.massing && (
          <p>경계 내 배치 계산 불가 · 제안 매스 미표시</p>
        )}
        <p>
          {props.context?.length
            ? `등록 주변건물 ${props.context.length}동 · 높이는 추정 포함`
            : '주변 건물 자료 0건 또는 조회 불가 · 임의 건물을 만들지 않습니다.'}
        </p>
        {!props.boundary.value && (
          <p>경계 미확인 · 위치·배치 판단에 사용하지 마세요.</p>
        )}
      </div>
      <div className="absolute left-3 top-16 z-10 flex gap-1 rounded bg-slate-950/85 p-1 text-xs text-white">
        <button
          onClick={() => setView('perspective')}
          className="rounded px-3 py-1"
        >
          사시도
        </button>
        <button onClick={() => setView('plan')} className="rounded px-3 py-1">
          배치 평면 · 북쪽 ↑
        </button>
      </div>
      <Canvas
        gl={{ preserveDrawingBuffer: true }}
        shadows
        camera={{
          position: [camDist * 0.55, camDist * 0.6, camDist * 0.6],
          fov: 42,
        }}
        dpr={[1, 1.8]}
      >
        <ViewCamera view={view} distance={camDist} />
        <Suspense fallback={null}>
          {groundStatus !== 'loading' && (
            <CaptureScene onReady={props.onCaptureReady} />
          )}
          <AnalysisSceneContent
            onGroundStatus={setGroundStatus}
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
