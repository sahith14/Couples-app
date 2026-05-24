# Deployment guide

Free-tier path that scales to ~10k DAU before paying anything meaningful.

## Backend — Supabase (free tier)

| Limit              | Free      | Notes                                          |
| ------------------ | --------- | ---------------------------------------------- |
| Database           | 500 MB    | Plenty for messages/metadata (chat is 99% text)|
| Storage            | 1 GB      | Move media to R2/B2 when this fills (see below)|
| Bandwidth          | 5 GB / mo | CDN-cached signed URLs save bandwidth          |
| Edge function invs | 500k / mo | AI features add up — cache aggressively        |
| MAUs               | 50k       | Keep                                           |

### Steps

1. `supabase init` (already done in this repo).
2. Create a Supabase project at https://supabase.com/dashboard.
3. `supabase link --project-ref XXXX && supabase db push`.
4. Enable **Email**, **Google**, **Apple** providers in Auth → Providers. Paste callback URL `soulsync://auth/callback`.
5. Set storage buckets to **private** (already done by migration). Add a daily scheduled job to run `select public.purge_expired_messages();`.
6. Generate service-role key for the admin dashboard. **Never** ship it to the mobile app.

### When you outgrow Supabase storage

Switch the `memories` bucket to **Cloudflare R2** (10 GB free) or **Backblaze B2** (10 GB free). Keep metadata in Postgres; just rewrite `services/storage.ts` in the mobile app to upload via S3-compatible signed URLs.

## Mobile — Expo + EAS

```
pnpm --filter @soulsync/mobile exec eas build --platform all --profile production
pnpm --filter @soulsync/mobile exec eas submit --platform ios
pnpm --filter @soulsync/mobile exec eas submit --platform android
```

Free tier: 30 builds/month is enough for a single dev. After 1.0, switch to OTA updates via `eas update` so you stop spending build credits on every JS-only change.

### Push notifications

Expo's push service is free and unlimited. Wire your Supabase **Edge Function** `notify_partner` (templated in `docs/EDGE_FUNCTIONS.md`) to call `https://exp.host/--/api/v2/push/send` whenever a new row lands in `messages`, `silent_care_signals`, or `time_capsules` (when `unlock_at <= now()`).

### Code signing

- **iOS:** EAS handles certs/profiles automatically.
- **Android:** EAS generates an upload key the first time. Save the keystore.

## Admin — Vercel

`apps/admin` deploys for free on Vercel:

```
cd apps/admin
vercel --prod
```

Set env vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Restrict access via Vercel's Password Protection (Pro plan) or use `middleware.ts` + a hard-coded admin email allowlist.

## Cost model at scale

| DAU  | Storage cost / mo | Notes                                  |
| ---- | ----------------- | -------------------------------------- |
| 1k   | ~$0               | Stays inside free tiers                |
| 10k  | ~$25              | Move media to R2; Supabase Pro $25     |
| 100k | ~$300             | Add Postgres read replica + image CDN  |

OpenAI / AI calls are the real cost driver. Always cache, batch, and gate behind Premium.
