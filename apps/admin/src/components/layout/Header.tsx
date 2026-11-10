import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../ui/Button';

export function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { user, logout } = useAuth();
  const { preference, setPreference, resolvedTheme } = useTheme();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="app-header">
      <button className="btn btn-ghost btn-sm sidebar-toggle" onClick={onToggleSidebar} aria-label="Toggle navigation">
        ☰
      </button>
      <div>
        <label className="visually-hidden" htmlFor="theme-select">
          Theme
        </label>
        <select
          id="theme-select"
          className="field-select"
          value={preference}
          onChange={(e) => setPreference(e.target.value as 'light' | 'dark' | 'system')}
          aria-label={`Theme (currently resolved to ${resolvedTheme})`}
        >
          <option value="system">System theme</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
        <Link to="/account" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          {user?.displayName ?? user?.email ?? user?.phone}
        </Link>
        <Button variant="secondary" size="sm" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
