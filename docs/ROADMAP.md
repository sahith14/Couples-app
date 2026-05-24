# SoulSync — Feature roadmap & status

Legend:
- ✅ shipped + working today
- 🟡 schema + UI hook in place; needs polish or extension
- 🔲 stubbed — design + table is there, implementation is the next sprint
- ⚪ not started; spec only

## 1. Private couple space
- ✅ Pairing via invite codes (`generate_invite_code` / `redeem_invite_code`)
- ✅ Couple profile (`couples` table, `pet_name_*`, `song_url`, `cover_url`, `theme`)
- ✅ Anniversary counter on Home
- ✅ Streak engine (`bump_streak` RPC, called from mood checkin)
- ✅ E2E key exchange — `profiles.public_key` + `partner_public_key()` RPC + `bootstrapKeys()` on every session
- 🟡 Shared timeline screen — combine messages + memories + events into a feed (data is there, no screen yet)
- ⚪ Mood syncing UI ring animation (mood logging itself is ✅)

## 2. Chat
- ✅ Realtime text via `messages` + Supabase Realtime channel
- ✅ E2E text encryption (tweetnacl box, keys in expo-secure-store, partner key from profile)
- ✅ Optimistic send + reconcile-on-realtime
- ✅ **Image attachments** — encrypted secretbox upload, key wrapped for partner
- ✅ **Voice notes** — `expo-av` record → encrypt → upload → tap-to-play with cache
- ✅ **Reactions** — long-press picker, atomic `toggle_reaction` RPC
- ✅ **Read receipts** — `mark_conversation_read` RPC, ✓/✓✓ on own messages
- 🔲 Disappearing messages — `expires_at` is on the schema; pass `expires_in_seconds` from validators when sending (cleanup function exists)
- ⚪ Typing indicator UI (table exists)
- ⚪ Couple-only sticker pack
- ✅ AI message generator (`compose-message` Edge Function)

## 3. Memory Vault
- ✅ Photo upload with compression (1920w JPEG @0.78)
- ✅ Grid view with signed URLs
- 🔲 Albums — table exists; UI for album picker on upload
- 🔲 Secret vault — `is_encrypted` + `encrypted_key` columns; gate behind PIN (`pinHash` already in shared)
- 🔲 On-this-day full screen (count is on Home)
- 🔲 Video uploads — pick video assets, generate thumbnail with `expo-video-thumbnails`
- ⚪ AI captions — Edge Function calling vision model; populate `ai_caption` + `ai_tags`
- ⚪ Memory Galaxy 3D (use `react-native-skia` + custom shader)

## 4. Live location
- ✅ Foreground watch + insert into `location_pings`
- ✅ Trigger updates `location_latest`; partner reads it
- ✅ Ghost mode toggle + RLS enforcement
- ✅ **Background location** — `BG_LOCATION_TASK` registered, `startLocationUpdatesAsync` with foreground service banner
- ✅ **Battery + charging** — read via `expo-battery`, sent with each ping
- ✅ **SOS button** — writes `sos_events` + dialer to 911 from map screen
- 🔲 ETA & safe arrival — diff partner location vs `geofences`
- 🔲 Trip history — server-side daily job clusters pings into `trips`

## 5. Date Planner
- ✅ Schema (`events`, surprise hidden via RLS)
- ✅ **Calendar UI** — month grid with event dots, day picker, surprise toggle
- ✅ Local reminder 2h before each event via `expo-notifications`
- ✅ `plan_a_date` quest auto-completed on event create
- 🔲 Budget rollup view — sum `budget_cents` by month
- ⚪ AI date suggestions — extend `compose-message` Edge Function with `kind: 'date_idea'`
- ⚪ Restaurant bookmarks — pull from Google Places API

## 6. Gamification
- ✅ XP + level (`add_xp`)
- ✅ Streak (`bump_streak`)
- ✅ Quest definitions (seeded in migration 006)
- ✅ **`complete_quest` RPC** — atomic quest completion + XP award + level recalc
- ✅ **Quests UI** — daily / weekly / one-time sections, today's progress
- 🔲 Achievements unlock screen
- 🔲 Compatibility quizzes — content table + result page
- 🔲 Mini games (rock-paper-scissors realtime, drawing)

