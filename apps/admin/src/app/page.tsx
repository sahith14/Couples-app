import { adminSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function loadKpis() {
  try {
    const sb = adminSupabase();
    const [{ count: users }, { count: couples }, { count: messages }, { count: memories }] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('couples').select('*', { count: 'exact', head: true }),
      sb.from('messages').select('*', { count: 'exact', head: true }),
      sb.from('memories').select('*', { count: 'exact', head: true }),
    ]);
    return { users: users ?? 0, couples: couples ?? 0, messages: messages ?? 0, memories: memories ?? 0 };
  } catch (e) {
    return { users: 0, couples: 0, messages: 0, memories: 0, error: (e as Error).message };
  }
}

export default async function AdminHome() {
  const k = await loadKpis();
  return (
    <main>
      <header style={{ marginBottom: 32 }}>
        <div className="faint">SoulSync · Operations</div>
        <h1 className="h1">Pulse of the platform</h1>
      </header>

      <section className="grid">
        <Kpi label="Users" value={k.users} />
        <Kpi label="Couples" value={k.couples} />
        <Kpi label="Messages" value={k.messages} />
        <Kpi label="Memories" value={k.memories} />
      </section>

      {('error' in k && k.error) && (
        <div className="card" style={{ marginTop: 24, borderColor: '#FF6B6B66' }}>
          <div className="faint">Connection issue</div>
          <p className="muted">{k.error}</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
          </p>
        </div>
      )}
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="faint">{label}</div>
      <div className="kpi">{value.toLocaleString()}</div>
    </div>
  );
}
