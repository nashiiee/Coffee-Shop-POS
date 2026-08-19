# Coffee Shop POS — API

Express + TypeScript + Prisma backend for the Coffee Shop POS.

## Setup

1. `cp .env.example .env` and fill in real secrets (JWT secrets must be 32+ chars each and different from one another).
2. Start Postgres: `docker compose up -d` (from the repo root).
3. `npm install`
4. `npm run prisma:generate`
5. `npm run prisma:migrate` — creates the initial migration against your local Postgres.
6. `npm run prisma:seed` — creates the first ADMIN user from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
7. `npm run dev`

## Scripts

- `npm run dev` — start with hot reload
- `npm run build` / `npm run start` — production build and run
- `npm run lint` — ESLint
- `npm run test` — Vitest unit tests
