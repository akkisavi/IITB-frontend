# Design

## 1. Interpretation
- Floor: 25 fixed locations (A-E x 1-5). A1 is a transfer point that never holds stock; 24 storage locations hold at most one pallet each.
- Load = palletise at A1 + instant shuttle move to a free storage location. Unload = instant move back to A1, after which the pallet leaves stock (kept as history, status `unloaded`).
- One shuttle (`SH-01`), read-only, values from the DB. Operations do not change it (brief says simulation is not required).
- Synthetic data only. Stock is persisted in a relational DB; nothing is simulated in the browser.

## 2. Architecture
```
Browser (React + TS, Vite, TanStack Query polling)
   |  HTTPS, JSON, Authorization: Token <key>
Django + DRF  (/api/..., /health/)
   |
SQLite (SQLITE_PATH)
```
**Repository layout:** one repository with `warehouse-api/` and `warehouse-ui/` as independent apps (each has its own dependencies, README and `evaluation.json`). The brief asks for two public repositories with each app at its root; this is a deliberate departure, so evaluation tooling must be pointed at the subfolders.

**Database decision:** the API uses SQLite at `SQLITE_PATH`, locally and hosted, following the brief's §7 convention. No database server is needed.
Hosted: UI static build on Vercel, API on Render free web service (gunicorn) with its SQLite file on the instance. Render's free filesystem is ephemeral, so the hosted data resets to the seeded demo on every deploy, restart or wake from sleep.

## 3. Data model
| Model | Key fields | Relationships / constraints |
|---|---|---|
| `UserProfile` | role (`admin`/`auditor`/`technician`) | 1:1 `auth.User`; superuser always counts as admin |
| `Location` | code, column, row, kind (`transfer`/`storage`) | 25 rows from a data migration; never created by API |
| `Pallet` | pallet_number, barcode, item_name, quantity, status, storage_location, loaded/unloaded at/by | 1:1 nullable to Location (NULL after unload, so the slot frees up); `storage_location` keeps the code forever, so the row doubles as the pallet's history record; unique number and barcode among **active** pallets; check: active <=> has location; quantity 1..100000 |
| `IdempotencyRecord` | key, user, endpoint, request_hash, stored response | unique (user, key); written only for successful load/unload |
| `OperationLog` | op_type LOAD/UNLOAD, location_code, snapshots of pallet/item/qty/username | FK Pallet (PROTECT), FK User (SET_NULL); append-only |
| `Shuttle` | identifier, status, battery_percent 0..100 | single seeded row |
| `DailyOccupancySnapshot` | date (unique), occupied, free, capacity=24, source `sample`/`live` | written by operations and seed |

## 4. API summary
| Method | Path | Roles |
|---|---|---|
| GET | `/health/` | anyone |
| POST | `/api/auth/login/`, `/api/auth/logout/`; GET `/api/auth/me/` | anon / authenticated |
| GET | `/api/locations/`, `/api/locations/{code}/` | all roles |
| POST | `/api/operations/load/`, `/api/operations/unload/` | admin, technician |
| GET | `/api/pallets/`, `/api/pallets/{id}/`, `/api/operations/` | all roles |
| GET | `/api/shuttle/` | all roles |
| GET | `/api/dashboard/` | admin, auditor |
| CRUD | `/api/users/`, `/api/users/{id}/set-password/` | admin |

Errors use one shape: `{"detail", "code", "errors"?}`, with codes such as `validation_error`, `location_occupied`, `location_empty`, `duplicate_pallet_number`, `duplicate_barcode`, `conflict`, `last_admin`, `self_action_forbidden`.

## 5. Permissions
| Capability | Admin | Auditor | Technician | Anonymous |
|---|---|---|---|---|
| Map, pallets, operations, shuttle | Y | Y | Y | 401 |
| Load / unload | Y | 403 | Y | 401 |
| Dashboard | Y | Y | 403 | 401 |
| User administration | Y | 403 | 403 | 401 |

Enforced by DRF permission classes on every view (backend is authoritative). The UI hides nav links and buttons for disallowed actions and renders a "no access" page on direct navigation.

