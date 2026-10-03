# ShiftSaver

Autonomous HR assistant prototype for last-minute shift absences.

## Repository Layout

- `backend/`: Next.js API backend, Twilio webhooks, Supabase schema, matching, and call cascade logic.
- `frontend/`: Reserved for the manager dashboard team.

## Backend Commands

Run from the repo root:

```bash
npm run backend:dev
npm run backend:test
npm run backend:lint
npm run backend:build
```

Backend-specific setup lives in `backend/README.md`.

## Planning Docs

Kash's planning package is preserved under `docs/`. The backend-specific adoption notes are in `docs/backend-execution-plan.md`.
MVP test instructions are in `docs/mvp-testing.md`.

## Branching

Do not work directly on `main`. Backend work should happen on `backend-shiftsaver` or smaller backend feature branches.
