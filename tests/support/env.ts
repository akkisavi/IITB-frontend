export type Role = 'admin' | 'auditor' | 'technician';

export const API_BASE_URL = (
  process.env.API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  'http://127.0.0.1:8000'
).replace(/\/+$/, '');

const DEFAULT_USERNAMES: Record<Role, string> = {
  admin: 'demo_admin',
  auditor: 'demo_auditor',
  technician: 'demo_technician',
};

/** Credentials come only from EVAL_* env vars. Fails fast with a clear message if a password is missing. */
export function creds(role: Role): { username: string; password: string } {
  const key = role.toUpperCase();
  const username = process.env[`EVAL_${key}_USERNAME`] || DEFAULT_USERNAMES[role];
  const password = process.env[`EVAL_${key}_PASSWORD`];
  if (!password) {
    throw new Error(
      `Missing EVAL_${key}_PASSWORD. Set EVAL_${key}_USERNAME/EVAL_${key}_PASSWORD (the same values used for "python manage.py seed_demo").`,
    );
  }
  return { username, password };
}
