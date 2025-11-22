import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';

const amountFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const statusCopy = {
  PENDING: {
    label: 'Awaiting approvals',
    sub: 'Your request is moving through the approval ladder.',
    badge: 'pending',
  },
  APPROVED: {
    label: 'Approved',
    sub: 'Finance can now reconcile and proceed to payment.',
    badge: 'approved',
  },
  REJECTED: {
    label: 'Rejected',
    sub: 'Review feedback below and update your request.',
    badge: 'rejected',
  },
};

const RequestDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fetchRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/requests/${id}/`);
      setRequest(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to fetch request');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequest();
  }, [id]);

  const uploadFile = async (endpoint, fileField) => {
    if (!fileField) return;
    const formData = new FormData();
    formData.append('file', fileField);
    setUploading(true);
    setMessage(null);
    try {
      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(JSON.stringify(data, null, 2));
      await fetchRequest();
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to upload file');
    } finally {
      setUploading(false);
    }
  };

  const uploads = useMemo(() => {
    if (!request || user.role !== 'staff') {
      return [];
    }
    const items = [];
    if (request.status === 'PENDING') {
      items.push({
        title: 'Upload proforma',
        description:
          'Drop a PDF or image. AI will auto-extract supplier, totals, and PO metadata.',
        endpoint: `/requests/${id}/upload-proforma/`,
      });
    }
    if (['PENDING'].includes(request.status)) {
      items.push({
        title: 'Upload receipt',
        description:
          'Share final proof-of-payment so finance can archive this purchase.',
        endpoint: `/requests/${id}/submit-receipt/`,
      });
    }
    return items;
  }, [id, request, user.role]);

  if (loading) {
    return (
      <div className="glass-panel p-8 text-center text-slate-500">
        Loading request…
      </div>
    );
  }

  if (!request) {
    return (
      <div className="glass-panel p-8 text-center text-rose-600">
        {error || 'Request not found.'}
      </div>
    );
  }

  const status = statusCopy[request.status] || statusCopy.PENDING;

  return (
    <section className="space-y-6">
      <div className="glass-panel space-y-5 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">
              Request #{request.id}
            </p>
            <h2 className="text-3xl font-semibold text-slate-900">
              {request.title}
            </h2>
          </div>
          <span className={`status-pill ${status.badge}`}>
            {request.status}
          </span>
        </div>
        <p className="text-lg text-slate-600">{request.description}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Amount</p>
            <p className="text-2xl font-semibold text-slate-900">
              {amountFormatter.format(Number(request.amount || 0))}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Status</p>
            <p className="text-lg font-semibold text-slate-900">
              {status.label}
            </p>
            <p className="text-sm text-slate-500">{status.sub}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Current level</p>
            <p className="text-2xl font-semibold text-slate-900">
              {request.current_level}
            </p>
          </div>
        </div>
      </div>

      {uploads.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {uploads.map((item) => (
            <label
              key={item.title}
              className="glass-panel flex cursor-pointer flex-col gap-3 rounded-3xl border-2 border-dashed border-slate-200 p-6 transition hover:border-brand"
            >
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(event) =>
                  event.target.files?.length &&
                  uploadFile(item.endpoint, event.target.files[0])
                }
                disabled={uploading}
              />
              <p className="text-sm uppercase tracking-wide text-slate-500">
                {item.title}
              </p>
              <p className="text-base text-slate-600">{item.description}</p>
              <span className="btn-secondary w-fit">
                {uploading ? 'Uploading…' : 'Select file'}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="glass-panel p-8">
        <h3 className="text-2xl font-semibold text-slate-900">
          Approval timeline
        </h3>
        {request.approvals.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No approvals recorded yet.
          </p>
        ) : (
          <ol className="mt-6 space-y-4">
            {request.approvals.map((approval) => (
              <li key={approval.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Level {approval.level} ·{' '}
                    {approval.approver?.username || 'Pending'}
                  </p>
                  <span
                    className={`status-pill ${(
                      approval.decision || ''
                    ).toLowerCase()}`}
                  >
                    {approval.decision}
                  </span>
                </div>
                {approval.comments && (
                  <p className="mt-2 text-sm text-slate-600">
                    {approval.comments}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {message && (
        <div className="glass-panel p-6">
          <h4 className="text-lg font-semibold text-slate-900">
            Processing details
          </h4>
          <pre className="mt-4 max-h-64 overflow-auto rounded-2xl bg-slate-900/90 p-4 text-xs text-white">
            {message}
          </pre>
        </div>
      )}

      {error && (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
    </section>
  );
};

export default RequestDetailPage;
