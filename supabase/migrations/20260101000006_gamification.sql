-- =============================================================================
-- SoulSync 006: Gamification, mood, health score
-- =============================================================================

create table public.quests (
  id          uuid primary key default uuid_generate_v4(),
  code        text unique not null,        -- 'daily_chat', 'send_photo', 'new_memory'
  title       text not null,
  description text,
  xp_reward   int not null default 10,
  cadence     text not null default 'daily' check (cadence in ('daily','weekly','once')),
  active      boolean not null default true
);

create table public.quest_progress (
  id           uuid primary key default uuid_generate_v4(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete cascade, -- null = couple-wide
  quest_id     uuid not null references public.quests(id) on delete cascade,
  for_date     date not null default current_date,
  completed_at timestamptz,
  unique (couple_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), quest_id, for_date)
);
create index quest_progress_couple_idx on public.quest_progress(couple_id, for_date);

create table public.achievements (
  id          uuid primary key default uuid_generate_v4(),
  code        text unique not null,
  title       text not null,
  description text,
  icon        text,
  rarity      text not null default 'common' check (rarity in ('common','rare','epic','legendary'))
);

create table public.couple_achievements (
  couple_id     uuid references public.couples(id) on delete cascade,
  achievement_id uuid references public.achievements(id) on delete cascade,
  unlocked_at   timestamptz not null default now(),
  primary key (couple_id, achievement_id)
);

create table public.mood_logs (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  mood        text not null,             -- happy, sad, anxious, loved, ...
  intensity   int  not null check (intensity between 1 and 5),
  note        text,
  for_date    date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (user_id, for_date)
);

create table public.health_snapshots (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  for_week    date not null,             -- monday of the week
  score       numeric(5,2) not null,
  factors     jsonb not null default '{}'::jsonb,   -- {"chat_consistency": 0.92, ...}
  created_at  timestamptz not null default now(),
  unique (couple_id, for_week)
);

-- ---------- RLS --------------------------------------------------------------
alter table public.quests              enable row level security;
alter table public.quest_progress      enable row level security;
alter table public.achievements        enable row level security;
alter table public.couple_achievements enable row level security;
alter table public.mood_logs           enable row level security;
alter table public.health_snapshots    enable row level security;

create policy "quests_read_all"       on public.quests       for select using (active = true);
create policy "achievements_read_all" on public.achievements for select using (true);

create policy "qp_member"   on public.quest_progress      for all using (public.is_couple_member(couple_id, auth.uid())) with check (public.is_couple_member(couple_id, auth.uid()));
create policy "ca_member"   on public.couple_achievements for all using (public.is_couple_member(couple_id, auth.uid())) with check (public.is_couple_member(couple_id, auth.uid()));
create policy "mood_member" on public.mood_logs           for all using (public.is_couple_member(couple_id, auth.uid())) with check (public.is_couple_member(couple_id, auth.uid()));
create policy "hs_member"   on public.health_snapshots    for select using (public.is_couple_member(couple_id, auth.uid()));

-- ---------- seed quests ------------------------------------------------------
insert into public.quests (code, title, description, xp_reward, cadence) values
  ('daily_chat',     'Say good morning',         'Send the first message of the day',                10, 'daily'),
  ('share_photo',    'Capture today',            'Share a photo to your memory vault',                15, 'daily'),
  ('mood_checkin',   'Mood check-in',            'Log how you''re feeling today',                     10, 'daily'),
  ('voice_note',     'Send a voice note',        'Hearing each other matters',                        15, 'daily'),
  ('compliment',     'Send a compliment',        'Use the AI compliment generator',                   20, 'daily'),
  ('plan_a_date',    'Plan a date',              'Add an event to the shared calendar',               25, 'weekly'),
  ('weekly_quiz',    'Take the weekly quiz',     'Compatibility quiz of the week',                    50, 'weekly'),
  ('first_memory',   'Your first memory',        'Add your first memory to the vault',                30, 'once'),
  ('first_capsule',  'Plant a time capsule',     'Schedule a future message',                         30, 'once');

insert into public.achievements (code, title, description, icon, rarity) values
  ('one_week_streak', '7-day streak',  'Connect for 7 days straight', '🔥', 'common'),
  ('thirty_streak',   '30-day streak', 'A whole month, unbroken',     '⚡', 'rare'),
  ('hundred_memos',   '100 memories',  'Vault overflowing',           '📸', 'rare'),
  ('first_year',      '1 year together','Anniversary unlocked',       '💍', 'epic'),
  ('star_couple',     'Star couple',   '500 mutual reactions',        '⭐', 'legendary');
