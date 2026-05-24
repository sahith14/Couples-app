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
} as const;

export const PREMIUM_GATES = {
  free: {
    storageGB: 1,
    aiCallsPerWeek: 10,
    secretAlbums: 1,
    capsulesActive: 3,
  },
  plus: {
    storageGB: 25,
    aiCallsPerWeek: 200,
    secretAlbums: 25,
    capsulesActive: 50,
  },
  infinite: {
    storageGB: 250,
    aiCallsPerWeek: 2_000,
    secretAlbums: 1_000,
    capsulesActive: 1_000,
  },
} as const;

export const LOCATION_PING_INTERVAL_MS = 60_000;        // foreground
export const LOCATION_PING_BG_DISTANCE_M = 100;         // bg distance filter
export const TYPING_TTL_MS = 4_000;
export const STREAK_GRACE_HOURS = 6;

export const SOULSYNC = {
  appName: 'SoulSync',
  scheme: 'soulsync',
  inviteHelp: 'Ask your partner to enter this 6-character code in the app.',
};
