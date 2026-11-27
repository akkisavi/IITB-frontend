import { Link } from 'react-router-dom';
import { IconGrid } from '../components/Icons';

const COLUMNS = ['A', 'B', 'C', 'D', 'E'];
const ROWS = [5, 4, 3, 2, 1];
const SAMPLE_OCCUPIED = new Set(['B2', 'B4', 'C3', 'D1', 'D5', 'E2', 'A4']);

const ROLES = [
  { role: 'Technician', does: 'Loads pallets into free slots and unloads them back through A1.', map: 'Read + write', dashboard: 'No', users: 'No' },
  { role: 'Auditor', does: 'Reviews stock, pallet history and the 7-day occupancy chart.', map: 'Read only', dashboard: 'Yes', users: 'No' },
  { role: 'Admin', does: 'Everything a technician and auditor can do, plus user access.', map: 'Read + write', dashboard: 'Yes', users: 'Yes' },
];

const DECISIONS = [
  {
    title: 'One pallet per slot, enforced by the database',
    body: 'Loads run inside a transaction and the location column is one-to-one. When two technicians target the same slot, one gets a 409 and the map refreshes instead of double-booking.',
  },
  {
    title: 'Unloading keeps the record',
    body: 'A pallet is marked unloaded with who and when, never deleted. The operations log is append-only, so the audit trail and the occupancy history come from the same facts.',
  },
  {
    title: 'Retries cannot act twice',
    body: 'Load and unload accept an Idempotency-Key. A resent request replays the first response; a reused key with a different body is rejected.',
  },
  {
    title: 'Removing access is a deactivation',
    body: 'Deactivating a user or resetting a password deletes their token at once. An admin cannot deactivate themselves, and the last admin cannot be removed.',
  },
];

