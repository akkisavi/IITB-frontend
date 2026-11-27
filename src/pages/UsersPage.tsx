import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useCreateUser, useSetPassword, useUpdateUser, useUsers } from '../api/hooks';
import type { ManagedUser, Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Modal } from '../components/Modal';
import { Pagination, TableRegion } from '../components/DataTable';
import { IconPlus } from '../components/Icons';
import { Empty, ErrorBanner, Loading, PageHeader } from '../components/States';
import { useToast } from '../components/Toasts';
import { formatDateTime } from '../lib/format';
import { MSG, validPassword, validUsername } from '../lib/validate';

const ROLES: Role[] = ['technician', 'auditor', 'admin'];
const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', auditor: 'Auditor', technician: 'Technician' };

function errText(err: unknown) {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'You do not have permission to do that.';
    const fields = Object.values(err.errors).flat();
    return fields.length ? fields.join(' ') : err.detail;
  }
  return 'Unexpected error.';
}

const MSG_EMAIL = 'Enter a valid email address, or leave it blank.';
const validEmail = (v: string) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateUser();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('technician');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setUsername('');
    setPassword('');
    setEmail('');
    setRole('technician');
    setErrors({});
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!validUsername(username)) errs.username = MSG.username;
    if (!validPassword(password)) errs.password = MSG.password;
    if (!validEmail(email)) errs.email = MSG_EMAIL;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const u = await create.mutateAsync({ username: username.trim(), password, role, email: email.trim() });
      toast(`Created ${u.username} as ${ROLE_LABEL[u.role]}.`, 'success');
      reset();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.errors).length) {
        const fe: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) fe[k] = v.join(' ');
        setErrors(fe);
      }
      toast(errText(err), 'error');
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Add user" testid="create-user-dialog" busy={create.isPending} size="sm">
    <form data-testid="create-user-form" onSubmit={submit} noValidate>
      <p className="text-xs text-base-content/70">Passwords: 12–128 characters, no spaces. Share them out of band.</p>
      <div className="mt-4 space-y-3">
        <label className="form-control">
          <span className="label-text mb-1 font-medium">Username</span>
          <input
            data-testid="create-user-username"
            className={`input input-bordered input-sm h-10 ${errors.username ? 'input-error' : ''}`}
            value={username}
            autoComplete="off"
            autoFocus
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? 'cu-username' : undefined}
          />
          {errors.username && <span id="cu-username" data-testid="field-error-username" className="mt-1 text-xs text-occupied">{errors.username}</span>}
        </label>
        <label className="form-control">
          <span className="label-text mb-1 font-medium">Email <span className="font-normal text-base-content/60">(optional, for password resets)</span></span>
          <input
            data-testid="create-user-email"
            type="email"
            autoComplete="off"
            className={`input input-bordered input-sm h-10 ${errors.email ? 'input-error' : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'cu-email' : undefined}
          />
          {errors.email && <span id="cu-email" data-testid="field-error-email" className="mt-1 text-xs text-occupied">{errors.email}</span>}
        </label>
        <label className="form-control">
          <span className="label-text mb-1 font-medium">Initial password</span>
          <input
            data-testid="create-user-password"
            type="password"
            autoComplete="new-password"
            className={`input input-bordered input-sm h-10 ${errors.password ? 'input-error' : ''}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'cu-password' : undefined}
          />
          {errors.password && <span id="cu-password" data-testid="field-error-password" className="mt-1 text-xs text-occupied">{errors.password}</span>}
        </label>
        <label className="form-control">
          <span className="label-text mb-1 font-medium">Role</span>
          <select data-testid="create-user-role" className="select select-bordered select-sm h-10" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          {errors.role && <span data-testid="field-error-role" className="mt-1 text-xs text-occupied">{errors.role}</span>}
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { reset(); onClose(); }} disabled={create.isPending}>Cancel</button>
        <button data-testid="create-user-submit" type="submit" className="btn btn-primary btn-sm" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create user'}
        </button>
      </div>
    </form>
    </Modal>
  );
}

