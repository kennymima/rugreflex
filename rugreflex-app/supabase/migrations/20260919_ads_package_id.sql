alter table public.advertisements add column if not exists package_id bigint references public.ad_packages(id) on delete set null;
