-- RugReflex Admin Foundation
-- Platform control/configuration layer only.
-- Existing intelligence tables are untouched.

create table if not exists public.admin_settings (
  id bigint primary key generated always as identity,
  pro_enabled boolean not null default true,
  ads_enabled boolean not null default false,
  payments_enabled boolean not null default true,
  usdc_enabled boolean not null default true,
  rflx_enabled boolean not null default true,
  rflx_discount_percent numeric(5,2) not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pro_plans (
  id bigint primary key generated always as identity,
  name text not null,
  price_usdc numeric(18,6) not null,
  duration_days integer not null,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_config (
  id bigint primary key generated always as identity,
  currency text not null unique,
  enabled boolean not null default true,
  network text,
  receiving_wallet text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_users_active
  on public.admin_users(active);

insert into public.admin_settings (id)
select 1
where not exists (
  select 1 from public.admin_settings
);

insert into public.pro_plans (
  name,
  price_usdc,
  duration_days,
  features
)
select
  'RugReflex Pro',
  20,
  30,
  '[
    "Full Alpha Radar",
    "Radar Candidates",
    "Alpha Scores",
    "Radar Investigations",
    "Qualified Alpha",
    "Advanced Radar Intelligence"
  ]'::jsonb
where not exists (
  select 1 from public.pro_plans
);

insert into public.payment_config (
  currency,
  enabled,
  network
)
select 'USDC', true, 'Solana'
where not exists (
  select 1 from public.payment_config where currency = 'USDC'
);

insert into public.payment_config (
  currency,
  enabled,
  network
)
select 'RFLX', true, 'Solana'
where not exists (
  select 1 from public.payment_config where currency = 'RFLX'
);
