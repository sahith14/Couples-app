import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client for admin dashboard.
 * Uses SERVICE ROLE key — must never be exposed to browser. Only used in
 * Next.js Server Components / Route Handlers.
 */
export function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
