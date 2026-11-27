import { useEffect, useState } from 'react';
import { useOperations, usePallets } from '../api/hooks';
import { Empty, ErrorBanner, Loading, PageHeader } from '../components/States';
import { formatDateTime, fmtNum } from '../lib/format';
import { OpBadge, Pagination, TableRegion } from '../components/DataTable';

const SIZES = [10, 25, 50];

type StatusFilter = 'active' | 'unloaded' | 'all';
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'In stock' },
  { value: 'unloaded', label: 'Unloaded' },
  { value: 'all', label: 'All' },
];

function LocChip({ code, dim }: { code: string | null; dim?: boolean }) {
  if (!code) return <span className="muted">—</span>;
  return (
    <span
      title={dim ? `Was stored at ${code}` : undefined}
      className={`num inline-flex min-w-[2.25rem] justify-center rounded-sm border px-1.5 py-0.5 text-xs font-semibold ${
        dim ? 'border-dashed border-base-300 text-base-content/60' : 'border-base-300 bg-base-200/60'
      }`}
    >
      {code}
    </span>
  );
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function PalletsPage() {
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const [opPage, setOpPage] = useState(1);
  const [size, setSize] = useState(10);
  const [opSize, setOpSize] = useState(10);
  const [status, setStatus] = useState<StatusFilter>('active');
  useEffect(() => setPage(1), [q, status]);

  const pallets = usePallets({ search: q, status, page, page_size: size });
  const history = status !== 'active';
  const ops = useOperations({ page: opPage, page_size: opSize });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Pallets & operations log" sub="Stock and pallet history, searchable by pallet number, barcode or item. The log is append-only." />
      <ErrorBanner error={pallets.error ?? ops.error} />

      <section className="rounded-lg border border-base-300 bg-base-100">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold">Pallets</h2>
            <div role="radiogroup" aria-label="Pallet status" className="join">
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={status === o.value}
                  data-testid={`pallet-status-${o.value}`}
                  className={`btn join-item btn-sm h-8 min-h-8 font-medium ${status === o.value ? 'btn-neutral' : 'btn-ghost border-base-300'}`}
                  onClick={() => setStatus(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <label className="w-full sm:w-72">
            <span className="sr-only">Search pallets</span>
            <input
              type="search"
              data-testid="pallet-search"
              className="input input-bordered input-sm h-9 w-full"
              placeholder="Search number, barcode, item"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {pallets.isLoading ? (
          <div className="px-4"><Loading /></div>
        ) : (
          <TableRegion label="Pallets">
            <table data-testid="pallets-table" className="data-table">
              <thead>
                <tr>
                  <th scope="col">Pallet</th>
                  <th scope="col">Location</th>
                  <th scope="col">Item</th>
                  <th scope="col" className="num-col">Quantity</th>
                  <th scope="col" className="hidden md:table-cell">Barcode</th>
                  <th scope="col" className="hidden md:table-cell">Loaded</th>
                  {history && <th scope="col">Status</th>}
                  {history && <th scope="col" className="hidden md:table-cell">Unloaded</th>}
                </tr>
              </thead>
              <tbody>
                {pallets.data?.results.map((p) => (
                  <tr key={p.id} data-testid={`pallet-row-${p.pallet_number}`}>
                    <td className="num font-medium">{p.pallet_number}</td>
                    <td><LocChip code={p.location ?? p.storage_location} dim={p.status === 'unloaded'} /></td>
                    <td className="max-w-[10rem] truncate sm:max-w-none">{p.item_name}</td>
                    <td className="num-col font-medium">{fmtNum(p.quantity)}</td>
                    <td className="num muted hidden md:table-cell">{p.barcode}</td>
                    <td className="num muted hidden whitespace-nowrap md:table-cell">
                      {formatDateTime(p.loaded_at)}
                      {history && <span className="block text-xs">by {p.loaded_by ?? '—'}</span>}
                    </td>
                    {history && (
                      <td>
                        <span
                          className={`inline-flex rounded-sm px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            p.status === 'active' ? 'cell-occupied text-occupied ring-error/30' : 'bg-base-200 text-base-content/70 ring-base-300'
                          }`}
                        >
                          {p.status === 'active' ? 'In stock' : 'Left via A1'}
                        </span>
                      </td>
                    )}
                    {history && (
                      <td className="num muted hidden whitespace-nowrap md:table-cell">
                        {p.unloaded_at ? (
                          <>
                            {formatDateTime(p.unloaded_at)}
                            <span className="block text-xs">by {p.unloaded_by ?? '—'}</span>
                          </>
                        ) : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {pallets.data && pallets.data.results.length === 0 && (
              <div className="p-4">
                <Empty title={q ? `No ${status === 'all' ? '' : status + ' '}pallet matches “${q}”.` : status === 'active' ? 'The warehouse is empty.' : 'No pallets found.'}>
                  {q ? 'Check the spelling or search by barcode.' : status === 'unloaded' ? 'Unloaded pallets will appear here.' : 'Loaded pallets will appear here.'}
                </Empty>
              </div>
            )}
          </TableRegion>
        )}
        {pallets.data && (
          <Pagination page={page} pageSize={size} count={pallets.data.count} onPage={setPage} label="Pallets"
            sizes={SIZES} onPageSize={(n) => { setSize(n); setPage(1); }} />
        )}
      </section>

      <section className="mt-8 rounded-lg border border-base-300 bg-base-100">
        <div className="flex items-baseline justify-between gap-3 px-4 py-3">
          <h2 className="text-base font-semibold">Operations log</h2>
          <span className="text-xs text-base-content/60">Newest first · append-only</span>
        </div>
        {ops.isLoading ? (
          <div className="px-4"><Loading /></div>
        ) : (
          <TableRegion label="Operations log">
            <table data-testid="operations-table" className="data-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Operation</th>
                  <th scope="col">Location</th>
                  <th scope="col">Pallet</th>
                  <th scope="col" className="hidden sm:table-cell">Item</th>
                  <th scope="col" className="num-col hidden md:table-cell">Quantity</th>
                  <th scope="col" className="hidden md:table-cell">By</th>
                </tr>
              </thead>
              <tbody>
                {ops.data?.results.map((o) => (
                  <tr key={o.id} data-testid={`operation-row-${o.id}`}>
                    <td className="num muted whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                    <td><OpBadge type={o.op_type} /></td>
                    <td><LocChip code={o.location_code} /></td>
                    <td className="num font-medium">{o.pallet_number}</td>
                    <td className="hidden sm:table-cell">{o.item_name}</td>
                    <td className="num-col hidden md:table-cell">{fmtNum(o.quantity)}</td>
                    <td className="muted hidden md:table-cell">{o.username || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ops.data && ops.data.results.length === 0 && (
              <div className="p-4"><Empty title="No operations recorded yet." /></div>
            )}
          </TableRegion>
        )}
        {ops.data && (
          <Pagination page={opPage} pageSize={opSize} count={ops.data.count} onPage={setOpPage} label="Operations"
            sizes={SIZES} onPageSize={(n) => { setOpSize(n); setOpPage(1); }} />
        )}
      </section>
    </div>
  );
}
