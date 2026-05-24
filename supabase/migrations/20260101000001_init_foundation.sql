-- =============================================================================
-- SoulSync 001: Foundation — extensions, profiles, couples, invites
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";
create extension if not exists "citext";

-- ---------- profiles ---------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text        not null check (char_length(display_name) between 1 and 60),
  username        citext      unique,
  avatar_url      text,
  bio             text        check (char_length(bio) <= 280),
  birthday        date,
  pronouns        text,
  love_language   text        check (love_language in ('words','acts','gifts','time','touch')),
  push_token      text,
  device_locale   text,
  premium_tier    text        not null default 'free' check (premium_tier in ('free','plus','infinite')),
  premium_until   timestamptz,
  pin_hash        text,
  ghost_mode      boolean     not null default false,
  low_bandwidth   boolean     not null default false,
  theme           text        not null default 'romantic-dark',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_username_trgm on public.profiles using gin (username gin_trgm_ops);

-- ---------- couples ----------------------------------------------------------
create table public.couples (
  id              uuid primary key default uuid_generate_v4(),
  user_a          uuid not null references public.profiles(id) on delete cascade,
  user_b          uuid not null references public.profiles(id) on delete cascade,
  status          text not null default 'active' check (status in ('active','paused','ended')),
  anniversary     date,
  pet_name_a      text,
  pet_name_b      text,
  song_url        text,
  cover_url       text,
  theme           text not null default 'aurora',
  streak_count    int  not null default 0,
  streak_last_day date,
  xp              int  not null default 0,
  level           int  not null default 1,
  health_score    numeric(5,2) default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint couples_distinct check (user_a <> user_b),
  constraint couples_unique unique (user_a, user_b)
);

create index couples_user_a_idx on public.couples(user_a);
create index couples_user_b_idx on public.couples(user_b);

-- ---------- invite codes -----------------------------------------------------
create table public.couple_invites (
  id          uuid primary key default uuid_generate_v4(),
  code        text unique not null,
  inviter_id  uuid not null references public.profiles(id) on delete cascade,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  consumed_by uuid references public.profiles(id) on delete set null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index couple_invites_inviter_idx on public.couple_invites(inviter_id);

-- ---------- helper: check membership -----------------------------------------
create or replace function public.is_couple_member(p_couple uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.couples c
    where c.id = p_couple and (c.user_a = p_user or c.user_b = p_user)
  );
$$;

create or replace function public.current_couple_id()
returns uuid language sql stable security definer set search_path = public as $$
  select c.id from public.couples c
  where c.user_a = auth.uid() or c.user_b = auth.uid()
  order by c.created_at desc
  limit 1;
$$;

create or replace function public.partner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select case when c.user_a = auth.uid() then c.user_b else c.user_a end
  from public.couples c
  where c.user_a = auth.uid() or c.user_b = auth.uid()
  order by c.created_at desc
  limit 1;
$$;

-- ---------- updated_at trigger generator -------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_set_updated before update on public.profiles
  for each row execute procedure public.tg_set_updated_at();
create trigger couples_set_updated before update on public.couples
  for each row execute procedure public.tg_set_updated_at();

-- ---------- RLS --------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.couples         enable row level security;
alter table public.couple_invites  enable row level security;

-- profiles: self full access; partner read; everyone read minimal public via RPC
create policy "profiles_self"        on public.profiles for all      using (id = auth.uid())                with check (id = auth.uid());
create policy "profiles_partner_read" on public.profiles for select  using (id = public.partner_id());

-- couples: only members
create policy "couples_member_select" on public.couples for select  using (user_a = auth.uid() or user_b = auth.uid());
create policy "couples_member_update" on public.couples for update  using (user_a = auth.uid() or user_b = auth.uid());
create policy "couples_member_insert" on public.couples for insert  with check (user_a = auth.uid() or user_b = auth.uid());
create policy "couples_member_delete" on public.couples for delete  using (user_a = auth.uid() or user_b = auth.uid());

-- invites: inviter manages; consumer can read by code via RPC only
create policy "invites_inviter_all"  on public.couple_invites for all using (inviter_id = auth.uid()) with check (inviter_id = auth.uid());
