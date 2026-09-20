import { useState, useEffect, FormEvent } from 'react';
import { UpstreamApi, CreateKeyInput, UpdateKeyInput, RateLimitConfig, KeyStatus } from '@/types';
import api from '@/api/client';

interface EditingKey {
  _id: string;
  name: string;
  upstreamApi: string | UpstreamApi;
  rateLimit: RateLimitConfig;
  ipWhitelist: string[];
  ipBlacklist: string[];
  status: KeyStatus;
}

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  upstreams: UpstreamApi[];
  editingKey?: EditingKey | null;
  generatedKey?: string | null;
  setGeneratedKey: (key: string | null) => void;
}

export function ApiKeyModal({
  isOpen,
  onClose,
  onSuccess,
  upstreams,
  editingKey,
  generatedKey,
  setGeneratedKey,
}: ApiKeyModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<CreateKeyInput & { status: KeyStatus }>({
    name: '',
    upstreamApi: '',
    rateLimit: { perMinute: 60, daily: 1000, monthly: 10000 },
    ipWhitelist: [],
    ipBlacklist: [],
    status: 'active',
  });

  useEffect(() => {
    if (isOpen) {
      if (editingKey) {
        const upstreamId = typeof editingKey.upstreamApi === 'string'
          ? editingKey.upstreamApi
          : editingKey.upstreamApi._id;
        setFormData({
          name: editingKey.name,
          upstreamApi: upstreamId,
          rateLimit: editingKey.rateLimit,
          ipWhitelist: editingKey.ipWhitelist,
          ipBlacklist: editingKey.ipBlacklist,
          status: editingKey.status,
        });
        setGeneratedKey(null);
      } else {
        setFormData({
          name: '',
          upstreamApi: upstreams[0]?._id || '',
          rateLimit: { perMinute: 60, daily: 1000, monthly: 10000 },
          ipWhitelist: [],
          ipBlacklist: [],
          status: 'active',
        });
        setGeneratedKey(null);
      }
      setError('');
    }
  }, [isOpen, editingKey, upstreams, setGeneratedKey]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (editingKey) {
        const updateData: UpdateKeyInput = {
          name: formData.name,
          upstreamApi: formData.upstreamApi,
          rateLimit: formData.rateLimit,
          ipWhitelist: formData.ipWhitelist,
          ipBlacklist: formData.ipBlacklist,
        };
        await api.patch(`/admin/keys/${editingKey._id}`, updateData);
      } else {
        const response = await api.post('/admin/keys', formData);
        setGeneratedKey(response.data.key);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!editingKey || !confirm('Suspend this API key?')) return;
    try {
      await api.post(`/admin/keys/${editingKey._id}/suspend`);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to suspend');
    }
  };

  const handleUnsuspend = async () => {
    if (!editingKey) return;
    try {
      await api.post(`/admin/keys/${editingKey._id}/unsuspend`);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to unsuspend');
    }
  };

  const handleDelete = async () => {
    if (!editingKey || !confirm('Delete this API key? This action cannot be undone.')) return;
    try {
      await api.delete(`/admin/keys/${editingKey._id}`);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  if (!isOpen) return null;

  const rateLimit = formData.rateLimit ?? { perMinute: 60, daily: 1000, monthly: 10000 };
  const ipWhitelist = formData.ipWhitelist ?? [];
  const ipBlacklist = formData.ipBlacklist ?? [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editingKey ? 'Edit API Key' : 'Create API Key'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {generatedKey && (
          <div style={{
            padding: '16px 20px',
            background: 'rgb(34 197 94 / 0.1)',
            borderBottom: '1px solid var(--border)',
            border: '1px solid var(--success)',
            borderRadius: 'var(--radius) var(--radius) 0 0',
            margin: '-1px -1px 0 -1px',
          }}>
            <div style={{ fontSize: 12, color: 'var(--success)', marginBottom: 4, fontWeight: 600 }}>
              NEW API KEY (copy now - shown only once)
            </div>
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)',
              fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all',
            }}>
              <code>{generatedKey}</code>
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(generatedKey)}>
                Copy
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{
                padding: '12px 16px',
                background: 'rgb(239 68 68 / 0.1)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--danger)',
                fontSize: 14,
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="name">Name *</label>
              <input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Production TG ID Key"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="upstreamApi">Upstream API *</label>
              <select
                id="upstreamApi"
                value={formData.upstreamApi}
                onChange={(e) => setFormData({ ...formData, upstreamApi: e.target.value })}
                required
              >
                {upstreams.map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            </div>

            <fieldset className="form-group" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
              <legend style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-secondary)', padding: '0 8px' }}>Rate Limits</legend>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="perMinute">Per Minute</label>
                  <input
                    id="perMinute"
                    type="number"
                    min="0"
                    value={rateLimit.perMinute}
                    onChange={(e) => setFormData({ ...formData, rateLimit: { ...rateLimit, perMinute: parseInt(e.target.value) || 0 } })}
                    placeholder="60"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="daily">Daily</label>
                  <input
                    id="daily"
                    type="number"
                    min="0"
                    value={rateLimit.daily}
                    onChange={(e) => setFormData({ ...formData, rateLimit: { ...rateLimit, daily: parseInt(e.target.value) || 0 } })}
                    placeholder="1000"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="monthly">Monthly</label>
                  <input
                    id="monthly"
                    type="number"
                    min="0"
                    value={rateLimit.monthly}
                    onChange={(e) => setFormData({ ...formData, rateLimit: { ...rateLimit, monthly: parseInt(e.target.value) || 0 } })}
                    placeholder="10000"
                  />
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 8 }}>
                Set to 0 for unlimited. Limits are sliding windows (minute/day/month UTC).
              </p>
            </fieldset>

            <div className="form-group">
              <label htmlFor="ipWhitelist">IP Whitelist (one per line, CIDR supported)</label>
              <textarea
                id="ipWhitelist"
                value={ipWhitelist.join('\n')}
                onChange={(e) => setFormData({ ...formData, ipWhitelist: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                placeholder="192.168.1.0/24&#10;10.0.0.1"
                rows={3}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
              <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>
                Leave empty to allow all IPs. Supports CIDR (e.g., 192.168.1.0/24) and exact IPs.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="ipBlacklist">IP Blacklist (one per line, CIDR supported)</label>
              <textarea
                id="ipBlacklist"
                value={ipBlacklist.join('\n')}
                onChange={(e) => setFormData({ ...formData, ipBlacklist: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                placeholder="192.168.1.100&#10;10.0.0.0/8"
                rows={3}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
              <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>
                Blocked IPs take precedence over whitelist.
              </p>
            </div>

            {editingKey && (
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as KeyStatus })}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            )}
          </div>

          <div className="modal-footer">
            {editingKey && (
              <>
                <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>
                {formData.status === 'active' ? (
                  <button type="button" className="btn btn-warning" onClick={handleSuspend}>Suspend</button>
                ) : (
                  <button type="button" className="btn btn-success" onClick={handleUnsuspend}>Unsuspend</button>
                )}
              </>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editingKey ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}