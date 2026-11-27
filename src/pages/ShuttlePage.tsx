import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useAddMaintenanceNote, useMaintenanceNotes, useShuttle, useUpdateShuttle } from '../api/hooks';
import type { Shuttle } from '../api/types';
import { canOperate, useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toasts';
import { IconTruck } from '../components/Icons';
import { Empty, ErrorBanner, Loading, PageHeader } from '../components/States';
import { formatDateTime } from '../lib/format';

const STATUS_TEXT: Record<string, string> = { idle: 'Idle', busy: 'Busy', charging: 'Charging', offline: 'Offline' };

export default function ShuttlePage() {
  const { data, error, isLoading, refetch } = useShuttle();
  const pct = data?.battery_percent ?? 0;
  const low = pct < 20;
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Shuttle" sub="Refreshes every 10 s. The battery drains while the shuttle works and charges when docked; dropping below 20% emails a low-battery alert." />
      <ErrorBanner error={error} onRetry={() => void refetch()} />
      {isLoading && !data ? (
        <Loading label="Loading shuttle" />
      ) : data ? (
        <article data-testid="shuttle-card" className="grid gap-6 rounded-lg border border-base-300 bg-base-100 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
          <div className="hatch grid h-24 w-24 place-items-center rounded-lg border border-base-300">
            <IconTruck className="h-10 w-10" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-base-content/60">Identifier</p>
            <p data-testid="shuttle-identifier" className="num font-display text-2xl font-semibold">{data.identifier}</p>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-base-content/60">Status</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${data.status === 'offline' ? 'bg-error' : data.status === 'idle' ? 'bg-success' : 'bg-warning'}`}
                  />
                  <span data-testid="shuttle-status" className="font-medium">{STATUS_TEXT[data.status] ?? data.status}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-base-content/60">Battery</dt>
                <dd className="mt-1">
                  <span data-testid="shuttle-battery" className="num font-medium">{pct}%</span>
                  {low && <span className="ml-2 text-xs font-medium text-occupied">Low</span>}
                  <progress
                    className={`progress mt-2 block h-2 w-full ${low ? 'progress-error' : 'progress-success'}`}
                    value={pct}
                    max={100}
                    aria-label={`Battery ${pct} percent`}
                  />
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-xs text-base-content/60">Record updated {formatDateTime(data.updated_at)}</p>
            {data.simulated && (
              <p data-testid="shuttle-simulated" className="mt-3 rounded-md border border-dashed border-base-300 bg-base-200/60 px-3 py-2 text-xs text-base-content/70">
                <span className="font-semibold text-base-content">Simulated battery.</span>{' '}
                {data.status === 'charging'
                  ? 'Charging: +1% every 6 s, switches to Idle at 100%.'
                  : data.status === 'busy'
                    ? 'Busy: −1% every 20 s. Returns to charge at 10%.'
                    : data.status === 'idle'
                      ? 'Idle: −1% every 90 s. Returns to charge at 10%.'
                      : 'Offline: battery is frozen.'}
              </p>
            )}
          </div>
        </article>
      ) : null}
      {data && canOperate(user?.role) && <ShuttleControl shuttle={data} />}
      {data && <MaintenanceNotes canAdd={canOperate(user?.role)} />}
      {!data && !isLoading ? (
        <Empty title="No shuttle record found.">Run the seed command on the API to create SH-01.</Empty>
      ) : null}
    </div>
  );
}

const STATUSES: Shuttle['status'][] = ['idle', 'busy', 'charging', 'offline'];

