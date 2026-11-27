-- Harden SECURITY DEFINER search paths without changing the callable contract.
-- All application tables referenced by these routines are schema-qualified.
-- pg_catalog remains implicitly available when search_path is empty.

begin;

alter function public.get_sib_public_branding()
  set search_path = '';

alter function public.sib_generate_monthly_payroll(date, boolean)
  set search_path = '';

commit;
