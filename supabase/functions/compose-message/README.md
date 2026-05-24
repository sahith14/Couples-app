# compose-message

Generates compliments, love letters, apologies, and good-morning notes for a
couple using any OpenAI-compatible chat-completion API.

## Setup

```sh
# Set the secret(s)
supabase secrets set OPENAI_API_KEY=sk-... 

# Optional: route through a different provider
supabase secrets set OPENAI_BASE_URL=https://openrouter.ai/api/v1
supabase secrets set OPENAI_MODEL_OVERRIDE=anthropic/claude-3.5-sonnet
```

## Deploy

```sh
supabase functions deploy compose-message
```

## Call from the mobile app

```ts
const { data, error } = await supabase.functions.invoke('compose-message', {
  body: { kind: 'compliment', tone: 'playful', context: 'after they cooked dinner' },
});
console.log(data.text);
```
