import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

function safeNextPath(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/analysis';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'));
  let exchangeSucceeded = false;

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      exchangeSucceeded = !error;
    } catch (error) {
      console.error('OAuth callback failed', error);
    }
  }

  if (exchangeSucceeded) redirect(new URL(next, url.origin).toString());

  redirect(new URL('/login?error=oauth_callback', url.origin).toString());
}
