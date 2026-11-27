const pad = (n: number) => String(n).padStart(2, '0');

/** Browser-local time as YYYY-MM-DD HH:mm. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** History dates are UTC calendar dates; weekday is computed in UTC too. */
export function shortUtcDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
}

export const fmtNum = (n: number) => n.toLocaleString();
