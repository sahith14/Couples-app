// Mirrors public schema in supabase/migrations.
// Keep this file in sync when running new migrations (or generate via supabase gen types).

export type UUID = string;

export type PremiumTier = 'free' | 'plus' | 'infinite';
export type LoveLanguage = 'words' | 'acts' | 'gifts' | 'time' | 'touch';
export type MessageKind =
  | 'text'
  | 'image'
  | 'video'
  | 'voice'
  | 'sticker'
  | 'system'
  | 'capsule_unlock'
  | 'silent_care';
export type MemoryKind = 'photo' | 'video' | 'audio' | 'note';
export type MoodKey =
  | 'happy'
  | 'sad'
  | 'anxious'
  | 'loved'
  | 'tired'
  | 'excited'
  | 'angry'
  | 'calm'
  | 'longing';

export interface Profile {
  id: UUID;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  birthday: string | null;
  pronouns: string | null;
  love_language: LoveLanguage | null;
  push_token: string | null;
  premium_tier: PremiumTier;
  premium_until: string | null;
  ghost_mode: boolean;
  low_bandwidth: boolean;
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface Couple {
  id: UUID;
  user_a: UUID;
  user_b: UUID;
  status: 'active' | 'paused' | 'ended';
  anniversary: string | null;
  pet_name_a: string | null;
  pet_name_b: string | null;
  song_url: string | null;
  cover_url: string | null;
  theme: string;
  streak_count: number;
  streak_last_day: string | null;
  xp: number;
  level: number;
  health_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: UUID;
  couple_id: UUID;
  pinned_msg: UUID | null;
  wallpaper: string | null;
  created_at: string;
}

export interface Message {
  id: UUID;
  conversation_id: UUID;
  sender_id: UUID;
  kind: MessageKind;
  ciphertext: string | null; // base64 from server (bytea)
  nonce: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_bytes: number | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  reply_to: UUID | null;
  reactions: Record<string, UUID[]>;
  read_at: string | null;
  delivered_at: string | null;
  expires_at: string | null;
  edited_at: string | null;
  pinned: boolean;
  created_at: string;
}

/** Decoded form held in memory after client-side decryption. */
export interface DecryptedMessage extends Omit<Message, 'ciphertext' | 'nonce'> {
  text?: string;
}

export interface Memory {
  id: UUID;
  couple_id: UUID;
  album_id: UUID | null;
  author_id: UUID;
  kind: MemoryKind;
  storage_path: string;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  duration_ms: number | null;
  caption: string | null;
  ai_caption: string | null;
  ai_mood: string | null;
  ai_tags: string[];
  taken_at: string | null;
  place_name: string | null;
  is_encrypted: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Album {
  id: UUID;
  couple_id: UUID;
  title: string;
  cover_url: string | null;
  is_secret: boolean;
  sort_order: number;
}

export interface LocationLatest {
  user_id: UUID;
  couple_id: UUID;
  point: { type: 'Point'; coordinates: [number, number] };
  battery_pct: number | null;
  is_moving: boolean | null;
  updated_at: string;
}

export interface Geofence {
  id: UUID;
  couple_id: UUID;
  owner_id: UUID;
  label: string;
  emoji: string | null;
  center: { type: 'Point'; coordinates: [number, number] };
  radius_m: number;
  notify_on_enter: boolean;
  notify_on_exit: boolean;
}

export interface CalendarEvent {
  id: UUID;
  couple_id: UUID;
  created_by: UUID;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  budget_cents: number | null;
  category: 'date' | 'anniversary' | 'birthday' | 'trip' | 'milestone' | 'other' | null;
  surprise_for: UUID | null;
  cover_url: string | null;
  reminder_at: string | null;
}

export interface Note {
  id: UUID;
  couple_id: UUID;
  author_id: UUID;
  title: string | null;
  body: string;
  emoji: string | null;
  pinned: boolean;
  updated_at: string;
}

export interface Task {
  id: UUID;
  list_id: UUID;
  couple_id: UUID;
  title: string;
  done: boolean;
  done_by: UUID | null;
  done_at: string | null;
  assignee_id: UUID | null;
  due_at: string | null;
  position: number;
}

export interface MoodLog {
  id: UUID;
  couple_id: UUID;
  user_id: UUID;
  mood: MoodKey;
  intensity: 1 | 2 | 3 | 4 | 5;
  note: string | null;
  for_date: string;
  created_at: string;
}

export interface TimeCapsule {
  id: UUID;
  couple_id: UUID;
  author_id: UUID;
  title: string;
  body: string | null;
  media_path: string | null;
  unlock_at: string;
  unlocked_at: string | null;
  is_locked: boolean;
}

export interface Dream {
  id: UUID;
  couple_id: UUID;
  user_id: UUID;
  for_date: string;
  body: string;
  ai_emotion: string | null;
  ai_themes: string[];
  is_shared: boolean;
}

export interface SilentCareSignal {
  id: UUID;
  couple_id: UUID;
  from_user: UUID;
  to_user: UUID;
  intensity: 1 | 2 | 3;
  acknowledged_at: string | null;
  created_at: string;
}

export interface Quest {
  id: UUID;
  code: string;
  title: string;
  description: string | null;
  xp_reward: number;
  cadence: 'daily' | 'weekly' | 'once';
  active: boolean;
}

export interface Achievement {
  id: UUID;
  code: string;
  title: string;
  description: string | null;
  icon: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}
