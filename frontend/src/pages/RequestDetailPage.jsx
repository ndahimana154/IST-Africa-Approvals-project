import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useParams } from 'react-router-dom';
import api, { uploadToCloudinary } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';
import DocumentViewer from '../components/DocumentViewer.jsx';

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
  const [decisionComment, setDecisionComment] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerTitle, setViewerTitle] = useState(null);

  const fetchRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/requests/${id}/`);
      console.log('AA', data);
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

  const uploadViaCloudinary = async (endpoint, file) => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const url = await uploadToCloudinary(file);
      const { data } = await api.post(endpoint, { external_url: url });
      setMessage(JSON.stringify(data, null, 2));
      await fetchRequest();
    } catch (err) {
      setError(
        err.message || err.response?.data?.detail || 'Unable to upload file'
      );
    } finally {
      setUploading(false);
    }
  };

  const openViewer = (url, title) => {
    if (!url) return;
    setViewerUrl(url);
    setViewerTitle(title || 'Document');
  };

  const closeViewer = () => {
    setViewerUrl(null);
    setViewerTitle(null);
  };

  const uploads = useMemo(() => {
    if (!request || user.role !== 'staff') {
      return [];
    }
    const items = [];

    if (['PENDING'].includes(request.status) && !request.receipt) {
      items.push({
        title: 'Upload receipt',
        description:
          'Share final proof-of-payment so finance can archive this purchase.',
        endpoint: `/requests/${id}/submit-receipt/`,
      });
    }
    return items;
  }, [id, request, user.role]);

  const handleDecision = async (endpoint, decision) => {
    setDecisionLoading(true);
    setError(null);
    try {
      await api.patch(endpoint, { decision, comments: decisionComment });
      setDecisionComment('');
      await fetchRequest();
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to submit decision');
    } finally {
      setDecisionLoading(false);
    }
  };

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
        {request.supplier && (
          <p className="text-sm text-slate-500">Supplier: {request.supplier}</p>
        )}
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

        <div className="glass-panel p-8">
          <h3 className="text-2xl font-semibold text-slate-900">
            Files & attachments
          </h3>
          <div className="mt-4 space-y-3">
            {request.purchase_order_file_url && (
              <button
                type="button"
                className="btn-secondary inline-block"
                onClick={() =>
                  openViewer(request.purchase_order_file_url, 'Purchase Order')
                }
              >
                View PO
              </button>
            )}
            {request.receipt && (
              <button
                type="button"
                className="btn-secondary inline-block"
                onClick={() => openViewer(request.receipt, 'Receipt')}
              >
                View receipt
              </button>
            )}

            {Array.isArray(request.attachments) &&
              request.attachments.length === 0 && (
                <p className="text-sm text-slate-500">
                  No attachments uploaded.
                </p>
              )}

            {Array.isArray(request.attachments) &&
              request.attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-sm text-brand"
                    onClick={() =>
                      openViewer(
                        att.external_url || att.file || att.download_url,
                        'Attachment'
                      )
                    }
                  >
                    Open attachment
                  </button>
                  <span className="text-xs text-slate-500">
                    {att.content_type}
                  </span>
                </div>
              ))}
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
                onChange={(event) => {
                  const f = event.target.files?.[0];
                  // prefer Cloudinary when configured
                  if (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET && f) {
                    uploadViaCloudinary(item.endpoint, f);
                  } else if (f) {
                    uploadFile(item.endpoint, f);
                  }
                }}
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
        {!Array.isArray(request.approvals) || request.approvals.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No approvals recorded yet.
          </p>
        ) : (
          <ol className="mt-6 space-y-4">
            {request.approvals.map((approval) => {
              const formattedDate = approval.decided_at
                ? dayjs(approval.decided_at).format('DD MMM YYYY, HH:mm')
                : null;

              return (
                <li
                  key={approval.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Level {approval.level} ·{' '}
                        {approval.approver?.username || 'Pending Approver'}
                      </p>

                      {formattedDate && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formattedDate}
                        </p>
                      )}
                    </div>

                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        approval.decision === 'APPROVED'
                          ? 'bg-green-100 text-green-700'
                          : approval.decision === 'REJECTED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {approval.decision || 'PENDING'}
                    </span>
                  </div>

                  {approval.comments && (
                    <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                      {approval.comments}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {user &&
        user.role &&
        (user.role === 'approver_level_1' ||
          user.role === 'approver_level_2') &&
        request.status === 'PENDING' && (
          <div className="glass-panel p-6">
            <h4 className="text-lg font-semibold">Approve / Reject</h4>
            <textarea
              placeholder="Add comments (optional)"
              value={decisionComment}
              onChange={(e) => setDecisionComment(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-200 p-3"
            />
            <div className="mt-4 flex gap-3">
              <button
                className="btn-secondary"
                onClick={() =>
                  handleDecision(`/requests/${id}/reject/`, 'REJECTED')
                }
                disabled={decisionLoading}
              >
                {decisionLoading ? 'Processing…' : 'Reject'}
              </button>
              <button
                className="btn-primary"
                onClick={() =>
                  handleDecision(`/requests/${id}/approve/`, 'APPROVED')
                }
                disabled={decisionLoading}
              >
                {decisionLoading ? 'Processing…' : 'Approve'}
              </button>
            </div>
          </div>
        )}

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
      {viewerUrl && (
        <DocumentViewer
          url={viewerUrl}
          title={viewerTitle}
          onClose={closeViewer}
        />
      )}
    </section>
  );
};

export default RequestDetailPage;
