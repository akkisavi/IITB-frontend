import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { newIdempotencyKey, useLoadPallet, useLocations, useUnloadPallet } from '../api/hooks';
import type { WarehouseLocation } from '../api/types';
import { canOperate, useAuth } from '../auth/AuthContext';
import { IconBox, IconCheck, IconPlus, IconSwap } from '../components/Icons';
import { Modal } from '../components/Modal';
import { Pagination, TableRegion } from '../components/DataTable';
import { ErrorBanner, Loading, PageHeader } from '../components/States';
import { useToast } from '../components/Toasts';
import { formatDateTime, fmtNum } from '../lib/format';
import { validateLoad, type LoadField, type LoadForm } from '../lib/validate';

const COLS = ['A', 'B', 'C', 'D', 'E'];
const ROWS = [1, 2, 3, 4, 5];
const FORBIDDEN_MSG = 'You do not have permission to do that.';

function cellLabel(l: WarehouseLocation) {
  if (l.state === 'transfer') return `${l.code} transfer point`;
  if (l.state === 'occupied') return `${l.code} occupied, pallet ${l.pallet?.pallet_number ?? ''}`.trim();
  return `${l.code} free`;
}

function useFlashOnChange(value: string) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash((n) => n + 1);
    }
  }, [value]);
  return flash;
}

function Cell({
  loc, index, selected, onSelect,
}: { loc: WarehouseLocation; index: number; selected: boolean; onSelect: () => void }) {
  const flash = useFlashOnChange(loc.state);
  const tone =
    loc.state === 'transfer' ? 'hatch border-base-content/30' : loc.state === 'occupied' ? 'cell-occupied' : 'cell-free';
  const word = loc.state === 'transfer' ? 'Transfer' : loc.state === 'occupied' ? 'Occupied' : 'Free';
  const wordTone = loc.state === 'transfer' ? 'text-base-content/70' : loc.state === 'occupied' ? 'text-occupied' : 'text-free';
  return (
    <button
      type="button"
      data-testid={`location-cell-${loc.code}`}
      data-state={loc.state}
      aria-label={cellLabel(loc)}
      aria-pressed={selected}
      onClick={onSelect}
      style={{ ['--i' as string]: index }}
      className={`cell-enter relative flex min-h-[56px] min-w-0 cursor-pointer flex-col justify-between overflow-hidden rounded-md border-2 p-1 text-left transition-[box-shadow,border-color] duration-150 hover:shadow-md sm:min-h-[84px] sm:p-2.5 ${tone} ${
        selected ? 'ring-2 ring-base-content ring-offset-2 ring-offset-base-100' : ''
      } ${loc.state === 'transfer' ? 'border-dashed' : ''}`}
    >
      {flash > 0 && <span key={flash} aria-hidden="true" className="cell-flash pointer-events-none absolute inset-0 bg-base-content" />}
      <span className="flex items-center justify-between gap-1">
        <span className="num font-display text-sm font-semibold sm:text-base">{loc.code}</span>
        {loc.state === 'occupied' && <IconBox className="h-3.5 w-3.5 text-occupied sm:h-4 sm:w-4" />}
        {loc.state === 'free' && <IconCheck className="h-3.5 w-3.5 text-free sm:h-4 sm:w-4" />}
        {loc.state === 'transfer' && <IconSwap className="h-3.5 w-3.5 text-base-content/70 sm:h-4 sm:w-4" />}
      </span>
      <span className={`text-[10px] font-semibold leading-tight tracking-tight sm:text-xs sm:tracking-normal ${wordTone}`}>{word}</span>
      {loc.pallet && (
        <span className="num hidden truncate text-xs text-base-content/80 sm:block">{loc.pallet.pallet_number}</span>
      )}
    </button>
  );
}

function Legend() {
  return (
    <ul data-testid="map-legend" className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Map legend">
      <li className="flex items-center gap-2">
        <span className="cell-free grid h-5 w-5 place-items-center rounded-sm border-2"><IconCheck className="h-3 w-3 text-free" /></span>
        Free storage
      </li>
      <li className="flex items-center gap-2">
        <span className="cell-occupied grid h-5 w-5 place-items-center rounded-sm border-2"><IconBox className="h-3 w-3 text-occupied" /></span>
        Occupied storage
      </li>
      <li className="flex items-center gap-2">
        <span className="hatch grid h-5 w-5 place-items-center rounded-sm border-2 border-dashed border-base-content/30"><IconSwap className="h-3 w-3" /></span>
        Transfer point (A1, holds no stock)
      </li>
    </ul>
  );
}

