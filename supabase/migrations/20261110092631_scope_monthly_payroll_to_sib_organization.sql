-- Restrict automatic monthly payroll generation to the SIB organization.
-- The Edge Function authorizes active SIB roles before invoking this service-role RPC.
-- This database-level filter is defense in depth and prevents future tenant bleed.

do $migration$
declare
  v_definition text;
  v_old text := E'from public.sib_app_state\n    for update';
  v_new text := E'from public.sib_app_state\n    where organization_id = ''6070dc4b-5c5e-402c-911b-735cb754d241''::uuid\n    for update';
begin
  select pg_get_functiondef('public.sib_generate_monthly_payroll(date,boolean)'::regprocedure)
    into v_definition;

  if position(v_old in v_definition) = 0 then
    raise exception 'Expected payroll loop not found; migration aborted';
  end if;

  v_definition := replace(v_definition, v_old, v_new);
  execute v_definition;
end
$migration$;
