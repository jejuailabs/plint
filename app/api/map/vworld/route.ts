export async function GET() {
  const key = process.env.VWORLD_API_KEY;
  if (!key)
    return new Response('VWorld API 키가 설정되지 않았습니다.', {
      status: 503,
    });
  // VWorld WebGL keys are browser-facing and must be restricted to the registered domain.
  const sdk =
    'https://map.vworld.kr/js/webglMapInit.js.do?version=3.0&apiKey=' +
    encodeURIComponent(key);
  return new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#map{margin:0;width:100%;height:100%;overflow:hidden;background:#071522}#notice{position:absolute;top:8px;left:8px;color:white;background:#071522dd;padding:8px;font:12px sans-serif;z-index:1000}</style></head><body><div id="map"></div><div id="notice">VWorld 3D를 연결하는 중…</div><script src="${sdk}"></script><script src="/vworld-viewer.js"></script></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    },
  );
}
