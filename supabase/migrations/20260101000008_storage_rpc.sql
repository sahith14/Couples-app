-- =============================================================================
-- SoulSync 008: Storage buckets, RPCs (pairing, redemption), device sessions
-- =============================================================================

-- ---------- Storage buckets --------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',  'avatars',  true,  5  * 1024 * 1024, array['image/jpeg','image/png','image/webp','image/heic']),
  ('memories', 'memories', false, 50 * 1024 * 1024, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']),
  ('chat',     'chat',     false, 50 * 1024 * 1024, null),
  ('voice',    'voice',    false, 15 * 1024 * 1024, array['audio/mp4','audio/m4a','audio/aac','audio/mpeg','audio/ogg']),
  ('replays',  'replays',  false, 200 * 1024 * 1024, array['video/mp4'])
on conflict (id) do nothing;

-- Storage policies: path convention `{couple_id}/{...}`
-- avatars bucket: profile-owner writes, public read
create policy "avatars_read_public" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars_write_self" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_self" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- memories / chat / voice / replays: couple member only, identified via path[1] = couple_id
create policy "couple_storage_read" on storage.objects for select
  using (bucket_id in ('memories','chat','voice','replays')
         and public.is_couple_member(((storage.foldername(name))[1])::uuid, auth.uid()));
create policy "couple_storage_write" on storage.objects for insert
  with check (bucket_id in ('memories','chat','voice','replays')
              and public.is_couple_member(((storage.foldername(name))[1])::uuid, auth.uid()));
create policy "couple_storage_update" on storage.objects for update
  using (bucket_id in ('memories','chat','voice','replays')
         and public.is_couple_member(((storage.foldername(name))[1])::uuid, auth.uid()));
create policy "couple_storage_delete" on storage.objects for delete
  using (bucket_id in ('memories','chat','voice','replays')
         and public.is_couple_member(((storage.foldername(name))[1])::uuid, auth.uid()));

-- ---------- Pairing RPCs -----------------------------------------------------
create or replace function public.generate_invite_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_inviter uuid := auth.uid();
begin
  if v_inviter is null then raise exception 'auth required'; end if;
  -- 6-char human-friendly (no confusing chars)
  v_code := upper(substring(translate(encode(gen_random_bytes(8),'base64'),'+/=Il0O','') from 1 for 6));
  insert into public.couple_invites (code, inviter_id) values (v_code, v_inviter);
  return v_code;
end $$;

create or replace function public.redeem_invite_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv  public.couple_invites%rowtype;
  v_user uuid := auth.uid();
  v_couple_id uuid;
begin
  if v_user is null then raise exception 'auth required'; end if;
  select * into v_inv from public.couple_invites
   where code = upper(p_code) and consumed_by is null and expires_at > now()
   for update;
  if not found then raise exception 'invalid_or_expired'; end if;
  if v_inv.inviter_id = v_user then raise exception 'cannot_pair_self'; end if;

  -- Either user already in a couple? prevent double-pair
  if exists (select 1 from public.couples where user_a in (v_inv.inviter_id, v_user) or user_b in (v_inv.inviter_id, v_user)) then
    raise exception 'already_paired';
  end if;

  insert into public.couples (user_a, user_b) values (v_inv.inviter_id, v_user)
  returning id into v_couple_id;
  insert into public.conversations (couple_id) values (v_couple_id);

  update public.couple_invites set consumed_by = v_user, consumed_at = now() where id = v_inv.id;
  return v_couple_id;
end $$;

grant execute on function public.generate_invite_code() to authenticated;
grant execute on function public.redeem_invite_code(text) to authenticated;

-- ---------- XP / streak helpers ---------------------------------------------
create or replace function public.add_xp(p_couple uuid, p_xp int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_couple_member(p_couple, auth.uid()) then raise exception 'forbidden'; end if;
  update public.couples set
    xp = xp + p_xp,
    level = greatest(1, ((xp + p_xp) / 500) + 1)
   where id = p_couple;
end $$;

create or replace function public.bump_streak(p_couple uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_last date;
begin
  if not public.is_couple_member(p_couple, auth.uid()) then raise exception 'forbidden'; end if;
  select streak_last_day into v_last from public.couples where id = p_couple for update;
  if v_last is null or v_last < current_date - 1 then
    update public.couples set streak_count = 1, streak_last_day = current_date where id = p_couple;
  elsif v_last = current_date - 1 then
    update public.couples set streak_count = streak_count + 1, streak_last_day = current_date where id = p_couple;
  end if;
end $$;

grant execute on function public.add_xp(uuid, int)      to authenticated;
grant execute on function public.bump_streak(uuid)      to authenticated;

-- ---------- device sessions / push tokens -----------------------------------
create table public.device_sessions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  expo_token    text,
  platform      text check (platform in ('ios','android','web')),
  device_name   text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (user_id, expo_token)
);

alter table public.device_sessions enable row level security;
create policy "device_self" on public.device_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- profile auto-create on signup -----------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
