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
