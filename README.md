# ShiftSaver

Autonomous HR assistant prototype for last-minute shift absences.

## Repository Layout

- `backend/`: Next.js API backend, Twilio webhooks, Supabase schema, matching, and call cascade logic.
- `frontend/`: Vite + React + Tailwind mobile web app (extra and manager screens). Runs on mock data until the API is wired; see `frontend/API_CONTRACT.md`.

## Backend Commands

Run from the repo root:

```bash
npm run backend:dev
npm run backend:test
npm run backend:lint
npm run backend:build
```

Backend-specific setup lives in `backend/README.md`.

## Frontend Commands

Run from the repo root:

```bash
npm run frontend:dev
npm run frontend:lint
npm run frontend:build
```

For the integrated demo, run the backend on port `3000` and the frontend on port `5173`. Vite proxies `/api/*` to the backend.

## Planning Docs

Kash's planning package is preserved under `docs/`. The backend-specific adoption notes are in `docs/backend-execution-plan.md`.
MVP test instructions are in `docs/mvp-testing.md`.

## Branching

Do not work directly on `main`. Backend work should happen on `backend-shiftsaver` or smaller backend feature branches.

## Product Documentation

Product and feature docs live under `docs/`, including `docs/ROADMAP.md` for post-hackathon scope.
