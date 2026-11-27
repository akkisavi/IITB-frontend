# AI usage

## My role
I owned the project and made its decisions; AI agents wrote most of the code under my direction. My part:
- **Scope and product decisions:** chose the features beyond the brief and asked for them one at a time: shuttle battery control, low-battery email alerts, maintenance notes on the Shuttle page, and the collapsible sidebar.
- **Database:** set up and ran a local database for development, then decided to move the API to SQLite for hosting, and had existing user accounts carried over.
- **Backend issues:** reviewed backend problems as they came up, decided how each should be resolved and approved the fixes, including a model missing from the code and alert emails holding up API requests.
- **Configuration:** supplied the SMTP settings for alert emails and the local environment values.
- **Review and testing:** used the running app myself, reported layout problems from screenshots (the sidebar collapse control's position and the gap under the top bar), and checked the fixes.
- **Cleanup:** asked for unnecessary code comments to be removed across both apps and for the docs to match the final database setup.

## Tools
- **Claude Code** (Claude Opus model) as the main agent, following the `fable-playbook` workflow skill to plan, delegate and check work.
- **AntiSlopUI** design skill (`antislop-design`), installed with `npx skills add Vanszs/AntiSlopUI`, used by the frontend work to avoid generic AI-styled UI defaults.
- Web search for current free-hosting terms (Render, Vercel, Koyeb).

## Workflow
1. Working from my instructions, the main agent read the brief (`Design_Round.md`) and fixed the stack and key decisions (token auth, history definition, seed behaviour). An architecture subagent then wrote `SPEC.md` (kept outside both repos as a working document): data model, API contract, permissions, validation, UI test IDs, seed commands. The main agent reviewed it and accepted its open choices (e.g. admins may create admins, guarded by self/last-admin rules).
2. Four further subagents then worked in parallel from that spec, each owning separate files so they could not overwrite each other:
   | Subagent | Scope |
   |---|---|
   | Architecture | `SPEC.md` only; no code |
   | Backend | Django/DRF app in `warehouse-api` (models, migrations, views, seed/reset commands, API tests) |
   | Frontend | React/TS app in `warehouse-ui` |
   | QA | Playwright suite and config |
   | DevOps/Docs | deployment config, `evaluation.json`, `.env.example`, README, DESIGN, AI_USAGE |
3. The main agent integrated the results, ran the apps and tests, and reviewed the output against the brief. I then used the app, asked for changes and new features, and reviewed each result.

An independent critic subagent reviewed both repositories against the brief after integration (read-only); its findings were triaged by the main agent (see Corrections).

## Verification performed
Reports from subagents were treated as claims; the main agent re-ran the checks itself on 2026-11-27:
- Backend: `manage.py makemigrations --check --dry-run` (no changes), `manage.py test` (OK; Django `APITestCase` suite covering the permission matrix, validation, 409 conflicts, self/last-admin rules, seed idempotency).
- Frontend: `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- End-to-end, evaluator-style on a fresh SQLite file: `migrate --noinput`, `seed_demo` run twice (second run created no duplicates), API on `127.0.0.1:8000`, UI via `npm start` on `127.0.0.1:5173`, `npm test` → 22 passed, 0 failed, 0 skipped, exit 0, JSON report written to `PLAYWRIGHT_JSON_OUTPUT_FILE`.
- The frontend subagent smoke-tested login, load, duplicate-load error, unload, role gating and the 375 px layout in a real browser; the AntiSlopUI `audit.py` script reported 0 violations (`docs/ANTISLOP_AUDIT.md`).

## Corrections made
- Database: at the owner's decision for hosting, the API uses SQLite only (`SQLITE_PATH`), locally and hosted. The latest suite (27/27) has not yet been re-run since that change.
- First Playwright run (QA subagent) had 9 failures: another agent's API restarted on the shared port 8000 with a different database. Root cause was test-environment port sharing, not app code; QA moved to isolated ports and added a sweep that unloads stale `E2E-*` pallets left by aborted runs. Final run on the standard ports with a fresh DB: 22/22.
- Frontend smoke test found map cells only 53 px wide at 1024 px and a 448 px-wide header at 375 px; layout was changed (detail panel moved below the grid under `xl`, compact header) and re-checked.
- Critic review: the API refused to start locally unless `DJANGO_DEBUG=1` was set, and localhost CORS also depended on DEBUG. Settings now treat a local-only `DJANGO_ALLOWED_HOSTS` as local mode (dev key fallback + localhost/127.0.0.1 CORS); hosted mode still requires `DJANGO_SECRET_KEY`. Re-verified with `check`, `migrate` and `test` without `DJANGO_DEBUG`.
- Critic review: unresolved `<!-- VERIFY -->` markers in DESIGN.md; error codes were checked against `services.py`/`exceptions.py`/`accounts/views.py` and the markers removed.
- `AI_USAGE.md` draft wrongly said the main agent wrote `SPEC.md`; corrected to the architecture subagent.

## Remaining uncertainty
- Free-tier terms (Render sleep/hours) can change; verified via provider docs on 2026-11-27.
- SQLite serialises writes, so truly parallel writes are never exercised.
- Not run: gunicorn (Windows), the Render/Vercel deployment itself, browsers other than Chromium.
- AntiSlopUI audit items at 768 px and 1440 px widths are marked UNVERIFIED in `docs/ANTISLOP_AUDIT.md`.
