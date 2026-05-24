// Supabase Edge Function: dispatch-scheduled
//
// Called by pg_cron every minute (configure via Supabase dashboard or
// `supabase functions schedule`). Calls dispatch_due_messages() which atomically
// flips scheduled_at + null dispatched_at messages whose time has come,
// triggering realtime delivery to the recipient.
//
// Curl example to wire as a cron:
//   curl -X POST https://<project>.functions.supabase.co/dispatch-scheduled \
//        -H "Authorization: Bearer <SERVICE_ROLE_KEY>"

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Reject anything not authed with the service role.
  const auth = req.headers.get('Authorization');
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!auth || !expected || !auth.includes(expected)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    expected,
  );

  const { data, error } = await supabase.rpc('dispatch_due_messages');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Also purge expired instants while we're warm — same heartbeat.
  await supabase.rpc('purge_expired_instants').catch(() => null);
  await supabase.rpc('purge_expired_messages').catch(() => null);

  return new Response(JSON.stringify({ dispatched: data ?? 0, ts: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
