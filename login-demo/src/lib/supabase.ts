'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

export function getSupabaseClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Authentication is not configured. Run npm run setup:local, then restart the app.');
  client = createClient(url, key, { auth: { storageKey: 'entre-auth', flowType: 'pkce' } });
  return client;
}
