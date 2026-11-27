import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import type { Role } from './api/types';
import { Layout } from './components/Layout';
import { Forbidden, Loading, NotFound } from './components/States';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordResetPages';
import MapPage from './pages/MapPage';
import PalletsPage from './pages/PalletsPage';
import ShuttlePage from './pages/ShuttlePage';
import ProfilePage from './pages/ProfilePage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, booting } = useAuth();
  const loc = useLocation();
  if (!user && booting) return <div className="p-6"><Loading label="Checking session" /></div>;
  if (!user) return <Navigate to={loc.pathname === '/' ? '/overview' : '/login'} replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

/** Wrong role renders the forbidden view in place (no redirect), per spec 6.2. */
function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { hasRole } = useAuth();
  return hasRole(...roles) ? <>{children}</> : <Forbidden />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/overview" element={<OverviewPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<MapPage />} />
        <Route path="pallets" element={<PalletsPage />} />
        <Route path="shuttle" element={<ShuttlePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="dashboard" element={<RequireRole roles={['admin', 'auditor']}><DashboardPage /></RequireRole>} />
        <Route path="users" element={<RequireRole roles={['admin']}><UsersPage /></RequireRole>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
