import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');
  const zoom = req.nextUrl.searchParams.get('zoom') ?? '17';
  const w = req.nextUrl.searchParams.get('w') ?? '800';
  const h = req.nextUrl.searchParams.get('h') ?? '500';
  const basemap = req.nextUrl.searchParams.get('basemap') ?? 'HYBRID';

  if (!lat || !lon) {
    return Response.json({ error: 'lat, lon required' }, { status: 400 });
  }

  const apiKey = process.env.VWORLD_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'VWORLD_API_KEY not configured' }, { status: 500 });
  }

  const params = new URLSearchParams({
    service: 'image',
    request: 'getmap',
    key: apiKey,
    basemap,
    center: `${lon},${lat}`,
    zoom,
    size: `${w},${h}`,
    format: 'png',
  });

  try {
    const res = await fetch(`https://api.vworld.kr/req/image?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return Response.json({ error: 'VWorld 응답 오류' }, { status: 502 });
    }

    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return Response.json({ error: '지도 이미지 생성 실패' }, { status: 500 });
  }
}
