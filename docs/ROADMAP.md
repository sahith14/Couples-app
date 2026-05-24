# SoulSync — Feature roadmap & status

Legend:
- ✅ shipped in this foundation
- 🟡 schema + UI hook in place; needs business logic / polish
- 🔲 stubbed — design + table is there, implementation is the next sprint
- ⚪ not started; spec only

## 1. Private couple space
- ✅ Pairing via invite codes (`generate_invite_code` / `redeem_invite_code`)
- ✅ Couple profile (`couples` table, `pet_name_*`, `song_url`, `cover_url`, `theme`)
- ✅ Anniversary counter on Home
- ✅ Streak engine (`bump_streak` RPC, called from mood checkin)
- 🟡 Shared timeline screen — combine messages + memories + events into a feed (data is there, no screen yet)
- ⚪ Mood syncing UI ring animation (mood logging itself is ✅)

## 2. Chat
- ✅ Realtime text via `messages` + Supabase Realtime channel
- ✅ E2E encryption (tweetnacl box, keys in expo-secure-store)
- ✅ Optimistic send
- 🔲 Voice notes — `expo-av` recorder → upload to `voice` bucket → write `messages.kind='voice'`
- 🔲 Photo/video sharing — same path as Memory Vault but write a `messages.kind='image'` row
- 🔲 Read receipts — UPDATE `read_at` on viewport-visible messages
- 🔲 Reactions — already a `reactions jsonb` column; needs long-press UI
- 🔲 Disappearing — `expires_at` is on the schema; pass `expires_in_seconds` from validators when sending
- ⚪ Couple-only stickers
- ⚪ AI message generator (Edge Function calling OpenAI; stub a `compose-message` function)

## 3. Memory Vault
- ✅ Photo upload with compression (1920w JPEG @0.78)
- ✅ Grid view with signed URLs
- 🔲 Albums — table exists; UI for album picker on upload
- 🔲 Secret vault — `is_encrypted` + `encrypted_key` columns; gate behind PIN (`pinHash` already in shared)
- 🔲 On-this-day surface (count is on Home; needs full screen)
- 🔲 Video uploads — pick video assets, generate thumbnail with `expo-video-thumbnails`
- ⚪ AI captions — Edge Function calling vision model; populate `ai_caption` + `ai_tags`
- ⚪ Memory Galaxy 3D (use `react-native-skia` + custom shader)

## 4. Live location
- ✅ Foreground watch + insert into `location_pings`
- ✅ Trigger updates `location_latest`; partner reads it
- ✅ Ghost mode toggle + RLS enforcement
- 🔲 Background location — wire `expo-task-manager` defined task `BG_LOCATION_TASK` → `Location.startLocationUpdatesAsync`
- 🔲 ETA & safe arrival — diff partner location vs `geofences`
- 🔲 Battery + charging — read via `expo-battery`, send with each ping
- 🔲 SOS button — write `sos_events` + push notification + 911 deep link
- 🔲 Trip history — server-side daily job clusters pings into `trips`

## 5. Date Planner
- ✅ Schema (`events`, surprise hidden via RLS)
- 🔲 Calendar UI — render `events` in a custom month grid
- 🔲 Budget rollup — sum `budget_cents` by month
- ⚪ AI date suggestions — OpenAI Edge Function `suggest_date(couple_id, budget, vibe)`
- ⚪ Restaurant bookmarks — pull from Google Places API

## 6. Gamification
- ✅ XP + level (`add_xp`)
- ✅ Streak (`bump_streak`)
- ✅ Quest definitions (seeded in migration 006)
- 🔲 Quest progress UI — show today's quests + tick on completion
- 🔲 Achievements unlock screen
- 🔲 Compatibility quizzes — content table + result page
- 🔲 Mini games (rock-paper-scissors realtime, drawing)

## 7. AI features
- 🔲 Edge Function scaffold under `supabase/functions/<name>` calling OpenAI
- ⚪ Relationship assistant chat
- ⚪ Memory captions
- ⚪ Letter generator
- ⚪ Anniversary video creator (run server-side ffmpeg in a Cloudflare Worker)
- ⚪ Conflict resolution suggestions

## 8. Shared utilities
- ✅ Schema for notes / tasks / wishlist / watchlist / finances
- 🔲 UI screens for each (CRUD over the existing tables)
- ⚪ Spotify / Apple Music shared playlist integration

## 9. Aesthetic + widgets
- ✅ Glassmorphism + 5 themes + aurora backdrop + spring buttons
- ✅ Cinematic transitions (expo-router `animation: 'fade' / 'slide_from_right'`)
- 🔲 Lockscreen widget — needs SwiftUI / Glance via `expo-modules-core`. Out of JS-only scope.
- 🔲 Story-mode memory viewer — pan-zoom-fade with `react-native-reanimated`

## 10. Premium
- ✅ Tier columns + `PREMIUM_GATES` constants
- 🔲 RevenueCat SDK init
- 🔲 Paywall screens
- 🔲 Webhook → update `profiles.premium_tier`

## Unique features
| Feature | Status | Where |
| ------- | ------ | ----- |
| Relationship Replay | ⚪ | `replays` table done; renderer not |
| Emotion Heatmap | 🔲 | Aggregate `mood_logs` over months → heatmap component |
| Time Capsule | ✅ schema + RLS, 🔲 UI | `time_capsules` |
| Dream Sync | ✅ schema, 🔲 UI | `dreams` |
| Parallel Timeline | 🔲 | Cluster `location_pings` + memories on a map |
| Heartbeat Mode | 🔲 | Reanimated pulse synced via realtime presence channel |
| Aura Mode | ⚪ | Sentiment of last 50 messages → gradient theme override |
| Memory Galaxy | ⚪ | Skia 3D scene |
| Silent Care | ✅ schema + realtime, 🔲 UI button | `silent_care_signals` |
| Health Score | 🔲 | Weekly Edge Function writes `health_snapshots` |

## Recommended sprint order

1. **Sprint 1** — close out chat (voice + image + read receipts + reactions). This is what users actually do.
2. **Sprint 2** — albums + on-this-day full screen + video memories.
3. **Sprint 3** — calendar UI + quests UI + paywall (RevenueCat).
4. **Sprint 4** — SOS, geofences, background location, trip history.
5. **Sprint 5** — first AI Edge Function (memory captions), then letter + recap.
6. **Sprint 6** — Memory Galaxy + Heartbeat Mode + Anniversary share card.

Each sprint is ~1 dev-week.
