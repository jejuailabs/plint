'use client';

import { LoaderCircle, MapPinned } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { DevelopmentScenario } from '@/lib/domain/parcel-intelligence';

export type CesiumContextProps = {
  address: string;
  center: { latitude: number; longitude: number };
  areaSqm?: number;
  scenario: DevelopmentScenario;
};

function parcelRing(longitude: number, latitude: number, areaSqm?: number) {
  const halfSideM = Math.max(12, Math.min(38, Math.sqrt(areaSqm ?? 480) / 2));
  const latitudeOffset = halfSideM / 111_320;
  const longitudeOffset =
    halfSideM / (111_320 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.2));

  return [
    longitude - longitudeOffset,
    latitude - latitudeOffset,
    longitude + longitudeOffset,
    latitude - latitudeOffset,
    longitude + longitudeOffset,
    latitude + latitudeOffset,
    longitude - longitudeOffset,
    latitude + latitudeOffset,
  ];
}

export function CesiumContext({
  address,
  center,
  areaSqm,
  scenario,
}: CesiumContextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let disposed = false;
    let viewer: import('cesium').Viewer | undefined;

    async function initialize() {
      try {
        if (!containerRef.current) return;

        // Cesium workers, widgets and terrain assets are copied to public/cesium at build time.
        (window as typeof window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL =
          '/cesium';
        const Cesium = await import('cesium');
        if (disposed || !containerRef.current) return;

        viewer = new Cesium.Viewer(containerRef.current, {
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
          baseLayer: new Cesium.ImageryLayer(
            new Cesium.OpenStreetMapImageryProvider({
              url: 'https://tile.openstreetmap.org/',
            }),
          ),
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
        });

        viewer.scene.globe.enableLighting = true;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#07101c');
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.00018;

        const heightM = Math.max(
          10,
          scenario.floors.reduce((total, floor) => total + floor.heightM, 0),
        );
        const sideM = Math.max(18, Math.min(55, Math.sqrt(areaSqm ?? 480) * 0.88));
        const position = Cesium.Cartesian3.fromDegrees(
          center.longitude,
          center.latitude,
          heightM / 2,
        );

        viewer.entities.add({
          name: '대상 필지',
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(
              parcelRing(center.longitude, center.latitude, areaSqm),
            ),
            material: Cesium.Color.LIME.withAlpha(0.24),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#bef264'),
          },
        });
        viewer.entities.add({
          name: `${scenario.name} 개발 매스`,
          position,
          box: {
            dimensions: new Cesium.Cartesian3(sideM, sideM * 0.84, heightM),
            material: Cesium.Color.fromCssColorString('#bff7ff').withAlpha(0.78),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#22d3ee'),
          },
        });
        viewer.entities.add({
          name: address,
          position: Cesium.Cartesian3.fromDegrees(
            center.longitude,
            center.latitude,
            heightM + 8,
          ),
          point: {
            pixelSize: 9,
            color: Cesium.Color.fromCssColorString('#bef264'),
            outlineColor: Cesium.Color.fromCssColorString('#07101c'),
            outlineWidth: 2,
          },
        });

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            center.longitude,
            center.latitude,
            780,
          ),
          orientation: {
            heading: Cesium.Math.toRadians(28),
            pitch: Cesium.Math.toRadians(-47),
            roll: 0,
          },
          duration: 0,
        });
        viewer.scene.requestRender();
        if (!disposed) setStatus('ready');
      } catch (error) {
        console.error('Cesium context failed to initialize', error);
        if (!disposed) setStatus('error');
      }
    }

    void initialize();
    return () => {
      disposed = true;
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
    };
  }, [address, areaSqm, center.latitude, center.longitude, scenario]);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit] bg-[#07101c]">
      <div ref={containerRef} className="cesium-context absolute inset-0" />
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center bg-[#07101c]">
          <div className="text-center">
            <LoaderCircle className="mx-auto size-7 animate-spin text-cyan-300" />
            <p className="mt-3 text-xs text-slate-300">도시 공간을 불러오는 중</p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center bg-[#07101c] p-6 text-center">
          <p className="text-sm text-slate-200">도시 컨텍스트를 불러오지 못했습니다.</p>
          <p className="mt-2 text-xs text-slate-500">네트워크 또는 WebGL 상태를 확인해 주세요.</p>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-5 right-5 flex items-center gap-2 rounded-lg border border-cyan-300/15 bg-slate-950/75 px-3 py-2 font-mono text-[9px] uppercase tracking-[.16em] text-cyan-100/80 backdrop-blur">
        <MapPinned className="size-3 text-cyan-300" />
        Cesium context · geographic view
      </div>
    </div>
  );
}
