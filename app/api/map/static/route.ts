import { NextRequest } from 'next/server';

// VWorld can reject requests issued from Vercel's US default region.
export const preferredRegion = 'icn1';
export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');
  const zoom = req.nextUrl.searchParams.get('zoom') ?? '17';
  const w = String(
    Math.min(
      1024,
      Math.max(64, Number(req.nextUrl.searchParams.get('w') ?? 800) || 800),
    ),
  );
  const h = String(
    Math.min(
      1024,
      Math.max(64, Number(req.nextUrl.searchParams.get('h') ?? 500) || 500),
    ),
  );
  const requested = req.nextUrl.searchParams.get('basemap') ?? 'HYBRID';
  const basemap =
    requested === 'SATELLITE'
      ? 'PHOTO'
      : requested === 'HYBRID'
        ? 'PHOTO_HYBRID'
        : requested;

  if (!lat || !lon) {
    return Response.json({ error: 'lat, lon required' }, { status: 400 });
  }

  const apiKey = process.env.VWORLD_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'VWORLD_API_KEY not configured' },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    service: 'image',
    request: 'getmap',
    version: '2.0',
    crs: 'EPSG:4326',
    key: apiKey,
    basemap,
    center: `${lon},${lat}`,
    zoom,
    size: `${w},${h}`,
    format: 'png',
  });

  if (process.env.VWORLD_DOMAIN)
    params.set('domain', process.env.VWORLD_DOMAIN);

  try {
    const res = await fetch(`https://api.vworld.kr/req/image?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) {
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
