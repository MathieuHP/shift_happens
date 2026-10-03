# ShiftSaver

Autonomous HR assistant prototype for last-minute shift absences.

## Repository Layout

- `backend/`: Next.js API backend, Twilio webhooks, Supabase schema, matching, and call cascade logic.
- `frontend/`: Vite + React + Tailwind mobile web app (extra and manager screens). Implemented `/api/*` flows use the backend; other screens use mock data. See `frontend/API_CONTRACT.md`.

## First Setup

After cloning or pulling new dependencies, install from the repo root:

```bash
npm install
```

This repo uses npm workspaces, so the root install installs both `backend/` and `frontend/` dependencies. If you see `next: not found`, dependencies were not installed.

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

## Vercel services

The repository root `vercel.json` builds `backend/` (Next.js) and `frontend/` (Vite) as two services in one Vercel project. Public `/api/*` requests go to the backend; all other paths go to the frontend. The frontend has an SPA fallback for direct visits to routes such as `/gerant/paiements`.

Browser API calls use same-origin `/api/*` URLs. There are no server-to-server calls between these two services, so no service binding is declared. The backend uses Vercel's deployment hostname for Stripe browser return URLs unless `FRONTEND_URL` is set. Set `NEXT_PUBLIC_APP_URL` to the public deployment origin used by Twilio webhooks.

To test both services with Vercel routing locally, run `vercel dev -L` from the repository root. The existing two-terminal npm development setup still works.

The current backend stores billing and payout state in local JSON files and demo state in memory. Vercel functions do not provide shared durable process state; migrate those stores before relying on billing, payout, or demo flows across requests in a deployed project.

## Planning Docs

Kash's planning package is preserved under `docs/`. The backend-specific adoption notes are in `docs/backend-execution-plan.md`.
MVP test instructions are in `docs/mvp-testing.md`.

## Branching

Do not work directly on `main`. Backend work should happen on `backend-shiftsaver` or smaller backend feature branches.

## Product Documentation

Product and feature docs live under `docs/`, including `docs/ROADMAP.md` for post-hackathon scope.