function FloorDiagram() {
  return (
    <figure className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1.5" role="img" aria-label="Sample 5 by 5 warehouse floor. A1 is the transfer point; 7 of 24 storage slots are occupied.">
        {ROWS.map((r) => (
          <div key={r} className="contents">
            <span className="num self-center pr-1 text-xs text-base-content/70">{r}</span>
            {COLUMNS.map((c) => {
              const code = `${c}${r}`;
              const transfer = code === 'A1';
              const occupied = SAMPLE_OCCUPIED.has(code);
              return (
                <div
                  key={code}
                  className={`flex aspect-square flex-col items-center justify-center rounded-md border text-[11px] font-medium ${transfer ? 'hatch border-base-300' : occupied ? 'cell-occupied' : 'cell-free'}`}
                >
                  <span>{code}</span>
                  <span className={`text-[9px] uppercase tracking-wide ${transfer ? 'text-base-content/70' : occupied ? 'text-occupied' : 'text-free'}`}>
                    {transfer ? 'Transfer' : occupied ? 'Full' : 'Free'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        <span />
        {COLUMNS.map((c) => (
          <span key={c} className="text-center text-xs text-base-content/70">{c}</span>
        ))}
      </div>
      <figcaption className="mt-4 text-xs text-base-content/70">Sample layout, not live stock. Sign in to see the real map.</figcaption>
    </figure>
  );
}

export default function OverviewPage() {
  return (
    <div id="top" className="min-h-full bg-base-200">
      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-4 sm:pt-4">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between rounded-xl border border-base-300 bg-base-100 py-2 pl-3 pr-2 shadow-md sm:pl-4"
          aria-label="Primary"
        >
          <a href="#top" className="flex items-center gap-2 rounded-md font-display text-lg">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-content">
              <IconGrid className="h-4 w-4" />
            </span>
            Warehouse Console
          </a>
          <div className="flex items-center gap-1 text-sm">
            {[
              ['#how', 'How it works'],
              ['#tour', 'Video tour'],
              ['#roles', 'Roles'],
              ['#decisions', 'Design decisions'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="hidden rounded-md px-3 py-1.5 text-base-content/80 transition-colors duration-150 hover:bg-base-200 hover:text-base-content md:inline"
              >
                {label}
              </a>
            ))}
            <Link to="/login" className="btn btn-primary btn-sm ml-2">Sign in</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-[1.1fr_1fr] md:py-32">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-medium text-primary">Pallet shuttle warehouse</p>
            <h1 className="text-4xl leading-tight sm:text-5xl">Track every pallet across a 25-slot floor, and who moved it.</h1>
            <p className="mt-6 max-w-prose text-base text-base-content/80">
              Technicians load pallets through transfer point A1 into 24 storage slots. Auditors read the stock, the
              per-pallet history and seven days of occupancy. Every screen refreshes within five seconds of a change
              made in another session.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="btn btn-primary">Open the console</Link>
              <a href="#how" className="btn btn-ghost border border-base-300">See how a load works</a>
            </div>
          </div>
          <FloorDiagram />
        </section>

        <section id="how" className="scroll-mt-24 border-y border-base-300 bg-base-100">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="text-2xl">How a pallet moves</h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-[2fr_1fr_1fr]">
              <li className="border-l-2 border-primary pl-4">
                <span className="num text-sm text-base-content/70">01 Load</span>
                <p className="mt-2">
                  The technician enters pallet number, barcode, item and quantity, then picks a free slot. The server
                  checks the rules, locks the slot and writes the pallet and a LOAD entry in one transaction.
                </p>
              </li>
              <li className="border-l-2 border-base-300 pl-4">
                <span className="num text-sm text-base-content/70">02 Store</span>
                <p className="mt-2">The slot turns full on every open map within five seconds.</p>
              </li>
              <li className="border-l-2 border-base-300 pl-4">
                <span className="num text-sm text-base-content/70">03 Unload</span>
                <p className="mt-2">The pallet returns through A1, leaves stock and stays in history.</p>
              </li>
            </ol>
          </div>
        </section>

        <section id="tour" className="scroll-mt-24 mx-auto max-w-5xl px-4 pt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl">Watch the console in one minute</h2>
            <span className="text-sm text-base-content/70">55 s · narrated · real screens</span>
          </div>
          <video
            className="mt-6 aspect-video w-full rounded-lg border border-base-300 bg-base-100"
            src="/video/warehouse-tutorial.mp4"
            poster="/video/warehouse-tutorial-poster.jpg"
            controls
            preload="none"
            playsInline
            aria-label="Warehouse Console tutorial: sign in, read the map, load a pallet, check the log and dashboard"
          />
        </section>

        <section id="roles" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
            <div>
              <h2 className="text-2xl">Three roles, checked on the server</h2>
              <p className="mt-3 max-w-prose text-base-content/80">
                The interface hides what a role cannot do, but every API view enforces it too. Opening a page you have
                no access to shows a no-access screen.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Role</th>
                    <th scope="col">Map</th>
                    <th scope="col">Dashboard</th>
                    <th scope="col">Users</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((r) => (
                    <tr key={r.role}>
                      <td>
                        <div className="font-medium">{r.role}</div>
                        <div className="mt-0.5 text-xs text-base-content/70">{r.does}</div>
                      </td>
                      <td>{r.map}</td>
                      <td>{r.dashboard}</td>
                      <td>{r.users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="decisions" className="scroll-mt-24 bg-neutral text-neutral-content">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="max-w-3xl text-3xl">Built for the moment two people reach for the same slot</h2>
            <dl className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
              {DECISIONS.map((d) => (
                <div key={d.title} className="border-t border-neutral-content/20 pt-5">
                  <dt className="font-display text-lg">{d.title}</dt>
                  <dd className="mt-2 max-w-prose text-neutral-content/80">{d.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-12">
          <h2 className="text-xl">Stack</h2>
          <p className="mt-3 text-base-content/80">
            React and TypeScript on Vite, with TanStack Query for polling and Tailwind with DaisyUI for styling. The API
            is Django REST Framework with token authentication. Playwright tests cover the end-to-end flows, including
            two simultaneous loads into one slot.
          </p>
        </section>
      </main>

      <footer className="border-t border-base-300 bg-base-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-base-content/70">
          <span>Warehouse Console</span>
          <Link to="/login" className="hover:text-primary">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
