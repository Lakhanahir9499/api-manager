import { ReactNode, useState } from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function Layout() {
  const { isAuthenticated, logout, loading } = useAuth();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ fontSize: 18, color: 'var(--fg-muted)' }}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Outlet />;
  }

  const handleLogout = async () => {
    await logout();
    showToast('Logged out successfully');
  };

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/keys', label: 'API Keys' },
    { path: '/upstreams', label: 'Upstreams' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link to="/" style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)' }}>🔐 API Manager</Link>
          <nav style={{ display: 'flex', gap: '4px' }}>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: isActive ? 'var(--accent)' : 'var(--fg-secondary)',
                  background: isActive ? 'rgb(59 130 246 / 0.1)' : 'transparent',
                  textDecoration: 'none',
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <main style={{ flex: 1, padding: '24px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>

      {toast && (
        <div className={`toast toast-${toast.type}`} role="alert">
          <span>{toast.message}</span>
          <button className="btn-ghost" onClick={() => setToast(null)} style={{ padding: 4, lineHeight: 1 }}>✕</button>
        </div>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}