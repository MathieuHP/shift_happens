create extension if not exists pgcrypto;

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  role text not null check (role in ('server', 'nurse', 'cashier', 'manager')),
  skills text[] not null default '{}',
  active boolean not null default true,
  priority integer not null default 50,
  created_at timestamptz not null default now()
);

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete set null,
  replacement_for_employee_id uuid references employees(id) on delete set null,
  role text not null check (role in ('server', 'nurse', 'cashier', 'manager')),
  skill_required text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'vacant', 'covered', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists absence_cases (
  id uuid primary key default gen_random_uuid(),
  absent_employee_id uuid not null references employees(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'calling', 'resolved', 'unresolved')),
  inbound_message text not null,
  candidate_ids uuid[] not null default '{}',
  accepted_employee_id uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists call_attempts (
  id uuid primary key default gen_random_uuid(),
  absence_case_id uuid not null references absence_cases(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'calling', 'accepted', 'declined', 'no_answer', 'failed')),
  twilio_call_sid text,
  response_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  absence_case_id uuid references absence_cases(id) on delete cascade,
  type text not null,
  message text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists shifts_employee_id_idx on shifts(employee_id);
create index if not exists shifts_starts_at_idx on shifts(starts_at);
create index if not exists absence_cases_status_idx on absence_cases(status);
create index if not exists call_attempts_case_idx on call_attempts(absence_case_id);
create index if not exists events_case_created_idx on events(absence_case_id, created_at);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists absence_cases_set_updated_at on absence_cases;
create trigger absence_cases_set_updated_at
before update on absence_cases
for each row execute function set_updated_at();

drop trigger if exists call_attempts_set_updated_at on call_attempts;
create trigger call_attempts_set_updated_at
before update on call_attempts
for each row execute function set_updated_at();

alter table shifts replica identity full;
alter table absence_cases replica identity full;
alter table call_attempts replica identity full;
alter table events replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shifts') then
    alter publication supabase_realtime add table shifts;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'absence_cases') then
    alter publication supabase_realtime add table absence_cases;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'call_attempts') then
    alter publication supabase_realtime add table call_attempts;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events') then
    alter publication supabase_realtime add table events;
  end if;
end;
$$;
