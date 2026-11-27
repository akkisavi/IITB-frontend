import { useState, type FormEvent } from 'react';
import { ApiError, isRemembered, storeSession } from '../api/client';
import { useChangePassword, useProfile } from '../api/hooks';
import type { Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { OpBadge, TableRegion } from '../components/DataTable';
import { Empty, ErrorBanner, Loading, PageHeader } from '../components/States';
import { useToast } from '../components/Toasts';
import { formatDateTime } from '../lib/format';
import { MSG, validPassword } from '../lib/validate';

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', auditor: 'Auditor', technician: 'Technician' };
const ROLE_CAN: Record<Role, string> = {
  admin: 'Load and unload pallets, view the dashboard and reports, and manage user accounts.',
  auditor: 'View stock, pallet history, the dashboard and reports. Read only.',
  technician: 'Load and unload pallets and add shuttle notes.',
};

type PwField = 'current_password' | 'new_password' | 'confirm';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-base-content/60">{label}</p>
      <p className="num mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ChangePassword() {
  const { user } = useAuth();
  const toast = useToast();
  const change = useChangePassword();
  const [values, setValues] = useState<Record<PwField, string>>({ current_password: '', new_password: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<PwField, string>>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { current_password, new_password, confirm } = values;
    const errs: Partial<Record<PwField, string>> = {};
    if (!current_password) errs.current_password = 'Enter your current password.';
    if (!validPassword(new_password)) errs.new_password = MSG.password;
    else if (new_password === current_password) errs.new_password = 'New password must be different from the current one.';
    if (confirm !== new_password) errs.confirm = 'Passwords do not match.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const res = await change.mutateAsync({ current_password, new_password });
      if (user) storeSession(res.token, user, isRemembered());
      setValues({ current_password: '', new_password: '', confirm: '' });
      toast('Password changed. Other sessions were signed out.', 'success');
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.errors).length) {
        const fe: Partial<Record<PwField, string>> = {};
        for (const [k, v] of Object.entries(err.errors)) fe[k as PwField] = v.join(' ');
        setErrors(fe);
      }
      toast(err instanceof ApiError ? err.detail : 'Could not change the password.', 'error');
    }
  }

  const fields: [PwField, string, string][] = [
    ['current_password', 'Current password', 'current-password'],
    ['new_password', 'New password', 'new-password'],
    ['confirm', 'Confirm new password', 'new-password'],
  ];

  return (
    <form onSubmit={submit} noValidate className="self-start rounded-lg border border-base-300 bg-base-100 p-5 sm:p-6" aria-labelledby="pw-title">
      <h2 id="pw-title" className="text-lg font-semibold">Change password</h2>
      <p className="mt-1 text-sm text-base-content/70">12–128 characters, no spaces. Your other signed-in sessions will be signed out.</p>
      <div className="mt-4 grid gap-4">
        {fields.map(([id, label, auto]) => (
          <label key={id} className="form-control w-full" htmlFor={id}>
            <span className="label-text mb-1 font-medium">{label}</span>
            <input
              id={id}
              data-testid={`profile-${id}`}
              type="password"
              autoComplete={auto}
              value={values[id]}
              onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value }))}
              aria-invalid={!!errors[id]}
              aria-describedby={errors[id] ? `${id}-error` : undefined}
              className={`input input-bordered w-full ${errors[id] ? 'input-error' : ''}`}
            />
            {errors[id] && <span id={`${id}-error`} className="mt-1 text-xs text-error">{errors[id]}</span>}
          </label>
        ))}
      </div>
      <button type="submit" data-testid="profile-change-password" className="btn btn-primary btn-sm mt-5" disabled={change.isPending}>
        {change.isPending ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}

export default function ProfilePage() {
  const { data, error, isLoading, refetch } = useProfile();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Your profile" sub="Your account details and the stock movements you made." />
      <ErrorBanner error={error} onRetry={() => void refetch()} />
      {isLoading && !data ? (
        <Loading label="Loading profile" />
      ) : data ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-6">
            <section
              data-testid="profile-card"
              className="flex flex-col gap-5 rounded-lg border border-base-300 bg-base-100 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:p-6"
            >
              <span
                aria-hidden="true"
                className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary font-display text-2xl font-semibold text-primary-content"
              >
                {data.username.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-[12rem] flex-1">
                <p data-testid="profile-username" className="truncate font-display text-xl font-semibold">{data.username}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-sm bg-base-200 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide">{ROLE_LABEL[data.role]}</span>
                  <span className={data.is_active ? 'text-free' : 'text-occupied'}>{data.is_active ? 'Active' : 'Deactivated'}</span>
                </p>
                <p className="mt-2 text-sm text-base-content/70">{ROLE_CAN[data.role]}</p>
              </div>
              <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:basis-full md:basis-auto md:grid-cols-1 md:text-right">
                <div>
                  <dt className="text-xs text-base-content/60">Member since</dt>
                  <dd className="num">{formatDateTime(data.date_joined)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-base-content/60">Last sign-in</dt>
                  <dd className="num">{data.last_login ? formatDateTime(data.last_login) : 'Never'}</dd>
                </div>
              </dl>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Pallets loaded" value={data.activity.loads} />
              <Stat label="Pallets unloaded" value={data.activity.unloads} />
            </div>

            <section className="rounded-lg border border-base-300 bg-base-100" aria-labelledby="recent-title">
              <h2 id="recent-title" className="border-b border-base-300 px-4 py-3 text-base font-semibold">Your recent movements</h2>
              {data.activity.recent.length ? (
                <TableRegion label="Your recent movements">
                  <table className="data-table data-table-compact">
                    <thead>
                      <tr>
                        <th scope="col">Type</th>
                        <th scope="col">Slot</th>
                        <th scope="col">Pallet</th>
                        <th scope="col" className="hidden sm:table-cell">Item</th>
                        <th scope="col">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.activity.recent.map((o) => (
                        <tr key={o.id}>
                          <td><OpBadge type={o.op_type} /></td>
                          <td className="num">{o.location_code}</td>
                          <td className="num font-medium">{o.pallet_number}</td>
                          <td className="hidden sm:table-cell">{o.item_name}</td>
                          <td className="num muted">{formatDateTime(o.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableRegion>
              ) : (
                <div className="p-4">
                  <Empty title="No movements yet.">Loads and unloads you make will appear here.</Empty>
                </div>
              )}
            </section>
          </div>
          <ChangePassword />
        </div>
      ) : null}
    </div>
  );
}
