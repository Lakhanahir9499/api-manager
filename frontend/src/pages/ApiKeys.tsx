import { useEffect, useState } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import api from '@/api/client';
import { ApiKey, UpstreamApi, RateLimitConfig, KeyStatus } from '@/types';
import { ApiKeyModal } from '@/components/ApiKeyModal';

interface EditingKey {
  _id: string;
  name: string;
  upstreamApi: string | UpstreamApi;
  rateLimit: RateLimitConfig;
  ipWhitelist: string[];
  ipBlacklist: string[];
  status: KeyStatus;
}

export function ApiKeys() {
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [upstreams, setUpstreams] = useState<UpstreamApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<EditingKey | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [keysRes, upstreamsRes] = await Promise.all([
        api.get('/admin/keys', { params: { status: statusFilter || undefined } }),
        api.get('/admin/upstreams/active'),
      ]);
      setKeys(keysRes.data);
      setUpstreams(upstreamsRes.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingKey(null);
    setModalOpen(true);
  };

  const handleEdit = (key: ApiKey) => {
    setEditingKey(key);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingKey(null);
    setGeneratedKey(null);
  };

  const handleSuccess = () => {
    fetchData();
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

  const getStatusBadge = (status: string) => (
    <span className={`badge badge-${status}`}>{status}</span>
  );

  const getUpstreamName = (upstream: string | UpstreamApi) => {
    if (typeof upstream === 'string') return upstream;
    return upstream.name;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">API Keys</h1>
        <div className="page-actions">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', minWidth: 160 }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <button className="btn btn-primary" onClick={handleCreate}>
            <span>➕</span> Create Key
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-container scrollbar-thin">
          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Key Prefix</th>
                <th>Name</th>
                <th style={{ width: 180 }}>Upstream</th>
                <th style={{ width: 120 }}>Rate Limits</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 140 }}>Usage</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                    No API keys found. Create your first key to get started.
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr key={key._id}>
                    <td><code style={{ fontSize: 12 }}>{key.keyPrefix}••••</code></td>
                    <td>{key.name}</td>
                    <td>{getUpstreamName(key.upstreamApi)}</td>
                    <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
                      {key.rateLimit.perMinute}/min · {key.rateLimit.daily}/day · {key.rateLimit.monthly}/mo
                    </td>
                    <td>{getStatusBadge(key.status)}</td>
                    <td>{key.usageCount.toLocaleString()}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleEdit(key)}
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

      <ApiKeyModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        upstreams={upstreams}
        editingKey={editingKey}
        generatedKey={generatedKey}
        setGeneratedKey={setGeneratedKey}
      />
    </div>
  );
}