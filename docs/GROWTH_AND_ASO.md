# Viral growth & ASO

## The fundamental loop

SoulSync has a **mandatory two-sided invite**: you cannot use it alone. That's a viral coefficient floor of **K ≥ 1.0** if onboarding completion stays above ~50% — which is achievable when the inviter has emotional skin in the game.

> Optimization rule: any friction added to onboarding costs you ~30% on K. Treat the pair flow as sacred.

## Mechanics already built

1. **6-character codes** (no link routing required, easy to text).
2. **Auto-redirect** — partner joins → both phones snap into the home tab. Magical.
3. **First-3-min wow:** anniversary counter + heartbeat ring + first photo upload, all done before any feature explanation.

## Add next (high impact, ~1 sprint each)

### 1. Anniversary share card
Tappable image-share of "We've been together 412 days 💗 SoulSync" → renders a beautiful gradient card via `react-native-view-shot`. Auto-stamp `soulsync.app/r/<code>`.

### 2. AI Recap previews on TikTok-friendly aspect ratios
Generate 9:16 30-second recap videos. Watermark with handle. Couples *will* post these without prompting.

### 3. Friend-of-couple referral
"Invite another couple, get 1 month Plus free for both of you." Unlocks a 4-person group chat for couples-of-couples (untapped feature).

### 4. Streak loss-aversion push
Day 6 of streak: push notification at 9pm "1 day left to keep your 6-day streak with [Partner]." Massive D7 lift in tested benchmarks.

### 5. Time capsule unlocks as TikTok content
"3 years ago I sent myself this capsule. I just unlocked it." Inherently shareable. Stamp the unlock UI for screen recording.

## ASO

### App Store

**Title (30 chars):** `SoulSync: Couple's Vault`
**Subtitle (30):** `Memories, chat, mood, more`
**Keywords (100, no spaces):** `couple,couples,relationship,love,partner,boyfriend,girlfriend,memories,paired,between,lasting,lovewick,life360,widget,longdistance`

**Screenshots (these matter most):**
1. Aurora hero — anniversary counter
2. Heartbeat mode (motion screenshot)
3. Memory vault grid (real-looking content)
4. Live location with privacy framing — "Ghost mode anytime"
5. Time capsule — "Send a message to 2026"
6. Theme picker — visual variety
7. End-to-end encryption badge — trust

### Google Play

**Short description (80):** `Your private app for two. Memories, chat, location, mood — end-to-end encrypted.`
**Long description top:** lead with emotion, not features. Bullet list at line 6+.

### Localization that pays back

Translate to: **Hindi, Spanish, Brazilian Portuguese, Indonesian, Vietnamese, Japanese, Korean, Turkish.** These are couples-app powerhouses with low CAC.

## Paid acquisition (when ready)

- **TikTok Spark Ads** featuring real users' AI recaps — 3–5x cheaper than Meta for couples niche.
- **Reddit r/relationships, r/LongDistance** — sponsored posts work surprisingly well, audience is qualified.
- **Influencer barter** — give 100 micro-couple-creators lifetime Infinite, ask for one organic post on anniversary.

## Anti-patterns to avoid

- ❌ Force notifications turned on at signup → kills D1.
- ❌ Pay-to-pair → annihilates K.
- ❌ Invite gating themes → looks like a trick. Free users get 2 themes; paid get 5.
