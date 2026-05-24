# Monetization

Couples-app benchmarks (Paired, Lovewick, Lasting) sit at $30–80 ARPU/year with 4–7% paid conversion. Designed targets:

| Tier         | Price (USD)         | Gates                                                           |
| ------------ | ------------------- | --------------------------------------------------------------- |
| **Free**     | $0                  | 1 GB storage · 10 AI calls/wk · 1 secret album · 3 capsules     |
| **Plus**     | $5.99 / mo · $39/yr | 25 GB · 200 AI/wk · all themes · unlimited memories · capsules  |
| **Infinite** | $9.99 / mo · $69/yr | 250 GB · 2k AI/wk · 4K replays · priority sync · couples coach  |

### Why three tiers (not two)

Couples apps convert **higher** with a "Plus" tier focused on cosmetics + storage and a separate "Infinite" tier focused on AI. The cosmetic tier reduces objection ("I just want themes"), the AI tier captures the high-intent users who'll pay anything.

## Implementation

- **RevenueCat** wraps StoreKit 2 + Google Billing — single SDK, free under $10k MTR.
- Map RevenueCat entitlement → `profiles.premium_tier` via a Supabase Edge Function webhook.
- Gate features at runtime with `PREMIUM_GATES` from `@soulsync/shared/constants`.

```ts
import { PREMIUM_GATES } from '@soulsync/shared';
const { aiCallsPerWeek } = PREMIUM_GATES[profile.premium_tier];
```

## Non-subscription revenue

- **Cosmetic theme packs** ($1.99 each — Aurora, Sunset, Cyberlove). Pure margin.
- **Anniversary photobook** — print-on-demand via Lulu/Printful, $30/book, ~$15 margin.
- **Couples gift cards** — partner with restaurants, take affiliate cut.
- **Wedding mode upsell** — invite tracking, registry sync, $9.99 one-time.

## Free → Paid funnel

1. Day 0–3: heavy onboarding into chat + memories, lock nothing.
2. Day 4: first soft paywall — "Unlock all 5 themes" (low friction, high yes-rate).
3. Day 7: "On this week 1 year ago" → AI mini-recap (free), with **"Make a full year recap"** CTA → hard paywall.
4. Day 14: streak-based upsell — "Save your 14-day streak forever with unlimited memories."
5. Anniversary day: emotional payload — surfacing forgotten memories drives best conversion.

## KPIs to watch

- D1 / D7 / D30 retention (couples are *both* required to retain → use min of the two)
- Median paid conversion day
- ARPU per *couple* (not user — paying couple = both partners benefit)
- Memories/couple/week — the strongest leading indicator of LTV
