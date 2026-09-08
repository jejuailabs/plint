'use client';
import { useEffect, useRef, useState } from 'react';
import type { CesiumContextProps } from './cesium-context';
export function VWorldContext(props: CesiumContextProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(props);
  const pending = useRef(
    new Map<
      string,
      {
        resolve: (image: string) => void;
        reject: (e: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >(),
  );
  const [error, setError] = useState('');
  useEffect(() => {
    latest.current = props;
  }, [props]);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      {
        channel: 'plint-vworld',
        type: 'config',
        data: {
          address: props.address,
          center: {
            latitude: props.center.latitude,
            longitude: props.center.longitude,
          },
          boundary: props.boundary,
          scenario: props.scenario,
        },
      },
      location.origin,
    );
  }, [
    props.address,
    props.center.latitude,
    props.center.longitude,
    props.boundary,
    props.scenario,
  ]);
  useEffect(() => {
    const requests = pending.current;
    const listener = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        event.data?.channel !== 'plint-vworld'
      )
        return;
      const message = event.data;
      if (message.type === 'initialized') {
        const p = latest.current;
        frame.current?.contentWindow?.postMessage(
          {
            channel: 'plint-vworld',
            type: 'config',
            data: {
              address: p.address,
              center: p.center,
              boundary: p.boundary,
              scenario: p.scenario,
            },
          },
          location.origin,
        );
      }
      if (message.type === 'error') setError(message.message);
      if (message.type === 'ready') {
        setError('');
        latest.current.onCaptureReady?.(
          () =>
            new Promise((resolve, reject) => {
              const id = crypto.randomUUID();
              const timer = setTimeout(() => {
                requests.delete(id);
                reject(new Error('VWorld 캡처 시간 초과'));
              }, 20000);
              requests.set(id, { resolve, reject, timer });
              frame.current?.contentWindow?.postMessage(
                { channel: 'plint-vworld', type: 'capture', id },
                location.origin,
              );
            }),
        );
      }
      if (message.type === 'capture') {
        const request = requests.get(message.id);
        if (!request) return;
        clearTimeout(request.timer);
        requests.delete(message.id);
        if (message.error) request.reject(new Error(message.error));
        else request.resolve(message.image);
      }
    };
    window.addEventListener('message', listener);
    return () => {
      window.removeEventListener('message', listener);
      requests.forEach((r) => {
        clearTimeout(r.timer);
        r.reject(new Error('지도 화면이 닫혔습니다.'));
      });
      requests.clear();
    };
  }, []);
  if (
    props.center.latitude < 33 ||
    props.center.latitude > 39 ||
    props.center.longitude < 124 ||
    props.center.longitude > 132
  )
    return <p className="p-6">좌표 확인 후 지도를 표시할 수 있습니다.</p>;
  return (
    <div className="absolute inset-0">
      <iframe
        ref={frame}
        src={`/api/map/vworld?lat=${props.center.latitude}&lon=${props.center.longitude}`}
        title="VWorld 3D 현장과 제안 매스"
        className="h-full w-full border-0"
        allow="fullscreen"
      />
      <button
        type="button"
        className="absolute left-3 top-16 rounded bg-slate-950/90 px-3 py-2 text-xs text-white"
        onClick={() =>
          frame.current?.contentWindow?.postMessage(
            { channel: 'plint-vworld', type: 'focus' },
            location.origin,
          )
        }
      >
        대상 필지로 확대
      </button>
      {error && (
        <p
          role="alert"
          className="absolute bottom-12 left-3 right-3 rounded bg-slate-950 p-3 text-xs text-amber-200"
        >
          {error}
        </p>
      )}
    </div>
  );
}
