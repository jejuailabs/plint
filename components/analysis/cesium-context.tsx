'use client';

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  MapPinned,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { VWorldContext } from './vworld-context';
import { labeledSnapshot } from '@/lib/report/capture';
import type {
  DevelopmentScenario,
  Polygon,
  ContextBuilding,
} from '@/lib/domain/parcel-intelligence';

export type CesiumContextProps = {
  address: string;
  center: { latitude: number; longitude: number };
  areaSqm?: number;
  scenario: DevelopmentScenario;
  glbDataUrl?: string | null;
  boundary?: Polygon | null;
  context?: ContextBuilding[];
  onCaptureReady?: (capture: () => Promise<string>) => void;
};

const CESIUM_VERSION = '1.121.1';
const CESIUM_CDN = `https://cdnjs.cloudflare.com/ajax/libs/cesium/${CESIUM_VERSION}`;

let cesiumPromise: Promise<typeof import('cesium')> | null = null;

function loadCesiumFromCDN(): Promise<typeof import('cesium')> {
  if (cesiumPromise) return cesiumPromise;
  cesiumPromise = new Promise((resolve, reject) => {
    if (
      (
        window as Window & {
          Cesium?: typeof import('cesium');
          CESIUM_BASE_URL?: string;
        }
      ).Cesium
    ) {
      resolve(
        (
          window as Window & {
            Cesium?: typeof import('cesium');
            CESIUM_BASE_URL?: string;
          }
        ).Cesium!,
      );
      return;
    }

    (
      window as Window & {
        Cesium?: typeof import('cesium');
        CESIUM_BASE_URL?: string;
      }
    ).CESIUM_BASE_URL = `${CESIUM_CDN}/`;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${CESIUM_CDN}/Widgets/widgets.min.css`;
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = `${CESIUM_CDN}/Cesium.js`;
    script.onload = () => {
      if (
        (
          window as Window & {
            Cesium?: typeof import('cesium');
            CESIUM_BASE_URL?: string;
          }
        ).Cesium
      ) {
        resolve(
          (
            window as Window & {
              Cesium?: typeof import('cesium');
              CESIUM_BASE_URL?: string;
            }
          ).Cesium!,
        );
      } else {
        reject(new Error('Cesium global not found after script load'));
      }
    };
    script.onerror = () => {
      cesiumPromise = null;
      reject(new Error('Failed to load Cesium CDN'));
    };
    document.head.appendChild(script);
  });
  return cesiumPromise;
}

function CesiumFallback({
  address,
  center,
  areaSqm,
  scenario,
  glbDataUrl,
  boundary,
  context,
  onCaptureReady,
}: CesiumContextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import('cesium').Viewer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [errorMsg, setErrorMsg] = useState('');

  const orbitCamera = useCallback(
    (deltaHeading: number, deltaPitch: number, deltaZoom: number) => {
      const v = viewerRef.current;
      if (!v || v.isDestroyed()) return;
      const cam = v.camera;
      if (deltaHeading)
        cam.setView({
          orientation: {
            heading: cam.heading + deltaHeading,
            pitch: cam.pitch,
            roll: cam.roll,
          },
        });
      if (deltaPitch)
        cam.setView({
          orientation: {
            heading: cam.heading,
            pitch: Math.max(
              -Math.PI / 2,
              Math.min(-0.05, cam.pitch + deltaPitch),
            ),
            roll: cam.roll,
          },
        });
      if (deltaZoom > 0) cam.moveForward(deltaZoom);
      if (deltaZoom < 0) cam.moveBackward(-deltaZoom);
      v.scene.requestRender();
    },
    [],
  );

  const isValidKoreaCoord =
    center.latitude >= 33 &&
    center.latitude <= 39 &&
    center.longitude >= 124 &&
    center.longitude <= 132;

  useEffect(() => {
    let disposed = false;
    let viewer: import('cesium').Viewer;

    async function initialize() {
      try {
        if (!containerRef.current || !isValidKoreaCoord) {
          if (!isValidKoreaCoord) setStatus('error');
          return;
        }

        const Cesium = await loadCesiumFromCDN();
        if (disposed || !containerRef.current) return;

        const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        const hasIon = !!ionToken;

        if (hasIon) {
          Cesium.Ion.defaultAccessToken = ionToken;
        }

        const viewerOptions: import('cesium').Viewer.ConstructorOptions = {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          navigationHelpButton: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          requestRenderMode: true,
          contextOptions: { webgl: { preserveDrawingBuffer: true } },
          maximumRenderTimeChange: Infinity,
        };

        const coverage =
          (800 * 156543.03 * Math.cos((center.latitude * Math.PI) / 180)) /
          2 ** 18;
        const latOffset = coverage / 2 / 111320,
          lonOffset = latOffset / Math.cos((center.latitude * Math.PI) / 180);
        viewerOptions.baseLayer = new Cesium.ImageryLayer(
          await Cesium.SingleTileImageryProvider.fromUrl(
            `/api/map/static?lat=${center.latitude}&lon=${center.longitude}&zoom=18&w=800&h=800&basemap=SATELLITE`,
            {
              rectangle: Cesium.Rectangle.fromDegrees(
                center.longitude - lonOffset,
                center.latitude - latOffset,
                center.longitude + lonOffset,
                center.latitude + latOffset,
              ),
              credit: '공간정보 오픈플랫폼 VWorld',
            },
          ),
        );
        viewerOptions.terrainProvider = hasIon
          ? await Cesium.createWorldTerrainAsync().catch(
              () => new Cesium.EllipsoidTerrainProvider(),
            )
          : new Cesium.EllipsoidTerrainProvider();

        viewer = new Cesium.Viewer(containerRef.current, viewerOptions);
        viewerRef.current = viewer;
        // The fallback uses one calibrated VWorld image. Keep the camera inside
        // that image's useful footprint so zooming out cannot stretch it across
        // the globe and produce raster seams.
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 35;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = hasIon
          ? 850
          : 1_000;

        const heightM = Math.max(
          10,
          scenario.floors.reduce(
            (t: number, f: { heightM: number }) => t + f.heightM,
            0,
          ),
        );
        if (boundary)
          viewer.entities.add({
            name: '대상 필지',
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(
                boundary.coordinates[0].flat(),
              ),
              material: Cesium.Color.LIME.withAlpha(0.15),
              outline: true,
              outlineColor: Cesium.Color.LIME,
            },
          });
        const placement = scenario.massing;
        let groundElevation = 0;
        if (placement && viewerOptions.terrainProvider.availability) {
          try {
            const points = await Cesium.sampleTerrainMostDetailed(
              viewerOptions.terrainProvider,
              [
                Cesium.Cartographic.fromDegrees(
                  placement.center.longitude,
                  placement.center.latitude,
                ),
              ],
            );
            groundElevation = points[0]?.height ?? 0;
          } catch {
            /* Ellipsoid reference remains explicitly preliminary. */
          }
        }
        let yAccum = 0;
        if (placement)
          for (let i = 0; i < scenario.floors.length; i++) {
            const floor = scenario.floors[i];
            const scale = Math.sqrt(
              (placement.floorAreasSqm[i] ?? 0) /
                (placement.widthM * placement.depthM),
            );
            if (scale <= 0) continue;
            const coords = placement.footprint.coordinates[0]
              .map(([lon, lat]) => [
                placement.center.longitude +
                  (lon - placement.center.longitude) * scale,
                placement.center.latitude +
                  (lat - placement.center.latitude) * scale,
              ])
              .flat();
            viewer.entities.add({
              name: `${floor.floor}F`,
              polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(coords),
                height: groundElevation + yAccum,
                extrudedHeight: groundElevation + yAccum + floor.heightM,
                material:
                  Cesium.Color.fromCssColorString('#bff7ff').withAlpha(0.85),
                outline: true,
                outlineColor: Cesium.Color.CYAN,
              },
            });
            yAccum += floor.heightM;
          }

        for (const building of context ?? []) {
          const outer = building.footprint.coordinates[0];
          viewer.entities.add({
            name: '현황 건물 · 높이 추정 포함',
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(
                Cesium.Cartesian3.fromDegreesArray(outer.flat()),
                building.footprint.coordinates
                  .slice(1)
                  .map(
                    (r) =>
                      new Cesium.PolygonHierarchy(
                        Cesium.Cartesian3.fromDegreesArray(r.flat()),
                      ),
                  ),
              ),
              height: groundElevation,
              extrudedHeight: groundElevation + (building.heightM.value ?? 9),
              material:
                Cesium.Color.fromCssColorString('#668ca8').withAlpha(0.8),
            },
          });
        }
        // Top label marker
        viewer.entities.add({
          name: address,
          position: Cesium.Cartesian3.fromDegrees(
            center.longitude,
            center.latitude,
            yAccum + 6,
          ),
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString('#bef264'),
            outlineColor: Cesium.Color.fromCssColorString('#060e18'),
            outlineWidth: 2,
            heightReference: hasIon
              ? Cesium.HeightReference.RELATIVE_TO_GROUND
              : undefined,
          },
          label: {
            text: `${scenario.name}\n${scenario.floors.length}F · ${Math.round(heightM)}m`,
            font: '13px sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#bef264'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            heightReference: hasIon
              ? Cesium.HeightReference.RELATIVE_TO_GROUND
              : undefined,
          },
        });

        // Keep the georeferenced analytic mass; standalone GLB files may include their own context/origin.
        // Camera — offset south-east so the target area is centered in view
        const camOffsetM = 120;
        const camLatOff = camOffsetM / 111_320;
        const camLonOff =
          camOffsetM / (111_320 * Math.cos((center.latitude * Math.PI) / 180));
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            center.longitude + camLonOff,
            center.latitude - camLatOff,
            hasIon ? 200 : 620,
          ),
          orientation: {
            heading: Cesium.Math.toRadians(330),
            pitch: Cesium.Math.toRadians(hasIon ? -40 : -50),
            roll: 0,
          },
          duration: 0,
        });
        viewer.scene.requestRender();
        if (!disposed) {
          setStatus('ready');
          onCaptureReady?.(async () => {
            const started = Date.now();
            while (
              !viewer.scene.globe.tilesLoaded &&
              Date.now() - started < 15000
            ) {
              if (disposed) throw new Error('지도 화면이 닫혔습니다.');
              viewer.scene.requestRender();
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
            if (!viewer.scene.globe.tilesLoaded)
              throw new Error(
                '지도 영상 로딩이 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.',
              );
            viewer.render();
            const credits =
              viewer.cesiumWidget.creditDisplay.container.textContent ??
              'Cesium / OpenStreetMap contributors';
            return labeledSnapshot(
              viewer.scene.canvas,
              `${address} · ${scenario.name} · 지리 맥락/규제 미검증 · ${credits}`,
            );
          });
        }
      } catch (error) {
        console.error('Cesium init failed:', error);
        if (!disposed) {
          setErrorMsg(
            error instanceof Error ? error.message : '알 수 없는 오류',
          );
          setStatus('error');
        }
      }
    }

    void initialize();
    return () => {
      disposed = true;
      viewerRef.current = null;
      try {
        if (viewer && !viewer.isDestroyed()) viewer.destroy();
      } catch {
        /* noop */
      }
    };
  }, [
    address,
    areaSqm,
    center.latitude,
    center.longitude,
    glbDataUrl,
    isValidKoreaCoord,
    scenario,
    boundary,
    context,
    onCaptureReady,
  ]);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit] bg-[#060e18]">
      <div ref={containerRef} className="cesium-context absolute inset-0" />
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center bg-[#060e18]">
          <div className="text-center">
            <LoaderCircle className="mx-auto size-7 animate-spin text-cyan-300" />
            <p className="mt-3 text-xs text-slate-300">
              도시 공간을 불러오는 중
            </p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center bg-[#060e18] p-6 text-center">
          <div>
            <AlertTriangle className="mx-auto size-7 text-amber-300" />
            <p className="mt-3 text-sm text-slate-200">
              {isValidKoreaCoord
                ? '도시 컨텍스트를 불러오지 못했습니다.'
                : '좌표 정보를 확인할 수 없습니다.'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {isValidKoreaCoord
                ? errorMsg || '네트워크 또는 WebGL 상태를 확인해 주세요.'
                : '주소의 좌표 데이터가 제공되지 않아 지도를 표시할 수 없습니다.'}
            </p>
          </div>
        </div>
      )}
      {status === 'ready' && (
        <div className="absolute right-3 top-1/2 z-[100] flex -translate-y-1/2 flex-col gap-1 pointer-events-auto">
          {[
            {
              icon: <RotateCcw className="size-3.5" />,
              label: '좌회전',
              delta: [-0.15, 0, 0],
            },
            {
              icon: <RotateCw className="size-3.5" />,
              label: '우회전',
              delta: [0.15, 0, 0],
            },
            {
              icon: <ChevronUp className="size-3.5" />,
              label: '위로',
              delta: [0, 0.1, 0],
            },
            {
              icon: <ChevronDown className="size-3.5" />,
              label: '아래로',
              delta: [0, -0.1, 0],
            },
            {
              icon: <Plus className="size-3.5" />,
              label: '확대',
              delta: [0, 0, 50],
            },
            {
              icon: <Minus className="size-3.5" />,
              label: '축소',
              delta: [0, 0, -50],
            },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={() =>
                orbitCamera(btn.delta[0], btn.delta[1], btn.delta[2])
              }
              title={btn.label}
              className="grid size-8 place-items-center rounded-lg border border-slate-600/40 bg-slate-900/80 text-slate-300 backdrop-blur transition-colors hover:bg-slate-700/80 hover:text-white"
            >
              {btn.icon}
            </button>
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-5 right-5 flex items-center gap-2 rounded-lg border border-cyan-300/15 bg-slate-950/75 px-3 py-2 font-mono text-[9px] uppercase tracking-[.16em] text-cyan-100/80 backdrop-blur">
        <MapPinned className="size-3 text-cyan-300" />
        VWorld 영상 · Cesium · 지형 높이 확인 필요
      </div>
    </div>
  );
}

export function CesiumContext(props: CesiumContextProps) {
  const [provider, setProvider] = useState<'vworld' | 'cesium'>('vworld');
  return (
    <div className="absolute inset-0">
      {provider === 'vworld' ? (
        <VWorldContext {...props} />
      ) : (
        <CesiumFallback {...props} />
      )}
      <div className="absolute left-3 top-16 z-20 flex gap-1 rounded bg-slate-950/90 p-1 text-xs text-white">
        <button
          onClick={() => setProvider('vworld')}
          className={
            provider === 'vworld'
              ? 'rounded bg-cyan-700 px-2 py-1'
              : 'px-2 py-1'
          }
        >
          VWorld 3D
        </button>
        <button
          onClick={() => setProvider('cesium')}
          className={
            provider === 'cesium'
              ? 'rounded bg-cyan-700 px-2 py-1'
              : 'px-2 py-1'
          }
        >
          Cesium 대체 지도
        </button>
      </div>
    </div>
  );
}
