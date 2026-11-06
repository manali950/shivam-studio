# shivamStudio — Multi-Tenant Photography Studio & Booking Platform
 
One platform, many independent photography studios. Each studio gets its own branded website, photographers, services and
packages, customers, bookings, events, photo galleries and video showcases — plus the **next-day photo delivery** workflow
(highlights the day after the event, the complete gallery later).
 
| Part | Stack | Status |
|---|---|---|
| `frontend/` | React 18, TypeScript, Vite, Tailwind CSS, React Query | Complete. **Runs on its own with mock JSON — no backend or database needed.** |
| `backend/` | Node.js, Express, TypeScript, PostgreSQL 16 | Complete and verified against real PostgreSQL. Connect it whenever your database is ready. |
| `tools/` | Node script | Generates `backend/database/seed.sql` from the frontend's mock JSON so both demos match. |
 
Documentation: [ARCHITECTURE.md](ARCHITECTURE.md) · [docs/API.md](docs/API.md) · [docs/DATABASE.md](docs/DATABASE.md) ·
[backend/README.md](backend/README.md) · [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)
 
---
 
## 1. Run the frontend (mock mode — start here)
 
Requires Node 20+.
 
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```
 
Open `http://localhost:5173/` for the studio picker, or go straight to a studio:
 
| URL | Studio |
|---|---|
| `/royal` | Royal Wedding Photography (Jaipur) — the fullest demo data |
| `/dream` | Dream Moments Studio |
| `/pixel` | Pixel Photography (commercial / product) — on a trial plan |
| `/creative` | Creative Lens Studio — seeded **inactive**; its site shows a "paused" page until a super admin activates it |
| `/platform/login` | Super admin console |
 
A floating **studio switcher** (bottom corner, development only) jumps between studios, opens the platform admin and resets
the demo data. Set `VITE_DEV_TENANT_SWITCHER=false` to hide it.
 
### Demo accounts
 
The login page lists one-click demo buttons for each studio. All demo accounts share the password `Demo@12345`.
 
| Role | Account | Where |
|---|---|---|
| Super admin | `super@shivamstudio.app` | `/platform/login` |
| Studio admin | `admin@royal.demo`, `admin@dream.demo`, `admin@pixel.demo`, `admin@creative.demo` | `/<studio>/login` → `/admin` |
| Photographer | `aarav@royal.demo`, `simran@royal.demo`, `ananya@dream.demo` | `/<studio>/login` → `/photographer` |
| Client | `meera@royal.demo`, `priya@royal.demo`, `riya@dream.demo`, `aura@pixel.demo` | `/<studio>/login` → `/portal` |
 
### Mock data behaves like a real system
 
Mock data lives in `frontend/src/data/mock/*.json` and is loaded into an in-browser database that persists to
`localStorage`, so bookings you create, galleries you publish and notifications you receive survive a reload.
 
* **Dates are relative to today.** The seed is anchored to 2026-11-06 and shifted to "now" on first load, so "next-day
  delivery" and "upcoming events" always make sense. Seeded history never lands in the future.
* **Reset** with the studio switcher → *Reset demo data* (clears the mock database and session).
* Each browser profile has its own mock database; nothing is shared between visitors.
 
### Try the whole business workflow
 
1. As a visitor, open `/royal/booking` and send an enquiry.
2. Sign in as `admin@royal.demo` → **Bookings** → open it → **Approve & confirm** (a customer record and an event are created).
3. Assign photographers on the booking. Sign in as an assigned photographer → **Events** → **Start shoot**, then **Mark shoot
   wrapped** (completes the event and starts the delivery clock). Create the gallery, add photographs, pick the highlights and
   **submit** them for review.
4. Back as admin → **Photo delivery** → **Review & publish** highlights (the client is notified), later **Publish complete gallery**
   (the event becomes *Delivered*).
5. Sign in as the client (`meera@royal.demo`) → **My photos**, **Notifications**.
 
> **Overdue is informational.** An event past its highlight target is flagged on the Photo delivery board but is never marked
> delivered automatically — only a person publishing a gallery changes delivery state.
 
---
 
## 2. Switch to the real backend
 
The frontend talks to one interface (`services.*`) with two implementations. Pages never import mock JSON or call `fetch`.
 
```bash
# frontend/.env
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://localhost:5000/api/v1
```
 
Restart `npm run dev` and every screen now reads and writes through the Node.js API — no component changes. Set up the
backend first (next section). `frontend/.env.example` documents every variable.
 
## 3. Set up the backend and PostgreSQL
 
Full details are in [backend/README.md](backend/README.md) and [docs/DATABASE.md](docs/DATABASE.md). In short:
 
