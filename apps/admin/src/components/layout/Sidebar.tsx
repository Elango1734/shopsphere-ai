import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

interface NavItem {
  to: string;
  label: string;
}

const ADMIN_ITEMS: NavItem[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/analytics', label: 'Analytics & Reports' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/sellers', label: 'Sellers' },
  { to: '/admin/catalog/categories', label: 'Categories' },
  { to: '/admin/catalog/brands', label: 'Brands' },
  { to: '/admin/catalog/products', label: 'Product moderation' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/returns', label: 'Returns & refunds' },
  { to: '/admin/coupons', label: 'Coupons' },
  { to: '/admin/ai', label: 'Sphere AI' }
];

const SELLER_ITEMS: NavItem[] = [
  { to: '/seller', label: 'Dashboard' },
  { to: '/seller/products', label: 'Products' },
  { to: '/seller/orders', label: 'Orders' },
  { to: '/seller/inventory', label: 'Inventory' }
];

const SUPPORT_ITEMS: NavItem[] = [{ to: '/support', label: 'Ticket queue' }];

export function Sidebar({ isOpen, onNavigate }: { isOpen: boolean; onNavigate?: () => void }) {
  const { hasRole } = useAuth();

  return (
    <aside className={`app-sidebar ${isOpen ? 'app-sidebar-open' : ''}`} aria-label="Primary navigation">
      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', padding: 'var(--spacing-2) var(--spacing-3) var(--spacing-4)' }}>
        ShopSphere AI
      </div>

      {hasRole('admin') && (
        <>
          <div className="nav-section-label">Administration</div>
          {ADMIN_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              onClick={onNavigate}
            >
              {item.label}
            </NavLink>
          ))}
        </>
      )}

      {hasRole('seller') && (
        <>
          <div className="nav-section-label">Seller</div>
          {SELLER_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/seller'}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              onClick={onNavigate}
            >
              {item.label}
            </NavLink>
          ))}
        </>
      )}

      {(hasRole('support_agent') || hasRole('admin')) && (
        <>
          <div className="nav-section-label">Support</div>
          {SUPPORT_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              onClick={onNavigate}
            >
              {item.label}
            </NavLink>
          ))}
        </>
      )}
    </aside>
  );
}
