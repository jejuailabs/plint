'use client';

import { AlertTriangle, ChevronDown, ChevronUp, LoaderCircle, MapPinned, Minus, Plus, RotateCcw, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { DevelopmentScenario } from '@/lib/domain/parcel-intelligence';

export type CesiumContextProps = {
  address: string;
  center: { latitude: number; longitude: number };
  areaSqm?: number;
  scenario: DevelopmentScenario;
  glbDataUrl?: string | null;
};

const CESIUM_VERSION = '1.121.1';
const CESIUM_CDN = `https://cdnjs.cloudflare.com/ajax/libs/cesium/${CESIUM_VERSION}`;

function parcelRing(longitude: number, latitude: number, areaSqm?: number) {
  const halfSideM = Math.max(12, Math.min(38, Math.sqrt(areaSqm ?? 480) / 2));
  const latOff = halfSideM / 111_320;
  const lonOff =
    halfSideM /
    (111_320 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.2));
  return [
    longitude - lonOff, latitude - latOff,
    longitude + lonOff, latitude - latOff,
    longitude + lonOff, latitude + latOff,
    longitude - lonOff, latitude + latOff,
  ];
}

let cesiumPromise: Promise<typeof import('cesium')> | null = null;

function loadCesiumFromCDN(): Promise<typeof import('cesium')> {
  if (cesiumPromise) return cesiumPromise;
  cesiumPromise = new Promise((resolve, reject) => {
    if ((window as any).Cesium) {
      resolve((window as any).Cesium);
      return;
    }

    (window as any).CESIUM_BASE_URL = `${CESIUM_CDN}/`;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${CESIUM_CDN}/Widgets/widgets.min.css`;
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = `${CESIUM_CDN}/Cesium.js`;
    script.onload = () => {
      if ((window as any).Cesium) {
        resolve((window as any).Cesium);
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

export function CesiumContext({
  address,
  center,
  areaSqm,
  scenario,
  glbDataUrl,
}: CesiumContextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const orbitCamera = useCallback((deltaHeading: number, deltaPitch: number, deltaZoom: number) => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    const cam = v.camera;
    if (deltaHeading) cam.setView({
      orientation: { heading: cam.heading + deltaHeading, pitch: cam.pitch, roll: cam.roll },
    });
    if (deltaPitch) cam.setView({
      orientation: { heading: cam.heading, pitch: Math.max(-Math.PI / 2, Math.min(-0.05, cam.pitch + deltaPitch)), roll: cam.roll },
    });
    if (deltaZoom > 0) cam.moveForward(deltaZoom);
    if (deltaZoom < 0) cam.moveBackward(-deltaZoom);
    v.scene.requestRender();
  }, []);

  const isValidKoreaCoord = center.latitude >= 33 && center.latitude <= 39 && center.longitude >= 124 && center.longitude <= 132;

  useEffect(() => {
    let disposed = false;
    let viewer: any;

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

        const viewerOptions: any = {
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
          maximumRenderTimeChange: Infinity,
        };

        if (!hasIon) {
          viewerOptions.baseLayer = new Cesium.ImageryLayer(
            new Cesium.OpenStreetMapImageryProvider({
              url: 'https://tile.openstreetmap.org/',
            }),
          );
        }
        viewerOptions.terrainProvider = new Cesium.EllipsoidTerrainProvider();

        viewer = new Cesium.Viewer(containerRef.current, viewerOptions);
        viewerRef.current = viewer;

        if (hasIon) {

          // Load 3D building tilesets in background — don't block entity creation
          void (async () => {
            let loaded = false;

            // Attempt 1: Google 3D Tiles via Cesium Ion (asset 2275207)
            try {
              const google3D = await Cesium.Cesium3DTileset.fromIonAssetId(2275207);
              if (!disposed && !viewer.isDestroyed()) {
                viewer.scene.primitives.add(google3D);
                viewer.scene.requestRender();
                loaded = true;
              }
            } catch { /* not available */ }

            // Attempt 2: Google 3D Tiles via direct API key
            if (!loaded && !disposed) {
              const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
              if (googleKey && Cesium.createGooglePhotorealistic3DTileset) {
                try {
                  const google3D = await Cesium.createGooglePhotorealistic3DTileset({ key: googleKey });
                  if (!disposed && !viewer.isDestroyed()) {
                    viewer.scene.primitives.add(google3D);
                    viewer.scene.requestRender();
                    loaded = true;
                  }
                } catch { /* not available */ }
              }
            }

            // Attempt 3: Fall back to OSM 3D Buildings
            if (!loaded && !disposed) {
              try {
                const osmBuildings = await Cesium.Cesium3DTileset.fromIonAssetId(96188);
                if (!disposed && !viewer.isDestroyed()) {
                  viewer.scene.primitives.add(osmBuildings);
                  viewer.scene.requestRender();
                }
              } catch { /* continue without buildings */ }
            }
          })();
        }

        viewer.scene.globe.enableLighting = false;
        viewer.scene.backgroundColor =
          Cesium.Color.fromCssColorString('#060e18');
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = true;
        }
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.00015;
        viewer.scene.globe.depthTestAgainstTerrain = true;

        const heightM = Math.max(
          10,
          scenario.floors.reduce(
            (t: number, f: { heightM: number }) => t + f.heightM,
            0,
          ),
        );
        const sideM = Math.max(
          18,
          Math.min(55, Math.sqrt(areaSqm ?? 480) * 0.88),
        );

        // Parcel boundary — clamp to ground when terrain available
        viewer.entities.add({
          name: '대상 필지',
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(
              parcelRing(center.longitude, center.latitude, areaSqm),
            ),
            material: Cesium.Color.LIME.withAlpha(0.25),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#bef264'),
            heightReference: hasIon ? Cesium.HeightReference.CLAMP_TO_GROUND : undefined,
            classificationType: hasIon ? Cesium.ClassificationType.BOTH : undefined,
          },
        });

        // Per-floor building mass — relative to ground when terrain available
        let yAccum = 0;
        for (const floor of scenario.floors) {
          const scale = floor.footprintScale ?? 1;
          const floorW = sideM * scale;
          const floorD = sideM * 0.84 * scale;
          const floorH = floor.heightM;

          const pos = Cesium.Cartesian3.fromDegrees(
            center.longitude,
            center.latitude,
            yAccum + floorH / 2,
          );
          viewer.entities.add({
            name: `${floor.floor}F`,
            position: pos,
            box: {
              dimensions: new Cesium.Cartesian3(floorW, floorD, floorH),
              material: Cesium.Color.fromCssColorString('#bff7ff').withAlpha(0.65),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString('#22d3ee').withAlpha(0.7),
              heightReference: hasIon ? Cesium.HeightReference.RELATIVE_TO_GROUND : undefined,
            },
          });
          yAccum += floorH;
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
            heightReference: hasIon ? Cesium.HeightReference.RELATIVE_TO_GROUND : undefined,
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
            heightReference: hasIon ? Cesium.HeightReference.RELATIVE_TO_GROUND : undefined,
          },
        });

        // Load Blender GLB model if available
        if (glbDataUrl) {
          try {
            const modelEntity = viewer.entities.add({
              name: 'Blender 건축 모델',
              position: Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, 0),
              model: {
                uri: glbDataUrl,
                scale: 1.0,
                heightReference: hasIon ? Cesium.HeightReference.CLAMP_TO_GROUND : undefined,
              },
            });
            if (modelEntity) {
              // Hide the box masses when GLB is loaded
              viewer.entities.values.forEach((e: any) => {
                if (e.box) e.show = false;
              });
            }
          } catch {
            // GLB load failed, keep box masses visible
          }
        }

        // Camera — offset south-east so the target area is centered in view
        const camOffsetM = 120;
        const camLatOff = camOffsetM / 111_320;
        const camLonOff = camOffsetM / (111_320 * Math.cos((center.latitude * Math.PI) / 180));
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
        if (!disposed) setStatus('ready');
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
  }, [address, areaSqm, center.latitude, center.longitude, glbDataUrl, isValidKoreaCoord, scenario]);

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
              {isValidKoreaCoord ? '도시 컨텍스트를 불러오지 못했습니다.' : '좌표 정보를 확인할 수 없습니다.'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {isValidKoreaCoord ? (errorMsg || '네트워크 또는 WebGL 상태를 확인해 주세요.') : '주소의 좌표 데이터가 제공되지 않아 지도를 표시할 수 없습니다.'}
            </p>
          </div>
        </div>
      )}
      {status === 'ready' && (
        <div className="absolute right-3 top-1/2 z-[100] flex -translate-y-1/2 flex-col gap-1 pointer-events-auto">
          {[
            { icon: <RotateCcw className="size-3.5" />, label: '좌회전', action: () => orbitCamera(-0.15, 0, 0) },
            { icon: <RotateCw className="size-3.5" />, label: '우회전', action: () => orbitCamera(0.15, 0, 0) },
            { icon: <ChevronUp className="size-3.5" />, label: '위로', action: () => orbitCamera(0, 0.1, 0) },
            { icon: <ChevronDown className="size-3.5" />, label: '아래로', action: () => orbitCamera(0, -0.1, 0) },
            { icon: <Plus className="size-3.5" />, label: '확대', action: () => orbitCamera(0, 0, 50) },
            { icon: <Minus className="size-3.5" />, label: '축소', action: () => orbitCamera(0, 0, -50) },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
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
        Cesium context · geographic view
      </div>
    </div>
  );
}