```bash
# 1. Create roles + database (as a PostgreSQL superuser, once)
cd backend
psql -U postgres -v owner_pw="'choose-owner-password'" -v app_pw="'choose-app-password'" -f database/setup.sql
 
# 2. Configure
cp .env.example .env     # set DATABASE_URL (app role), MIGRATE_DATABASE_URL (owner role) and JWT_SECRET
 
# 3. Install, migrate, seed, run
npm install
npm run db:migrate       # applies database/migrations/*.sql (tracked, checksummed)
npm run db:seed          # idempotent demo data: 4 studios, 12 users, bookings, events, galleries…
npm run dev              # http://localhost:5000/api/v1/health
```
 
With the API running, `npm run smoke` runs 100+ end-to-end checks (authentication, role rules, tenant isolation, the full
booking → delivery workflow, validation, platform tools).
 
---
 
## 4. Multi-tenancy
 
* **Resolution** (`frontend/src/tenancy/resolve.ts`): on `localhost` / IPs the studio is the first path segment
  (`/royal/...`). On any other host the studio is looked up from the hostname — a subdomain
  (`royal.yourplatform.com`, set `VITE_BASE_DOMAIN`) or a custom domain (`royalweddingphotography.in`) — through
  `GET /tenants/resolve?host=…` (mock mode resolves the same way from the mock tenant list).
* **Branding & content** come from tenant configuration (colours, logo, hero, about, contact, social, booking rules) and are
  applied at runtime. No studio details are hard-coded in components. Configuration is mock JSON today and is loaded from
  `GET /tenants/:id/config` in API mode.
* **Isolation in the backend** is enforced three ways: every query is scoped by `tenant_id`; composite foreign keys make it
  impossible for a row to reference another studio's data; and PostgreSQL **row-level security** (FORCE-d, with the app
  connecting as a non-superuser role) returns nothing without a tenant context. See [ARCHITECTURE.md](ARCHITECTURE.md).
 
---
 
## 5. Security notes — please read
 
### Mock authentication is **not** security
In mock mode the "server" is the visitor's own browser. Demo passwords are visible in the source JSON, anyone can edit
`localStorage`, role checks run in client code, and sessions are unsigned. It exists so you can explore every role and
workflow offline. **Never deploy mock mode to real customers or put real data or real passwords into it.** (Passwords that
someone chooses in mock mode — sign-up, change password — are stored only as a salted hash, but that is hygiene, not
protection.)
 
### What the real backend does
* Passwords: scrypt with a per-user salt (`scrypt$N$r$p$salt$hash`), 8–128 characters with a letter and a digit, constant-time
  comparison and timing equalisation for unknown emails. No plain-text passwords anywhere (the seed contains only a hash).
* Sessions: HS256 JWT in an **httpOnly, SameSite, Secure (in production)** cookie. The user is re-loaded from the database on
  every request, so disabling a user, deleting a studio or changing a password takes effect immediately.
* Authorisation: role checks (super admin, studio admin, photographer, client) **and** ownership checks (a client only sees
  their own bookings; a photographer only their assigned events).
* CSRF: unsafe requests from unknown `Origin`s are rejected; CORS allows only configured origins, tenant subdomains and active
  custom domains.
* Also: Helmet headers, rate limiting (stricter on sign-in and public forms), Zod validation on every input, parameterised SQL
  only, consistent error envelopes that never leak internals, audit log for sensitive actions.
* **Tenant isolation:** a signed-in user of studio A who calls studio B's endpoints is treated as anonymous there — they
  can read B's public pages and nothing else; writes return `403 TENANT_FORBIDDEN`.
* **Deployment checklist:** HTTPS; strong `JWT_SECRET`; `NODE_ENV=production`; `ENABLE_PUBLIC_TENANT_LIST=false`; run the API
  as the restricted `shivamstudio_app` role (the server refuses to start in production if it is a superuser or has
  BYPASSRLS); set `TRUST_PROXY` behind a proxy; change/delete the demo accounts.
 
### Photographs, YouTube and Google Drive
* **Google Drive:** a Drive link is validated (only `https://drive.google.com` folder and file share links are accepted).
  Whether a client can actually open it **depends on the folder's Google Drive sharing permissions** — the platform never
  changes them. The UI says so wherever links are shown. Private gallery links are only returned to studio staff and the
  gallery's own client.
* **YouTube:** any watch / share / embed / Shorts URL is normalised to a video id and embedded with the privacy-friendly
  `youtube-nocookie.com` player.
* **Placeholders:** the demo uses five public YouTube ids and ~250 Unsplash photo URLs as **placeholder media**. They need
  internet access, may disappear over time, and are not licensed for your own studios' marketing — replace them with each
  studio's own photographs and videos (Admin → Galleries / YouTube videos / Website content). In offline or blocked networks
  images fall back to a neutral placeholder tile.
 
---
 
## 6. Quality checks
 
```bash
cd frontend && npm run typecheck && npm run lint && npm run build
cd backend  && npm run typecheck && npm run build
cd backend  && npm run smoke        # needs the API running on a seeded database
```
 
See [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) for what has been verified and the known limitations.
