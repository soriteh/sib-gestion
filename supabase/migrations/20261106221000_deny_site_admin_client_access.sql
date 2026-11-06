-- Make the intentional client denial on the site-admin registry explicit.
begin;
revoke all on table public.sib_site_admins from public, anon, authenticated;
drop policy if exists sib_site_admins_deny_client_access on public.sib_site_admins;
create policy sib_site_admins_deny_client_access
on public.sib_site_admins
for all
to anon, authenticated
using (false)
with check (false);
commit;
