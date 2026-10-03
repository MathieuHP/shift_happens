truncate table events, call_attempts, absence_cases, shifts, employees restart identity cascade;

insert into employees (id, name, phone, role, skills, active, priority) values
  ('00000000-0000-0000-0000-000000000101', 'Paul Martin', '+15550001001', 'server', array['server', 'bar'], true, 10),
  ('00000000-0000-0000-0000-000000000102', 'Sarah Lee', '+15550001002', 'server', array['server', 'bar'], true, 20),
  ('00000000-0000-0000-0000-000000000103', 'Thomas Reed', '+15550001003', 'server', array['server', 'host'], true, 5),
  ('00000000-0000-0000-0000-000000000104', 'Maya Chen', '+15550001004', 'cashier', array['cashier', 'floor'], true, 30),
  ('00000000-0000-0000-0000-000000000105', 'Nina Patel', '+15550001005', 'manager', array['manager', 'server'], true, 40);

insert into shifts (id, employee_id, role, skill_required, starts_at, ends_at, status) values
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    'server',
    'server',
    date_trunc('day', now()) + interval '1 day' + interval '8 hours',
    date_trunc('day', now()) + interval '1 day' + interval '16 hours',
    'scheduled'
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000104',
    'cashier',
    'cashier',
    date_trunc('day', now()) + interval '1 day' + interval '8 hours',
    date_trunc('day', now()) + interval '1 day' + interval '14 hours',
    'scheduled'
  );
