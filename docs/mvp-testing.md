# MVP Testing Runbook

## Fast Checks

Run these before every demo merge:

```bash
npm run backend:test
npm run backend:lint
npm run backend:build
```

## Local Backend Smoke Test

1. Start the backend:

```bash
npm run backend:dev
```

2. Check service/config status:

```bash
curl http://localhost:3000/api/health
```

3. Trigger the absence cascade without waiting for a real SMS:

```bash
curl -X POST http://localhost:3000/api/demo/absence \
  -H "Content-Type: application/json" \
  -d '{"fromPhone":"+15550001001","body":"I am sick and cannot make my 8 AM shift"}'
```

4. Fetch the current dashboard state without retriggering the cascade:

```bash
curl http://localhost:3000/api/demo/state
```

If Supabase env vars are missing, this endpoint returns a deterministic simulated cascade. That is intentional so the MVP can be tested immediately.

## Live Supabase Setup

1. Copy `backend/.env.example` to `backend/.env.local` and fill Supabase keys.
2. Run `backend/supabase/schema.sql` in Supabase SQL editor.
3. Run `backend/supabase/seed.sql` in Supabase SQL editor.
4. Re-run the demo trigger. The response should include `"mode":"live"`.

## Expected Supabase State In Live Mode

- `absence_cases`: one new case for Paul.
- `shifts`: Paul's shift becomes `vacant`, or later `covered` after acceptance.
- `call_attempts`: one attempt for the first eligible candidate.
- `events`: timeline entries for absence, vacancy, candidates, and call start.
- `audit_events`: reserved for the next hardening pass.

If Twilio env vars are missing, the backend records `demo_call_skipped`; this is expected and keeps the live Supabase path testable without real calls.

## In-app flow (absence → replacement)

Start both servers (`npm run backend:dev`, `npm run frontend:dev`), then either use the app or curl:

```bash
B=http://localhost:3000/api
curl -X POST $B/demo/reset
curl -X POST $B/absences -H 'content-type: application/json' -d '{"employee_id":"jade","shift_id":"shift-5","kind":"absence"}'
curl $B/absences                                   # copy the report id
curl -X POST $B/absences/<id>/find-replacement     # offers go to eli and sacha
curl "$B/shifts/open?employee_id=eli"              # copy the offer id
curl -X POST $B/shifts/<offer_id>/accept -H 'content-type: application/json' -d '{"employee_id":"eli"}'
```

In the app: on the home page pick **Jade** as demo account → "Je suis extra" → Shifts → *Absence*. Then "Je suis gérant" → Ce soir → *Trouver un remplaçant*. Pick **Eli** as demo account → Shifts → *Accepter*. Demo shift dates are always "tomorrow" and "the day after" (UTC).
Set `DEMO_SECRET` in `backend/.env.local` to require `x-demo-secret` on `/api/demo/*`.
