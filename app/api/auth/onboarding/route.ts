import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const requestSchema = z.object({
  segment: z.enum(['owner', 'architect', 'platform']),
  companyName: z.string().trim().min(1).max(120).nullable(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: 'INVALID_REQUEST', message: '입력값을 확인해 주세요.' } }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return Response.json({ error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } }, { status: 401 });

  const { error } = await supabase.from('users').update({ segment: parsed.data.segment, company_name: parsed.data.companyName }).eq('id', userId);
  if (error) return Response.json({ error: { code: 'ONBOARDING_UPDATE_FAILED', message: '설정을 저장하지 못했습니다.' } }, { status: 500 });

  return Response.json({ data: { segment: parsed.data.segment } });
}
