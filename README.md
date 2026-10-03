# ShiftSaver

Autonomous HR assistant prototype for last-minute shift absences.

## Repository Layout

- `backend/`: Next.js API backend, Twilio webhooks, Supabase schema, matching, and call cascade logic.
- `frontend/`: Reserved for the manager dashboard team.

## Backend Commands

Run from the repo root:

```bash
npm run backend:dev
npm run backend:lint
npm run backend:build
```

Backend-specific setup lives in `backend/README.md`.

## Branching

Do not work directly on `main`. Backend work should happen on `backend-shiftsaver` or smaller backend feature branches.
