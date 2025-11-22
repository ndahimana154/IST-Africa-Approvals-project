import { useEffect, useState } from 'react';
import api from '../api/client.js';

const ApproverDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);

  const loadPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/requests/pending/');
      setRequests(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const decide = async (id, action) => {
    setActioningId(`${id}-${action}`);
    try {
      await api.patch(`/requests/${id}/${action}/`, {});
      await loadPending();
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to update request');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 p-8">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">Approvals</p>
          <h2 className="text-3xl font-semibold text-slate-900">Pending queue</h2>
          <p className="text-slate-500">Review context-rich requests and respond with one click.</p>
        </div>
        <button className="btn-secondary" onClick={loadPending} disabled={loading}>
          Refresh queue
        </button>
      </div>

      {error && (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <div className="glass-panel p-8 text-center text-slate-500">Loading pending requests…</div>
      ) : requests.length === 0 ? (
        <div className="glass-panel p-8 text-center text-slate-500">You are all caught up ✨</div>
      ) : (
        <div className="grid gap-6">
          {requests.map((request) => (
            <article key={request.id} className="glass-panel space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-slate-500">Request #{request.id}</p>
                  <h3 className="text-2xl font-semibold text-slate-900">{request.title}</h3>
                </div>
                <span className="status-pill pending">{request.status}</span>
              </div>
              <p className="text-sm text-slate-600">{request.description}</p>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase text-slate-500">Amount</p>
                <p className="text-xl font-semibold text-slate-900">{request.amount}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="btn-primary"
                  onClick={() => decide(request.id, 'approve')}
                  disabled={actioningId === `${request.id}-approve`}
                >
                  {actioningId === `${request.id}-approve` ? 'Approving…' : 'Approve'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => decide(request.id, 'reject')}
                  disabled={actioningId === `${request.id}-reject`}
                >
                  {actioningId === `${request.id}-reject` ? 'Rejecting…' : 'Reject'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default ApproverDashboard;

