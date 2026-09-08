import { afterEach, describe, it, expect, vi } from 'vitest';
const auth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: auth }));
import { POST } from '@/app/api/analysis/concept/route';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
const payload = {
  address: '애월해안로 255',
  use: '카페·소매점',
  style: '백색 건축 모형',
  floors: 3,
  heightM: 10.6,
  grossArea: 1200,
  massing: 'data:image/png;base64,YQ==',
  cesium: 'data:image/png;base64,Yg==',
};
const request = () =>
  new Request('http://localhost/api/analysis/concept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
describe('proposal image route', () => {
  it('does not call a paid provider without authentication', async () => {
    auth.mockRejectedValue(new Response('Unauthorized', { status: 401 }));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await POST(request())).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('passes site first, mass second and the chosen geometry to GPT Image 2', async () => {
    auth.mockResolvedValue({ userId: 'test' });
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ data: [{ b64_json: 'Yw==' }] }));
    vi.stubGlobal('fetch', fetch);
    const res = await POST(request());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reviewed).toBe(false);
    expect(body.model).toBe('gpt-image-2');
    const form = fetch.mock.calls[0][1].body as FormData;
    expect(form.get('model')).toBe('gpt-image-2');
    expect(form.get('n')).toBe('1');
    expect(form.get('prompt')).toContain('Exactly 3 floors');
    const refs = form.getAll('image[]') as File[];
    expect(await refs[0].text()).toBe('b');
    expect(await refs[1].text()).toBe('a');
  });
});
