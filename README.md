# SoulSync 💗

The couples super-app — Between · Paired · Lovewick · Widgetable · Life360, fused into one cinematic, end-to-end-encrypted product.

> Status: foundation complete. Core flows are wired to real Supabase + Postgres. AI features and a few cinematic add-ons (Memory Galaxy 3D, AI Replay rendering) are stubbed for follow-up sprints — see [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Repo layout

```
soulsync/
├─ apps/
│  ├─ mobile/        Expo SDK 51 + expo-router (iOS, Android, web)
│  └─ admin/         Next.js 14 ops dashboard (server-only service-role)
├─ packages/
│  └─ shared/        Types · zod validators · tweetnacl crypto · theme tokens
├─ supabase/
│  ├─ config.toml
│  └─ migrations/    Numbered SQL: schema, RLS, RPCs, storage buckets
└─ docs/             Deployment · monetization · viral · ASO · roadmap
```

## What is wired end-to-end

- **Auth:** email/password + magic link (Google/Apple stubbed in UI, configurable in Supabase)
- **Pairing:** 6-char invite codes via `generate_invite_code` / `redeem_invite_code` SQL RPCs with anti-double-pair guards
- **Realtime chat:** `postgres_changes` channel on `messages`, optimistic send, **tweetnacl box** E2E encryption (server only ever sees ciphertext)
- **Memory vault:** `expo-image-picker` → `expo-image-manipulator` (1920w JPEG @ 0.78) → Supabase Storage with signed URLs and per-couple folder RLS
- **Live location:** `expo-location` foreground watcher → `location_pings`; trigger updates `location_latest`; ghost mode hides you from partner via RLS
- **Mood sync, streaks, XP:** `mood_logs` + `add_xp(p_couple, p_xp)` + `bump_streak(p_couple)` RPCs
- **Theming:** 5 palettes (romantic-dark / aurora / noir / sunset / mint) live-switchable in Profile
- **Admin dashboard:** real KPIs over service-role Supabase

## Quick start

### 1. Prereqs

- Node 20+, **pnpm 9+** (`npm i -g pnpm`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase`)
- For mobile: Xcode 15 (iOS) / Android Studio + JDK 17 (Android) — or just use **Expo Go** for everything except deep native modules
- Optional: Expo account for EAS builds

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

This creates every table, every RLS policy, the storage buckets, and the pairing/XP/streak RPCs.

### 4. Run mobile

```sh
pnpm --filter @soulsync/mobile start
# press i (iOS sim), a (Android), or scan QR with Expo Go
```

For real native builds (location BG, push, biometrics):

```sh
pnpm --filter @soulsync/mobile exec eas build --profile development --platform ios
```

### 5. Run admin dashboard

```sh
pnpm --filter @soulsync/admin dev
# http://localhost:3000
```

## Architecture

```
[Expo RN App] ──HTTPS──▶ [Supabase Postgres]
       │                    │  RLS + Realtime
       │                    │  pgvector (future AI)
       ├──Realtime ws──────┘
       ├──Storage signed URLs──▶ [Storage buckets]
       └──E2E box (tweetnacl) on device, ciphertext-only on server
                                      ▲
                              [Admin Next.js] (service-role)
```

End-to-end encryption: each device generates a Curve25519 keypair stored in
the platform keychain via `expo-secure-store`. Public keys are exchanged at
pair time; everything sensitive (chat text, secret-vault media keys) is sealed
with `nacl.box` before reaching Postgres. The server **cannot** read messages.

## Where to go next

See [`docs/ROADMAP.md`](docs/ROADMAP.md) — every feature from the brief, with status, blocking work, and the file you'd open to extend it.
