// Supabase Edge Function: compose-message
//
// Generates a romantic compliment, love letter, or apology for a couple,
// using any OpenAI-compatible chat-completion API (works with OpenAI itself,
// OpenRouter, Groq, together.ai, etc.).
//
// Auth: caller must send the user's JWT in the Authorization header. We use
// it to construct an authed Supabase client so RLS still applies for the
// reads we do (couple lookup) and writes we make (ai_logs ledger).
//
// Secrets (set via `supabase secrets set`):
//   OPENAI_API_KEY      — the API key for your provider
//   OPENAI_BASE_URL     — defaults to https://api.openai.com/v1 ; set this to
//                         use OpenRouter / Groq / Together / Ollama proxy
//   OPENAI_MODEL_OVERRIDE (optional) — overrides app_settings 'ai.compose.model'
//
// Request body:
//   {
//     "kind":      "compliment" | "letter" | "apology" | "good_morning",
//     "tone":      "playful" | "tender" | "spicy" | "poetic" | "casual",
//     "context":   string?  // optional short hint, e.g. "we just argued about chores"
//   }
//
// Response:
//   { "text": string, "model": string }

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface Body {
  kind?: 'compliment' | 'letter' | 'apology' | 'good_morning';
  tone?: 'playful' | 'tender' | 'spicy' | 'poetic' | 'casual';
  context?: string;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'auth_required' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: auth } },
  });
  const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? SUPABASE_ANON);

  const { data: who } = await supabase.auth.getUser();
  const user = who?.user;
  if (!user) return json({ error: 'auth_required' }, 401);

  let body: Body;
  try { body = await req.json(); } catch { body = {}; }
  const kind = body.kind ?? 'compliment';
  const tone = body.tone ?? 'tender';
  const ctx = (body.context ?? '').slice(0, 600);

  // Look up couple + partner pet name for personalisation.
  const { data: couple } = await supabase
    .from('couples')
    .select('id, user_a, user_b, pet_name_a, pet_name_b, anniversary')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .limit(1)
    .maybeSingle();

  let partnerName = 'them';
  if (couple) {
    const partnerId = couple.user_a === user.id ? couple.user_b : couple.user_a;
    const { data: p } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', partnerId)
      .maybeSingle();
    partnerName = (p?.display_name as string) || 'them';
  }

  // Model + temperature pulled from settings (admin-only table). Service role
  // is used for these lookups since clients have no read policy on app_settings.
  const settings = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['ai.compose.model', 'ai.compose.temperature']);
  const settingsMap = new Map<string, any>();
  (settings.data ?? []).forEach((r: any) => settingsMap.set(r.key, r.value));
  const model = Deno.env.get('OPENAI_MODEL_OVERRIDE')
    ?? settingsMap.get('ai.compose.model')
    ?? 'gpt-4o-mini';
  const temperature = Number(settingsMap.get('ai.compose.temperature') ?? 0.85);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'ai_not_configured', hint: 'set OPENAI_API_KEY secret' }, 503);
  const baseUrl = Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1';

  const systemPrompt = buildSystemPrompt(kind, tone);
  const userPrompt = buildUserPrompt(kind, tone, partnerName, ctx);

  const aiRes = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: kind === 'letter' ? 700 : 220,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!aiRes.ok) {
    const txt = await aiRes.text();
    return json({ error: 'ai_failed', detail: txt.slice(0, 500) }, 502);
  }

  const aiJson = await aiRes.json();
  const text = (aiJson.choices?.[0]?.message?.content ?? '').trim();

  // Audit log (service role bypasses RLS; ai_logs has no insert policy for clients).
  if (couple?.id) {
    await supabaseAdmin.from('ai_logs').insert({
      couple_id: couple.id,
      user_id: user.id,
      feature: kind,
      model,
      input_chars: userPrompt.length,
      output_chars: text.length,
      cost_micros: aiJson.usage
        ? Math.round(((aiJson.usage.prompt_tokens ?? 0) * 0.15 + (aiJson.usage.completion_tokens ?? 0) * 0.6) / 1_000)
        : null,
    });
  }

  // Award XP for using the AI compliment generator.
  if (couple?.id && kind === 'compliment') {
    await supabase.rpc('complete_quest', { p_couple: couple.id, p_code: 'compliment' });
  }

  return json({ text, model });
});

function buildSystemPrompt(kind: string, tone: string): string {
  return [
    'You are SoulSync, a warm, original assistant that helps couples express affection in their own voice.',
    'Never be cheesy, never use clichés like "moon and stars", "soulmate", "two halves of a whole".',
    'Use specific, sensory, surprising language. One image > ten adjectives.',
    'Match the requested tone exactly. Default to short and punchy unless writing a letter.',
    `Kind: ${kind}. Tone: ${tone}.`,
    'Output ONLY the message text. No preface, no quotes, no explanations.',
  ].join('\n');
}

function buildUserPrompt(
  kind: string,
  tone: string,
  partnerName: string,
  context: string,
): string {
  const lines = [
    `Write a ${kind} from me to ${partnerName}.`,
    `Tone: ${tone}.`,
  ];
  if (context) lines.push(`Context the user gave: ${context}`);

  switch (kind) {
    case 'compliment':
      lines.push('1-2 sentences. Specific to a real moment. End with a beat that lands.');
      break;
    case 'letter':
      lines.push('150-250 words. 3-4 short paragraphs. Personal and grounded, not abstract.');
      break;
    case 'apology':
      lines.push('Take responsibility. No "if I" or "but". 2-3 sentences. End with a concrete next step.');
      break;
    case 'good_morning':
      lines.push('1 sentence. Tactile. Like a soft tap on the shoulder.');
      break;
  }
  return lines.join('\n');
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
