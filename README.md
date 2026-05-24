# SoulSync 💗

The couples super-app — Between · Paired · Lovewick · Widgetable · Life360 fused into one cinematic, end-to-end-encrypted product.

> **Status:** foundation + first feature sprints shipped. Real auth, real E2E chat (text + image + voice), real memory vault, real background location with SOS, real time capsules, planner, quests, notes, push notifications, paywall, and a working AI Edge Function. A few cinematic add-ons (Memory Galaxy 3D, AI yearly recap renderer, lock-screen widgets) are explicitly stubbed for follow-up sprints — see [`docs/ROADMAP.md`](docs/ROADMAP.md) for the honest status of every feature.

## Repo layout

```
soulsync/
├─ apps/
│  ├─ mobile/        Expo SDK 51 + expo-router (iOS, Android, web)
│  └─ admin/         Next.js 14 ops dashboard (server-only service-role)
├─ packages/
│  └─ shared/        Types · zod validators · tweetnacl crypto · theme tokens · constants
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/    Numbered SQL: schema, RLS, RPCs, storage buckets, key exchange, ai
│  └─ functions/     Edge Functions (compose-message, ...)
└─ docs/             Architecture · auth · ai · deployment · monetization · viral · ASO · roadmap
```

## What is wired end-to-end

### Couple core
- **Auth:** email/password + magic link; Google/Apple wired in UI, configurable in Supabase
- **Pairing:** 6-char invite codes via `generate_invite_code` / `redeem_invite_code` SQL RPCs with anti-double-pair guards
- **E2E key exchange:** Curve25519 keypair generated on first launch, secret in `expo-secure-store`, public synced to `profiles.public_key`. Partner's key fetched via `partner_public_key()` RPC every cold-start.

### Chat
- **Realtime text** via `postgres_changes` channel + optimistic send
- **Image attachments** — picker → `expo-image-manipulator` → encrypt with random secretbox key → upload ciphertext → wrap key for partner
- **Voice notes** — `expo-av` recorder → same encrypt-and-wrap flow → tap-to-play with cached decryption
- **Reactions** — long-press → 8-emoji picker → atomic `toggle_reaction` RPC; jsonb shape `{"❤️":["uid"]}`
- **Read receipts** — `mark_conversation_read` RPC fires on screen entry and partner message arrival; ✓/✓✓ rendered on own messages
- **Disappearing messages** — `expires_at` schema + `purge_expired_messages` cron-ready function

### Memory vault
- **Photo upload** with compression (1920w JPEG @0.78), grid view with signed URLs
- **Video** + **album** + **secret-vault** tables already in schema; UI hooks coming next

### Live location + safety
- **Foreground watcher** + insert into `location_pings`; trigger updates `location_latest`
- **Background task** (`expo-task-manager` + `expo-location.startLocationUpdatesAsync`) flushes pings at 100m intervals with battery + charging state
- **SOS button** on the map → writes `sos_events` + opens dialer to 911
- **Ghost mode** — RLS-enforced; partner literally cannot select your pings

### Calendar / planner
- **Custom month-grid** calendar with event dots, today highlight, day picker
- **Surprise events** — hidden from partner via existing RLS (`surprise_for <> auth.uid()`)
- **Local reminders** scheduled 2h before each event via `expo-notifications`

### Gamification
- **Quests UI** — daily / weekly / one-time sections; `complete_quest` RPC awards XP + bumps level via `add_xp`
- **Streak engine** (`bump_streak`) called from mood checkin
- **5 themes** live-switchable in Profile

### Unique features (working today)
- **Time Capsules** — preset durations (1mo → 5y), sealed countdown, glow when ready to open, local notif on unlock_at
- **Heartbeat Mode** — Reanimated breath cycle + Supabase Realtime presence + broadcast pulse events; haptic + ring expansion + "in sync" detection
- **Shared Notes** — realtime collab via `postgres_changes`, debounced 600ms autosave, emoji + pin

### AI
- **`compose-message` Edge Function** — OpenAI-compatible (works with OpenRouter / Groq / Together via `OPENAI_BASE_URL`), generates compliments / letters / apologies / good-mornings in 5 tones; audits to `ai_logs`. See [`docs/AI_SETUP.md`](docs/AI_SETUP.md)

### Premium
- **Paywall screen** with all 3 tiers (Free / Plus / Infinite) sourced from `PREMIUM_GATES`, monthly/yearly toggle, RevenueCat handoff stub

### Push
- **Expo push** token registered to `device_sessions` + mirrored on `profiles.push_token`
- **Tap-to-deeplink** routing for messages / SOS / capsules / memories / events
- **5 Android channels** with appropriate importance + vibration

### Admin dashboard
- Real KPIs over service-role Supabase

## Quick start

### 1. Prereqs

- Node 20+, **pnpm 9+** (`npm i -g pnpm`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase`)
- For mobile: Xcode 15 (iOS) / Android Studio + JDK 17 (Android) — or just use **Expo Go** for everything except deep native modules (background location, push tokens, biometrics)
- Optional: Expo account for EAS builds, OpenAI API key for AI features

### 2. Install

```sh
cd soulsync
pnpm install
cp .env.example .env
```

Fill `.env` with your Supabase project URL + anon key (also paste them into `apps/mobile/.env` and `apps/admin/.env.local`).

### 3. Database

```sh
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push          # applies all migrations in supabase/migrations
```

This creates every table, every RLS policy, the storage buckets, the pairing/XP/streak RPCs, **and the new key-exchange + reaction + read-receipt + quest-completion RPCs** (migration 009).

### 4. (Optional) Configure AI

```sh
supabase secrets set OPENAI_API_KEY=sk-...
# Or route through any OpenAI-compatible provider:
supabase secrets set OPENAI_BASE_URL=https://openrouter.ai/api/v1
supabase secrets set OPENAI_MODEL_OVERRIDE=anthropic/claude-3.5-sonnet
supabase functions deploy compose-message
```

### 5. Run mobile

```sh
pnpm --filter @soulsync/mobile start
# press i (iOS sim), a (Android), or scan QR with Expo Go
```

For real native builds (background location, push, biometrics, voice recording):

```sh
pnpm --filter @soulsync/mobile exec eas build --profile development --platform ios
```

### 6. Run admin dashboard

```sh
pnpm --filter @soulsync/admin dev
# http://localhost:3000
```

## Architecture

```
[Expo RN App] ──HTTPS──▶ [Supabase Postgres]
       │                    │  RLS + Realtime
       │                    │  pgvector (future AI)
       ├──Realtime ws──────┘  + Presence (heartbeat)
       ├──Storage signed URLs──▶ [Storage buckets]
       │                          memories/chat/voice/avatars/replays
       ├──Edge Functions──▶ [compose-message] ──▶ [OpenAI-compatible API]
       └──E2E box (tweetnacl) on device, ciphertext-only on server
                                      ▲
                              [Admin Next.js] (service-role)
```

End-to-end encryption: each device generates a Curve25519 keypair stored in
the platform keychain via `expo-secure-store`. Public keys are exchanged via
the `profiles.public_key` column at pair time (and re-fetched on every chat
load). Everything sensitive (chat text, chat images, chat voice notes,
secret-vault media keys) is sealed with `nacl.box` before reaching Postgres.
**The server cannot read messages.**

## Where to go next

See [`docs/ROADMAP.md`](docs/ROADMAP.md) — every feature from the brief, with
status, blocking work, and the file you'd open to extend it.
