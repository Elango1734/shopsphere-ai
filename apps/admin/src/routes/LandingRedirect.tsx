import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LoadingState } from '../components/ui/StateViews';

/** Sends a signed-in user to the first area their roles grant access to, in priority order. */
export function LandingRedirect() {
  const { isAuthenticated, isBootstrapping, hasRole } = useAuth();

  if (isBootstrapping) return <LoadingState label="Loading…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (hasRole('admin')) return <Navigate to="/admin" replace />;
  if (hasRole('seller')) return <Navigate to="/seller" replace />;
  if (hasRole('support_agent')) return <Navigate to="/support" replace />;
  return <Navigate to="/unauthorized" replace />;
}
