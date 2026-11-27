import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { IconAlert } from './Icons';

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div data-testid="loading" className="flex items-center gap-2 py-10 text-sm text-base-content/70" role="status">
      <span className="loading loading-spinner loading-sm" aria-hidden="true" />
      {label}…
    </div>
  );
}

/** Inline banner for failed queries. Last good data stays on screen below it. */
export function ErrorBanner({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  const msg =
    error instanceof ApiError && !error.isNetwork ? error.detail : 'Cannot reach the server. Retrying...';
  return (
    <div data-testid="error-banner" role="alert" className="alert mb-4 rounded-md border border-error/40 bg-base-100 py-2 text-sm">
      <IconAlert className="h-4 w-4 text-occupied" />
      <span>{msg}</span>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-xs" onClick={onRetry}>
          Retry now
        </button>
      )}
    </div>
  );
}

export function Forbidden() {
  return (
    <section data-testid="forbidden" className="mx-auto max-w-prose py-16">
      <p className="text-xs font-medium uppercase tracking-wider text-base-content/60">403</p>
      <h1 className="mt-1 text-xl font-semibold">You do not have access to this page.</h1>
      <p className="mt-2 text-base-content/70">Your role does not include this area. Ask an administrator if you need it.</p>
      <Link to="/" className="btn btn-sm btn-outline mt-6">Back to warehouse map</Link>
    </section>
  );
}

export function NotFound() {
  return (
    <section data-testid="not-found" className="mx-auto max-w-prose py-16">
      <p className="text-xs font-medium uppercase tracking-wider text-base-content/60">404</p>
      <h1 className="mt-1 text-xl font-semibold">No page at this address.</h1>
      <Link to="/" className="btn btn-sm btn-outline mt-6">Back to warehouse map</Link>
    </section>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-base-300 px-4 py-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 text-sm text-base-content/70">{children}</p>}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold sm:text-xl">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-base-content/70">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
