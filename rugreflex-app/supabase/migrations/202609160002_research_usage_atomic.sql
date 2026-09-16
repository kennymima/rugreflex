-- ============================================================
-- RugReflex Research Usage Atomic Consumption
-- Atomically checks and consumes one monthly research allowance.
-- ============================================================

create or replace function public.consume_research_usage(
  p_user_id uuid,
  p_usage_month date,
  p_monthly_limit integer
)
returns table (
  allowed boolean,
  used integer,
  remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  insert into public.research_usage (
    user_id,
    usage_month,
    research_count
  )
  values (
    p_user_id,
    p_usage_month,
    0
  )
  on conflict (user_id, usage_month) do nothing;

  select research_count
  into current_count
  from public.research_usage
  where user_id = p_user_id
    and usage_month = p_usage_month
  for update;

  if current_count >= p_monthly_limit then
    return query
    select
      false,
      current_count,
      0;
    return;
  end if;

  current_count := current_count + 1;

  update public.research_usage
  set
    research_count = current_count,
    updated_at = now()
  where user_id = p_user_id
    and usage_month = p_usage_month;

  return query
  select
    true,
    current_count,
    greatest(p_monthly_limit - current_count, 0);
end;
$$;

revoke all on function public.consume_research_usage(uuid, date, integer)
from public;

grant execute on function public.consume_research_usage(uuid, date, integer)
to service_role;
