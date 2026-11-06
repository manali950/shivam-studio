# shivamStudio API
 
Node.js 20+ · Express · TypeScript · PostgreSQL 13+ · versioned REST (`/api/v1`).
 
Related docs: [database setup & RLS](../docs/DATABASE.md) · [endpoint reference](../docs/API.md) · [architecture](../ARCHITECTURE.md)
 
## Quick start
 
```bash
npm install
# one-time database bootstrap (superuser) — see ../docs/DATABASE.md
psql -h localhost -U postgres -v owner_pw="'owner-pw'" -v app_pw="'app-pw'" -f database/setup.sql
cp .env.example .env          # fill DATABASE_URL, MIGRATE_DATABASE_URL, JWT_SECRET
npm run db:migrate
npm run db:seed               # demo studios + users (password Demo@12345 — remove before production)
npm run dev                   # http://localhost:5000/api/v1/health
```
 
Then point the frontend at it: `VITE_DATA_MODE=api`, `VITE_API_BASE_URL=http://localhost:5000/api/v1`.
 
## Scripts
 
| Script | What it does |
|---|---|
| `npm run dev` | Start with reload (`tsx watch`). |
| `npm run build` / `npm start` | Compile `src/` to `dist/` and run it. |
| `npm run typecheck` | `tsc --noEmit` over `src/` and `scripts/`. |
| `npm run db:migrate` | Apply new `database/migrations/*.sql` as the owner role (checksum-tracked). |
| `npm run db:seed` | Load the idempotent demo seed. |
| `npm run db:seed:generate` | Rebuild `database/seed.sql` from `../frontend/src/data/mock/*.json`. |
| `npm run db:schema` | Rebuild the single-file `database/schema.sql` snapshot. |
| `npm run db:reset` | **Development only.** Drop, migrate, seed (refused in production). |
| `npm run smoke` | 100+ end-to-end checks against a running API (`API_URL` overrides the base URL). Creates a few records — use `db:reset` for a pristine DB afterwards. Needs generous rate limits while testing (`RATE_LIMIT_AUTH_MAX=1000`). |
 
## Configuration (`.env.example` documents every variable)
 
| Variable | Notes |
|---|---|
| `DATABASE_URL` | Runtime connection as **`shivamstudio_app`** (non-superuser, no BYPASSRLS). |
| `MIGRATE_DATABASE_URL` | Owner role for migrate/seed only. |
| `JWT_SECRET` | ≥ 32 random characters. The server refuses to start in production with a weak or default secret. |
| `CORS_ORIGINS`, `PLATFORM_BASE_DOMAIN` | Allowed browser origins; tenant subdomains and active custom domains are allowed automatically. |
| `COOKIE_SAMESITE`, `COOKIE_DOMAIN` | `lax` for same-site deployments; `none` (HTTPS) when studios on custom domains call a separate API domain. |
| `ENABLE_PUBLIC_TENANT_LIST` | Powers the dev studio picker. **Set `false` in production.** |
| `TRUST_PROXY`, `RATE_LIMIT_*` | Behind a proxy set the hop count so rate limiting sees client IPs. |
 
## Roles
 
`super_admin` (platform), `studio_admin`, `photographer`, `client`. Authorisation is role **and** ownership based, and every
tenant-scoped request is validated against the caller's studio. Demo logins: `super@shivamstudio.app`, `admin@royal.demo`,
`aarav@royal.demo`, `meera@royal.demo`, … (password `Demo@12345`, see the root README).
 
## Source layout
 
```
src/
  app.ts, server.ts     express app (helmet, cors, limits, routers) · start-up checks + graceful shutdown
  config/env.ts         validated environment
  lib/                  errors, logger, password (scrypt), jwt, cookies, validation, media (YouTube/Drive), audit, handlers
  db/                   pool + withScope (RLS context), query builder, generic repository, reference checks
  middleware/           authenticate, origin (CORS/CSRF), rateLimit, error
  modules/              auth · tenants · bookings · events · galleries · catalogue/* · notifications · analytics · platform
scripts/                migrate, seed, build-schema, smoke-test
database/               setup.sql, migrations/, schema.sql (generated), seed.sql (generated)
```
 
Each module follows `routes → controller → service → repository`: controllers handle HTTP only, services hold rules and
workflow, repositories hold parameterised SQL. Simple resources reuse `modules/crud.ts`.
 
## Production checklist
 
* `NODE_ENV=production`, HTTPS, strong `JWT_SECRET`, `ENABLE_PUBLIC_TENANT_LIST=false`, correct `CORS_ORIGINS`.
* Connect as `shivamstudio_app` (the API refuses to start in production if its role is a superuser or has BYPASSRLS).
* Run `npm run db:migrate` (owner role) before starting a new version; never run `db:reset`.
* Delete or re-password the demo accounts; the temporary owner password returned when a studio is created is shown **once**.
* Plan limits are stored but not yet enforced; email/SMS delivery is not included (in-app notifications only).
