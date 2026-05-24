-- =============================================================================
-- SoulSync 009: E2E public key exchange + edge-function settings + helpers
--
-- Why: messages were already encrypted with tweetnacl box, but the receiver
-- couldn't actually find the sender's public key — pair.tsx had a stub. This
-- migration adds a public_key column, exposes it through a partner-readable
-- view via the existing profiles_partner_read RLS policy, and gives us a
-- cheap RPC to fetch it without leaking other profile fields.
-- =============================================================================

alter table public.profiles
  add column if not exists public_key text;

comment on column public.profiles.public_key is
  'Curve25519 public key (base64) used for end-to-end encryption (tweetnacl box). Secret key never leaves the device.';

-- For E2E media messages: the secretbox nonce used to encrypt the file body
-- itself. The `ciphertext` + `nonce` columns continue to hold the wrapped
-- per-message media key (encrypted with nacl.box for the partner).
alter table public.messages
  add column if not exists media_nonce bytea;

comment on column public.messages.media_nonce is
  'secretbox nonce for the encrypted file at media_path (image/voice/video). Keys are wrapped for the partner and stored in ciphertext+nonce.';

-- Lookup the partner's public key in one call. Returns null if not paired or
-- the partner hasn't generated a key yet (older clients, web-only, etc).
create or replace function public.partner_public_key()
returns text language sql stable security definer set search_path = public as $$
  select p.public_key
    from public.profiles p
   where p.id = public.partner_id();
$$;
grant execute on function public.partner_public_key() to authenticated;

-- =============================================================================
-- Edge function settings: table for storing app-wide config that Edge Functions
-- can read (OpenAI model name, default temperature, feature flags). Service
-- role only — never exposed to clients.
-- =============================================================================
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;
-- No policies = no client access. Edge Functions use the service role and
-- bypass RLS. Authenticated users get nothing.

insert into public.app_settings (key, value, description) values
  ('ai.compose.model',       '"gpt-4o-mini"'::jsonb,            'OpenAI-compatible model used by compose-message'),
  ('ai.compose.temperature', '0.85'::jsonb,                     'Higher = more creative compliments'),
  ('ai.caption.model',       '"gpt-4o-mini"'::jsonb,            'Model for memory captions'),
  ('feature.heartbeat',      'true'::jsonb,                     'Toggle the heartbeat presence experience'),
  ('feature.aura',           'false'::jsonb,                    'Toggle the Aura mode (still cooking)')
on conflict (key) do nothing;

-- =============================================================================
-- Read receipts helper: mark every unread message in a conversation as read.
-- Cheaper than per-row updates from the client and enforces RLS naturally.
-- =============================================================================
create or replace function public.mark_conversation_read(p_conv uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_count int;
begin
  if v_user is null then raise exception 'auth required'; end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conv and public.is_couple_member(c.couple_id, v_user)
  ) then
    raise exception 'forbidden';
  end if;

  update public.messages
     set read_at = now()
   where conversation_id = p_conv
     and sender_id <> v_user
     and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- =============================================================================
-- Reactions helper: atomically add/remove a reaction emoji from a message
-- using the existing jsonb shape {"❤️": ["uid", "uid"]}.
-- =============================================================================
create or replace function public.toggle_reaction(p_msg uuid, p_emoji text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user      uuid := auth.uid();
  v_reactions jsonb;
  v_users     jsonb;
  v_result    jsonb;
begin
  if v_user is null then raise exception 'auth required'; end if;

  select reactions into v_reactions
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
   where m.id = p_msg
     and public.is_couple_member(c.couple_id, v_user)
   for update;

  if v_reactions is null then raise exception 'forbidden_or_missing'; end if;

  v_users := coalesce(v_reactions -> p_emoji, '[]'::jsonb);

  if v_users @> to_jsonb(v_user::text) then
    -- remove
    v_users := (
      select coalesce(jsonb_agg(u), '[]'::jsonb)
        from jsonb_array_elements_text(v_users) as u
       where u <> v_user::text
    );
  else
    -- add
    v_users := v_users || to_jsonb(v_user::text);
  end if;

  if jsonb_array_length(v_users) = 0 then
    v_result := v_reactions - p_emoji;
  else
    v_result := jsonb_set(v_reactions, array[p_emoji], v_users, true);
  end if;

  update public.messages set reactions = v_result where id = p_msg;
  return v_result;
end $$;
grant execute on function public.toggle_reaction(uuid, text) to authenticated;

-- =============================================================================
-- Quest completion helper: mark a quest done for today and award XP atomically.
-- =============================================================================
create or replace function public.complete_quest(p_couple uuid, p_code text)
returns table(quest_id uuid, awarded_xp int, already_done boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_q public.quests%rowtype;
  v_user uuid := auth.uid();
  v_existing public.quest_progress%rowtype;
  v_xp int := 0;
begin
  if v_user is null then raise exception 'auth required'; end if;
  if not public.is_couple_member(p_couple, v_user) then raise exception 'forbidden'; end if;

  select * into v_q from public.quests where code = p_code and active = true;
  if not found then raise exception 'unknown_quest'; end if;

  select * into v_existing from public.quest_progress
    where couple_id = p_couple and quest_id = v_q.id and user_id = v_user
      and for_date = current_date
    limit 1;

  if found and v_existing.completed_at is not null then
    return query select v_q.id, 0, true;
    return;
  end if;

  insert into public.quest_progress (couple_id, user_id, quest_id, for_date, completed_at)
  values (p_couple, v_user, v_q.id, current_date, now())
  on conflict do nothing;

  -- Award XP via existing helper
  perform public.add_xp(p_couple, v_q.xp_reward);
  v_xp := v_q.xp_reward;

  return query select v_q.id, v_xp, false;
end $$;
grant execute on function public.complete_quest(uuid, text) to authenticated;
