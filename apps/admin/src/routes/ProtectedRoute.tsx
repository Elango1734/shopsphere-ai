import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, type Permission } from '../auth/AuthContext';
import { LoadingState } from '../components/ui/StateViews';
import { AccessDeniedState } from '../components/ui/StateViews';

/**
 * This gate is a UX convenience only — it hides nav items and redirects so
 * an unauthorized user isn't dropped into a dead page. The actual security
 * boundary is server-side (`requireRole` middleware on every `/admin`,
 * `/seller`, `/support-agent` route); every API call here is independently
 * authorized regardless of what this component decides to render.
 */
export function ProtectedRoute({ requireAnyOf }: { requireAnyOf: Permission[] }) {
  const { isAuthenticated, isBootstrapping, hasRole } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <LoadingState label="Checking your session…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!requireAnyOf.some((role) => hasRole(role))) return <AccessDeniedState />;

  return <Outlet />;
}
