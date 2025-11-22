import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import RequestCard from '../components/RequestCard.jsx';

const StaffDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/requests/');

      // Normalize to always have an array
      const items = Array.isArray(data.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];

      setRequests(items);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError(err.response?.data?.detail || 'Unable to load requests');
      setRequests([]); // fallback to empty array
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const stats = useMemo(() => {
    if (!Array.isArray(requests)) return [];
    const pending = requests.filter((req) => req.status === 'PENDING').length;
    const approved = requests.filter((req) => req.status === 'APPROVED').length;
    const rejected = requests.filter((req) => req.status === 'REJECTED').length;
    return [
      {
        label: 'Pending',
        value: pending,
        accent: 'text-amber-600 bg-amber-50',
      },
      {
        label: 'Approved',
        value: approved,
        accent: 'text-emerald-600 bg-emerald-50',
      },
      {
        label: 'Rejected',
        value: rejected,
        accent: 'text-rose-600 bg-rose-50',
      },
    ];
  }, [requests]);

  return (
    <section className="space-y-6">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-6 p-8">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">
            Staff workspace
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            My purchase requests
          </h2>
          <p className="text-slate-500">
            Track documents, approvals, and finance handoffs in real-time.
          </p>
        </div>
        <Link className="btn-primary" to="/staff/create">
          Create request
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-3xl p-6 text-center ${stat.accent}`}
          >
            <p className="text-sm uppercase tracking-wide">{stat.label}</p>
            <p className="text-3xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-panel p-8 text-center text-slate-500">
          Loading requests…
        </div>
      ) : requests.length === 0 ? (
        <div className="glass-panel p-8 text-center text-slate-500">
          No requests found.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={{
                ...request,
                images: request.images || [],
                comments: request.comments || [],
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default StaffDashboard;
