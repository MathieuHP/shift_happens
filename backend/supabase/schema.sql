create extension if not exists pgcrypto;

create table if not exists restaurant_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Brussels',
  autopilot_enabled boolean not null default true,
  manager_confirmation_required boolean not null default false,
  demo_seeded boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_account_id uuid not null references restaurant_accounts(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  subscription_status text not null default 'inactive' check (subscription_status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  last_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_account_id),
  unique (stripe_customer_id),
  unique (stripe_subscription_id)
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  restaurant_account_id uuid not null references restaurant_accounts(id) on delete cascade,
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
  restaurant_account_id uuid not null references restaurant_accounts(id) on delete cascade,
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
  restaurant_account_id uuid not null references restaurant_accounts(id) on delete cascade,
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
  idempotency_key text,
  status text not null default 'queued' check (status in ('queued', 'calling', 'accepted', 'declined', 'no_answer', 'failed')),
  twilio_call_sid text,
  voice_provider text not null default 'twilio',
  voice_conversation_id text,
  response_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create table if not exists voice_interactions (
  id uuid primary key default gen_random_uuid(),
  restaurant_account_id uuid not null references restaurant_accounts(id) on delete cascade,
  absence_case_id uuid references absence_cases(id) on delete set null,
  call_attempt_id uuid references call_attempts(id) on delete set null,
  provider text not null default 'twilio',
  direction text not null check (direction in ('inbound', 'outbound')),
  twilio_call_sid text,
  conversation_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}',
  unique (provider, twilio_call_sid),
  unique (provider, conversation_id)
);

create table if not exists provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  processed_at timestamptz,
  payload jsonb not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_account_id uuid references restaurant_accounts(id) on delete cascade,
  absence_case_id uuid references absence_cases(id) on delete set null,
  actor_type text not null,
  actor_id text,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  absence_case_id uuid references absence_cases(id) on delete cascade,
  type text not null,
  message text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists employees_restaurant_account_id_idx on employees(restaurant_account_id);
create index if not exists shifts_restaurant_account_id_idx on shifts(restaurant_account_id);
create index if not exists shifts_employee_id_idx on shifts(employee_id);
create index if not exists shifts_starts_at_idx on shifts(starts_at);
create index if not exists absence_cases_restaurant_account_id_idx on absence_cases(restaurant_account_id);
create index if not exists absence_cases_status_idx on absence_cases(status);
create index if not exists call_attempts_case_idx on call_attempts(absence_case_id);
create index if not exists voice_interactions_case_idx on voice_interactions(absence_case_id);
create index if not exists audit_events_case_created_idx on audit_events(absence_case_id, created_at);
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

drop trigger if exists subscriptions_set_updated_at on subscriptions;
create trigger subscriptions_set_updated_at
before update on subscriptions
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
