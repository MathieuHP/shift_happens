# ShiftSaver

Autonomous HR assistant prototype for last-minute shift absences.

## Repository Layout

- `backend/`: Next.js API backend, Twilio webhooks, Supabase schema, matching, and call cascade logic.
- `frontend/`: Vite + React + Tailwind mobile web app (extra and manager screens). Runs on mock data until the API is wired; see `frontend/API_CONTRACT.md`.

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

## Frontend Commands

```bash
cd frontend
npm install
npm run dev
```

## Product Documentation

Product and feature docs live at the repo root: `01-product-brief.md` to `09-open-decisions.md`, plus `ROADMAP.md` (post-hackathon) and the HTML UI mockup.
