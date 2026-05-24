-- =============================================================================
-- SoulSync 004: Live Location & Safety
-- =============================================================================

create table public.location_pings (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  couple_id     uuid not null references public.couples(id)  on delete cascade,
  point         geography(Point, 4326) not null,
  accuracy_m    real,
  speed_mps     real,
  heading_deg   real,
  altitude_m    real,
  battery_pct   int,
  is_charging   boolean,
  is_moving     boolean,
  recorded_at   timestamptz not null default now()
);

-- Hot table: keep only last 7 days hot, partition or prune via cron
create index location_pings_couple_time_idx on public.location_pings(couple_id, recorded_at desc);
create index location_pings_user_time_idx   on public.location_pings(user_id,   recorded_at desc);
create index location_pings_geo_idx         on public.location_pings using gist (point);

-- Latest known location materialized snapshot per user (cheap reads for UI)
create table public.location_latest (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  couple_id   uuid not null references public.couples(id)     on delete cascade,
  point       geography(Point, 4326) not null,
  battery_pct int,
  is_moving   boolean,
  updated_at  timestamptz not null default now()
);

create or replace function public.tg_update_location_latest()
returns trigger language plpgsql as $$
begin
  insert into public.location_latest(user_id, couple_id, point, battery_pct, is_moving, updated_at)
  values (new.user_id, new.couple_id, new.point, new.battery_pct, new.is_moving, new.recorded_at)
  on conflict (user_id) do update set
    couple_id   = excluded.couple_id,
    point       = excluded.point,
    battery_pct = excluded.battery_pct,
    is_moving   = excluded.is_moving,
    updated_at  = excluded.updated_at;
  return new;
end $$;

create trigger location_pings_to_latest
after insert on public.location_pings
for each row execute procedure public.tg_update_location_latest();

-- Geofences (home, work, gym, ...)
create table public.geofences (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  label       text not null,
  emoji       text,
  center      geography(Point, 4326) not null,
  radius_m    int  not null check (radius_m between 30 and 5000),
  notify_on_enter boolean not null default true,
  notify_on_exit  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index geofences_couple_idx on public.geofences(couple_id);
create index geofences_geo_idx    on public.geofences using gist (center);

-- Trips: derived from continuous moving pings
create table public.trips (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  started_at  timestamptz not null,
  ended_at    timestamptz,
  distance_m  int,
  path        geography(LineString, 4326),
  start_label text,
  end_label   text
);

create index trips_couple_idx on public.trips(couple_id, started_at desc);

-- Emergency / SOS
create table public.sos_events (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  point       geography(Point, 4326),
  message     text,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------- RLS --------------------------------------------------------------
alter table public.location_pings  enable row level security;
alter table public.location_latest enable row level security;
alter table public.geofences       enable row level security;
alter table public.trips           enable row level security;
alter table public.sos_events      enable row level security;

-- Insert: only self; Select: couple members
create policy "loc_pings_insert_self" on public.location_pings for insert with check (user_id = auth.uid());
create policy "loc_pings_select_couple" on public.location_pings for select
  using (public.is_couple_member(couple_id, auth.uid())
         and not (
           -- ghost mode: other user can't read your pings
           user_id <> auth.uid() and
           exists (select 1 from public.profiles p where p.id = user_id and p.ghost_mode = true)
         ));

create policy "loc_latest_select_couple" on public.location_latest for select
  using (public.is_couple_member(couple_id, auth.uid())
         and not (
           user_id <> auth.uid() and
           exists (select 1 from public.profiles p where p.id = user_id and p.ghost_mode = true)
         ));
create policy "loc_latest_upsert_self" on public.location_latest for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "geofences_member" on public.geofences for all
  using (public.is_couple_member(couple_id, auth.uid()))
  with check (public.is_couple_member(couple_id, auth.uid()));

create policy "trips_member" on public.trips for all
  using (public.is_couple_member(couple_id, auth.uid()))
  with check (public.is_couple_member(couple_id, auth.uid()));

create policy "sos_member" on public.sos_events for all
  using (public.is_couple_member(couple_id, auth.uid()))
  with check (public.is_couple_member(couple_id, auth.uid()));

alter publication supabase_realtime add table public.location_latest;
alter publication supabase_realtime add table public.sos_events;
