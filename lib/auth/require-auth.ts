import { getClaims, type Claims } from '@/lib/auth/get-claims';
import { error } from '@/lib/api/response';

/**
 * Returns the authenticated user's claims or throws a 401 JSON response.
 */
export async function requireAuth(): Promise<Claims> {
  const claims = await getClaims();
  if (!claims) {
    throw error('UNAUTHENTICATED', '로그인이 필요합니다.', 401);
  }
  return claims;
}

/**
 * Returns admin claims or throws a 403 JSON response.
 */
export async function requireAdmin(): Promise<Claims & { role: 'admin' }> {
  const claims = await requireAuth();
  if (claims.role !== 'admin') {
    throw error('FORBIDDEN', '관리자 권한이 필요합니다.', 403);
  }
  return claims as Claims & { role: 'admin' };
}
