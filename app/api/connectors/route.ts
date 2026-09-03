import { connectorRegistry } from '@/lib/external-apis/registry';

export function GET() {
  const data = connectorRegistry.map(({ auth: _auth, timeoutMs: _timeoutMs, ...connector }) => connector);
  return Response.json(
    { data, meta: { count: data.length, generatedAt: new Date().toISOString() } },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
  );
}
