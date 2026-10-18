-- SIB Gestion — intégrité des écritures et journal d'audit
-- Migration additive pour le schéma sib_*.
-- À exécuter uniquement après validation de supabase/01_core_schema.sql sur un environnement de test.
begin;

-- Bloque la suppression directe des écritures financières.
create or replace function public.sib_prevent_financial_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Suppression directe interdite sur %. Utilisez une opération de contre-passation autorisée.', TG_TABLE_NAME
    using errcode = '55000';
end;
$$;

-- Les documents validés et les écritures financières ne peuvent plus être modifiés silencieusement.
create or replace function public.sib_guard_validated_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Suppression directe interdite sur %. Conservez la trace et utilisez une contre-écriture.', TG_TABLE_NAME
      using errcode = '55000';
  end if;

  if TG_OP = 'UPDATE' then
    if TG_TABLE_NAME = 'sib_documents' and OLD.status <> 'brouillon' then
      raise exception 'Un devis ou une facture non brouillon est verrouillé. Créez une correction traçable.'
        using errcode = '55000';
    elsif TG_TABLE_NAME = 'sib_payments' and OLD.status <> 'brouillon' then
      raise exception 'Un paiement validé est verrouillé. Créez une contre-écriture traçable.'
        using errcode = '55000';
    elsif TG_TABLE_NAME = 'sib_expenses' and OLD.status <> 'brouillon' then
      raise exception 'Une dépense validée est verrouillée. Créez une contre-écriture traçable.'
        using errcode = '55000';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists sib_documents_guard on public.sib_documents;
create trigger sib_documents_guard
before update or delete on public.sib_documents
for each row execute function public.sib_guard_validated_record();

drop trigger if exists sib_payments_guard on public.sib_payments;
create trigger sib_payments_guard
before update or delete on public.sib_payments
for each row execute function public.sib_guard_validated_record();

drop trigger if exists sib_expenses_guard on public.sib_expenses;
create trigger sib_expenses_guard
before update or delete on public.sib_expenses
for each row execute function public.sib_guard_validated_record();

-- Journalise les insertions et modifications des entités métier.
-- La fonction est SECURITY DEFINER pour écrire même si l'utilisateur n'a qu'un accès SELECT au journal.
create or replace function public.sib_write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_id text;
  v_before jsonb;
  v_after jsonb;
begin
  if TG_OP = 'DELETE' then
    v_org := OLD.organization_id;
    v_id := OLD.id::text;
    v_before := to_jsonb(OLD);
    v_after := null;
  elsif TG_OP = 'UPDATE' then
    v_org := NEW.organization_id;
    v_id := NEW.id::text;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  else
    v_org := NEW.organization_id;
    v_id := NEW.id::text;
    v_before := null;
    v_after := to_jsonb(NEW);
  end if;

  insert into public.sib_audit_log
    (organization_id, actor_user_id, action, entity_table, entity_id, before_data, after_data)
  values
    (v_org, (select auth.uid()), TG_OP, TG_TABLE_NAME, v_id, v_before, v_after);

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists sib_clients_audit on public.sib_clients;
create trigger sib_clients_audit after insert or update or delete on public.sib_clients
for each row execute function public.sib_write_audit_log();

drop trigger if exists sib_services_audit on public.sib_services;
create trigger sib_services_audit after insert or update or delete on public.sib_services
for each row execute function public.sib_write_audit_log();

drop trigger if exists sib_documents_audit on public.sib_documents;
create trigger sib_documents_audit after insert or update or delete on public.sib_documents
for each row execute function public.sib_write_audit_log();

drop trigger if exists sib_financial_accounts_audit on public.sib_financial_accounts;
create trigger sib_financial_accounts_audit after insert or update or delete on public.sib_financial_accounts
for each row execute function public.sib_write_audit_log();

drop trigger if exists sib_payments_audit on public.sib_payments;
create trigger sib_payments_audit after insert or update or delete on public.sib_payments
for each row execute function public.sib_write_audit_log();

drop trigger if exists sib_expenses_audit on public.sib_expenses;
create trigger sib_expenses_audit after insert or update or delete on public.sib_expenses
for each row execute function public.sib_write_audit_log();

revoke all on function public.sib_prevent_financial_delete() from public;
revoke all on function public.sib_guard_validated_record() from public;
revoke all on function public.sib_write_audit_log() from public;

commit;
