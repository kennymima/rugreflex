-- ============================================================
-- RugReflex Commercial Core
-- Pro subscriptions, payment records, advertisements
-- ============================================================

create table if not exists public.pro_subscriptions (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id bigint references public.pro_plans(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'expired', 'cancelled')),
  currency text,
  amount numeric(18,6),
  starts_at timestamptz,
  expires_at timestamptz,
  payment_record_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pro_subscriptions_user_idx
  on public.pro_subscriptions(user_id);

create index if not exists pro_subscriptions_status_idx
  on public.pro_subscriptions(status);

create index if not exists pro_subscriptions_expires_idx
  on public.pro_subscriptions(expires_at);

alter table public.pro_subscriptions enable row level security;


create table if not exists public.payment_records (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) on delete set null,
  payment_type text not null
    check (payment_type in ('pro', 'advertisement')),
  reference text unique,
  currency text not null,
  network text not null default 'Solana',
  amount numeric(18,6) not null,
  receiving_wallet text,
  transaction_signature text unique,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed', 'expired')),
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_records_user_idx
  on public.payment_records(user_id);

create index if not exists payment_records_status_idx
  on public.payment_records(status);

create index if not exists payment_records_type_idx
  on public.payment_records(payment_type);

alter table public.payment_records enable row level security;


create table if not exists public.advertisements (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) on delete set null,
  token_name text not null,
  token_symbol text,
  token_address text,
  description text,
  website_url text,
  contact_email text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'active', 'expired', 'cancelled')),
  package_id bigint references public.ad_packages(id) on delete set null,
  currency text,
  amount numeric(18,6),
  starts_at timestamptz,
  expires_at timestamptz,
  payment_record_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advertisements_user_idx
  on public.advertisements(user_id);

create index if not exists advertisements_status_idx
  on public.advertisements(status);

create index if not exists advertisements_expires_idx
  on public.advertisements(expires_at);

alter table public.advertisements enable row level security;

-- ============================================================
-- User RLS policies
-- Users can read only their own commercial records.
-- Admin/service-role access remains available server-side.
-- ============================================================

create policy "Users can view own Pro subscriptions"
on public.pro_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can view own payment records"
on public.payment_records
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can view own advertisements"
on public.advertisements
for select
to authenticated
using (auth.uid() = user_id);
