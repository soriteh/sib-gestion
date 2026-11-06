-- SIB Gestion — WhatsApp Business Cloud API foundation
create table if not exists public.sib_whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contact_type text not null check (contact_type in ('employee','client','supplier','other')),
  contact_ref text not null,
  display_name text not null default '',
  phone_e164 text not null,
  opt_in boolean not null default false,
  opt_in_at timestamptz,
  opt_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contact_type, contact_ref),
  check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);
create table if not exists public.sib_whatsapp_message_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  recipient_phone text not null,
  recipient_type text not null check (recipient_type in ('employee','client','supplier','other')),
  recipient_ref text,
  message_kind text not null,
  template_name text,
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed','rejected')),
  provider_message_id text,
  error_code text,
  error_detail text,
  initiated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.sib_whatsapp_contacts enable row level security;
alter table public.sib_whatsapp_message_log enable row level security;
drop policy if exists "sib_whatsapp_contacts_manage" on public.sib_whatsapp_contacts;
create policy "sib_whatsapp_contacts_manage" on public.sib_whatsapp_contacts
for all to authenticated using (
 sib_whatsapp_contacts.organization_id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid
 and exists (select 1 from public.organization_memberships m where m.user_id=auth.uid() and m.organization_id=sib_whatsapp_contacts.organization_id and m.active=true and m.role in ('Administrateur','Direction','RH'))
) with check (
 sib_whatsapp_contacts.organization_id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid
 and exists (select 1 from public.organization_memberships m where m.user_id=auth.uid() and m.organization_id=sib_whatsapp_contacts.organization_id and m.active=true and m.role in ('Administrateur','Direction','RH'))
);
drop policy if exists "sib_whatsapp_logs_read" on public.sib_whatsapp_message_log;
create policy "sib_whatsapp_logs_read" on public.sib_whatsapp_message_log
for select to authenticated using (
 sib_whatsapp_message_log.organization_id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid
 and exists (select 1 from public.organization_memberships m where m.user_id=auth.uid() and m.organization_id=sib_whatsapp_message_log.organization_id and m.active=true and m.role in ('Administrateur','Direction','RH','Comptable'))
);
