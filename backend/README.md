# ShiftSaver Backend

Autonomous HR assistant prototype for last-minute shift absences.

## Backend Endpoints

- `POST /api/sms/inbound`: Twilio inbound SMS webhook.
- `POST /api/demo/absence`: Local/demo trigger for the same absence flow.
- `GET /api/voice/twiml?attemptId=...`: Twilio voice prompt.
- `POST /api/voice/response?attemptId=...`: Accept/decline handler from speech or keypad.
- `POST /api/voice/status?attemptId=...`: No-answer/failure cascade handler.

## Setup

1. Copy `backend/.env.example` into `backend/.env.local`.
2. Create a Supabase project.
3. Run `backend/supabase/schema.sql` in the SQL editor.
4. Run `backend/supabase/seed.sql` for demo data.
5. Configure Twilio SMS webhook to `/api/sms/inbound`.
6. Configure `NEXT_PUBLIC_APP_URL` to your Vercel or ngrok URL.

## Demo Trigger

```bash
curl -X POST http://localhost:3000/api/demo/absence \
  -H "Content-Type: application/json" \
  -d '{"fromPhone":"+15550001001","body":"I am sick and cannot make my 8 AM shift"}'
```

If Twilio env vars are missing, the backend writes a `demo_call_skipped` event instead of placing a real call.
