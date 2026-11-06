# Architecture
 
## 1. Big picture
 
```
 Browser ─────────────────────────────────────────────────────────────┐
 pages (React)                                                         │
   │  useTenantQuery / useTenantMutation  (hooks/data.ts, React Query) │
   ▼                                                                   │
 services.*  ← the ONLY data access point (services/data-provider)     │
   ├─ VITE_DATA_MODE=mock → mock-provider.ts + in-browser DB (localStorage, seeded from src/data/mock/*.json)
   └─ VITE_DATA_MODE=api  → api-provider.ts → http.ts ──fetch (cookie, X-Tenant-Id)──►  Express API  ──►  PostgreSQL
```
 
The contract between the two worlds is the TypeScript interface set in
`frontend/src/services/data-provider/types.ts` (+ domain types in `src/types`). `mock-provider.ts` and `api-provider.ts` both
implement it; the REST contract the API provider expects is documented in [docs/API.md](docs/API.md). Switching mode is an
environment variable — components never know which one is active.
 
## 2. Frontend
 
| Area | Location | Notes |
|---|---|---|
| Entry, routing | `src/App.tsx` | One centralised route tree; lazy-loaded pages; role-guarded dashboards. |
| Tenancy | `src/tenancy/resolve.ts`, `context/TenantContext.tsx` | Strategy decided from `window.location`; tenant + config loaded once, theme applied as CSS variables (`lib/theme.ts`). |
| Auth | `context/AuthContext.tsx` | Role-aware session, `ROLE_HOME` redirects, same API for mock and real auth. |
| Data | `services/data-provider/*`, `hooks/data.ts`, `hooks/admin.ts` | `useTenantQuery` keys every query by tenant id, so switching studios can never show another studio's cached data. |
| UI kit | `components/ui` | Buttons, forms, modals, tables, badges, feedback (loading / error / empty states). |
| Shared | `components/shared` | `CrudPage` (config-driven list + form + delete), galleries, YouTube/Drive parts, delivery tracker. |
| Layouts | `components/layout` | Public layout, dashboard shells for admin / photographer / client / platform, dev switcher. |
| Pages | `pages/public`, `client`, `photographer`, `admin`, `platform` | Thin: compose hooks + components. |
 
Conventions: pages never import mock JSON or call `fetch`; money, dates and status colours come from `lib/*`; every list has
loading, error, empty and success states; Zod schemas validate forms and mirror the API's validation.
 
### Mock database (`services/data-provider/mock/db.ts`)
Seeded from JSON on first load, mutations persisted to `localStorage`, dates shifted so the anchor day (2026-11-06) becomes
today, seeded timestamps clamped to the past. The mock provider re-implements the same visibility and workflow rules as the
backend (who may see which booking, event, gallery, photo or link; the delivery state machine), so UI behaviour matches API mode.
 
## 3. Multi-tenancy
 
* **Resolution.** `path` mode (`/royal/...`) on `localhost`/IPs/platform hosts; `host` mode on any other hostname. In host mode
the tenant is found by `GET /tenants/resolve?host=…`, which matches `slug.PLATFORM_BASE_DOMAIN` subdomains and custom domains.
Reserved slugs (`platform`, `api`, `admin`, `www`, `login`, `assets`) are rejected.
* **Request scoping.** Tenant-scoped API calls carry `X-Tenant-Id`. The backend never trusts it blindly: it verifies the tenant
exists and is not deleted, then compares it with the signed-in user's own studio (see §4.3).
* **Inactive studios.** The public site, portals and sign-in show a "paused" page; the API refuses logins and new enquiries.
Nothing is deleted; a super admin can reactivate.
 
## 4. Backend
 
### 4.1 Layers (`backend/src`)
 
```
routes  →  controller (HTTP only)  →  service (rules, workflow, notifications)  →  repository (SQL)  →  db/pool (scoped transaction)
```
 
| Folder | Responsibility |
|---|---|
| `config/env.ts` | Zod-validated environment. Fails fast on bad config. |
| `lib/` | errors, logger, scrypt `password`, `jwt`, `cookies`, `validation` (Zod helpers), `media` (YouTube/Drive parsing), `audit`, `handlers` (`tenantRoute`, `systemRoute`, role helpers). |
| `db/` | `pool.ts` (`withScope`), `query.ts` (parameterised builder, sort whitelist), `repository.ts` (generic CRUD repository), `refs.ts` (reference checks, unique slugs). |
| `middleware/` | `authenticate`, `origin` (CORS + CSRF), `rateLimit`, `error`. |
| `modules/` | `auth`, `tenants`, `bookings`, `events`, `galleries`, `catalogue` (photographers, services, packages, testimonials, blog, videos, drive links, clients), `notifications`, `analytics`, `platform`. Simple resources share `modules/crud.ts` (repository + service + router factory with hooks); workflow-heavy ones (bookings, events, galleries, auth, tenants) are hand-written. |
 
