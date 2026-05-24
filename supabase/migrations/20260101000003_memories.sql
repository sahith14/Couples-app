-- =============================================================================
-- SoulSync 003: Memory Vault — albums, memories, AI captions, secret vault
-- =============================================================================

create table public.albums (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  title       text not null,
  cover_url   text,
  is_secret   boolean not null default false,
  pin_hash    text,                  -- per-album lock for secret albums
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index albums_couple_idx on public.albums(couple_id);

create type memory_kind as enum ('photo','video','audio','note');

create table public.memories (
  id            uuid primary key default uuid_generate_v4(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  album_id      uuid references public.albums(id) on delete set null,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  kind          memory_kind not null,
  storage_path  text not null,           -- bucket path (private)
  thumb_path    text,
  width         int,
  height        int,
  bytes         int,
  duration_ms   int,
  -- AI / metadata
  caption       text,
  ai_caption    text,
  ai_mood       text,                    -- joy, calm, longing, ...
  ai_tags       text[] default '{}',
  taken_at      timestamptz,
  location      geography(Point, 4326),
  place_name    text,
  is_encrypted  boolean not null default false,
  encrypted_key bytea,                   -- per-memory wrapped key for secret vault
  nonce         bytea,
  pinned        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index memories_couple_taken_idx on public.memories(couple_id, taken_at desc nulls last);
create index memories_couple_created_idx on public.memories(couple_id, created_at desc);
create index memories_location_idx on public.memories using gist (location);
create index memories_ai_tags_idx on public.memories using gin (ai_tags);

-- on-this-day view
create or replace view public.on_this_day as
select m.*
from public.memories m
where extract(month from coalesce(m.taken_at, m.created_at)) = extract(month from now())
  and extract(day   from coalesce(m.taken_at, m.created_at)) = extract(day   from now())
  and extract(year  from coalesce(m.taken_at, m.created_at)) <  extract(year from now());

-- ---------- RLS --------------------------------------------------------------
alter table public.albums   enable row level security;
alter table public.memories enable row level security;

create policy "albums_member" on public.albums for all
  using (public.is_couple_member(couple_id, auth.uid()))
  with check (public.is_couple_member(couple_id, auth.uid()));

create policy "memories_member" on public.memories for all
  using (public.is_couple_member(couple_id, auth.uid()))
  with check (public.is_couple_member(couple_id, auth.uid()));

alter publication supabase_realtime add table public.memories;
alter publication supabase_realtime add table public.albums;
