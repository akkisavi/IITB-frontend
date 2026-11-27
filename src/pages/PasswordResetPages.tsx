import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { IconAlert, IconGrid, IconInfo } from '../components/Icons';

const NETWORK_MSG = 'Cannot reach the server. It may be starting up; try again in a moment.';

function errorText(err: unknown) {
  return err instanceof ApiError && !err.isNetwork ? err.detail : NETWORK_MSG;
}

function Shell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-base-200 px-4 py-10 sm:py-16">
      <Link to="/overview" className="mb-8 flex items-center gap-2 rounded-md font-display text-lg font-semibold">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-content">
          <IconGrid className="h-4 w-4" />
        </span>
        Warehouse Console
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-base-content/70">{sub}</p>
        {children}
      </div>
      <Link
        to="/login"
        className="mt-6 inline-flex items-center gap-1 text-sm text-base-content/70 transition-colors duration-150 hover:text-primary"
      >
        <span aria-hidden="true">←</span> Back to sign in
      </Link>
    </main>
  );
}

function Alert({ kind, children }: { kind: 'error' | 'info'; children: ReactNode }) {
  const Icon = kind === 'error' ? IconAlert : IconInfo;
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`mt-5 flex gap-2 rounded-md border bg-base-100 p-3 text-sm ${kind === 'error' ? 'border-error/50' : 'border-base-300'}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${kind === 'error' ? 'text-occupied' : ''}`} />
      <span>{children}</span>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Enter your username or email.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await api<{ detail: string }>('/api/auth/password-reset/', {
        method: 'POST',
        body: { identifier: identifier.trim() },
        auth: false,
      });
      setSent(res.detail);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Shell title="Forgot password" sub="We will email a reset link to the address on your account.">
      {sent ? (
        <>
          <Alert kind="info">{sent}</Alert>
          <p className="mt-4 text-sm text-base-content/70">
            The link works for one hour. No email address on your account? Ask an administrator to reset your password.
          </p>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          {error && <Alert kind="error">{error}</Alert>}
          <label className="form-control mt-6 w-full">
            <span className="label-text mb-1 font-medium">Username or email</span>
            <input
              data-testid="forgot-identifier"
              className="input input-bordered w-full"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              aria-invalid={!!error}
            />
          </label>
          <button data-testid="forgot-submit" type="submit" className="btn btn-primary mt-6 w-full" disabled={pending}>
            {pending && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
            {pending ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const uid = params.get('uid') ?? '';
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!uid || !token) {
    return (
      <Shell title="Reset password" sub="Choose a new password for your account.">
        <Alert kind="error">This reset link is incomplete. Open the link from your email again, or request a new one.</Alert>
        <Link to="/forgot-password" className="btn btn-primary mt-6 w-full">Request a new link</Link>
      </Shell>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 12 || /\s/.test(password)) {
      setFieldError('Password must be 12-128 characters with no spaces.');
      return;
    }
    if (password !== confirm) {
      setFieldError('The two passwords do not match.');
      return;
    }
    setFieldError(null);
    setPending(true);
    try {
      const res = await api<{ detail: string }>('/api/auth/password-reset/confirm/', {
        method: 'POST',
        body: { uid, token, password },
        auth: false,
      });
      setDone(res.detail);
    } catch (err) {
      if (err instanceof ApiError && err.errors.password?.length) setFieldError(err.errors.password.join(' '));
      else setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Shell title="Reset password" sub="Choose a new password for your account.">
      {done ? (
        <>
          <Alert kind="info">{done}</Alert>
          <Link to="/login" data-testid="reset-signin" className="btn btn-primary mt-6 w-full">Sign in</Link>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          {error && (
            <Alert kind="error">
              {error} <Link to="/forgot-password" className="text-primary underline-offset-2 hover:underline">Request a new link</Link>
            </Alert>
          )}
          <label className="form-control mt-6 w-full">
            <span className="label-text mb-1 font-medium">New password</span>
            <input
              data-testid="reset-password"
              type="password"
              className={`input input-bordered w-full ${fieldError ? 'input-error' : ''}`}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldError}
              aria-describedby="reset-hint"
            />
          </label>
          <label className="form-control mt-4 w-full">
            <span className="label-text mb-1 font-medium">Confirm new password</span>
            <input
              data-testid="reset-confirm"
              type="password"
              className={`input input-bordered w-full ${fieldError ? 'input-error' : ''}`}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={!!fieldError}
              aria-describedby="reset-hint"
            />
          </label>
          <p id="reset-hint" className={`mt-2 text-xs ${fieldError ? 'text-occupied' : 'text-base-content/70'}`}>
            {fieldError ?? '12-128 characters, no spaces. Signing in again is required on every device.'}
          </p>
          <button data-testid="reset-submit" type="submit" className="btn btn-primary mt-6 w-full" disabled={pending}>
            {pending && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
            {pending ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      )}
    </Shell>
  );
}
