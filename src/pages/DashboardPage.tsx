import { Link } from 'react-router-dom';
import { useDashboard } from '../api/hooks';
import { OpBadge, TableRegion } from '../components/DataTable';
import type { HistoryPoint } from '../api/types';
import { Empty, ErrorBanner, Loading } from '../components/States';
import { formatDateTime, fmtNum, shortUtcDay } from '../lib/format';

const SOURCE_LABEL: Record<HistoryPoint['source'], string> = {
  sample: 'Sample',
  live: 'Recorded',
  live_now: 'Live now',
  missing: 'No record',
};

function HistoryChart({ points, capacity }: { points: HistoryPoint[]; capacity: number }) {
  const W = 560;
  const H = 220;
  const padL = 28;
  const padB = 34;
  const padT = 10;
  const plotH = H - padB - padT;
  const slot = (W - padL) / Math.max(points.length, 1);
  const bw = Math.min(44, slot * 0.58);
  const y = (v: number) => padT + plotH - (v / Math.max(capacity, 1)) * plotH;
  const ticks = [0, 6, 12, 18, 24].filter((t) => t <= capacity);

  return (
    <svg
      data-testid="history-chart"
      data-points={points.length}
      viewBox={`0 0 ${W} ${H}`}
      className="dashboard-chart h-auto w-full"
      role="img"
      aria-label={`Stacked bars of occupied and free storage slots for the last ${points.length} days. Data in the table below.`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={t === 0 ? 0.35 : 0.1} />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity={0.6} className="num">{t}</text>
        </g>
      ))}
      {points.map((p, i) => {
        const cx = padL + slot * i + slot / 2;
        const x = cx - bw / 2;
        const today = i === points.length - 1;
        return (
          <g key={p.date} className="dashboard-chart-column" style={{ animationDelay: `${i * 55}ms` }}>
            {p.occupied === null || p.free === null ? (
              <>
                <rect x={x} y={y(capacity)} width={bw} height={plotH} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />
                <text x={cx} y={y(capacity / 2)} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity={0.6}>n/a</text>
              </>
            ) : (
              <>
                <rect x={x} y={y(p.occupied)} width={bw} height={y(0) - y(p.occupied)} rx="3" className="fill-error" />
                <rect x={x} y={y(capacity)} width={bw} height={y(p.occupied) - y(capacity)} rx="3" className="fill-success" fillOpacity={0.55} />
                {p.occupied > 0 && (
                  <text x={cx} y={y(p.occupied) + 12} textAnchor="middle" fontSize="10" fontWeight={600} className="fill-error-content num">{p.occupied}</text>
                )}
              </>
            )}
            <text x={cx} y={H - 18} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity={today ? 1 : 0.7} fontWeight={today ? 600 : 400}>
              {today ? 'Today' : shortUtcDay(p.date)}
            </text>
            <text x={cx} y={H - 5} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity={0.55} className="num">{p.date.slice(5)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Stat({ label, testid, value, tone, detail }: { label: string; testid: string; value: number | string; tone?: string; detail: string }) {
  return (
    <div className="dashboard-panel dashboard-enter rounded-xl border border-base-300 bg-base-100 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-base-content/60">{label}</p>
      <p className={`num mt-4 font-display text-4xl font-semibold leading-none ${tone ?? ''}`}>
        <span data-testid={testid}>{value}</span>
      </p>
      <p className="mt-3 text-xs text-base-content/60">{detail}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data, error, isLoading, refetch } = useDashboard();

  return (
    <div className="mx-auto max-w-7xl pb-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Warehouse overview</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Occupancy dashboard</h1>
          <p className="mt-1 text-sm text-base-content/60">A live view of space, stock and recent movement.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-base-300 bg-base-100 px-3 py-2 text-xs text-base-content/70">
          <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
          {data ? `Updated ${formatDateTime(data.generated_at)}` : 'Refreshes every 5 s'}
        </div>
      </header>
      <ErrorBanner error={error} onRetry={() => void refetch()} />
      {isLoading && !data ? (
        <Loading label="Loading dashboard" />
      ) : data ? (
        <div className="space-y-5">
          <section className="dashboard-hero dashboard-enter relative overflow-hidden rounded-2xl bg-neutral p-6 text-neutral-content sm:p-8">
            <div className="relative z-10 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.75fr)] md:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-content/60">Current storage use</p>
                <p className="num mt-4 font-display text-7xl font-semibold leading-none tracking-tight sm:text-8xl">
                  <span data-testid="stat-occupancy-pct">{data.occupancy_pct}</span><span className="ml-1 text-4xl text-neutral-content/60 sm:text-5xl">%</span>
                </p>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-content/70">
                  {data.occupied} of {data.capacity} storage slots are occupied. {data.free} available for the next load.
                </p>
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-neutral-content/70">
                  <span>Occupied <strong className="num ml-1 text-neutral-content">{data.occupied}</strong></span>
                  <span>Available <strong className="num ml-1 text-neutral-content">{data.free}</strong></span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-content/20" role="img" aria-label={`${data.occupied} of ${data.capacity} storage slots occupied`}>
                  <div className="dashboard-meter h-full rounded-full bg-warning" style={{ width: `${Math.min(100, Math.max(0, data.occupancy_pct))}%` }} />
                </div>
                <p className="mt-3 text-xs text-neutral-content/50">Transfer point A1 is excluded from capacity</p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Occupied slots" testid="stat-occupied" value={data.occupied} tone="text-occupied" detail="Currently holding a pallet" />
            <Stat label="Free slots" testid="stat-free" value={data.free} tone="text-free" detail="Ready for incoming stock" />
            <Stat label="Storage capacity" testid="stat-capacity" value={data.capacity} detail="Excludes transfer point A1" />
            <div className="dashboard-panel dashboard-enter rounded-xl border border-base-300 bg-base-100 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-base-content/60">Today's movement</p>
              <p className="num mt-4 font-display text-4xl font-semibold leading-none">{data.loads_today}<span className="mx-2 text-xl font-normal text-base-content/30">/</span>{data.unloads_today}</p>
              <p className="mt-3 text-xs text-base-content/60">Loads / unloads today</p>
            </div>
          </div>

          <section className="dashboard-panel dashboard-enter rounded-xl border border-base-300 bg-base-100 p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Trend</p><h2 className="mt-1 font-display text-xl font-semibold">Last 7 days</h2></div>
              <ul className="flex gap-4 text-xs" aria-label="Chart legend">
                <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-error" aria-hidden="true" />Occupied</li>
                <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success/60" aria-hidden="true" />Free</li>
                <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-base-content/40" aria-hidden="true" />No record</li>
              </ul>
            </div>
            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <figure>
                <HistoryChart points={data.history} capacity={data.capacity} />
                <figcaption data-testid="history-definition" className="mt-3 max-w-prose text-xs leading-relaxed text-base-content/70">
                  Each day’s value is the number of occupied storage slots (A1 excluded, capacity {data.capacity}) at the end of
                  that UTC day. Today is computed live from current stock. Past days come from snapshots written by each
                  load/unload; rows marked “Sample” are seeded synthetic history and need not match today’s stock. Days with no
                  record are shown as gaps, never estimated.
                </figcaption>
              </figure>
              <TableRegion label="Daily occupancy, last 7 days">
                <table data-testid="history-table" className="data-table data-table-compact rounded-md border border-base-300">
                  <caption className="sr-only">Daily occupancy, last 7 days</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date (UTC)</th>
                      <th scope="col" className="num-col">Occupied</th>
                      <th scope="col" className="num-col">Free</th>
                      <th scope="col" className="num-col">Use</th>
                      <th scope="col">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((p) => (
                      <tr key={p.date} data-testid={`history-row-${p.date}`}>
                        <td className="num whitespace-nowrap">{p.date}</td>
                        <td className="num-col font-medium text-occupied">{p.occupied ?? '—'}</td>
                        <td className="num-col font-medium text-free">{p.free ?? '—'}</td>
                        <td className="num-col muted">{p.occupied == null ? '—' : `${Math.round((p.occupied / data.capacity) * 100)}%`}</td>
                        <td>
                          <span className={`text-xs ${p.source === 'live_now' ? 'font-medium' : 'muted'}`}>
                            {SOURCE_LABEL[p.source] ?? p.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableRegion>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <section data-testid="recent-operations" className="dashboard-panel rounded-xl border border-base-300 bg-base-100">
              <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                <h2 className="font-display text-lg font-semibold">Recent operations</h2>
                <Link to="/pallets" className="link link-hover text-xs text-base-content/70">Full log →</Link>
              </div>
              {data.recent_operations.length === 0 ? (
                <div className="p-4"><Empty title="No operations yet." /></div>
              ) : (
                <TableRegion label="Recent operations">
                  <table className="data-table data-table-compact">
                    <thead>
                      <tr>
                        <th scope="col">Operation</th>
                        <th scope="col">Pallet</th>
                        <th scope="col">Location</th>
                        <th scope="col" className="hidden sm:table-cell">Item</th>
                        <th scope="col">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent_operations.map((o) => (
                        <tr key={o.id}>
                          <td><OpBadge type={o.op_type} /></td>
                          <td className="num font-medium">{o.pallet_number}</td>
                          <td className="num">{o.location_code}</td>
                          <td className="muted hidden max-w-[12rem] truncate sm:table-cell">{o.item_name}</td>
                          <td className="num muted whitespace-nowrap text-xs">
                            {formatDateTime(o.created_at)}
                            <span className="block">{o.username || '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableRegion>
              )}
            </section>

            <div className="space-y-6">
              <section data-testid="top-items" className="dashboard-panel rounded-xl border border-base-300 bg-base-100">
                <h2 className="px-4 py-3 font-display text-lg font-semibold">Top items by quantity</h2>
                {data.top_items.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-base-content/70">No stock on hand.</p>
                ) : (
                  <TableRegion label="Top items by quantity">
                    <table className="data-table data-table-compact">
                      <thead>
                        <tr>
                          <th scope="col">Item</th>
                          <th scope="col" className="num-col">Quantity</th>
                          <th scope="col" className="num-col">Pallets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_items.map((t) => (
                          <tr key={t.item_name}>
                            <td className="max-w-[10rem] truncate">{t.item_name}</td>
                            <td className="num-col font-medium">{fmtNum(t.quantity)}</td>
                            <td className="num-col muted">{t.pallets}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableRegion>
                )}
              </section>
              <section data-testid="oldest-pallets" className="dashboard-panel rounded-xl border border-base-300 bg-base-100">
                <h2 className="px-4 py-3 font-display text-lg font-semibold">Longest in storage</h2>
                {data.oldest_pallets.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-base-content/70">No active pallets.</p>
                ) : (
                  <TableRegion label="Longest in storage">
                    <table className="data-table data-table-compact">
                      <thead>
                        <tr>
                          <th scope="col">Pallet</th>
                          <th scope="col">Location</th>
                          <th scope="col">Loaded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.oldest_pallets.map((p) => (
                          <tr key={p.id}>
                            <td className="num font-medium">{p.pallet_number}</td>
                            <td className="num">{p.location}</td>
                            <td className="num muted whitespace-nowrap text-xs">{formatDateTime(p.loaded_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableRegion>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
