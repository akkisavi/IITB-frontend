import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useIsFetching } from '@tanstack/react-query';
import { canAudit, useAuth } from '../auth/AuthContext';
import type { Role } from '../api/types';
import { IconBox, IconChart, IconChevronLeft, IconClose, IconGrid, IconLogout, IconMenu, IconMoon, IconTruck, IconUsers } from './Icons';

const SIDEBAR_KEY = 'wms.sidebar';
function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

interface NavItem { to: string; label: string; testid: string; icon: ComponentType<SVGProps<SVGSVGElement>>; allowed: (r: Role) => boolean }

const NAV: NavItem[] = [
  { to: '/', label: 'Warehouse map', testid: 'nav-map', icon: IconGrid, allowed: () => true },
  { to: '/pallets', label: 'Pallets & log', testid: 'nav-pallets', icon: IconBox, allowed: () => true },
  { to: '/shuttle', label: 'Shuttle', testid: 'nav-shuttle', icon: IconTruck, allowed: () => true },
  { to: '/dashboard', label: 'Dashboard', testid: 'nav-dashboard', icon: IconChart, allowed: canAudit },
  { to: '/users', label: 'Users', testid: 'nav-users', icon: IconUsers, allowed: (r) => r === 'admin' },
];

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', auditor: 'Auditor', technician: 'Technician' };

function toggleTheme() {
  const el = document.documentElement;
  const next = el.getAttribute('data-theme') === 'depot-dark' ? 'depot' : 'depot-dark';
  el.setAttribute('data-theme', next);
  try {
    localStorage.setItem('wms.theme', next);
  } catch {
    /* storage blocked */
  }
}

export function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const loc = useLocation();

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? 'expanded' : 'collapsed');
      } catch {
        /* storage blocked */
      }
      return !c;
    });
  }
  const fetching = useIsFetching({ queryKey: ['locations'] });

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!user) return null;
  const items = NAV.filter((n) => n.allowed(user.role));

  return (
    <div className="flex h-full flex-col">
      <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-base-300 bg-base-100 px-3 sm:px-4">
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square lg:hidden"
          data-testid="nav-menu-toggle"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
        <NavLink to="/" className="flex items-center gap-2 rounded-md px-1 font-display text-base font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-content">
            <IconGrid className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">Warehouse Console</span>
          <span className="sm:hidden">WMS</span>
        </NavLink>
        <span className="ml-2 hidden items-center gap-1.5 text-xs text-base-content/60 md:flex" aria-live="off">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${fetching ? 'bg-primary' : 'bg-base-content/30'}`} aria-hidden="true" />
          Live · polls every 3 s
        </span>
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          <span
            data-testid="current-user"
            data-role={user.role}
            title={`Signed in as ${user.username}`}
            aria-label={`Signed in as ${user.username}, ${ROLE_LABEL[user.role]}`}
            className="rounded-md border border-base-300 bg-base-200 px-2 py-1 text-xs font-medium uppercase tracking-wide text-base-content/80"
          >
            {ROLE_LABEL[user.role]}
          </span>
          <button type="button" className="btn btn-ghost btn-sm btn-square" aria-label="Toggle dark theme" onClick={toggleTheme}>
            <IconMoon className="h-4 w-4" />
          </button>
          <button type="button" data-testid="logout-button" className="btn btn-ghost btn-sm gap-1.5 px-2" aria-label="Sign out" onClick={() => void logout()}>
            <IconLogout className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {open && (
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            className="fixed inset-0 top-14 z-20 cursor-default bg-neutral/40 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}
        <nav
          id="primary-nav"
          aria-label="Primary"
          data-collapsed={collapsed ? 'true' : 'false'}
          className={`fixed bottom-0 left-0 top-14 z-30 flex w-64 flex-col border-r border-base-300 bg-base-200 p-3 transition-transform duration-200 lg:relative lg:inset-auto lg:z-auto lg:translate-x-0 ${
            collapsed ? 'lg:w-[4.25rem] lg:px-2.5' : 'lg:w-56'
          } ${open ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible'}`}
        >
          <ul className="flex flex-col gap-0.5">
            {items.map((n) => (
              <li key={n.to} className={collapsed ? 'lg:tooltip lg:tooltip-right' : ''} data-tip={collapsed ? n.label : undefined}>
                <NavLink
                  to={n.to}
                  end={n.to === '/'}
                  data-testid={n.testid}
                  aria-label={collapsed ? n.label : undefined}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150 ${
                      collapsed ? 'lg:justify-center lg:px-0' : ''
                    } ${
                      isActive
                        ? 'bg-primary/10 font-medium text-base-content'
                        : 'text-base-content/70 hover:bg-base-300/60 hover:text-base-content'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <n.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-primary' : ''}`} />
                      <span className={collapsed ? 'lg:sr-only' : ''}>{n.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
          <button
            type="button"
            data-testid="sidebar-collapse-toggle"
            className="absolute -right-3 top-[1.375rem] z-10 hidden h-6 w-6 place-items-center rounded-full border border-base-300 bg-base-100 text-base-content/60 shadow-sm transition-colors duration-150 hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary lg:grid"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-controls="primary-nav"
            onClick={toggleCollapsed}
          >
            <IconChevronLeft className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <main id="main" className="w-full flex-1 px-4 py-5 sm:px-6 lg:px-8">
            <Outlet />
          </main>
          <footer className="border-t border-base-300 px-4 py-3 text-xs text-base-content/60 sm:px-6 lg:px-8">
            5 × 5 floor · 24 storage slots · A1 transfer point · times shown in your local zone
          </footer>
        </div>
      </div>
    </div>
  );
}
