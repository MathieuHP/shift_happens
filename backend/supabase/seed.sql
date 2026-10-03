truncate table audit_events, provider_events, voice_interactions, events, call_attempts, absence_cases, shifts, subscriptions, employees, restaurant_accounts restart identity cascade;

insert into restaurant_accounts (id, name, timezone, autopilot_enabled, manager_confirmation_required, demo_seeded) values
  ('00000000-0000-0000-0000-000000000001', 'Coli Brasserie', 'Europe/Brussels', true, false, true);

insert into subscriptions (id, restaurant_account_id, subscription_status, stripe_customer_id, stripe_subscription_id, stripe_price_id) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'active', 'cus_demo_shiftsaver', 'sub_demo_shiftsaver', 'price_demo_shiftsaver');

insert into employees (id, restaurant_account_id, name, phone, role, skills, active, priority, contact_consent_at) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Paul Martin', '+15550001001', 'salle', array['salle', 'bar'], true, 10, now()),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Sarah Lee', '+15550001002', 'salle', array['salle', 'bar'], true, 20, now()),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Thomas Reed', '+15550001003', 'salle', array['salle', 'accueil'], true, 5, now()),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'Maya Chen', '+15550001004', 'cuisine', array['cuisine', 'caisse'], true, 30, now()),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', 'Nina Patel', '+15550001005', 'salle', array['salle', 'caisse'], true, 40, now());

insert into shifts (id, restaurant_account_id, employee_id, role, skill_required, starts_at, ends_at, status) values
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    'salle',
    'salle',
    date_trunc('day', now()) + interval '1 day' + interval '8 hours',
    date_trunc('day', now()) + interval '1 day' + interval '16 hours',
    'scheduled'
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000104',
    'cuisine',
    'cuisine',
    date_trunc('day', now()) + interval '1 day' + interval '8 hours',
    date_trunc('day', now()) + interval '1 day' + interval '14 hours',
    'scheduled'
  );
