-- =============================================================================
-- SoulSync 007: Unique features — capsules, dreams, silent-care, replays, AI
-- =============================================================================

-- ---------- Digital Time Capsule -------------------------------------------
create table public.time_capsules (
  id            uuid primary key default uuid_generate_v4(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  body          text,                       -- text payload
  media_path    text,                       -- optional encrypted media
  unlock_at     timestamptz not null,
  unlocked_at   timestamptz,
  is_locked     boolean generated always as (unlocked_at is null) stored,
  created_at    timestamptz not null default now(),
  check (unlock_at > created_at)
);
create index capsules_couple_unlock_idx on public.time_capsules(couple_id, unlock_at);

-- ---------- Dream Sync ------------------------------------------------------
create table public.dreams (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  for_date    date not null default current_date,
  body        text not null,
  ai_emotion  text,
  ai_themes   text[] default '{}',
  is_shared   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index dreams_couple_date_idx on public.dreams(couple_id, for_date);

-- ---------- Silent Care -----------------------------------------------------
create table public.silent_care_signals (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  from_user   uuid not null references public.profiles(id) on delete cascade,
  to_user     uuid not null references public.profiles(id) on delete cascade,
  intensity   int not null default 2 check (intensity between 1 and 3),  -- 1 hug, 2 hold, 3 SOS-soft
  acknowledged_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------- AI ledger (cost + audit) ----------------------------------------
create table public.ai_logs (
  id          bigint generated always as identity primary key,
  couple_id   uuid references public.couples(id) on delete set null,
  user_id     uuid references public.profiles(id) on delete set null,
  feature     text not null,         -- 'caption','letter','recap','conflict','aura','dream'
  model       text,
  input_chars int,
  output_chars int,
  cost_micros int,                   -- cost * 1e6
  created_at  timestamptz not null default now()
);
create index ai_logs_couple_idx on public.ai_logs(couple_id, created_at desc);

-- ---------- Yearly relationship replay --------------------------------------
create table public.replays (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  for_year    int  not null,
  video_path  text,                  -- generated mp4 in storage
  cover_path  text,
  stats       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (couple_id, for_year)
);

-- ---------- RLS --------------------------------------------------------------
alter table public.time_capsules         enable row level security;
alter table public.dreams                enable row level security;
alter table public.silent_care_signals   enable row level security;
alter table public.ai_logs               enable row level security;
alter table public.replays               enable row level security;

-- Capsules: locked capsules visible to author only until unlock_at
create policy "capsules_select" on public.time_capsules for select
  using (public.is_couple_member(couple_id, auth.uid())
         and (unlock_at <= now() or author_id = auth.uid()));
create policy "capsules_insert" on public.time_capsules for insert
  with check (author_id = auth.uid() and public.is_couple_member(couple_id, auth.uid()));
create policy "capsules_update_self" on public.time_capsules for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "capsules_delete_self" on public.time_capsules for delete
  using (author_id = auth.uid());

-- Dreams: own always; partner only if is_shared
create policy "dreams_select" on public.dreams for select
  using (user_id = auth.uid() or (is_shared and public.is_couple_member(couple_id, auth.uid())));
create policy "dreams_modify_self" on public.dreams for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "silent_care_member" on public.silent_care_signals for all
  using (public.is_couple_member(couple_id, auth.uid()))
  with check (public.is_couple_member(couple_id, auth.uid()));

create policy "ai_logs_self" on public.ai_logs for select using (user_id = auth.uid());

create policy "replays_member" on public.replays for select
  using (public.is_couple_member(couple_id, auth.uid()));

alter publication supabase_realtime add table public.silent_care_signals;
alter publication supabase_realtime add table public.time_capsules;
