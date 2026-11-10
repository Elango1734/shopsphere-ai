import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Breadcrumbs } from './Breadcrumbs';

export function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar isOpen={isSidebarOpen} onNavigate={() => setIsSidebarOpen(false)} />
      <div className="app-main">
        <Header onToggleSidebar={() => setIsSidebarOpen((v) => !v)} />
        <main className="app-content">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