function Field({ label, testid, value }: { label: string; testid: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-base-300 py-2 last:border-0">
      <dt className="text-base-content/70">{label}</dt>
      <dd data-testid={testid} className="num break-all text-right font-medium">{value}</dd>
    </div>
  );
}

function DetailPanel({
  loc, operator, full, onUnload, onLoadHere,
}: { loc: WarehouseLocation; operator: boolean; full: boolean; onUnload: () => void; onLoadHere: () => void }) {
  return (
    <section data-testid="location-detail" data-location={loc.code} className="fade-in rounded-lg border border-base-300 bg-base-100" aria-live="polite">
      <header className="flex items-center justify-between border-b border-base-300 px-4 py-3">
        <h2 className="text-base font-semibold">Location <span className="num">{loc.code}</span></h2>
        <span
          className={`rounded-sm px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
            loc.state === 'occupied' ? 'cell-occupied text-occupied' : loc.state === 'free' ? 'cell-free text-free' : 'hatch'
          }`}
        >
          {loc.state === 'transfer' ? 'Transfer' : loc.state === 'occupied' ? 'Occupied' : 'Free'}
        </span>
      </header>
      <div className="px-4 py-3 text-sm">
        {loc.state === 'transfer' && <p>Transfer point: pallets enter and leave here.</p>}
        {loc.state === 'free' && (
          <div data-testid="detail-empty">
            <p>No pallet stored at {loc.code}. This slot is free.</p>
            {operator && (
              <button type="button" className="btn btn-sm btn-outline mt-3" onClick={onLoadHere} disabled={full}>
                Load a pallet into {loc.code}
              </button>
            )}
          </div>
        )}
        {loc.state === 'occupied' && loc.pallet && (
          <>
            <dl>
              <Field label="Pallet number" testid="detail-pallet-number" value={loc.pallet.pallet_number} />
              <Field label="Barcode" testid="detail-barcode" value={loc.pallet.barcode} />
              <Field label="Item" testid="detail-item-name" value={loc.pallet.item_name} />
              <Field label="Quantity" testid="detail-quantity" value={String(loc.pallet.quantity)} />
              <Field label="Loaded at" testid="detail-loaded-at" value={formatDateTime(loc.pallet.loaded_at)} />
              <Field label="Loaded by" testid="detail-loaded-by" value={loc.pallet.loaded_by ?? '—'} />
            </dl>
            {operator && (
              <button type="button" data-testid="unload-button" className="btn btn-sm btn-error btn-outline mt-4 w-full" onClick={onUnload}>
                Unload to A1
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const EMPTY_FORM: LoadForm = { pallet_number: '', barcode: '', item_name: '', quantity: '', location: '' };

function LoadDialog({
  open, initialLocation, freeCodes, onClose, onLoaded,
}: { open: boolean; initialLocation: string; freeCodes: string[]; onClose: () => void; onLoaded: (code: string) => void }) {
  const toast = useToast();
  const mutation = useLoadPallet();
  const [form, setForm] = useState<LoadForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<LoadField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const attempt = useRef<{ sig: string; key: string } | null>(null);

  // Reset only when the dialog opens. Map polling re-renders must not wipe input (spec 5.14).
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, location: initialLocation });
      setErrors({});
      setFormError(null);
      attempt.current = null;
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const options = useMemo(
    () => (form.location && !freeCodes.includes(form.location) ? [form.location, ...freeCodes] : freeCodes),
    [freeCodes, form.location],
  );

  const set = (k: LoadField) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;
    setFormError(null);
    const clientErrors = validateLoad(form, freeCodes.concat(form.location ? [form.location] : []));
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;
    const body = {
      pallet_number: form.pallet_number.trim().toUpperCase(),
      barcode: form.barcode.trim(),
      item_name: form.item_name.trim().replace(/\s+/g, ' '),
      quantity: Number(form.quantity.trim()),
      location: form.location.trim().toUpperCase(),
    };
    // Same form submitted again (e.g. after a lost response) reuses its key, so the server replays
    // the first result instead of loading twice. A changed form gets a new key.
    const sig = JSON.stringify(body);
    if (attempt.current?.sig !== sig) attempt.current = { sig, key: newIdempotencyKey() };
    try {
      const res = await mutation.mutateAsync({ body, idempotencyKey: attempt.current.key });
      toast(`Loaded ${res.pallet.pallet_number} into ${res.operation.location_code}.`, 'success');
      onLoaded(res.operation.location_code);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setFormError('Unexpected error. Try again.');
        return;
      }
      if (err.status === 403) toast(FORBIDDEN_MSG, 'error');
      const fieldErrs: Partial<Record<LoadField, string>> = {};
      for (const k of ['pallet_number', 'barcode', 'item_name', 'quantity', 'location'] as LoadField[]) {
        if (err.errors[k]?.length) fieldErrs[k] = err.errors[k].join(' ');
      }
      setErrors(fieldErrs);
      const nonField = err.errors.non_field_errors?.join(' ');
      if (nonField || !Object.keys(fieldErrs).length) setFormError(nonField || err.detail);
      if (err.status !== 400) toast(err.detail, 'error');
    }
  }

  const input = (k: LoadField, label: string, testid: string, extra: Record<string, unknown> = {}) => (
    <label className="form-control w-full">
      <span className="label-text mb-1 font-medium">{label}</span>
      <input
        data-testid={testid}
        className={`input input-bordered input-sm h-10 w-full ${errors[k] ? 'input-error' : ''}`}
        value={form[k]}
        onChange={set(k)}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `fe-${k}` : undefined}
        {...extra}
      />
      {errors[k] && (
        <span id={`fe-${k}`} data-testid={`field-error-${k}`} className="mt-1 text-xs text-occupied">{errors[k]}</span>
      )}
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} title="Load pallet" testid="load-dialog" busy={mutation.isPending}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <p className="text-sm text-base-content/70">The shuttle takes the pallet from A1 to the destination slot.</p>
        {formError && (
          <div data-testid="load-error" role="alert" className="rounded-md border border-error/50 px-3 py-2 text-sm text-occupied">
            {formError}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {input('pallet_number', 'Pallet number', 'load-pallet-number', { autoCapitalize: 'characters', placeholder: 'PLT-0042', spellCheck: false })}
          {input('barcode', 'Barcode', 'load-barcode', { inputMode: 'numeric', placeholder: '8–14 digits' })}
        </div>
        {input('item_name', 'Item', 'load-item-name', { maxLength: 120 })}
        <div className="grid gap-3 sm:grid-cols-2">
          {input('quantity', 'Quantity', 'load-quantity', { inputMode: 'numeric', placeholder: '1–100000' })}
          <label className="form-control w-full">
            <span className="label-text mb-1 font-medium">Destination</span>
            <select
              data-testid="load-location"
              className={`select select-bordered select-sm h-10 w-full ${errors.location ? 'select-error' : ''}`}
              value={form.location}
              onChange={set('location')}
              aria-invalid={!!errors.location}
              aria-describedby={errors.location ? 'fe-location' : undefined}
            >
              <option value="">Choose a free slot</option>
              {options.map((c) => (
                <option key={c} value={c}>{c}{freeCodes.includes(c) ? '' : ' (now occupied)'}</option>
              ))}
            </select>
            {errors.location && (
              <span id="fe-location" data-testid="field-error-location" className="mt-1 text-xs text-occupied">{errors.location}</span>
            )}
          </label>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" data-testid="load-cancel" className="btn btn-ghost btn-sm" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button type="submit" data-testid="load-submit" className="btn btn-primary btn-sm" disabled={mutation.isPending}>
            {mutation.isPending && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
            {mutation.isPending ? 'Loading…' : 'Load pallet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const STORED_PAGE_SIZE = 8;

/** Tabular view of the same live location data as the grid: occupied slots, selectable. */
function StoredPalletsTable({
  locations, selected, onSelect,
}: { locations: WarehouseLocation[]; selected: string | null; onSelect: (l: WarehouseLocation) => void }) {
  const [page, setPage] = useState(1);
  const rows = locations.flatMap((l) => (l.state === 'occupied' && l.pallet ? [{ ...l, pallet: l.pallet }] : []));
  const pages = Math.max(1, Math.ceil(rows.length / STORED_PAGE_SIZE));
  const current = Math.min(page, pages); // stock can shrink between polls
  const visible = rows.slice((current - 1) * STORED_PAGE_SIZE, current * STORED_PAGE_SIZE);

  return (
    <section data-testid="stored-pallets" className="mt-5 rounded-lg border border-base-300 bg-base-100">
      <div className="flex items-baseline justify-between gap-3 px-4 py-3">
        <h2 className="text-base font-semibold">
          Stored pallets <span className="num ml-1 text-sm font-normal text-base-content/60">{rows.length}</span>
        </h2>
        <span className="hidden text-xs text-base-content/60 sm:inline">Same live data as the floor plan · select a row to inspect</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-base-content/70">No pallets in storage. All 24 slots are free.</p>
      ) : (
        <>
          <TableRegion label="Stored pallets">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Location</th>
                  <th scope="col">Pallet</th>
                  <th scope="col">Item</th>
                  <th scope="col" className="num-col">Quantity</th>
                  <th scope="col" className="hidden md:table-cell">Barcode</th>
                  <th scope="col" className="hidden lg:table-cell">Loaded</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => (
                  <tr key={l.code} className={selected === l.code ? 'bg-primary/5' : ''}>
                    <td>
                      <button
                        type="button"
                        className="num inline-flex min-w-[2.75rem] cursor-pointer items-center justify-center gap-1 rounded-sm border border-error/40 bg-error/5 px-1.5 py-0.5 text-xs font-semibold text-occupied hover:bg-error/10"
                        aria-label={`Inspect ${l.code}`}
                        aria-pressed={selected === l.code}
                        onClick={() => onSelect(l)}
                      >
                        {l.code}
                      </button>
                    </td>
                    <td className="num font-medium">{l.pallet.pallet_number}</td>
                    <td className="max-w-[9rem] truncate sm:max-w-[16rem]">{l.pallet.item_name}</td>
                    <td className="num-col font-medium">{fmtNum(l.pallet.quantity)}</td>
                    <td className="num muted hidden md:table-cell">{l.pallet.barcode}</td>
                    <td className="num muted hidden whitespace-nowrap lg:table-cell">{formatDateTime(l.pallet.loaded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
          {rows.length > STORED_PAGE_SIZE && (
            <Pagination page={current} pageSize={STORED_PAGE_SIZE} count={rows.length} onPage={setPage} label="Stored pallets" />
          )}
        </>
      )}
    </section>
  );
}

export default function MapPage() {
  const { user } = useAuth();
  const operator = canOperate(user?.role);
  const toast = useToast();
  const { data, error, isLoading, refetch } = useLocations();
  const unload = useUnloadPallet();
  const [selected, setSelected] = useState<string | null>(null);
  const [loadOpen, setLoadOpen] = useState(false);
  const [loadTarget, setLoadTarget] = useState('');
  const [confirm, setConfirm] = useState<{ code: string; pallet: string } | null>(null);
  const confirmCode = confirm?.code ?? null;

  const byCode = useMemo(() => new Map((data ?? []).map((l) => [l.code, l])), [data]);
  const storage = (data ?? []).filter((l) => l.kind === 'storage');
  const occupied = storage.filter((l) => l.state === 'occupied').length;
  const freeCodes = storage.filter((l) => l.state === 'free').map((l) => l.code);
  const full = !!data && freeCodes.length === 0;
  const selectedLoc = selected ? byCode.get(selected) : undefined;

  function select(l: WarehouseLocation) {
    setSelected(l.code);
    if (l.state === 'free' && operator && !full) {
      setLoadTarget(l.code);
      setLoadOpen(true);
    }
  }

  async function doUnload() {
    if (!confirmCode) return;
    const code = confirmCode;
    try {
      const res = await unload.mutateAsync({ location: code, idempotencyKey: newIdempotencyKey() });
      toast(`Unloaded ${res.pallet.pallet_number} from ${code} via A1. It has left stock.`, 'success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) toast(FORBIDDEN_MSG, 'error');
      else toast(err instanceof ApiError ? err.detail : 'Unload failed.', 'error');
      void refetch();
    } finally {
      setConfirm(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Warehouse map"
        sub="Select a slot to inspect it. Changes from other sessions appear within a few seconds."
        actions={
          operator && (
            <button
              type="button"
              data-testid="load-button"
              className="btn btn-primary btn-sm gap-1.5"
              disabled={!data || full}
              onClick={() => {
                setLoadTarget(selectedLoc?.state === 'free' ? selectedLoc.code : '');
                setLoadOpen(true);
              }}
            >
              {!full && <IconPlus className="h-4 w-4" />}
              {full ? 'Warehouse full' : 'Load pallet'}
            </button>
          )
        }
      />

      <ErrorBanner error={error} onRetry={() => void refetch()} />

      <div className="mb-4 flex flex-wrap items-stretch gap-3 text-sm">
        <div className="flex items-baseline gap-2 rounded-md border border-base-300 bg-base-100 px-3 py-2">
          <span data-testid="map-occupied-count" className="num font-display text-xl font-semibold text-occupied"><span key={occupied} className="tick">{occupied}</span></span>
          <span className="text-base-content/70">occupied</span>
        </div>
        <div className="flex items-baseline gap-2 rounded-md border border-base-300 bg-base-100 px-3 py-2">
          <span data-testid="map-free-count" className="num font-display text-xl font-semibold text-free"><span key={freeCodes.length} className="tick">{freeCodes.length}</span></span>
          <span className="text-base-content/70">free</span>
        </div>
        <div className="flex min-w-[12rem] flex-1 flex-col justify-center gap-1.5 px-1 py-1">
          <span className="text-base-content/70">
            of <span className="num font-medium text-base-content">{fmtNum(24)}</span> storage slots ·{' '}
            <span className="num font-medium text-base-content">{Math.round((occupied / 24) * 100)}%</span> full
          </span>
          <span
            role="progressbar"
            aria-label="Warehouse occupancy"
            aria-valuemin={0}
            aria-valuemax={24}
            aria-valuenow={occupied}
            className="block h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-base-300"
          >
            <span
              className="block h-full w-full origin-left rounded-full bg-primary transition-transform duration-200 ease-out"
              style={{ transform: `scaleX(${occupied / 24})` }}
            />
          </span>
        </div>
      </div>

      {isLoading && !data ? (
        <Loading label="Loading floor plan" />
      ) : data ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-label="Floor plan" className="min-w-0 rounded-lg border border-base-300 bg-base-100 p-3 sm:p-5">
            <div className="grid grid-cols-[1rem_repeat(5,minmax(0,1fr))] gap-1.5 sm:grid-cols-[1.5rem_repeat(5,minmax(0,1fr))] sm:gap-2.5">
              <span aria-hidden="true" />
              {COLS.map((c) => (
                <span key={c} aria-hidden="true" className="text-center text-xs font-medium text-base-content/60">{c}</span>
              ))}
            </div>
            <div
              data-testid="warehouse-grid"
              role="group"
              aria-label="Warehouse locations, columns A to E, rows 1 to 5"
              className="mt-1.5 grid grid-cols-[1rem_repeat(5,minmax(0,1fr))] gap-1.5 sm:grid-cols-[1.5rem_repeat(5,minmax(0,1fr))] sm:gap-2.5"
            >
              {ROWS.map((r, ri) => [
                <span key={`r${r}`} aria-hidden="true" className="self-center text-center text-xs font-medium text-base-content/60">{r}</span>,
                ...COLS.map((c, ci) => {
                  const l = byCode.get(`${c}${r}`);
                  return l ? (
                    <Cell key={l.code} loc={l} index={ri * COLS.length + ci} selected={selected === l.code} onSelect={() => select(l)} />
                  ) : (
                    <span key={`${c}${r}`} />
                  );
                }),
              ])}
            </div>
            <div className="mt-5 border-t border-base-300 pt-4">
              <Legend />
            </div>
          </section>

          <aside className="xl:sticky xl:top-0 xl:self-start">
            {selectedLoc ? (
              <DetailPanel
                key={selectedLoc.code}
                loc={selectedLoc}
                operator={operator}
                full={full}
                onUnload={() => setConfirm({ code: selectedLoc.code, pallet: selectedLoc.pallet?.pallet_number ?? '' })}
                onLoadHere={() => {
                  setLoadTarget(selectedLoc.code);
                  setLoadOpen(true);
                }}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-base-300 p-4 text-sm text-base-content/70">
                No slot selected. Choose a red slot to see its pallet{operator ? ', or a green slot to load one' : ''}.
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {data && <StoredPalletsTable locations={storage} selected={selected} onSelect={select} />}

      {operator && (
        <LoadDialog
          open={loadOpen}
          initialLocation={loadTarget}
          freeCodes={freeCodes}
          onClose={() => setLoadOpen(false)}
          onLoaded={(code) => {
            setLoadOpen(false);
            setSelected(code);
          }}
        />
      )}

      {operator && (
        <Modal open={!!confirmCode} onClose={() => setConfirm(null)} title="Confirm unload" testid="unload-confirm-dialog" busy={unload.isPending} size="sm">
          <p className="text-sm">
            Unload pallet {confirm?.pallet} from {confirmCode}? It will leave warehouse stock.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" data-testid="unload-cancel" className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)} disabled={unload.isPending}>
              Cancel
            </button>
            <button type="button" data-testid="unload-confirm" className="btn btn-error btn-sm" onClick={() => void doUnload()} disabled={unload.isPending}>
              {unload.isPending && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
              Unload
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
