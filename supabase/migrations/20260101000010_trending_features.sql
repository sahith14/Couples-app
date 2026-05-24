-- =============================================================================
-- SoulSync 010: trending features sprint
--   - Scheduled messages (future-send) + cron dispatcher
--   - Instants (24h disappearing photo/text/mood posts, like IG Notes)
--   - Live phone status sharing (battery, DND, focus mode, current screen)
--   - Widget payload view (one cheap query for native widgets)
-- =============================================================================

-- ============================ Scheduled messages =============================
alter table public.messages
  add column if not exists scheduled_at timestamptz,
  add column if not exists scheduled_dispatched_at timestamptz;

comment on column public.messages.scheduled_at is
  'When set in the future, the message is hidden until dispatch_due_messages() flips it.';

create index if not exists messages_scheduled_idx
  on public.messages(scheduled_at)
  where scheduled_at is not null and scheduled_dispatched_at is null;

drop policy if exists "msg_select_member" on public.messages;
create policy "msg_select_member" on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and public.is_couple_member(c.couple_id, auth.uid())
    )
    and (
      scheduled_at is null
      or scheduled_dispatched_at is not null
      or sender_id = auth.uid()
    )
  );

create or replace function public.dispatch_due_messages()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with due as (
    update public.messages
       set scheduled_dispatched_at = now(),
           created_at = now()
     where scheduled_at is not null
       and scheduled_dispatched_at is null
       and scheduled_at <= now()
    returning id
  )
  select count(*) into v_count from due;
  return coalesce(v_count, 0);
end $$;
grant execute on function public.dispatch_due_messages() to service_role;

-- ============================ Instants =======================================
create table public.instants (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('photo','text','mood')),
  body        text,
  mood        text,
  media_path  text,
  ciphertext  bytea,
  nonce       bytea,
  media_nonce bytea,
  expires_at  timestamptz not null default (now() + interval '24 hours'),
  views       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index instants_couple_expires_idx on public.instants(couple_id, expires_at);

alter table public.instants enable row level security;

create policy "instants_member" on public.instants for select
  using (public.is_couple_member(couple_id, auth.uid()) and expires_at > now());

create policy "instants_insert_self" on public.instants for insert
  with check (author_id = auth.uid() and public.is_couple_member(couple_id, auth.uid()));

create policy "instants_delete_self" on public.instants for delete
  using (author_id = auth.uid());

create or replace function public.mark_instant_seen(p_instant uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'auth required'; end if;
  update public.instants
     set views = jsonb_set(coalesce(views,'{}'::jsonb), array[v_user::text], to_jsonb(now()), true)
   where id = p_instant
     and public.is_couple_member(couple_id, v_user)
     and author_id <> v_user;
end $$;
grant execute on function public.mark_instant_seen(uuid) to authenticated;

create or replace function public.purge_expired_instants()
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  with d as (delete from public.instants where expires_at <= now() returning 1)
    select count(*) into v from d;
  return coalesce(v, 0);
end $$;
grant execute on function public.purge_expired_instants() to service_role;

alter publication supabase_realtime add table public.instants;

-- ============================ Phone status ===================================
create table public.phone_status (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  couple_id         uuid not null references public.couples(id) on delete cascade,
  battery_pct       int  check (battery_pct between 0 and 100),
  is_charging       boolean,
  battery_low       boolean,
  dnd               boolean,
  focus_mode        text,
  active            boolean not null default true,
  current_screen    text,
  now_playing_title text,
  now_playing_app   text,
  online_at         timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index phone_status_couple_idx on public.phone_status(couple_id);

alter table public.phone_status enable row level security;

create policy "phone_status_self_write" on public.phone_status for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "phone_status_partner_read" on public.phone_status for select
  using (
    public.is_couple_member(couple_id, auth.uid())
    and not (
      user_id <> auth.uid()
      and exists (select 1 from public.profiles p where p.id = user_id and p.ghost_mode = true)
    )
  );

alter publication supabase_realtime add table public.phone_status;

-- ============================ Widget payload view ============================
create or replace view public.widget_payload as
select
  c.id                                              as couple_id,
  c.user_a, c.user_b,
  c.anniversary,
  c.streak_count,
  c.level,
  c.xp,
  (
    select row_to_json(ps.*)
      from public.phone_status ps
     where ps.couple_id = c.id and ps.user_id <> auth.uid()
     limit 1
  )                                                 as partner_status,
  (
    select row_to_json(ml.*)
      from public.mood_logs ml
     where ml.couple_id = c.id and ml.user_id <> auth.uid()
       and ml.for_date = current_date
     order by ml.created_at desc
     limit 1
  )                                                 as partner_mood,
  (
    select row_to_json(i.*)
      from public.instants i
     where i.couple_id = c.id and i.author_id <> auth.uid()
       and i.expires_at > now()
     order by i.created_at desc
     limit 1
  )                                                 as latest_instant
from public.couples c
where c.user_a = auth.uid() or c.user_b = auth.uid();

grant select on public.widget_payload to authenticated;

create or replace function public.touch_phone_status(
  p_battery int,
  p_charging boolean,
  p_dnd boolean,
  p_focus text,
  p_screen text,
  p_active boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_couple uuid := public.current_couple_id();
begin
  if v_user is null or v_couple is null then return; end if;
  insert into public.phone_status as ps
    (user_id, couple_id, battery_pct, is_charging, battery_low, dnd, focus_mode, current_screen, active, online_at, updated_at)
  values
    (v_user, v_couple, p_battery, coalesce(p_charging, false),
     case when p_battery is not null then p_battery <= 20 else null end,
     coalesce(p_dnd, false), p_focus, p_screen, coalesce(p_active, true), now(), now())
  on conflict (user_id) do update set
    couple_id      = excluded.couple_id,
    battery_pct    = coalesce(excluded.battery_pct, ps.battery_pct),
    is_charging    = coalesce(excluded.is_charging, ps.is_charging),
    battery_low    = excluded.battery_low,
    dnd            = coalesce(excluded.dnd, ps.dnd),
    focus_mode     = excluded.focus_mode,
    current_screen = excluded.current_screen,
    active         = coalesce(excluded.active, ps.active),
    online_at      = now(),
    updated_at     = now();
end $$;
grant execute on function public.touch_phone_status(int, boolean, boolean, text, text, boolean) to authenticated;
