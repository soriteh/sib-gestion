-- SIB-GESTION: données dédiées aux relances WhatsApp de présence.
-- Exécuter dans Supabase SQL Editor avant de déployer la fonction Edge.
create table if not exists public.whatsapp_attendance_employees (
  employee_id text primary key,
  full_name text not null,
  phone_e164 text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_attendance_sessions (
  id bigint generated always as identity primary key,
  employee_id text not null references public.whatsapp_attendance_employees(employee_id) on delete cascade,
  work_date date not null default (now() at time zone 'Africa/Conakry')::date,
  message_sent_at timestamptz,
  reply_received_at timestamptz,
  reply_text text,
  status text not null default 'pending' check (status in ('pending','present','late','review','absent','excused','error')),
  final_message_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, work_date)
);

create table if not exists public.whatsapp_attendance_events (
  id bigint generated always as identity primary key,
  wamid text unique,
  employee_id text,
  phone_e164 text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create index if not exists whatsapp_attendance_sessions_date_status_idx
  on public.whatsapp_attendance_sessions(work_date, status);
create index if not exists whatsapp_attendance_employees_phone_idx
  on public.whatsapp_attendance_employees(phone_e164);

alter table public.whatsapp_attendance_employees enable row level security;
alter table public.whatsapp_attendance_sessions enable row level security;
alter table public.whatsapp_attendance_events enable row level security;

-- Aucun accès public direct. La fonction Edge utilise la clé service_role côté serveur.
revoke all on public.whatsapp_attendance_employees from anon, authenticated;
revoke all on public.whatsapp_attendance_sessions from anon, authenticated;
revoke all on public.whatsapp_attendance_events from anon, authenticated;
