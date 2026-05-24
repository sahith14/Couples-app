export const QUEST_CODES = {
  daily_chat: 'daily_chat',
  share_photo: 'share_photo',
  mood_checkin: 'mood_checkin',
  voice_note: 'voice_note',
  compliment: 'compliment',
  plan_a_date: 'plan_a_date',
  weekly_quiz: 'weekly_quiz',
  first_memory: 'first_memory',
  first_capsule: 'first_capsule',
  first_instant: 'first_instant',
  schedule_msg:  'schedule_msg',
} as const;

/**
 * Per-tier feature limits. Stored in code (not DB) because they're checked
 * on the client to gate UI and on the server-via-Edge-Functions to enforce.
 */
export const PREMIUM_GATES = {
  free: {
    storageGB: 1,
    aiCallsPerWeek: 10,
    secretAlbums: 1,
    capsulesActive: 3,
    instantsPerDay: 3,
    scheduledMessagesActive: 3,
    videoCallMinutesPerMonth: 60,
    widgets: false,
  },
  plus: {
    storageGB: 25,
    aiCallsPerWeek: 200,
    secretAlbums: 25,
    capsulesActive: 50,
    instantsPerDay: 30,
    scheduledMessagesActive: 50,
    videoCallMinutesPerMonth: 600,
    widgets: true,
  },
  infinite: {
    storageGB: 250,
    aiCallsPerWeek: 2_000,
    secretAlbums: 1_000,
    capsulesActive: 1_000,
    instantsPerDay: 200,
    scheduledMessagesActive: 1_000,
    videoCallMinutesPerMonth: -1,         // unlimited
    widgets: true,
  },
} as const;

/**
 * Plans surface in the paywall. Pricing is in Indian rupees (₹) — designed for
 * the Indian market where SoulSync launches first. Mobile billing handled via
 * RevenueCat → App Store / Play Billing; the IDs map to your store products.
 */
export type PlanId = 'trial_weekly' | 'plus_monthly' | 'plus_yearly' | 'lifetime';

export interface Plan {
  id: PlanId;
  tier: keyof typeof PREMIUM_GATES;
  /** Display label in the paywall card. */
  label: string;
  /** Subhead shown under the label. */
  pitch: string;
  /** Display price as already-formatted string in INR. */
  price: string;
  /** Period suffix shown next to price. */
  period: string;
  /** Monthly-equivalent in rupees, for the "save N%" maths. */
  monthlyEquivalentInr: number;
  /** RevenueCat product identifier — set in your dashboard. */
  productId: string;
  /** Show a glow / highlight ring around this plan. */
  highlight?: boolean;
  /** Show a small "save N%" badge. */
  savingsLabel?: string;
}

export const PLANS: Plan[] = [
  {
    id: 'trial_weekly',
    tier: 'plus',
    label: '7-day trial',
    pitch: 'Try every Plus feature for a week',
    price: '₹49',
    period: '/wk',
    monthlyEquivalentInr: 196,
    productId: 'soulsync.plus.weekly_trial',
  },
  {
    id: 'plus_monthly',
    tier: 'plus',
    label: 'Plus',
    pitch: 'The full SoulSync experience',
    price: '₹149',
    period: '/mo',
    monthlyEquivalentInr: 149,
    productId: 'soulsync.plus.monthly',
    highlight: true,
  },
  {
    id: 'plus_yearly',
    tier: 'plus',
    label: 'Plus · Yearly',
    pitch: 'Best value — 12 months of love',
    price: '₹999',
    period: '/yr',
    monthlyEquivalentInr: 83,
    productId: 'soulsync.plus.yearly',
    savingsLabel: 'save 44%',
  },
  {
    id: 'lifetime',
    tier: 'infinite',
    label: 'Forever',
    pitch: 'One payment. Yours forever.',
    price: '₹4,999',
    period: ' once',
    monthlyEquivalentInr: 0,
    productId: 'soulsync.infinite.lifetime',
    savingsLabel: 'pay once',
  },
];

export const CURRENCY = { code: 'INR', symbol: '₹', locale: 'en-IN' } as const;

export const LOCATION_PING_INTERVAL_MS = 60_000;        // foreground
export const LOCATION_PING_BG_DISTANCE_M = 100;         // bg distance filter
export const PHONE_STATUS_INTERVAL_MS    = 90_000;      // periodic status push
export const TYPING_TTL_MS = 4_000;
export const STREAK_GRACE_HOURS = 6;
export const INSTANT_TTL_HOURS = 24;

export const SOULSYNC = {
  appName: 'SoulSync',
  scheme: 'soulsync',
  inviteHelp: 'Ask your partner to enter this 6-character code in the app.',
  /** Used as the iOS App Group + Android shared prefs key for the widget. */
  widgetGroupId: 'group.app.soulsync.widget',
};
