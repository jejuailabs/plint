import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  let destination: '/dashboard' | '/onboarding' | null = null;

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;

      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
      if (claimsError || !claimsData?.claims?.sub) throw claimsError ?? new Error('Missing authenticated user');

      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('segment')
        .eq('id', claimsData.claims.sub)
        .maybeSingle();
      if (userError) throw userError;

      destination = userRecord?.segment ? '/dashboard' : '/onboarding';
    } catch (error) {
      console.error('OAuth callback failed', error);
    }
  }

  if (destination) redirect(new URL(destination, url.origin).toString());

  redirect(new URL('/login?error=oauth_callback', url.origin).toString());
}
