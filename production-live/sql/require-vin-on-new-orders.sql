-- Require a VIN on newly created production jobs without retroactively changing existing orders.
-- Existing jobs already in app_state (including legacy MSA/ClickUp imports) remain editable as-is.
create or replace function private.require_vin_on_new_production_order()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  missing_vin_invoice text;
begin
  if new.id <> 'main' or new.data is not distinct from old.data then
    return new;
  end if;
  select coalesce(n.job->>'invoice','(unnumbered)')
    into missing_vin_invoice
    from jsonb_array_elements(coalesce(new.data->'jobs','[]'::jsonb)) as n(job)
    where not exists (
      select 1
      from jsonb_array_elements(coalesce(old.data->'jobs','[]'::jsonb)) as o(job)
      where o.job->>'id'=n.job->>'id'
    )
    and btrim(coalesce(n.job->>'vin',''))=''
    limit 1;
  if missing_vin_invoice is not null then
    raise exception using
      errcode='23514',
      message='VIN is required to create a new order ('||missing_vin_invoice||')';
  end if;
  return new;
end
$$;
revoke all on function private.require_vin_on_new_production_order() from public,anon,authenticated;
drop trigger if exists enforce_vin_on_new_production_order on public.app_state;
create trigger enforce_vin_on_new_production_order
  before update of data on public.app_state
  for each row
  execute function private.require_vin_on_new_production_order();
