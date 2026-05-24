# Architecture

## High level

```
┌──────────────────────────────┐         ┌──────────────────────────────┐
│  Mobile (Expo / RN)          │         │  Admin (Next.js)             │
│  ───────────────             │         │  ────────────                │
│  • expo-router screens       │         │  • Server components only    │
│  • Zustand auth store        │         │  • Service-role Supabase     │
│  • TanStack Query            │         │                              │
│  • tweetnacl E2E             │         └─────────────┬────────────────┘
│  • expo-secure-store keys    │                       │
│  • expo-image-manipulator    │                       │ HTTPS (service key)
│  • expo-location BG task     │                       │
└─────────┬────────────────────┘                       │
          │ HTTPS / WSS                                │
          │                                            │
          ▼                                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Supabase (Postgres 15 + PostGIS + Realtime + Storage + Edge funcs)    │
│  ───────────────────────────────────────────────────────────          │
│  • RLS on every table                                                  │
│  • SECURITY DEFINER RPCs: generate_invite_code, redeem_invite_code,    │
│    add_xp, bump_streak, purge_expired_messages                         │
│  • Realtime publication: messages, typing_state, location_latest, etc. │
│  • Storage: avatars (public) / memories, chat, voice, replays (private)│
│  • Triggers: on_auth_user_created → public.profiles                    │
│              location_pings INSERT → location_latest UPSERT            │
└────────────────────────────────────────────────────────────────────────┘
```

## Trust model

| Actor                   | Can read messages? | Can read media? | Can read location? |
| ----------------------- | ------------------ | --------------- | ------------------ |
| You (your device)       | ✅                 | ✅              | ✅                 |
| Partner (their device)  | ✅                 | ✅              | ✅ unless ghost    |
| Supabase server         | ❌ (ciphertext)    | ❌ (encrypted blobs for secret vault) | ✅ (needed for queries) |
| Anyone else             | ❌                 | ❌              | ❌ (RLS)           |

Location is intentionally **not** end-to-end encrypted — Postgres needs the geometry to run radius/geofence queries. If you later want E2E location, you'd move that logic onto the device and only sync ciphertext snapshots.

## Data classes

- **Hot (realtime, small):** messages, typing, location_latest, mood, silent_care.
- **Warm (frequent reads):** memories, events, tasks, notes.
- **Cold (rare):** location_pings (TTL 7d), trips, ai_logs (analytics).

## RLS pattern

Every couple-scoped table enforces:

```sql
using (public.is_couple_member(couple_id, auth.uid()))
with check (public.is_couple_member(couple_id, auth.uid()));
```

`is_couple_member` is `SECURITY DEFINER` so RLS doesn't recurse. `current_couple_id()` and `partner_id()` helpers exist for convenience.

## Realtime channels

- `conv:<conversation_id>` — `messages` INSERT subscriber per chat
- `loc-latest` — broadcast partner location updates
- (Add) `presence:<couple_id>` — for Heartbeat mode using Supabase Presence

## Storage layout

```
avatars/
  <user_id>/<filename>.jpg                         (public)
memories/
  <couple_id>/<author_id>/<ts>-<rand>.jpg          (private; RLS via path[1] = couple_id)
chat/
  <couple_id>/<conversation_id>/<message_id>.bin   (encrypted blobs)
voice/
  <couple_id>/<message_id>.m4a
replays/
  <couple_id>/<year>.mp4
```

## Background tasks

- **Mobile:** `expo-task-manager` BG location task `soulsync.bg.location` (defined-but-not-yet-registered; see `services/location.ts` to add).
- **Server:** Supabase `pg_cron` jobs:
  - daily 03:00 — `select public.purge_expired_messages();`
  - daily 04:00 — recompute `health_snapshots` per active couple
  - daily 05:00 — fan out "On this day" push notifications
