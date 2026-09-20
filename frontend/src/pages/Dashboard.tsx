import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/useAuth';
import api from '@/api/client';
import { Stats } from '@/types';

export function Dashboard() {
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
    }
  }, [isAuthenticated]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <div style={{ fontSize: 18, color: 'var(--fg-muted)' }}>Loading dashboard...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const statCards = [
    { label: 'Total Keys', value: stats?.totalKeys || 0, color: 'var(--fg-primary)' },
    { label: 'Active Keys', value: stats?.activeKeys || 0, color: 'var(--success)' },
    { label: 'Suspended', value: stats?.suspendedKeys || 0, color: 'var(--warning)' },
    { label: 'Upstreams', value: stats?.totalUpstreams || 0, color: 'var(--accent)' },
    { label: 'Requests Today', value: stats?.todayRequests || 0, color: 'var(--fg-secondary)' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div className="page-actions">
          <Link to="/keys" className="btn btn-primary">Create API Key</Link>
        </div>
      </div>

      <div className="stats-grid">
        {statCards.map((stat) => (
          <div key={stat.label} className="card stat-card">
            <div className="stat-value" style={{ color: stat.color }}>{stat.value.toLocaleString()}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Top API Keys by Usage</h2>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Name</th>
                <th>Usage</th>
                <th>Last Used</th>
              </tr>
            </thead>
            <tbody>
              {stats?.topKeys.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                    No API keys created yet
                  </td>
                </tr>
              ) : (
                stats?.topKeys.map((key) => (
                  <tr key={key._id}>
                    <td><code style={{ fontSize: 12 }}>{key.keyPrefix}••••</code></td>
                    <td>{key.name}</td>
                    <td>{key.usageCount.toLocaleString()}</td>
                    <td>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Quick Actions</h2>
        </div>
        <div style={{ padding: 20, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link to="/keys" className="btn btn-primary">
            <span>➕</span> Create API Key
          </Link>
          <Link to="/upstreams" className="btn btn-secondary">
            <span>⚙️</span> Manage Upstreams
          </Link>
        </div>
      </div>
    </div>
  );
}