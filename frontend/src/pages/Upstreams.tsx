import { useEffect, useState } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import api from '@/api/client';
import { UpstreamApi } from '@/types';
import { UpstreamModal } from '@/components/UpstreamModal';

export function Upstreams() {
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const [upstreams, setUpstreams] = useState<UpstreamApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUpstream, setEditingUpstream] = useState<UpstreamApi | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUpstreams();
    }
  }, [isAuthenticated]);

  const fetchUpstreams = async () => {
    try {
      const response = await api.get('/admin/upstreams');
      setUpstreams(response.data);
    } catch (err) {
      console.error('Failed to fetch upstreams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingUpstream(null);
    setModalOpen(true);
  };

  const handleEdit = (upstream: UpstreamApi) => {
    setEditingUpstream(upstream);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingUpstream(null);
  };

  const handleSuccess = () => {
    fetchUpstreams();
    handleCloseModal();
  };

  if (authLoading || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <div style={{ fontSize: 18, color: 'var(--fg-muted)' }}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const getStatusBadge = (active: boolean) => (
    <span className={`badge ${active ? 'badge-active' : 'badge-suspended'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Upstream APIs</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleCreate}>
            <span>➕</span> Create Upstream
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-container scrollbar-thin">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: 300 }}>Base URL</th>
                <th style={{ width: 250 }}>Path Pattern</th>
                <th style={{ width: 120 }}>Placeholders</th>
                <th style={{ width: 100 }}>Timeout</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {upstreams.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                    No upstream APIs configured. Create one to start wrapping APIs.
                  </td>
                </tr>
              ) : (
                upstreams.map((upstream) => (
                  <tr key={upstream._id}>
                    <td style={{ fontWeight: 500 }}>{upstream.name}</td>
                    <td><code style={{ fontSize: 12 }}>{upstream.baseUrl}</code></td>
                    <td><code style={{ fontSize: 12 }}>{upstream.pathPattern}</code></td>
                    <td>
                      {upstream.placeholders.length === 0 ? (
                        <span style={{ color: 'var(--fg-muted)' }}>—</span>
                      ) : (
                        <span style={{ fontSize: 12, fontFamily: 'monospace' }}>
                          {upstream.placeholders.join(', ')}
                        </span>
                      )}
                    </td>
                    <td>{upstream.timeout}ms</td>
                    <td>{getStatusBadge(upstream.active)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleEdit(upstream)}
                        style={{ padding: '4px 8px' }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UpstreamModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        editingUpstream={editingUpstream}
      />
    </div>
  );
}