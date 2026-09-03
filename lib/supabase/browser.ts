import { createBrowserClient } from '@supabase/ssr';

import { requirePublicSupabaseConfig } from '@/lib/supabase/config';

export function createClient() {
  const { url, publishableKey } = requirePublicSupabaseConfig();
  return createBrowserClient(url, publishableKey, { isSingleton: true });
}
