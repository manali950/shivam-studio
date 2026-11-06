# Development status
 
_Last updated: 2026-11-06 · all six phases complete._
 
## Summary
 
| Phase | Scope | Status |
|---|---|---|
| 1 | Frontend scaffold, design system, routing, tenancy, centralised data provider (mock/api switch) | Done |
| 2 | Public website: home, about, photographers, services, packages, portfolio, videos, events, blog, contact, booking | Done |
| 3 | Authentication, client portal, photographer portal | Done |
| 4 | Studio admin dashboard (16 sections), super admin console | Done |
| 5 | Backend: schema, migrations, RLS, idempotent seed, REST API, auth/RBAC, delivery workflow | Done — verified on PostgreSQL 16 |
| 6 | QA, documentation, packaging | Done |
 
Size: frontend ≈ 6.9k lines TS/TSX (86 files, 35 pages) · backend ≈ 3.4k lines TS + 563 lines SQL migrations.
 
## What was verified (and how)
 
| Check | Result |
|---|---|
| `tsc` (frontend `tsc -b`, backend), ESLint (frontend), production builds (Vite, `tsc` → `dist/`) | Clean |
| Compiled backend (`npm run build && npm start`) | Starts, serves `/health` and tenant resolution |
| Migrations on a fresh PostgreSQL 16 + seed run twice | Applies cleanly; stable row counts; delivery status of every seeded event matches its timestamps; no future timestamps |
| Row-level security as the restricted app role | No tenant context → 0 rows; studio context → only that studio; cross-tenant insert rejected by policy |
| Production guards | API refuses to start in production as a superuser / BYPASSRLS role, and with a placeholder or predictable `JWT_SECRET` |
| API smoke test (`npm run smoke`, 104 checks, fresh DB) | 104 / 104 — auth, cookies, role rules, tenant isolation (read, write, id-guessing, config, CSRF origin), validation (Drive / YouTube / URLs / mass-assignment), booking → confirm → event, full delivery workflow incl. notifications and idempotency, overdue stays informational, dashboard, config deep-merge, password change, super admin tools, studio create/deactivate |
| Real frontend against real API (`VITE_DATA_MODE=api`) | Public pages, login, admin dashboard and all admin modules load with no API errors; session survives reload; studio creation shows the owner's one-time password and the new owner can sign in |
| Playwright, mock mode — public site | 162 page loads (4 studios × 13 pages × 3 viewports + picker + 404): no errors, no horizontal overflow, no empty pages |
| Playwright, mock mode — dashboards | 82 page loads across super admin, studio admins (4 studios), photographers and clients at desktop and phone width; correct landing page per role; anonymous and cross-role access redirected |
| Playwright, mock mode — workflows (16 steps) | Super admin activates the inactive studio · mobile booking enquiry → admin approves → event exists · highlights published (card moves column) · complete gallery published → delivered · client sees all 10 photos and a notification · another client cannot see it · photographer sees only assigned events · admin of one studio cannot open another's admin · studio switcher changes branding · reset restores seed |
| Mock password handling | Self-chosen passwords are stored only as salted hashes; wrong/old passwords rejected; demo one-click login unaffected |
 
Defects found by this QA and fixed: `npm start` pointed at the wrong build output; mobile booking confirmation was left off-screen
below the footer; mock sign-up/change-password stored passwords in clear in `localStorage`; the studio-create success message
hard-coded the mock password (API mode never surfaced the owner's temporary password); a copied `.env.example` secret would have
been accepted in production.
 
## Known limitations & decisions
 
* **Mock authentication is not security** — see README. Mock mode is for demos and development only.
* **Plan limits** (photographers, galleries, storage) are stored and displayed but not enforced.
* **Photographer accounts:** studio admins create photographer *profiles*; a sign-in user is linked only for seeded photographers.
  There is no invite flow yet. Clients can self-register (`/auth/register`).
* **Email uniqueness** is per studio in the backend (the same person can be a client of two studios); mock mode keeps emails globally unique.
* **Notifications are in-app only.** No email / SMS / WhatsApp sender is wired in (`notify()` is the single hook to extend).
* **Photographs are URLs** (CDN, Google Drive, gallery services); there is no file-upload/storage adapter. Drive access depends on the
  folder's sharing permissions, which the platform does not and cannot change.
* **Placeholder media:** Unsplash images and five public YouTube ids in the demo data. They need internet access and should be replaced per studio.
* **`GET /tenants/public`** powers the development studio picker; disable it in production (`ENABLE_PUBLIC_TENANT_LIST=false`).
* **Payments** are recorded manually on a booking (the paid amount; unpaid / partial / paid is derived from it); no payment-gateway integration.
* **Automated tests:** coverage is the API smoke script plus the Playwright runs described above (run ad hoc, not committed as a suite). Adding
  Vitest unit tests for the pure helpers (`lib/*`, `media.ts`, workflow rules) and a committed Playwright suite is the natural next step.
 
## Handy commands
 
```bash
cd frontend && npm run dev                 # mock mode, http://localhost:5173
cd frontend && npm run typecheck && npm run lint && npm run build
cd backend  && npm run dev                 # API, http://localhost:5000/api/v1
cd backend  && npm run db:reset && npm run smoke
```
