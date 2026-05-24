import { z } from 'zod';

export const profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(60),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_.]+$/i, 'letters, numbers, _ or . only')
    .optional()
    .nullable(),
  bio: z.string().max(280).optional().nullable(),
  pronouns: z.string().max(40).optional().nullable(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  love_language: z.enum(['words', 'acts', 'gifts', 'time', 'touch']).optional().nullable(),
});

export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(6, 'invite codes are 6 characters');

export const messageInputSchema = z.object({
  text: z.string().min(1).max(4000).optional(),
  reply_to: z.string().uuid().optional(),
  expires_in_seconds: z.number().int().min(5).max(60 * 60 * 24 * 7).optional(),
});

export const memoryUploadMetaSchema = z.object({
  kind: z.enum(['photo', 'video', 'audio', 'note']),
  album_id: z.string().uuid().optional().nullable(),
  caption: z.string().max(500).optional().nullable(),
  taken_at: z.string().datetime().optional().nullable(),
  place_name: z.string().max(120).optional().nullable(),
  is_encrypted: z.boolean().optional().default(false),
});

export const eventSchema = z
  .object({
    title: z.string().min(1).max(120),
    description: z.string().max(1000).optional().nullable(),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime().optional().nullable(),
    all_day: z.boolean().optional().default(false),
    location: z.string().max(200).optional().nullable(),
    budget_cents: z.number().int().nonnegative().optional().nullable(),
    category: z
      .enum(['date', 'anniversary', 'birthday', 'trip', 'milestone', 'other'])
      .optional()
      .nullable(),
    surprise_for: z.string().uuid().optional().nullable(),
    reminder_at: z.string().datetime().optional().nullable(),
  })
  .refine((d) => !d.ends_at || new Date(d.ends_at) >= new Date(d.starts_at), {
    path: ['ends_at'],
    message: 'must be after starts_at',
  });

export const moodSchema = z.object({
  mood: z.enum([
    'happy',
    'sad',
    'anxious',
    'loved',
    'tired',
    'excited',
    'angry',
    'calm',
    'longing',
  ]),
  intensity: z.number().int().min(1).max(5),
  note: z.string().max(280).optional().nullable(),
});

export const capsuleSchema = z
  .object({
    title: z.string().min(1).max(120),
    body: z.string().max(5000).optional().nullable(),
    unlock_at: z.string().datetime(),
  })
  .refine((d) => new Date(d.unlock_at).getTime() > Date.now() + 60_000, {
    path: ['unlock_at'],
    message: 'must be at least 1 minute in the future',
  });

export const dreamSchema = z.object({
  body: z.string().min(1).max(2000),
  is_shared: z.boolean().optional().default(true),
});
