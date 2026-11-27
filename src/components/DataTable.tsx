import type { ReactNode } from 'react';
import { fmtNum } from '../lib/format';

/** Scrollable, keyboard-focusable wrapper for a semantic <table className="data-table">. */
export function TableRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

/** Load / Unload operation badge: icon-free text label + tint, so colour is never the only cue. */
export function OpBadge({ type }: { type: 'LOAD' | 'UNLOAD' }) {
  const load = type === 'LOAD';
  return (
    <span
      className={`inline-flex min-w-[4.25rem] items-center justify-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
        load ? 'cell-occupied text-occupied ring-error/30' : 'cell-free text-free ring-success/30'
      }`}
    >
      <span aria-hidden="true">{load ? '↓' : '↑'}</span>
      {load ? 'Load' : 'Unload'}
    </span>
  );
}

/** Returns page numbers with null gaps, e.g. [1, null, 4, 5, 6, null, 12]. */
function pageList(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

interface PaginationProps {
  page: number;
  pageSize: number;
  count: number;
  onPage: (p: number) => void;
  label: string;
  sizes?: number[];
  onPageSize?: (n: number) => void;
}

export function Pagination({ page, pageSize, count, onPage, label, sizes, onPageSize }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(count, page * pageSize);
  return (
    <nav
      aria-label={`${label} pagination`}
      className="flex flex-col gap-2 border-t border-base-300 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3 text-base-content/70">
        <span className="num" data-testid="pagination-summary">
          {count === 0 ? 'No rows' : <>Showing <b className="font-medium text-base-content">{from}–{to}</b> of {fmtNum(count)}</>}
        </span>
        {sizes && onPageSize && (
          <label className="flex items-center gap-1.5">
            <span className="text-xs">Rows</span>
            <select
              className="select select-bordered select-xs h-7"
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              aria-label={`${label} rows per page`}
            >
              {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>
      <ul className="flex items-center gap-1">
        <li>
          <button
            type="button"
            data-testid="pagination-prev"
            className="btn btn-ghost btn-xs h-8 min-h-8 px-2"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label="Previous page"
          >
            ‹ <span className="hidden sm:inline">Prev</span>
          </button>
        </li>
        {pageList(page, pages).map((n, i) =>
          n === null ? (
            <li key={`gap${i}`} aria-hidden="true" className="px-1 text-base-content/50">…</li>
          ) : (
            <li key={n}>
              <button
                type="button"
                className={`btn btn-xs num h-8 min-h-8 min-w-8 px-2 ${n === page ? 'btn-neutral' : 'btn-ghost'}`}
                aria-label={`Page ${n}`}
                aria-current={n === page ? 'page' : undefined}
                onClick={() => onPage(n)}
              >
                {n}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            data-testid="pagination-next"
            className="btn btn-ghost btn-xs h-8 min-h-8 px-2"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span> ›
          </button>
        </li>
      </ul>
    </nav>
  );
}
