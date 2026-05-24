# AI setup

SoulSync ships with one working Edge Function: `compose-message`. It generates compliments, love letters, apologies, and good-morning notes in 5 tones using any OpenAI-compatible API.

## Quick start (OpenAI)

```sh
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy compose-message
```

## Cheaper / open-source providers

The function speaks the OpenAI Chat Completions wire format, so it works with any provider that proxies it.

### OpenRouter (Claude, Llama, etc.)
```sh
supabase secrets set OPENAI_API_KEY=<openrouter-key>
supabase secrets set OPENAI_BASE_URL=https://openrouter.ai/api/v1
supabase secrets set OPENAI_MODEL_OVERRIDE=anthropic/claude-3.5-sonnet
```

### Groq (free, fast)
```sh
supabase secrets set OPENAI_API_KEY=<groq-key>
supabase secrets set OPENAI_BASE_URL=https://api.groq.com/openai/v1
supabase secrets set OPENAI_MODEL_OVERRIDE=llama-3.1-70b-versatile
```

### Local Ollama (dev only)
```sh
# Run Ollama with the OpenAI-compatible adapter
ollama serve
supabase secrets set OPENAI_API_KEY=ollama
supabase secrets set OPENAI_BASE_URL=http://host.docker.internal:11434/v1
supabase secrets set OPENAI_MODEL_OVERRIDE=llama3
```

Default model + temperature live in the `app_settings` table — service-role only, no client RLS access. Edit them in the Supabase SQL editor:

```sql
update app_settings set value = '"gpt-4o-mini"'::jsonb where key = 'ai.compose.model';
update app_settings set value = '0.9'::jsonb where key = 'ai.compose.temperature';
```

## Calling the function

From the mobile app:

```ts
const { data, error } = await supabase.functions.invoke('compose-message', {
  body: {
    kind: 'compliment',          // 'compliment' | 'letter' | 'apology' | 'good_morning'
    tone: 'playful',             // 'playful' | 'tender' | 'spicy' | 'poetic' | 'casual'
    context: 'after they cooked dinner for me',  // optional, max 600 chars
  },
});
console.log(data.text);   // → ready to send
console.log(data.model);  // → which model produced it
```

The function:
- Authenticates the caller via the JWT in the `Authorization` header
- Looks up the partner's display_name for personalisation
- Writes an `ai_logs` row with input/output char counts + estimated cost in micro-dollars
- Awards the `compliment` quest (+20 XP) on every successful compliment

## Rate limits & billing

- The `PREMIUM_GATES` constants in `packages/shared/src/constants.ts` define per-tier weekly call limits. Wire enforcement in the function (cheap to add — query `ai_logs` count for the past 7 days for `couple_id`).
- Cost estimate in `ai_logs.cost_micros` uses GPT-4o-mini's published price; adjust the multipliers in `compose-message/index.ts` if you switch providers.

## Adding more AI features

The pattern is repeatable — copy `supabase/functions/compose-message/` to a new directory, change the system prompt, and you're done. Suggested next:

- `compose-caption` — vision model that captions a memory photo (writes to `memories.ai_caption` + `ai_tags`)
- `compose-letter` — separate from compose-message so the model can be larger/more expensive
- `analyze-conflict` — given a chat snippet, suggest 3 reply options
- `health-snapshot` — weekly cron that aggregates couple metrics into a 0-100 score

Each one follows the same pattern: authenticate, look up couple context, call the OpenAI-compatible API, audit to `ai_logs`, return JSON.

## Troubleshooting

- `503 ai_not_configured` → set `OPENAI_API_KEY` and redeploy.
- `502 ai_failed` → check the function logs (`supabase functions logs compose-message`); the upstream API error is in the `detail` field.
- `401 auth_required` → make sure you're using `supabase.functions.invoke` (which sends the JWT) and not raw `fetch`.
