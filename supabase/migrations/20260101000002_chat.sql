-- =============================================================================
-- SoulSync 002: Chat — messages, reactions, voice notes, disappearing
-- Server stores ciphertext only; keys never leave devices.
-- =============================================================================

create table public.conversations (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid not null unique references public.couples(id) on delete cascade,
  pinned_msg  uuid,
  wallpaper   text,
  created_at  timestamptz not null default now()
);

create type message_kind as enum ('text','image','video','voice','sticker','system','capsule_unlock','silent_care');

create table public.messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id)      on delete cascade,
  kind            message_kind not null default 'text',
  -- E2E payload: clients encrypt with libsodium box; server only stores opaque blobs
  ciphertext      bytea,                  -- nullable for system/silent_care
  nonce           bytea,
  -- Public metadata (non-secret) — keep minimal
  media_path      text,                   -- storage object path (encrypted blob)
  media_mime      text,
  media_bytes     int,
  duration_ms     int,                    -- voice / video
  width           int,
  height          int,
  reply_to        uuid references public.messages(id) on delete set null,
  reactions       jsonb not null default '{}'::jsonb,   -- {"❤️": ["uid"], "🔥": ["uid"]}
  read_at         timestamptz,
  delivered_at    timestamptz,
  expires_at      timestamptz,            -- disappearing
  edited_at       timestamptz,
  pinned          boolean not null default false,
  created_at      timestamptz not null default now()
);

create index messages_conv_created_idx on public.messages(conversation_id, created_at desc);
create index messages_expiry_idx       on public.messages(expires_at) where expires_at is not null;

create table public.typing_state (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id)      on delete cascade,
  is_typing       boolean not null default false,
  updated_at      timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- ---------- RLS --------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.typing_state  enable row level security;

create policy "conv_member" on public.conversations for all
  using (public.is_couple_member(couple_id, auth.uid()))
  with check (public.is_couple_member(couple_id, auth.uid()));

create policy "msg_select_member" on public.messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and public.is_couple_member(c.couple_id, auth.uid())
  ));

create policy "msg_insert_self" on public.messages for insert
  with check (sender_id = auth.uid() and exists (
    select 1 from public.conversations c
    where c.id = conversation_id and public.is_couple_member(c.couple_id, auth.uid())
  ));

create policy "msg_update_self" on public.messages for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

create policy "msg_delete_self" on public.messages for delete
  using (sender_id = auth.uid());

create policy "typing_self" on public.typing_state for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- realtime publication --------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.typing_state;
alter publication supabase_realtime add table public.conversations;

-- ---------- disappearing cleanup --------------------------------------------
create or replace function public.purge_expired_messages()
returns void language sql security definer as $$
  delete from public.messages where expires_at is not null and expires_at < now();
$$;
