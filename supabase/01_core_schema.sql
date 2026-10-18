-- SIB Gestion — fondation PostgreSQL additive
-- Cette migration est volontairement isolée dans des tables sib_*.
-- Elle ne modifie ni ne supprime les tables existantes.
-- À relire avant exécution sur la base de production.
begin;

create extension if not exists pgcrypto;

create table if not exists public.sib_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  currency_code char(3) not null default 'GNF',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sib_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.sib_organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('Administrateur','Commercial','RH','Caissier','Direction','Comptable')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.sib_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.sib_organizations(id) on delete restrict,
  code text,
  name text not null,
  client_type text not null default 'particulier' check (client_type in ('particulier','entreprise')),
  phone text,
  email text,
  address text,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.sib_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.sib_organizations(id) on delete restrict,
  code text,
  name text not null,
  description text,
  unit_price numeric(15,2) not null default 0 check (unit_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.sib_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.sib_organizations(id) on delete restrict,
  client_id uuid references public.sib_clients(id) on delete restrict,
  document_type text not null check (document_type in ('devis','facture','avoir')),
  document_number text not null,
  status text not null default 'brouillon' check (status in ('brouillon','valide','partiel','paye','annule')),
  issue_date date not null default current_date,
  due_date date,
  currency_code char(3) not null default 'GNF',
  subtotal numeric(15,2) not null default 0 check (subtotal >= 0),
  discount numeric(15,2) not null default 0 check (discount >= 0),
  tax numeric(15,2) not null default 0 check (tax >= 0),
  total numeric(15,2) not null default 0 check (total >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, document_type, document_number),
  check (discount <= subtotal),
  check (total = subtotal - discount + tax)
);

create table if not exists public.sib_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.sib_documents(id) on delete restrict,
  service_id uuid references public.sib_services(id) on delete set null,
  description text not null,
  quantity numeric(15,3) not null check (quantity > 0),
  unit_price numeric(15,2) not null check (unit_price >= 0),
  line_total numeric(15,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.sib_financial_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.sib_organizations(id) on delete restrict,
  name text not null,
  account_type text not null check (account_type in ('caisse','banque','mobile_money')),
  currency_code char(3) not null default 'GNF',
  opening_balance numeric(15,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.sib_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.sib_organizations(id) on delete restrict,
  document_id uuid references public.sib_documents(id) on delete restrict,
  account_id uuid not null references public.sib_financial_accounts(id) on delete restrict,
  payment_number text not null,
  payment_date timestamptz not null default now(),
  amount numeric(15,2) not null check (amount > 0),
  method text not null check (method in ('especes','virement','mobile_money','cheque','autre')),
  direction text not null default 'entree' check (direction in ('entree','sortie','transfert')),
  reference text,
  status text not null default 'valide' check (status in ('brouillon','valide','annule')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  reversed_payment_id uuid references public.sib_payments(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, payment_number)
);

create table if not exists public.sib_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.sib_organizations(id) on delete restrict,
  expense_number text not null,
  expense_date date not null default current_date,
  category text not null,
  description text not null,
  amount numeric(15,2) not null check (amount > 0),
  account_id uuid not null references public.sib_financial_accounts(id) on delete restrict,
  status text not null default 'brouillon' check (status in ('brouillon','valide','annule')),
  created_by uuid references auth.users(id) on delete set null,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, expense_number)
);

create table if not exists public.sib_audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.sib_organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sib_memberships_user_idx on public.sib_memberships(user_id, active);
create index if not exists sib_clients_org_name_idx on public.sib_clients(organization_id, name);
create index if not exists sib_documents_org_date_idx on public.sib_documents(organization_id, issue_date desc);
create index if not exists sib_documents_client_idx on public.sib_documents(client_id);
create index if not exists sib_payments_org_date_idx on public.sib_payments(organization_id, payment_date desc);
create index if not exists sib_expenses_org_date_idx on public.sib_expenses(organization_id, expense_date desc);
create index if not exists sib_audit_org_date_idx on public.sib_audit_log(organization_id, created_at desc);

create or replace function public.sib_is_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sib_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
  );
$$;

revoke all on function public.sib_is_member(uuid) from public;
grant execute on function public.sib_is_member(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'sib_organizations','sib_memberships','sib_clients','sib_services',
    'sib_documents','sib_document_lines','sib_financial_accounts',
    'sib_payments','sib_expenses','sib_audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists sib_org_read_member on public.sib_organizations;
create policy sib_org_read_member on public.sib_organizations
for select to authenticated using (public.sib_is_member(id));

drop policy if exists sib_memberships_read_self_or_org_admin on public.sib_memberships;
create policy sib_memberships_read_self_or_org_admin on public.sib_memberships
for select to authenticated using (
  user_id = (select auth.uid()) or public.sib_is_member(organization_id)
);

drop policy if exists sib_clients_member_all on public.sib_clients;
create policy sib_clients_member_all on public.sib_clients
for all to authenticated
using (public.sib_is_member(organization_id))
with check (public.sib_is_member(organization_id));

drop policy if exists sib_services_member_all on public.sib_services;
create policy sib_services_member_all on public.sib_services
for all to authenticated
using (public.sib_is_member(organization_id))
with check (public.sib_is_member(organization_id));

drop policy if exists sib_documents_member_all on public.sib_documents;
create policy sib_documents_member_all on public.sib_documents
for all to authenticated
using (public.sib_is_member(organization_id))
with check (public.sib_is_member(organization_id));

drop policy if exists sib_lines_member_all on public.sib_document_lines;
create policy sib_lines_member_all on public.sib_document_lines
for all to authenticated
using (exists (
  select 1 from public.sib_documents d
  where d.id = document_id and public.sib_is_member(d.organization_id)
))
with check (exists (
  select 1 from public.sib_documents d
  where d.id = document_id and public.sib_is_member(d.organization_id)
));

drop policy if exists sib_accounts_member_all on public.sib_financial_accounts;
create policy sib_accounts_member_all on public.sib_financial_accounts
for all to authenticated
using (public.sib_is_member(organization_id))
with check (public.sib_is_member(organization_id));

drop policy if exists sib_payments_member_all on public.sib_payments;
create policy sib_payments_member_all on public.sib_payments
for all to authenticated
using (public.sib_is_member(organization_id))
with check (public.sib_is_member(organization_id));

drop policy if exists sib_expenses_member_all on public.sib_expenses;
create policy sib_expenses_member_all on public.sib_expenses
for all to authenticated
using (public.sib_is_member(organization_id))
with check (public.sib_is_member(organization_id));

drop policy if exists sib_audit_member_read on public.sib_audit_log;
create policy sib_audit_member_read on public.sib_audit_log
for select to authenticated using (
  organization_id is not null and public.sib_is_member(organization_id)
);

grant select on public.sib_organizations, public.sib_memberships to authenticated;
grant select, insert, update, delete on public.sib_clients, public.sib_services,
  public.sib_documents, public.sib_document_lines, public.sib_financial_accounts,
  public.sib_payments, public.sib_expenses to authenticated;
grant select on public.sib_audit_log to authenticated;

commit;
