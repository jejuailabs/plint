import { z } from 'zod';

import { requireAuth } from '@/lib/auth/require-auth';
import { error, success } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';

const createSiteSchema = z.object({
  jibunAddress: z.string().trim().min(5, '주소를 5자 이상 입력해 주세요.').max(200),
  roadAddress: z.string().trim().max(200).optional(),
  pnuCode: z
    .string()
    .regex(/^[0-9]{19}$/, 'PNU 코드는 19자리 숫자여야 합니다.')
    .optional(),
});

export async function GET() {
  try {
    const claims = await requireAuth();
    const supabase = await createClient();

    const { data, error: dbError } = await supabase
      .from('sites')
      .select('*')
      .eq('user_id', claims.userId)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('Failed to fetch sites', dbError);
      return error('DB_ERROR', '사이트 목록 조회에 실패했습니다.', 500);
    }

    return success(data ?? []);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}

export async function POST(request: Request) {
  try {
    const claims = await requireAuth();

    const parsed = createSiteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return error(
        'INVALID_BODY',
        parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.',
      );
    }

    const { jibunAddress, roadAddress, pnuCode } = parsed.data;

    const supabase = await createClient();
    const { data, error: dbError } = await supabase
      .from('sites')
      .insert({
        user_id: claims.userId,
        jibun_address: jibunAddress,
        road_address: roadAddress ?? null,
        pnu_code: pnuCode ?? null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Failed to create site', dbError);
      return error('DB_ERROR', '사이트 등록에 실패했습니다.', 500);
    }

    return success(data, 201);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}
