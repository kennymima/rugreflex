-- ============================================================
-- RugReflex Commercial Plans
-- ============================================================

-- Convert the original fixed Pro plan into the configurable
-- monthly Pro plan.
update public.pro_plans
set
  name = 'Monthly',
  duration_days = 30,
  updated_at = now()
where id = (
  select id
  from public.pro_plans
  order by id asc
  limit 1
);

-- Add the 6-month Pro plan if it does not already exist.
insert into public.pro_plans (
  name,
  price_usdc,
  duration_days,
  features,
  active
)
select
  '6 Months',
  0,
  180,
  '[
    "Full Alpha Radar",
    "Radar Candidates",
    "Alpha Scores",
    "Radar Investigations",
    "Qualified Alpha",
    "Advanced Radar Intelligence"
  ]'::jsonb,
  true
where not exists (
  select 1
  from public.pro_plans
  where duration_days = 180
);

-- ============================================================
-- Advertisement Packages
-- ============================================================

create table if not exists public.ad_packages (
  id bigint primary key generated always as identity,
  name text not null,
  duration_days integer not null,
  price_usdc numeric(18,6) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_packages_active_idx
on public.ad_packages(active);

alter table public.ad_packages enable row level security;

-- Default packages. Prices remain Admin-configurable.
insert into public.ad_packages (
  name,
  duration_days,
  price_usdc,
  active
)
select 'Daily', 1, 0, true
where not exists (
  select 1 from public.ad_packages where duration_days = 1
);

insert into public.ad_packages (
  name,
  duration_days,
  price_usdc,
  active
)
select 'Weekly', 7, 0, true
where not exists (
  select 1 from public.ad_packages where duration_days = 7
);

insert into public.ad_packages (
  name,
  duration_days,
  price_usdc,
  active
)
select 'Monthly', 30, 0, true
where not exists (
  select 1 from public.ad_packages where duration_days = 30
);
