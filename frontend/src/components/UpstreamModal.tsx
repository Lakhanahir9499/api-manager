import { useState, useEffect, FormEvent } from 'react';
import { UpstreamApi } from '@/types';
import api from '@/api/client';

interface UpstreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingUpstream?: UpstreamApi | null;
}

export function UpstreamModal({ isOpen, onClose, onSuccess, editingUpstream }: UpstreamModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: '',
    pathPattern: '/',
    queryParams: '' as string,
    headers: '' as string,
    placeholders: '' as string,
    timeout: 10000,
    active: true,
  });

  useEffect(() => {
    if (isOpen) {
      if (editingUpstream) {
        setFormData({
          name: editingUpstream.name,
          baseUrl: editingUpstream.baseUrl,
          pathPattern: editingUpstream.pathPattern,
          queryParams: JSON.stringify(editingUpstream.queryParams, null, 2),
          headers: JSON.stringify(editingUpstream.headers, null, 2),
          placeholders: editingUpstream.placeholders.join('\n'),
          timeout: editingUpstream.timeout,
          active: editingUpstream.active,
        });
      } else {
        setFormData({
          name: '',
          baseUrl: '',
          pathPattern: '/',
          queryParams: '{}',
          headers: '{}',
          placeholders: '',
          timeout: 10000,
          active: true,
        });
      }
      setError('');
    }
  }, [isOpen, editingUpstream]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let queryParams: Record<string, string> = {};
      let headers: Record<string, string> = {};
      try {
        queryParams = JSON.parse(formData.queryParams);
      } catch {
        setError('Invalid JSON in Query Params');
        setLoading(false);
        return;
      }
      try {
        headers = JSON.parse(formData.headers);
      } catch {
        setError('Invalid JSON in Headers');
        setLoading(false);
        return;
      }

      const payload = {
        name: formData.name,
        baseUrl: formData.baseUrl,
        pathPattern: formData.pathPattern,
        queryParams,
        headers,
        placeholders: formData.placeholders.split('\n').map(s => s.trim()).filter(Boolean),
        timeout: formData.timeout,
        active: formData.active,
      };

      if (editingUpstream) {
        await api.patch(`/admin/upstreams/${editingUpstream._id}`, payload);
      } else {
        await api.post('/admin/upstreams', payload);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingUpstream || !confirm('Delete this upstream API? This will also affect any keys using it.')) return;
    try {
      await api.delete(`/admin/upstreams/${editingUpstream._id}`);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h2 className="modal-title">{editingUpstream ? 'Edit Upstream API' : 'Create Upstream API'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

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
                placeholder="e.g., TG ID API"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="baseUrl">Base URL *</label>
              <input
                id="baseUrl"
                type="url"
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder="https://api.example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="pathPattern">Path Pattern *</label>
              <input
                id="pathPattern"
                value={formData.pathPattern}
                onChange={(e) => setFormData({ ...formData, pathPattern: e.target.value })}
                placeholder="/api/v1/endpoint/{placeholder}"
                required
              />
              <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>
                Use &#123;placeholder&#125; syntax for dynamic values (e.g., /api/&#123;tg_id&#125;)
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="queryParams">Fixed Query Params (JSON)</label>
              <textarea
                id="queryParams"
                value={formData.queryParams}
                onChange={(e) => setFormData({ ...formData, queryParams: e.target.value })}
                placeholder='{"key": "value", "param": "fixed"}'
                rows={4}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
              <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>
                These params are always added to upstream requests. Merged with request query params (request params take precedence).
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="headers">Fixed Headers (JSON)</label>
              <textarea
                id="headers"
                value={formData.headers}
                onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                placeholder='{"Authorization": "Bearer token", "X-Custom": "value"}'
                rows={4}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
              <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>
                These headers are always sent to upstream. Host, Content-Length, Connection are stripped.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="placeholders">Placeholders (one per line)</label>
              <textarea
                id="placeholders"
                value={formData.placeholders}
                onChange={(e) => setFormData({ ...formData, placeholders: e.target.value })}
                placeholder="tg_id&#10;aadhar"
                rows={3}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
              <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>
                Parameter names that will be replaced in the path pattern from query params or request body.
              </p>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="timeout">Timeout (ms)</label>
                <input
                  id="timeout"
                  type="number"
                  min="100"
                  max="60000"
                  value={formData.timeout}
                  onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 10000 })}
                />
              </div>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                id="active"
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              />
              <label htmlFor="active" style={{ marginBottom: 0, cursor: 'pointer' }}>Active</label>
            </div>
          </div>

          <div className="modal-footer">
            {editingUpstream && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editingUpstream ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}