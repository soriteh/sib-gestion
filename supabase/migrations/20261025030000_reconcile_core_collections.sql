-- Reconcile the relational client/service mirrors from the canonical versioned app state.
-- Idempotent and non-destructive: no business rows are deleted.
begin;

insert into public.sib_services (
  organization_id, legacy_id, service_code, name, description, category, unit,
  unit_price, currency, active
)
select
  s.organization_id,
  coalesce(nullif(trim(item->>'id'), ''), md5(item::text)) as legacy_id,
  nullif(trim(coalesce(item->>'code', item->>'no', '')), '') as service_code,
  trim(item->>'n') as name,
  coalesce(item->>'description', item->>'desc', '') as description,
  coalesce(item->>'category', item->>'cat', '') as category,
  coalesce(nullif(item->>'unit', ''), 'unité') as unit,
  case
    when coalesce(item->>'p', item->>'price', '') ~ '^-?[0-9]+([.][0-9]+)?$'
      then greatest(0, coalesce(item->>'p', item->>'price')::numeric)
    else 0
  end as unit_price,
  'GNF',
  case when lower(coalesce(item->>'active', 'true')) in ('false','0','no') then false else true end
from public.sib_app_state s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.state->'sv')='array' then s.state->'sv' else '[]'::jsonb end
) as item
where nullif(trim(item->>'n'), '') is not null
on conflict (organization_id, legacy_id) do update set
  service_code = excluded.service_code,
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  unit = excluded.unit,
  unit_price = excluded.unit_price,
  currency = excluded.currency,
  active = excluded.active,
  updated_at = now();

insert into public.sib_clients (
  organization_id, legacy_id, client_code, name, client_type, phone, email,
  address, tax_id, notes, active
)
select
  s.organization_id,
  coalesce(nullif(trim(item->>'id'), ''), md5(item::text)) as legacy_id,
  nullif(trim(coalesce(item->>'code', item->>'no', '')), '') as client_code,
  trim(item->>'n') as name,
  case
    when lower(coalesce(item->>'type','')) in ('particulier','individual') then 'particulier'
    when lower(coalesce(item->>'type','')) in ('établissement scolaire','etablissement_scolaire','school') then 'etablissement_scolaire'
    when lower(coalesce(item->>'type','')) in ('autre','other') then 'autre'
    else 'entreprise'
  end as client_type,
  coalesce(item->>'t', item->>'tel', item->>'phone', '') as phone,
  coalesce(item->>'mail', item->>'email', '') as email,
  coalesce(item->>'a', item->>'adr', item->>'address', '') as address,
  coalesce(item->>'nif', item->>'tax_id', '') as tax_id,
  coalesce(item->>'notes', '') as notes,
  case when lower(coalesce(item->>'active', item->>'actif', 'true')) in ('false','0','no') then false else true end as active
from public.sib_app_state s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.state->'c')='array' then s.state->'c' else '[]'::jsonb end
) as item
where nullif(trim(item->>'n'), '') is not null
on conflict (organization_id, legacy_id) do update set
  client_code = excluded.client_code,
  name = excluded.name,
  client_type = excluded.client_type,
  phone = excluded.phone,
  email = excluded.email,
  address = excluded.address,
  tax_id = excluded.tax_id,
  notes = excluded.notes,
  active = excluded.active,
  updated_at = now();

commit;
