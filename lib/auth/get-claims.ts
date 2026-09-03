import { createClient } from '@/lib/supabase/server';

export type Claims = {
  userId: string;
  email: string;
  role: 'user' | 'admin';
};

/**
 * Reads the authenticated user from the Supabase session cookie.
 * Returns `null` when no valid session exists.
 */
export async function getClaims(): Promise<Claims | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const role =
    (user.app_metadata?.role as string | undefined) === 'admin' ? 'admin' : 'user';

  return {
    userId: user.id,
    email: user.email ?? '',
    role,
  };
}
