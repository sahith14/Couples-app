-- =============================================================================
-- SoulSync 005: Date Planner + shared utilities
-- =============================================================================

-- ---------- calendar / dates -------------------------------------------------
create table public.events (
  id           uuid primary key default uuid_generate_v4(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  description  text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  all_day      boolean not null default false,
  location     text,
  geo          geography(Point, 4326),
  budget_cents int,
  category     text check (category in ('date','anniversary','birthday','trip','milestone','other')),
  surprise_for uuid references public.profiles(id),  -- hidden from this user
  cover_url    text,
  reminder_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index events_couple_starts_idx on public.events(couple_id, starts_at);

-- ---------- shared notes -----------------------------------------------------
create table public.notes (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  title       text,
  body        text not null default '',
  emoji       text,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index notes_couple_idx on public.notes(couple_id, updated_at desc);

-- ---------- shared task lists -----------------------------------------------
create table public.task_lists (
  id         uuid primary key default uuid_generate_v4(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  title      text not null,
  emoji      text,
  kind       text not null default 'todo' check (kind in ('todo','grocery','shopping')),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id            uuid primary key default uuid_generate_v4(),
  list_id       uuid not null references public.task_lists(id) on delete cascade,
  couple_id     uuid not null references public.couples(id) on delete cascade,
  title         text not null,
  done          boolean not null default false,
  done_by       uuid references public.profiles(id),
  done_at       timestamptz,
  assignee_id   uuid references public.profiles(id),
  due_at        timestamptz,
  position      int not null default 0,
  created_at    timestamptz not null default now()
);
create index tasks_list_idx on public.tasks(list_id, position);

-- ---------- shared wishlist + watchlist -------------------------------------
create table public.wishlist_items (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  added_by    uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  url         text,
  image_url   text,
  price_cents int,
  currency    text default 'USD',
  category    text,
  for_user    uuid references public.profiles(id),
  purchased   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.watchlist_items (
  id           uuid primary key default uuid_generate_v4(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  added_by     uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  kind         text not null default 'movie' check (kind in ('movie','show','anime','documentary')),
  poster_url   text,
  external_id  text,                -- TMDB id etc
  rating       numeric(3,1),
  watched      boolean not null default false,
  watched_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------- shared finances --------------------------------------------------
create table public.finance_entries (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  payer_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  amount_cents int not null,
  currency    text not null default 'USD',
  category    text,
  split       text not null default '50_50' check (split in ('50_50','payer','custom')),
  custom_share jsonb,                 -- {"<uid>": cents, ...}
  occurred_on date not null default current_date,
  created_at  timestamptz not null default now()
);
create index finance_couple_idx on public.finance_entries(couple_id, occurred_on desc);

-- ---------- RLS --------------------------------------------------------------
alter table public.events           enable row level security;
alter table public.notes            enable row level security;
alter table public.task_lists       enable row level security;
alter table public.tasks            enable row level security;
alter table public.wishlist_items   enable row level security;
alter table public.watchlist_items  enable row level security;
alter table public.finance_entries  enable row level security;

create policy "events_select_member" on public.events for select
  using (public.is_couple_member(couple_id, auth.uid())
         and (surprise_for is null or surprise_for <> auth.uid()));
create policy "events_modify_member" on public.events for insert with check (public.is_couple_member(couple_id, auth.uid()));
create policy "events_update_member" on public.events for update using (public.is_couple_member(couple_id, auth.uid())) with check (public.is_couple_member(couple_id, auth.uid()));
create policy "events_delete_member" on public.events for delete using (public.is_couple_member(couple_id, auth.uid()));
create policy "notes_member"     on public.notes            for all using (public.is_couple_member(couple_id, auth.uid())) with check (public.is_couple_member(couple_id, auth.uid()));
create policy "lists_member"     on public.task_lists       for all using (public.is_couple_member(couple_id, auth.uid())) with check (public.is_couple_member(couple_id, auth.uid()));
create policy "tasks_member"     on public.tasks            for all using (public.is_couple_member(couple_id, auth.uid())) with check (public.is_couple_member(couple_id, auth.uid()));
create policy "wishlist_member"  on public.wishlist_items   for all using (public.is_couple_member(couple_id, auth.uid())) with check (public.is_couple_member(couple_id, auth.uid()));
create policy "watchlist_member" on public.watchlist_items  for all using (public.is_couple_member(couple_id, auth.uid())) with check (public.is_couple_member(couple_id, auth.uid()));
create policy "finance_member"   on public.finance_entries  for all using (public.is_couple_member(couple_id, auth.uid())) with check (public.is_couple_member(couple_id, auth.uid()));

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.tasks;