function ShuttleControl({ shuttle }: { shuttle: Shuttle }) {
  const toast = useToast();
  const update = useUpdateShuttle();
  const [battery, setBattery] = useState(String(shuttle.battery_percent));
  const [status, setStatus] = useState<Shuttle['status']>(shuttle.status);
  const [error, setError] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const low = Number(battery) < 20;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(battery);
    if (battery.trim() === '' || !Number.isInteger(n) || n < 0 || n > 100) {
      setError('Battery must be a whole number from 0 to 100.');
      return;
    }
    const email = low ? testEmail.trim() : '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setError('');
    setEmailError('');
    try {
      const s = await update.mutateAsync({ battery_percent: n, status, ...(email ? { test_alert_email: email } : {}) });
      if (s.test_alert_sent_to) {
        toast(`Test alert accepted for ${s.test_alert_sent_to}. Check that inbox (and spam).`, 'info');
      } else if (s.battery_percent < 20 && shuttle.battery_percent >= 20) {
        toast(`Battery set to ${s.battery_percent}%. Low-battery alert email triggered.`, 'info');
      } else {
        toast(`Shuttle updated: ${s.battery_percent}%, ${STATUS_TEXT[s.status]}.`, 'success');
      }
    } catch (err) {
      if (err instanceof ApiError && err.errors.test_alert_email) {
        setEmailError(err.errors.test_alert_email.join(' '));
        toast(err.errors.test_alert_email.join(' '), 'error');
        return;
      }
      const msg = err instanceof ApiError ? Object.values(err.errors).flat().join(' ') || err.detail : 'Could not update the shuttle.';
      setError(msg);
      toast(msg, 'error');
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      data-testid="shuttle-control"
      className="mt-6 rounded-lg border border-base-300 bg-base-100 p-5 sm:p-6"
    >
      <h2 className="font-display text-lg font-semibold">Update shuttle</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-base-content/60">Battery %</span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={Number(battery) || 0}
              onChange={(e) => setBattery(e.target.value)}
              className={`range range-sm flex-1 ${Number(battery) < 20 ? 'range-error' : 'range-success'}`}
              aria-label="Battery percent slider"
            />
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              value={battery}
              onChange={(e) => setBattery(e.target.value)}
              data-testid="shuttle-battery-input"
              aria-invalid={!!error}
              className="input input-bordered input-sm num w-20"
              aria-label="Battery percent"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-base-content/60">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Shuttle['status'])}
            data-testid="shuttle-status-select"
            className="select select-bordered select-sm mt-1 block w-full sm:w-40"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_TEXT[s]}</option>
            ))}
          </select>
        </label>
      </div>
      {low && (
        <div className="mt-4 rounded-md border border-dashed border-warning/60 bg-base-200/60 p-3" data-testid="shuttle-test-alert">
          <label className="block" htmlFor="test-alert-email">
            <span className="text-xs font-medium uppercase tracking-wider text-base-content/60">
              Send test alert to (for testing)
            </span>
            <input
              id="test-alert-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              data-testid="shuttle-test-email"
              aria-invalid={!!emailError}
              aria-describedby="test-alert-help"
              className={`input input-bordered input-sm mt-1 block w-full sm:max-w-sm ${emailError ? 'input-error' : ''}`}
            />
          </label>
          <p id="test-alert-help" className={`mt-1.5 text-xs ${emailError ? 'text-error' : 'text-base-content/60'}`}>
            {emailError ||
              (testEmail.trim()
                ? 'On save, the low-battery alert goes only to this address, even if the battery was already low.'
                : shuttle.battery_percent >= 20
                  ? 'Leave empty to send the normal alert to the configured mailbox.'
                  : 'Battery is already low, so no normal alert will be sent. Enter an address to test.')}
          </p>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
      <button type="submit" className="btn btn-primary btn-sm mt-4" disabled={update.isPending} data-testid="shuttle-save">
        {update.isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}

const MAX_NOTE = 500;

function MaintenanceNotes({ canAdd }: { canAdd: boolean }) {
  const toast = useToast();
  const { data: notes, error, isLoading, refetch } = useMaintenanceNotes();
  const add = useAddMaintenanceNote();
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = note.trim();
    if (!text || text.length > MAX_NOTE) {
      setFormError(`Write a note of 1 to ${MAX_NOTE} characters.`);
      return;
    }
    setFormError('');
    try {
      await add.mutateAsync(text);
      setNote('');
      toast('Maintenance note added.', 'success');
    } catch (err) {
      const msg = err instanceof ApiError ? Object.values(err.errors).flat().join(' ') || err.detail : 'Could not add the note.';
      setFormError(msg);
      toast(msg, 'error');
    }
  }

  return (
    <section data-testid="maintenance-notes" className="mt-6 rounded-lg border border-base-300 bg-base-100 p-5 sm:p-6" aria-labelledby="maint-title">
      <h2 id="maint-title" className="font-display text-lg font-semibold">Maintenance notes</h2>
      {canAdd && (
        <form onSubmit={submit} noValidate className="mt-4">
          <label className="block">
            <span className="sr-only">New maintenance note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={MAX_NOTE}
              placeholder="e.g. Replaced front wheel bearing; battery contacts cleaned."
              data-testid="maintenance-input"
              aria-invalid={!!formError}
              className="textarea textarea-bordered w-full text-sm"
            />
          </label>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="num text-xs text-base-content/60">{note.trim().length}/{MAX_NOTE}</span>
            <button type="submit" className="btn btn-primary btn-sm" disabled={add.isPending} data-testid="maintenance-add">
              {add.isPending ? 'Adding…' : 'Add note'}
            </button>
          </div>
          {formError && <p role="alert" className="mt-2 text-sm text-error">{formError}</p>}
        </form>
      )}
      <div className="mt-5">
        <ErrorBanner error={error} onRetry={() => void refetch()} />
        {isLoading ? (
          <Loading label="Loading notes" />
        ) : notes && notes.length ? (
          <ol className="divide-y divide-base-300" data-testid="maintenance-list">
            {notes.map((n) => (
              <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                <p className="whitespace-pre-wrap break-words text-sm">{n.note}</p>
                <p className="mt-1 text-xs text-base-content/60">
                  {n.username || 'Unknown user'} · {formatDateTime(n.created_at)}
                </p>
              </li>
            ))}
          </ol>
        ) : !error ? (
          <p className="text-sm text-base-content/60">No maintenance notes yet.</p>
        ) : null}
      </div>
    </section>
  );
}