### 4.2 Database (details in [docs/DATABASE.md](docs/DATABASE.md))
UUID primary keys, `tenant_id` on every tenant-owned table, composite `(tenant_id, id)` unique constraints with composite
foreign keys (a booking cannot point at another studio's service), CHECK constraints instead of enums, `created_at` /
`updated_at` (trigger-maintained), soft delete on business entities, an append-only audit log, and JSONB only for genuinely
document-shaped data (studio configuration sections).
 
### 4.3 Tenant isolation — defence in depth
1. **Application:** every repository query filters by `tenant_id`; services re-check ownership (`assertRefs`) for every id in a
   request body.
2. **Schema:** composite FKs make cross-tenant references impossible even for buggy code.
3. **Row-level security:** policies on the 22 tenant-owned tables (and on `tenants` itself) compare `tenant_id` with `app_tenant_id()`, a function reading a
   transaction-local setting. Every request runs in **one transaction** opened by `withScope({ tenantId } | { system: true })`
   that sets it via `set_config(..., true)` (so it can never leak across pooled connections). `FORCE ROW LEVEL SECURITY` is on,
   and the API connects as `shivamstudio_app` — `NOSUPERUSER NOBYPASSRLS` — so the database itself refuses to return or accept
   another studio's rows even if a query forgets its `WHERE`. Without a tenant context, queries return zero rows.
4. **Principal downgrade:** if the signed-in user belongs to studio A but the request targets studio B, `tenantRoute` treats
   the caller as anonymous for B (public data only) and marks `crossTenant`; any write answers `403 TENANT_FORBIDDEN`.
   Super admins use the system scope for platform tools only.
 
### 4.4 Authentication & authorisation
`POST /auth/login` verifies the scrypt hash (a dummy hash is checked for unknown emails to equalise timing), then sets the
`ss_session` httpOnly cookie. `authenticate` reloads the user on every request and rejects disabled users, deleted studios and
tokens issued before `password_changed_at`. Roles: `super_admin`, `studio_admin`, `photographer`, `client`. Visibility rules
live in services/repositories and match the mock provider:
 
* **Bookings** — anonymous: none · client: own · photographer: assigned · staff: all.
* **Events** — anonymous: public + completed, with notes/client/booking redacted · client: own · photographer: assigned.
* **Galleries & photos** — staff and the assigned photographer see everything; others see all photos once the complete gallery
  is published, only highlights once highlights are published, otherwise nothing. External delivery links are returned only to
  staff and the gallery's own client.
* **Customers** — staff only. **Services/packages/photographers** — public sees active ones only.
 
## 5. The delivery workflow (next-day highlights → complete gallery)
 
```
 booking: enquiry ─► pending ─► confirmed ─► completed          (cancelled / rejected possible)
                                   │ confirm ⇒ ensure customer + create event, notify client
                                   ▼
 event:   planned ─► shooting ─► wrapped ─► editing ─► delivered      (progress; `delivered` is set automatically)
          wrapped = event completed → the delivery clock starts
                                   │
 delivery (derived from timestamps, never from a clock):
   pending ─► highlights_submitted ─► highlights_published ─► delivered
              photographer submits     admin reviews & publishes   admin publishes complete gallery
              highlight selection      (client notified)           (client notified, event = delivered)
```
 
* `events.delivery_status` is a **generated column** computed from the four delivery timestamps, so state cannot drift and no
  job can flip it. Past the target the UI shows **Overdue** — informational only.
* Publishing is idempotent and row-locked; re-publishing is a no-op. Photographers cannot publish and cannot edit a gallery
  after the complete gallery is published; clients see nothing before publication.
* Every transition writes notifications (client, admins, photographers as appropriate) and an audit row.
 
## 6. Key decisions
 
* **Provider abstraction over code generation** — one TypeScript interface, two implementations; the mock layer mirrors the
  real rules so there is no "rewrite" step.
* **Generic CRUD factory** for simple catalogue resources — less code, one place to get pagination, sorting, search, visibility
  and tenant checks right.
* **RLS plus application checks** — either alone would be a single point of failure.
* **Derived delivery status** — correctness by construction.
* **Seeds generated from the mock JSON** — the demo is identical in both modes, with deterministic UUIDv5 ids so seeding is idempotent.
* **No heavy dependencies** — React Query, React Hook Form + Zod, lucide icons on the frontend; Express, pg, Zod, jsonwebtoken,
  helmet, express-rate-limit on the backend. No ORM; SQL is explicit and parameterised.
 
## 7. Extending
 
* *New resource:* add the table + RLS policy in a new migration, a repository spec, a `crud.ts` router (or a module), the
  service method on both providers, and its type — nothing else.
* *Email / SMS / WhatsApp:* hook into `modules/notifications.ts → notify()`; today it writes in-app notifications.
* *File uploads:* photographs are stored as URLs (a CDN, Google Drive or an external gallery service). Direct upload would add a
  storage adapter behind `galleries.service`.
* *Payments:* bookings track amounts, deposits and recorded payments; a gateway would add webhook-driven payment records.
* *Plan limits:* plans are stored and displayed but **not enforced** (for parity with the mock); enforce in `tenants.service` /
  `photographers` creation when you decide the commercial rules.
