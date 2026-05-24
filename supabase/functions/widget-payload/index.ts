// Supabase Edge Function: widget-payload
//
// Returns the JSON the iOS WidgetKit / Android Glance widgets fetch every
// 15 minutes (or via push) to render the lockscreen / home-screen tile.
//
// The widget itself runs inside the OS, not the app, so it can't use the
// supabase-js client easily. We expose this URL signed with the user's JWT
// (stored in the app group / shared prefs alongside the widget) so the
// widget process can do a single HTTPS GET.
//
// Response shape matches packages/shared types `WidgetPayload`.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const auth = req.headers.get('Authorization');
  if (!auth) return j({ error: 'auth_required' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: who } = await supabase.auth.getUser();
  if (!who?.user) return j({ error: 'auth_required' }, 401);

  const { data, error } = await supabase
    .from('widget_payload')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) return j({ error: error.message }, 500);
  if (!data) return j({ error: 'no_couple' }, 404);

  // Cache control: widgets refresh ~15min on iOS, more on Android.
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=60',
      ...cors,
    },
  });
});

function j(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
