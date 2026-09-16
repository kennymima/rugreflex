-- ============================================================
-- RugReflex Research Usage
-- Tracks monthly Internet research usage per authenticated user.
-- Separate from Scanner usage.
-- ============================================================

create table if not exists public.research_usage (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_month date not null,
  research_count integer not null default 0
    check (research_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint research_usage_user_month_unique
    unique (user_id, usage_month)
);

create index if not exists research_usage_user_idx
  on public.research_usage(user_id);

create index if not exists research_usage_month_idx
  on public.research_usage(usage_month);

alter table public.research_usage enable row level security;

create policy "Users can view own research usage"
on public.research_usage
for select
to authenticated
using (auth.uid() = user_id);