## 6. Workflows
- **Load:** dialog (pallet number, barcode, item, quantity, destination limited to free storage cells). Server validates, then in one transaction locks the location, checks occupancy and active duplicates, creates the pallet and LOAD log, and updates today's snapshot. Success toast; map refetches.
- **Unload:** select an occupied cell, confirm. Transaction locks the location, marks the pallet `unloaded` with location NULL, writes an UNLOAD log, updates today's snapshot.
- **Audit trail:** the Pallets page filters In stock / Unloaded / All. Each pallet shows where it was stored, when and by whom it was loaded and unloaded; the operations log lists every movement. This is real history from operations, separate from the seeded sample chart data.
- **Live updates:** map polls every 3 s (other sessions visible within 5 s), dashboard every 5 s, shuttle every 10 s. Polling does not reset an open dialog.
- **Users:** admin creates users with a role, changes role, sets passwords (revokes the user's token), deactivates/reactivates (soft delete, history kept).

## 7. Validation
| Field | Rule |
|---|---|
| Pallet number | trimmed, uppercased, `^[A-Z0-9-]{3,32}$`, unique among active pallets |
| Barcode | `^[0-9]{8,14}$` (no checksum), unique among active pallets |
| Item name | trimmed, inner whitespace collapsed, 1-100 chars |
| Quantity | whole number 1-100000 (decimals, booleans, strings rejected) |
| Location | must exist; A1 rejected for load and unload; load target must be free (409), unload source must be occupied (409) |
| Username | `^[A-Za-z0-9_.-]{3,150}$`, unique case-insensitively |
| Password | 12-128 chars, no whitespace, plus Django validators |
| Role | admin, auditor or technician |

The UI mirrors these rules with the same messages; the server remains authoritative.

## 8. Concurrency and failure handling
- Each load runs inside `transaction.atomic()`; SQLite allows one writer at a time (20 s busy timeout), and the one-to-one location column is a database constraint. A losing concurrent request gets 409, never a double-booked cell.
- Active pallet number/barcode uniqueness is a database constraint too: unique `active_pallet_number` / `active_barcode` columns, cleared on unload.
- `IntegrityError` maps to a specific 409 code where the constraint is identifiable, else `conflict`.
- Verified end to end: a Playwright test fires two loads at the same free location from two sessions at once and asserts exactly one 201, one 409, and one pallet in the slot.
- **Idempotency.** Load and unload accept an optional `Idempotency-Key` header (8-64 chars). The first *successful* response is stored per (user, key); a retry with the same key and body replays it (`Idempotent-Replayed: true`) instead of acting twice. The same key with a different body is 422 `idempotency_key_reused`. Failed requests are not stored, so the client can correct input and resend. Without a key, the pallet number still acts as a natural key: a repeat load gets 409 `duplicate_pallet_number`. The UI sends one key per submitted form (reused if the identical form is resubmitted) and retries only on network errors, where the request may or may not have arrived.
- **Optimistic UI.** On load/unload the map cache is patched immediately (TanStack Query `onMutate`), a concurrent poll is cancelled so it cannot overwrite the patch, the server's cell replaces the guess on success, and the previous map is restored on error, with the server's message shown. A refetch always follows, so the poll remains the source of truth.
- Stale UI (e.g. unloading an already-empty cell) yields 409, an error toast and a refetch. 401 clears the session and redirects to login; 403 shows a toast only. Network errors show a retrying banner and keep the last data.

## 9. Historical chart
- **Daily value** = occupied storage locations at end of that UTC day; free = 24 - occupied (A1 excluded).
- Window: the 7 dates today-6 .. today.
- **Today** is computed live from active pallets.
- **Previous days** come from snapshot rows. Each load/unload upserts today's row in the same transaction, so at midnight it becomes that day's end-of-day value.
- A past day with no row is returned as `null` and drawn as a gap; values are never invented at request time.
- `seed_demo` creates deterministic `sample` rows (6, 8, 7, 10, 9, 11 occupied) for the previous 6 days where missing. This sample history is synthetic and need not connect to current stock; once the app is used, `live` rows replace it day by day.

## 10. Security
- DRF TokenAuthentication only (no session auth, so no CSRF surface for the API). Token kept in `localStorage`.
- Login gives the same message for wrong and inactive accounts. Deactivation and password resets delete the token.
- Passwords never returned or logged; demo passwords come only from `EVAL_*` env vars; `.env.example` holds placeholders.
- Production requires `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, explicit allowed hosts and CORS origins.

## 11. Trade-offs
- **Admins can create and promote admins.** The brief lists auditor and technician assignment, but also says admin accesses every feature. Without this, replacing an admin needs shell access and a single admin is a lockout risk. Guarded by: no self-deactivate/demote, and no change may leave zero active admins.
- **Token in localStorage:** simple and works across tabs, but exposed to XSS. Acceptable for this exercise; an httpOnly cookie + CSRF would be the production choice.
- **One token per user:** logout on one device logs out all.
- **Polling over WebSockets:** meets the 5 s requirement with no extra infrastructure on free hosting.
- **Snapshots written on operations, not by a scheduler:** free tiers have no reliable cron; gaps are shown honestly.
- **UTC days:** one consistent boundary; for IST users the day changes at 05:30.

## 12. Deferred work
- Shuttle simulation (busy/battery drain), movement animation.
- Scheduled daily snapshot command run by cron.
- Per-device tokens / token expiry; cookie-based auth.
- Barcode checksum validation; pallet edit/move between storage locations.
- Audit log export.

## 13. Limitations
- Free-tier cold starts (~1 min on Render).
- Hosted data is not durable: Render's free filesystem resets the SQLite file to the seeded demo on each deploy, restart or wake.
- Single repository: does not follow the brief's two-repository convention; each app is in a subfolder, not at a repository root.
- Playwright tests share the evaluation DB; crashed runs may leave `E2E-*` pallets.

