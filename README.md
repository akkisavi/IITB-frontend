# Warehouse Management System

A small warehouse management app: a 5x5 floor (A-E x 1-5) with transfer point A1 and 24 single-pallet storage locations. Technicians load and unload pallets, auditors inspect occupancy and a 7-day history dashboard, admins manage users. React + TypeScript UI (this repo) talking to a Django REST Framework API.

- Design and decisions: [DESIGN.md](DESIGN.md)
- AI workflow and verification: [AI_USAGE.md](AI_USAGE.md)
- API setup: [IITB-backend README](https://github.com/akkisavi/IITB-backend/blob/main/README.md)

## Links
The UI and API live in two repositories, each app at its own repository root.

| | URL |
|---|---|
| UI repository | https://github.com/akkisavi/IITB-frontend |
| API repository | https://github.com/akkisavi/IITB-backend |
| Hosted UI / login | https://iitb-frontend-mu.vercel.app/login |
| Hosted API | https://iitb-zeip.onrender.com (health: `/health/`) |

### Demo accounts
| Role | Hosted username | Local setup reads |
|---|---|---|
| Admin | `demo_admin` | `EVAL_ADMIN_USERNAME`, `EVAL_ADMIN_PASSWORD` |
| Auditor | `demo_auditor` | `EVAL_AUDITOR_USERNAME`, `EVAL_AUDITOR_PASSWORD` |
| Technician | `demo_technician` | `EVAL_TECHNICIAN_USERNAME`, `EVAL_TECHNICIAN_PASSWORD` |

Hosted passwords are supplied separately and are not in this repository. Locally, `seed_demo` creates or updates each account from its `EVAL_*` variables, and the Playwright tests read the same variables.

## Stack and runtimes
- UI: Node.js **20+** (developed on 24), React 18, TypeScript strict, Vite 5, Tailwind + DaisyUI 4, React Router 6, TanStack Query 5, Playwright (Chromium).
- API: Python **3.12**, Django 5.1, DRF token auth, SQLite locally (`SQLITE_PATH`, default `./db.sqlite3`), PostgreSQL on Render (`DATABASE_URL`).

## Run locally
1. API (clone [IITB-backend](https://github.com/akkisavi/IITB-backend); full steps in its README):
   ```bash
   cd IITB-backend
   pip install -r requirements.txt
   export EVAL_ADMIN_PASSWORD=... EVAL_AUDITOR_PASSWORD=... EVAL_TECHNICIAN_PASSWORD=...
   python manage.py migrate --noinput
   python manage.py seed_demo
   python manage.py runserver 127.0.0.1:8000 --noreload
   ```
2. UI:
   ```bash
   cd IITB-frontend
   npm install
   npm start        # Vite on http://127.0.0.1:5173, honours HOST / PORT
   ```

## Environment variables (UI)
| Var | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | first non-empty of `VITE_API_BASE_URL`, `REACT_APP_API_BASE_URL`, `API_BASE_URL`, else `http://127.0.0.1:8000` | API base URL, baked in at build time |
| `HOST` / `PORT` | `127.0.0.1` / `5173` | dev server |
| `UI_BASE_URL` / `BASE_URL` | `http://127.0.0.1:5173` | Playwright target |
| `API_BASE_URL` | `http://127.0.0.1:8000` | Playwright API setup and cleanup |
| `PLAYWRIGHT_JSON_OUTPUT_FILE` | `test-results/results.json` | full JSON report path |
| `EVAL_*_USERNAME` / `EVAL_*_PASSWORD` | demo usernames / unset | test credentials; a role's tests are skipped if its password is missing |

See `.env.example`.

## Tests
```bash
npx playwright install chromium
npm test         # playwright test: Chromium, list + full JSON reporter
```
UI and API must already be running (no `webServer`). Tests create uniquely named `E2E-*` pallets and unload them afterwards.

### Test results
Latest run on 2026-11-27 (Windows 11, Node 24.6, Python 3.12.10, Chromium via Playwright) against a fresh database (before the move to SQLite; not yet re-run on SQLite) after `migrate --noinput` and `seed_demo`, API on `127.0.0.1:8010`, UI on `127.0.0.1:5180`:

**27 passed, 0 failed, 0 skipped** (≈33 s, 1 worker, exit code 0).

Coverage: login and role-based navigation (3 roles), backend 401/403 enforcement through direct API calls, load (UI) → occupied cell + toast + counts, pallet details, form validation and A1 exclusion, duplicate pallet 409, unload → free cell and repeat-unload 409, cross-session update within 5 s (two browser contexts), dashboard stats vs map and 7 history points, shuttle page, 25-cell map with legend and transfer A1, 375×812 mobile layout, admin create/deactivate user, **simultaneous loads into one location (one 201, one 409)**, **Idempotency-Key replay**, **unloaded-pallet history**, **optimistic map update and rollback on 409**.

Known gaps: no Firefox/WebKit runs; users created by the users test remain as inactive accounts (soft delete).

### Concurrency, in one paragraph
Two operators can target the same slot at once. Each load/unload runs in one database transaction that first locks the location row (`select_for_update`), then re-checks occupancy and duplicates. The database is the final guard: a pallet's location is a one-to-one column, so two active pallets can never share a slot even if application checks were bypassed, and active pallet numbers and barcodes are unique. Whichever request commits second gets a clear `409` (`location_occupied`, `duplicate_pallet_number`, `duplicate_barcode`, or `conflict` when a constraint fires). Retries are safe because load/unload accept an `Idempotency-Key`; the UI updates the map optimistically and rolls back on a 409. Details: [DESIGN.md §8](DESIGN.md).

## Deploying the UI (Vercel Hobby, no card)
1. Sign in to vercel.com with GitHub and import this repo. `vercel.json` sets build `npm run build`, output `dist`, and an SPA rewrite to `index.html`.
2. Set `VITE_API_BASE_URL=https://iitb-zeip.onrender.com` and deploy.
3. Put the Vercel URL in the API's `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`, then redeploy the API.

Alternative: Netlify or Cloudflare Pages with the same build; `public/_redirects` gives the SPA fallback.

## Known limitations
- Hosted API sleeps after 15 min idle; the first request can take about a minute (login shows a spinner).
- History days with no operations and no seed row appear as gaps (no scheduler on the free tier).
- "Today" and the 7-day chart use IST (Asia/Kolkata) day boundaries.
- Auth token is stored in `localStorage`; one token per user, so logout signs out every session.
- Shuttle battery is simulated (drains while idle/working, recharges at 10%); below 20% it emails a low-battery alert.
- Playwright runs mutate the shared database; a crashed run can leave `E2E-*` pallets behind.