## 7. AI features
- ✅ Edge Function scaffold under `supabase/functions/compose-message/`
- ✅ Compose message — compliment / letter / apology / good_morning in 5 tones
- ✅ AI ledger (`ai_logs`) audits every call with token-cost estimate
- ✅ OpenAI-compatible (works with OpenRouter / Groq / Together / Ollama proxy)
- ⚪ Memory captions (vision model) — extend with `compose-caption` function
- ⚪ Anniversary recap video — server-side ffmpeg in a Cloudflare Worker
- ⚪ Conflict resolution suggestions
- ⚪ Aura mode — sentiment of last 50 messages → gradient theme override
- ⚪ Health Score weekly cron — writes `health_snapshots`

## 8. Shared utilities
- ✅ Schema for notes / tasks / wishlist / watchlist / finances
- ✅ **Notes UI** — realtime collab, debounced autosave, emoji + pin, long-press delete
- 🔲 UI screens for tasks / wishlist / watchlist / finances (CRUD over the existing tables)
- ⚪ Spotify / Apple Music shared playlist integration

## 9. Aesthetic + widgets
- ✅ Glassmorphism + 5 themes + aurora backdrop + spring buttons
- ✅ Cinematic transitions (expo-router `animation: 'fade' / 'slide_from_right'`)
- ✅ **Heartbeat Mode** — Reanimated pulse + Supabase Realtime presence/broadcast + sync detection
- 🔲 Lockscreen widget — needs SwiftUI / Glance via `expo-modules-core`. Out of JS-only scope.
- 🔲 Story-mode memory viewer — pan-zoom-fade with `react-native-reanimated`

## 10. Premium
- ✅ Tier columns + `PREMIUM_GATES` constants
- ✅ **Paywall screen** — 3 tiers, monthly/yearly toggle, plan comparison
- 🔲 RevenueCat SDK init (paywall has handoff stub)
- 🔲 Webhook → update `profiles.premium_tier`

## Push notifications
- ✅ Expo token registration on session start
- ✅ `device_sessions` row per device + `profiles.push_token` mirror
- ✅ Tap-deeplink routing (messages / sos / capsule / memory / event)
- ✅ Local reminders (planner, capsules)
- ⚪ Server-side fan-out Edge Functions (`message-fanout`, `sos-fanout`)

## Unique features
| Feature | Status | Where |
| ------- | ------ | ----- |
| Relationship Replay | ⚪ | `replays` table done; renderer not |
| Emotion Heatmap | 🔲 | Aggregate `mood_logs` over months → heatmap component |
| Time Capsule | ✅ | `time_capsules` + `app/capsules.tsx` |
| Dream Sync | 🔲 | schema exists; UI not |
| Parallel Timeline | 🔲 | Cluster `location_pings` + memories on a map |
| Heartbeat Mode | ✅ | `app/heartbeat.tsx` with presence + broadcast |
| Aura Mode | ⚪ | Sentiment of last 50 messages → gradient theme override |
| Memory Galaxy | ⚪ | Skia 3D scene |
| Silent Care | 🔲 | schema + realtime in place; UI button not |
| Health Score | 🔲 | Weekly Edge Function writes `health_snapshots` |

## Recommended next sprint order

1. **Sprint A** — finish chat: disappearing messages, typing indicator, sticker pack
2. **Sprint B** — memories: albums + secret vault PIN + video upload + on-this-day full screen
3. **Sprint C** — RevenueCat wiring + premium gates enforcement
4. **Sprint D** — geofences UI + safe-arrival notifications + trip history
5. **Sprint E** — second AI Edge Function (memory captions), then anniversary recap renderer
6. **Sprint F** — Memory Galaxy + Aura Mode + Story-style memory viewer
7. **Sprint G** — Native widgets (iOS WidgetKit, Android Glance) via expo-modules

Each sprint is ~1 dev-week.