function EmailDialog({ target, onClose }: { target: ManagedUser | null; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateUser();
  const [value, setValue] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const current = value ?? target?.email ?? '';

  function close() {
    setValue(null);
    setErr(null);
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (!validEmail(current)) {
      setErr(MSG_EMAIL);
      return;
    }
    try {
      const u = await update.mutateAsync({ id: target.id, email: current.trim() });
      toast(u.email ? `Reset emails for ${u.username} go to ${u.email}.` : `Removed the email for ${u.username}.`, 'success');
      close();
    } catch (e2) {
      setErr(e2 instanceof ApiError && e2.errors.email?.length ? e2.errors.email.join(' ') : errText(e2));
    }
  }

  return (
    <Modal open={!!target} onClose={close} title={target ? `Email for ${target.username}` : 'Email'} testid="email-dialog" busy={update.isPending} size="sm">
      <form onSubmit={submit} noValidate>
        <label className="form-control">
          <span className="label-text mb-1 font-medium">Email</span>
          <input
            data-testid="email-input"
            type="email"
            autoComplete="off"
            className={`input input-bordered input-sm h-10 ${err ? 'input-error' : ''}`}
            value={current}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!!err}
            aria-describedby={err ? 'em-err' : 'em-hint'}
          />
          {err && <span id="em-err" data-testid="field-error-email" className="mt-1 text-xs text-occupied">{err}</span>}
        </label>
        <p id="em-hint" className="mt-2 text-xs text-base-content/70">Forgot-password links are sent here. Leave blank to remove it.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={close} disabled={update.isPending}>Cancel</button>
          <button type="submit" data-testid="email-submit" className="btn btn-primary btn-sm" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save email'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SetPasswordDialog({ target, onClose }: { target: ManagedUser | null; onClose: () => void }) {
  const toast = useToast();
  const mut = useSetPassword();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (!validPassword(pw)) {
      setErr(MSG.password);
      return;
    }
    try {
      await mut.mutateAsync({ id: target.id, password: pw });
      toast(`Password updated for ${target.username}. Their sessions were signed out.`, 'success');
      setPw('');
      setErr(null);
      onClose();
    } catch (e2) {
      setErr(errText(e2));
    }
  }

  return (
    <Modal
      open={!!target}
      onClose={() => { setPw(''); setErr(null); onClose(); }}
      title={target ? `Set password for ${target.username}` : 'Set password'}
      testid="set-password-dialog"
      busy={mut.isPending}
      size="sm"
    >
      <form onSubmit={submit} noValidate>
        <label className="form-control">
          <span className="label-text mb-1 font-medium">New password</span>
          <input
            data-testid="set-password-input"
            type="password"
            autoComplete="new-password"
            className={`input input-bordered input-sm h-10 ${err ? 'input-error' : ''}`}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            aria-invalid={!!err}
            aria-describedby={err ? 'sp-err' : undefined}
          />
          {err && <span id="sp-err" data-testid="field-error-password" className="mt-1 text-xs text-occupied">{err}</span>}
        </label>
        <p className="mt-2 text-xs text-base-content/70">The user is signed out everywhere and must sign in with the new password.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={mut.isPending}>Cancel</button>
          <button type="submit" data-testid="set-password-submit" className="btn btn-primary btn-sm" disabled={mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Save password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const { data, error, isLoading, refetch } = useUsers({ search, page, page_size: pageSize });
  const update = useUpdateUser();
  const [pwTarget, setPwTarget] = useState<ManagedUser | null>(null);
  const [emailTarget, setEmailTarget] = useState<ManagedUser | null>(null);

  async function patch(u: ManagedUser, body: { role?: Role; is_active?: boolean }, okMsg: string) {
    try {
      await update.mutateAsync({ id: u.id, ...body });
      toast(okMsg, 'success');
    } catch (err) {
      toast(errText(err), 'error');
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Users"
        sub="Create accounts, assign roles and remove access. Deactivated users keep their history in the log."
        actions={
          <button type="button" data-testid="add-user-button" className="btn btn-primary btn-sm gap-1.5" onClick={() => setCreateOpen(true)}>
            <IconPlus className="h-4 w-4" />
            Add user
          </button>
        }
      />
      <ErrorBanner error={error} onRetry={() => void refetch()} />
      <section className="min-w-0 rounded-lg border border-base-300 bg-base-100">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <h2 className="text-base font-semibold">
              Accounts {data && <span className="num ml-1 text-sm font-normal text-base-content/60">{data.count}</span>}
            </h2>
            <label className="w-full sm:w-60">
              <span className="sr-only">Search users</span>
              <input type="search" className="input input-bordered input-sm h-9 w-full" placeholder="Search username or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </label>
          </div>
          {isLoading && !data ? (
            <div className="px-4"><Loading /></div>
          ) : (
            <TableRegion label="User accounts">
              <table data-testid="users-table" className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Username</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="hidden md:table-cell">Last sign-in</th>
                    <th scope="col" className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.results.map((u) => {
                    const self = u.id === me?.id;
                    return (
                      <tr key={u.id} data-testid={`user-row-${u.username}`} className={u.is_active ? '' : 'text-base-content/60'}>
                        <td className="font-medium">
                          <span className="flex items-center gap-2.5">
                            <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-base-200 text-[11px] font-semibold uppercase text-base-content/70">
                              {u.username.slice(0, 2)}
                            </span>
                            <span>
                          {u.username}
                          {self && <span className="ml-1.5 text-xs text-base-content/60">(you)</span>}
                          {u.is_superuser && <span className="ml-1.5 rounded-sm bg-base-200 px-1 text-[11px] uppercase">superuser</span>}
                          <span data-testid={`user-email-${u.username}`} className="block text-xs font-normal text-base-content/60">
                            {u.email || 'No email: cannot reset password'}
                          </span>
                            </span>
                          </span>
                        </td>
                        <td>
                          <label>
                            <span className="sr-only">Role for {u.username}</span>
                            <select
                              data-testid={`user-role-${u.username}`}
                              className="select select-bordered select-sm h-9 min-h-9"
                              value={u.role}
                              disabled={u.is_superuser || self || update.isPending}
                              title={u.is_superuser ? 'Superusers are always admin' : self ? 'You cannot change your own role' : undefined}
                              onChange={(e) => {
                                const role = e.target.value as Role;
                                void patch(u, { role }, `${u.username} is now ${ROLE_LABEL[role]}.`);
                              }}
                            >
                              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                            </select>
                          </label>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                              u.is_active ? 'bg-success/10 text-free ring-success/30' : 'bg-base-200 text-base-content/70 ring-base-300'
                            }`}
                          >
                            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-success' : 'bg-base-content/40'}`} />
                            <span data-testid={`user-status-${u.username}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                          </span>
                        </td>
                        <td className="num muted hidden whitespace-nowrap md:table-cell">{formatDateTime(u.last_login)}</td>
                        <td>
                          <span className="flex justify-end gap-1">
                            <button type="button" data-testid={`user-edit-email-${u.username}`} className="btn btn-ghost btn-sm h-8 min-h-8" onClick={() => setEmailTarget(u)}>
                              Email
                            </button>
                            <button type="button" data-testid={`user-set-password-${u.username}`} className="btn btn-ghost btn-sm h-8 min-h-8" onClick={() => setPwTarget(u)}>
                              Password
                            </button>
                            {u.is_active ? (
                              <button
                                type="button"
                                data-testid={`user-deactivate-${u.username}`}
                                className="btn btn-ghost btn-sm h-8 min-h-8 text-occupied"
                                disabled={self || update.isPending}
                                onClick={() => void patch(u, { is_active: false }, `${u.username} can no longer sign in.`)}
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                data-testid={`user-activate-${u.username}`}
                                className="btn btn-ghost btn-sm h-8 min-h-8"
                                disabled={update.isPending}
                                onClick={() => void patch(u, { is_active: true }, `${u.username} reactivated.`)}
                              >
                                Activate
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data && data.results.length === 0 && <div className="p-4"><Empty title="No users match." /></div>}
            </TableRegion>
          )}
          {data && (
            <Pagination
              page={page}
              pageSize={pageSize}
              count={data.count}
              onPage={setPage}
              label="Users"
              sizes={[10, 25, 50]}
              onPageSize={(n) => { setPageSize(n); setPage(1); }}
            />
          )}
      </section>
      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <SetPasswordDialog target={pwTarget} onClose={() => setPwTarget(null)} />
      <EmailDialog key={emailTarget?.id ?? 0} target={emailTarget} onClose={() => setEmailTarget(null)} />
    </div>
  );
}
