create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  visitor_id text,
  title text,
  token_mint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_conversations_owner_check
    check (user_id is not null or visitor_id is not null)
);

create index if not exists chat_conversations_user_id_idx
  on public.chat_conversations(user_id);

create index if not exists chat_conversations_visitor_id_idx
  on public.chat_conversations(visitor_id);

create index if not exists chat_conversations_updated_at_idx
  on public.chat_conversations(updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  token_mint text,
  scan_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_id_idx
  on public.chat_messages(conversation_id, created_at);

create index if not exists chat_messages_token_mint_idx
  on public.chat_messages(token_mint);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Users can read own chat conversations"
on public.chat_conversations;

create policy "Users can read own chat conversations"
on public.chat_conversations
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create own chat conversations"
on public.chat_conversations;

create policy "Users can create own chat conversations"
on public.chat_conversations
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own chat conversations"
on public.chat_conversations;

create policy "Users can update own chat conversations"
on public.chat_conversations
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own chat conversations"
on public.chat_conversations;

create policy "Users can delete own chat conversations"
on public.chat_conversations
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own chat messages"
on public.chat_messages;

create policy "Users can read own chat messages"
on public.chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_conversations c
    where c.id = chat_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Users can create own chat messages"
on public.chat_messages;

create policy "Users can create own chat messages"
on public.chat_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.chat_conversations c
    where c.id = chat_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

create or replace function public.touch_chat_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists chat_message_touch_conversation
on public.chat_messages;

create trigger chat_message_touch_conversation
after insert on public.chat_messages
for each row
execute function public.touch_chat_conversation();
