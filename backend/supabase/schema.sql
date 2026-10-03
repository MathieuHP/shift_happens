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
  role text not null check (role in ('salle', 'cuisine', 'bar')),
  skills text[] not null default '{}',
  active boolean not null default true,
  priority integer not null default 50,
  contact_consent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table employees add column if not exists contact_consent_at timestamptz;

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_account_id uuid not null references restaurant_accounts(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  replacement_for_employee_id uuid references employees(id) on delete set null,
  role text not null check (role in ('salle', 'cuisine', 'bar')),
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
  status text not null default 'open' check (status in ('open', 'calling', 'accepted_pending_manager', 'resolved', 'unresolved')),
  inbound_message text not null,
  candidate_ids uuid[] not null default '{}',
  accepted_employee_id uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table absence_cases drop constraint if exists absence_cases_status_check;
alter table absence_cases add constraint absence_cases_status_check
  check (status in ('open', 'calling', 'accepted_pending_manager', 'resolved', 'unresolved'));

create table if not exists call_attempts (
  id uuid primary key default gen_random_uuid(),
  absence_case_id uuid not null references absence_cases(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  idempotency_key text,
  status text not null default 'queued' check (status in ('queued', 'calling', 'accepted', 'declined', 'no_answer', 'failed', 'completed', 'closed')),
  twilio_call_sid text,
  voice_provider text not null default 'twilio',
  voice_conversation_id text,
  response_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

-- Keep existing installations compatible while extending the attempt lifecycle.
alter table call_attempts drop constraint if exists call_attempts_status_check;
alter table call_attempts add constraint call_attempts_status_check
  check (status in ('queued', 'calling', 'accepted', 'declined', 'no_answer', 'failed', 'completed', 'closed'));

-- A case can have at most one active outbound attempt at a time.
create unique index if not exists call_attempts_one_active_per_case_idx
  on call_attempts(absence_case_id)
  where status = 'calling';
create unique index if not exists call_attempts_conversation_id_idx
  on call_attempts(voice_conversation_id)
  where voice_conversation_id is not null;

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

create or replace function respond_to_voice_offer(p_attempt_id uuid, p_answer text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  attempt_row record;
  updated_rows integer;
begin
  if p_answer not in ('yes', 'no') then
    raise exception 'Invalid offer answer';
  end if;

  select
    ca.status as attempt_status,
    ca.absence_case_id,
    ca.employee_id,
    ac.status as case_status,
    ac.shift_id,
    ac.absent_employee_id,
    ac.restaurant_account_id,
    sh.starts_at,
    sh.status as shift_status,
    ra.manager_confirmation_required
  into attempt_row
  from call_attempts ca
  join absence_cases ac on ac.id = ca.absence_case_id
  join shifts sh on sh.id = ac.shift_id
  join restaurant_accounts ra on ra.id = ac.restaurant_account_id
  where ca.id = p_attempt_id
  for update of ca, ac, sh;

  if not found or attempt_row.attempt_status <> 'calling' then
    return 'ignored';
  end if;

  if attempt_row.case_status not in ('open', 'calling')
    or attempt_row.shift_status in ('covered', 'cancelled')
    or attempt_row.starts_at <= now() then
    update call_attempts set status = 'failed' where id = p_attempt_id;
    return 'ignored';
  end if;

  if p_answer = 'no' then
    update call_attempts set status = 'declined' where id = p_attempt_id;
    return 'declined';
  end if;

  if attempt_row.manager_confirmation_required then
    update call_attempts set status = 'accepted' where id = p_attempt_id;
    update absence_cases
      set status = 'accepted_pending_manager', accepted_employee_id = attempt_row.employee_id
      where id = attempt_row.absence_case_id;
    return 'pending_approval';
  end if;

  update shifts
    set employee_id = attempt_row.employee_id,
        replacement_for_employee_id = attempt_row.absent_employee_id,
        status = 'covered'
    where id = attempt_row.shift_id
      and status in ('scheduled', 'vacant')
      and starts_at > now();
  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    update call_attempts set status = 'failed' where id = p_attempt_id;
    return 'ignored';
  end if;

  update call_attempts set status = 'accepted' where id = p_attempt_id;
  update call_attempts
    set status = 'closed'
    where absence_case_id = attempt_row.absence_case_id
      and id <> p_attempt_id
      and status in ('queued', 'calling');
  update absence_cases
    set status = 'resolved', accepted_employee_id = attempt_row.employee_id
    where id = attempt_row.absence_case_id;
  return 'accepted';
end;
$$;

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
