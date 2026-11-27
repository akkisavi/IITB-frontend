import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { IconAlert, IconGrid, IconInfo } from '../components/Icons';

const COLS = ['A', 'B', 'C', 'D', 'E'];
const ROWS = [5, 4, 3, 2, 1];
const FULL = new Set(['B4', 'D5', 'C3', 'E2', 'B2']);
const delay = (i: number) => ({ ['--i' as string]: i }) as CSSProperties;

function SampleFloor() {
  return (
    <div className="rise mx-auto mt-10 w-64" style={delay(3)} aria-hidden="true">
      <div className="grid grid-cols-5 gap-1.5 rounded-lg border border-base-300 bg-base-100 p-2.5 shadow-sm">
        {ROWS.map((r, ri) =>
          COLS.map((c, ci) => {
            const code = `${c}${r}`;
            const transfer = code === 'A1';
            const full = FULL.has(code);
            return (
              <span
                key={code}
                style={delay(ri * COLS.length + ci)}
                className={`cell-enter relative grid aspect-square place-items-center overflow-hidden rounded-sm border text-[9px] font-semibold ${
                  transfer ? 'hatch border-dashed border-base-content/30 text-base-content/70' : full ? 'cell-occupied text-occupied' : 'cell-free text-free'
                }`}
              >
                {code}
              </span>
            );
          }),
        )}
      </div>
      <ul className="mt-4 flex justify-center gap-4 text-xs text-base-content/70">
        <li className="flex items-center gap-1.5"><span className="cell-free h-2.5 w-2.5 rounded-sm border" />Free</li>
        <li className="flex items-center gap-1.5"><span className="cell-occupied h-2.5 w-2.5 rounded-sm border" />Occupied</li>
        <li className="flex items-center gap-1.5"><span className="hatch h-2.5 w-2.5 rounded-sm border border-dashed border-base-content/30" />Transfer A1</li>
      </ul>
    </div>
  );
}

export default function LoginPage() {
  const { user, login, notice, clearNotice } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

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
      await login(username, password, remember);
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
    <div className="grid min-h-full bg-base-200 lg:grid-cols-[minmax(0,54fr)_minmax(0,46fr)]">
      <aside className="login-panel relative hidden flex-col justify-between overflow-hidden border-r border-base-300 p-10 lg:flex xl:p-14">
        <Link to="/overview" className="rise flex w-fit items-center gap-2 rounded-md font-display text-lg font-semibold" style={delay(0)}>
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-content">
            <IconGrid className="h-4 w-4" />
          </span>
          Warehouse Console
        </Link>

        <div className="mx-auto max-w-lg text-center">
          <p className="rise mb-3 text-sm font-medium text-primary" style={delay(1)}>Pallet shuttle warehouse</p>
          <h2 className="rise text-3xl leading-tight xl:text-4xl" style={delay(1)}>Every slot on the floor, and who last touched it.</h2>
          <p className="rise mt-4 text-sm text-base-content/70" style={delay(2)}>
            Load and unload pallets, read their history and see occupancy change across sessions within seconds.
          </p>
          <SampleFloor />
        </div>

        <p className="rise text-center text-xs text-base-content/60" style={delay(4)}>Sample layout. Pallets enter and leave through transfer point A1.</p>
      </aside>

      <main className="flex flex-col items-center justify-center px-4 py-10 sm:py-16">
        <Link to="/overview" className="mb-8 flex items-center gap-2 rounded-md font-display text-lg font-semibold lg:hidden">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-content">
            <IconGrid className="h-4 w-4" />
          </span>
          Warehouse Console
        </Link>
        <form
          onSubmit={submit}
          className="rise w-full max-w-sm rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm sm:p-8"
          style={delay(1)}
          noValidate
          aria-describedby={error ? 'login-error' : undefined}
        >
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
          <div className="mt-4">
            <label htmlFor="login-password" className="label-text mb-1 block font-medium">Password</label>
            <div className="relative">
              <input
                id="login-password"
                data-testid="login-password"
                type={showPassword ? 'text' : 'password'}
                className="input input-bordered w-full pr-16"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 my-1 mr-1 rounded-md px-3 text-xs font-medium text-base-content/70 transition-colors duration-150 hover:bg-base-200 hover:text-base-content"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="login-remember"
                className="checkbox checkbox-primary checkbox-sm"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me for 7 days
            </label>
            <Link
              to="/forgot-password"
              data-testid="login-forgot"
              className="rounded-md text-sm text-primary underline-offset-2 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <button data-testid="login-submit" type="submit" className="btn btn-primary mt-6 w-full" disabled={pending}>
            {pending && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <Link
          to="/overview"
          className="mt-6 inline-flex items-center gap-1 text-sm text-base-content/70 transition-colors duration-150 hover:text-primary"
        >
          <span aria-hidden="true">←</span> Back to homepage
        </Link>
      </main>
    </div>
  );
}
