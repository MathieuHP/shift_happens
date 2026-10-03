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

3. Trigger the attendance-recovery demo without waiting for a real scanner or phone call:

```bash
curl -X POST http://localhost:3000/api/demo/absence \
  -H "Content-Type: application/json" \
  -d '{"shiftId":"<seeded-shift-id>","mode":"missing-check-in"}'
```

4. Fetch the current dashboard state without retriggering the cascade:

```bash
curl http://localhost:3000/api/demo/state
```

If Supabase env vars are missing, the demo should use a deterministic simulated attendance trigger and cascade. That is intentional so the MVP can be tested immediately without external providers.

## Live Supabase Setup

1. Copy `backend/.env.example` to `backend/.env.local` and fill Supabase keys.
2. Run `backend/supabase/schema.sql` in Supabase SQL editor.
3. Run `backend/supabase/seed.sql` in Supabase SQL editor.
4. Re-run the demo trigger. The response should include `"mode":"live"`.

## Expected Supabase State In Live Mode

- `shift_check_ins`: no valid check-in for the seeded employee/shift.
- `attendance_recovery_cases`: one new case at the `T−5` checkpoint.
- `call_attempts`: one attendance-check attempt, followed by one replacement attempt after `absent` or no answer.
- `events`: timeline entries for missing check-in, scheduled-employee response, candidate order, and call start.
- `audit_events`: reserved for the next hardening pass.

If Twilio env vars are missing, the backend records a labeled demo-call skip; this is expected and keeps the attendance and cascade path testable without real calls.
