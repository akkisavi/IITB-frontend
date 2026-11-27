import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { IconAlert, IconGrid, IconInfo } from '../components/Icons';

export default function LoginPage() {
  const { user, login, notice, clearNotice } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user) {
    const from = (loc.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setPending(true);
    setError(null);
    clearNotice();
    try {
      await login(username, password);
      nav('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && !err.isNetwork
          ? err.detail
          : 'Cannot reach the server. It may be starting up; try again in a moment.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hatch hidden flex-col justify-between border-r border-base-300 p-10 lg:flex" aria-hidden="true">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-content">
            <IconGrid className="h-4 w-4" />
          </span>
          Warehouse Console
        </div>
        <div className="grid w-56 grid-cols-5 gap-1.5">
          {Array.from({ length: 25 }, (_, i) => (
            <span
              key={i}
              className={`aspect-square rounded-sm border ${
                i === 0 ? 'border-base-content/40 bg-base-100' : [3, 7, 12, 18, 21].includes(i) ? 'cell-occupied' : 'cell-free'
              }`}
            />
          ))}
        </div>
        <p className="max-w-xs text-sm text-base-content/70">
          Floor A–E × 1–5. Pallets enter and leave through transfer point A1.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12">
        <form onSubmit={submit} className="w-full max-w-sm" noValidate aria-describedby={error ? 'login-error' : undefined}>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-base-content/70">Use the account your administrator issued.</p>

          {notice && (
            <div role="status" className="mt-5 flex gap-2 rounded-md border border-base-300 bg-base-100 p-3 text-sm">
              <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </div>
          )}
          {error && (
            <div id="login-error" data-testid="login-error" role="alert" className="mt-5 flex gap-2 rounded-md border border-error/50 bg-base-100 p-3 text-sm">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-occupied" />
              {error}
            </div>
          )}

          <label className="form-control mt-6 w-full">
            <span className="label-text mb-1 font-medium">Username</span>
            <input
              data-testid="login-username"
              className="input input-bordered w-full"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={!!error}
            />
          </label>
          <label className="form-control mt-4 w-full">
            <span className="label-text mb-1 font-medium">Password</span>
            <input
              data-testid="login-password"
              type="password"
              className="input input-bordered w-full"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
            />
          </label>
          <button data-testid="login-submit" type="submit" className="btn btn-primary mt-6 w-full" disabled={pending}>
            {pending && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  );
}
