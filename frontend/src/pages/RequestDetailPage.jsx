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
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    amount: '',
    supplier: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  const fetchRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/requests/${id}/`);
      setRequest(data);
      // Initialize edit form with request data
      setEditForm({
        title: data.title || '',
        description: data.description || '',
        amount: data.amount || '',
        supplier: data.supplier || '',
      });
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
    setUploading(true);
    setMessage(null);
    try {
      console.log('[UPLOAD DEBUG] Starting file upload for:', fileField.name);

      // Upload to Cloudinary first
      const url = await uploadToCloudinary(fileField);
      console.log('[UPLOAD DEBUG] Cloudinary upload successful, URL:', url);

      // Send the URL to the backend
      const payload = { external_url: url };
      console.log(
        '[UPLOAD DEBUG] Sending payload to backend:',
        JSON.stringify(payload)
      );
      console.log('[UPLOAD DEBUG] Endpoint:', endpoint);

      const { data } = await api.post(endpoint, payload);
      console.log('[UPLOAD DEBUG] Backend response:', data);

      setMessage(JSON.stringify(data, null, 2));
      await fetchRequest();
    } catch (err) {
      console.error('[UPLOAD ERROR] Upload failed:', err);
      console.error(
        '[UPLOAD ERROR] Full error object:',
        JSON.stringify(err, null, 2)
      );
      console.error('[UPLOAD ERROR] Error response:', err.response?.data);
      console.error('[UPLOAD ERROR] Error status:', err.response?.status);
      console.error('[UPLOAD ERROR] Error message:', err.message);

      const errorDetail =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Unable to upload file';

      setError(errorDetail);
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

    if (['PENDING'].includes(request.status) && !request.proforma) {
      items.push({
        title: 'Upload proforma',
        description:
          'Share the proforma so approvers can review supplier details and pricing.',
        endpoint: `/requests/${id}/upload-proforma/`,
      });
    }

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

  const handleEditSubmit = async () => {
    setEditLoading(true);
    setError(null);
    try {
      await api.patch(`/requests/${id}/`, editForm);
      setMessage('Request updated successfully');
      setIsEditing(false);
      await fetchRequest();
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to update request');
    } finally {
      setEditLoading(false);
    }
  };
  console.log('REQUEST', request);

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
          <div className="flex items-center gap-3">
            <span className={`status-pill ${status.badge}`}>
              {request.status}
            </span>
            {user.role === 'staff' &&
              ['PENDING', 'REJECTED'].includes(request.status) && (
                <button
                  className="btn-secondary"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              )}
          </div>
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

        {isEditing && (
          <div className="space-y-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Edit request
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={editForm.amount}
                    onChange={(e) =>
                      setEditForm({ ...editForm, amount: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Supplier
                  </label>
                  <input
                    type="text"
                    value={editForm.supplier}
                    onChange={(e) =>
                      setEditForm({ ...editForm, supplier: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  className="btn-primary"
                  onClick={handleEditSubmit}
                  disabled={editLoading}
                >
                  {editLoading ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setIsEditing(false)}
                  disabled={editLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="glass-panel p-8">
          <h3 className="text-2xl font-semibold text-slate-900">
            Files & attachments
          </h3>
          <div className="mt-4 space-y-3">
            {request.proforma && (
              <button
                type="button"
                className="btn-secondary inline-block"
                onClick={() => openViewer(request.proforma, 'Proforma')}
              >
                View proforma
              </button>
            )}
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
                  if (f) {
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

      {Array.isArray(request.finance_comments) &&
        request.finance_comments.length > 0 && (
          <div className="glass-panel p-8">
            <h3 className="text-2xl font-semibold text-slate-900">
              Comments & Notes
            </h3>
            <div className="mt-6 space-y-4">
              {request.finance_comments.map((comment) => {
                const formattedDate = comment.created_at
                  ? dayjs(comment.created_at).format('DD MMM YYYY, HH:mm')
                  : null;

                return (
                  <div
                    key={comment.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {comment.user || 'Unknown User'}
                        </p>
                        {formattedDate && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formattedDate}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                      {comment.comment}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

      {user && user.role === 'finance' && (
        <div className="glass-panel p-6">
          <h4 className="text-lg font-semibold">Add Finance Comment</h4>
          <textarea
            placeholder="Add your comment or note"
            value={decisionComment}
            onChange={(e) => setDecisionComment(e.target.value)}
            className="mt-3 w-full rounded-2xl border border-slate-200 p-3"
          />
          <button
            className="btn-primary mt-4"
            onClick={async () => {
              setDecisionLoading(true);
              setError(null);
              try {
                const { data } = await api.post(
                  `/requests/${id}/finance-comment/`,
                  { comment: decisionComment }
                );
                setRequest(data);
                setDecisionComment('');
              } catch (err) {
                setError(err.response?.data?.detail || 'Unable to add comment');
              } finally {
                setDecisionLoading(false);
              }
            }}
            disabled={decisionLoading || !decisionComment.trim()}
          >
            {decisionLoading ? 'Adding…' : 'Add Comment'}
          </button>
        </div>
      )}

      {user && user.role === 'staff' && (
        <div className="glass-panel p-6">
          <h4 className="text-lg font-semibold">Add Note</h4>
          <textarea
            placeholder="Add a note to this request"
            value={decisionComment}
            onChange={(e) => setDecisionComment(e.target.value)}
            className="mt-3 w-full rounded-2xl border border-slate-200 p-3"
          />
          <button
            className="btn-primary mt-4"
            onClick={async () => {
              setDecisionLoading(true);
              setError(null);
              try {
                const { data } = await api.post(
                  `/requests/${id}/add-comment/`,
                  { comment: decisionComment }
                );
                setRequest(data);
                setDecisionComment('');
              } catch (err) {
                setError(err.response?.data?.detail || 'Unable to add note');
              } finally {
                setDecisionLoading(false);
              }
            }}
            disabled={decisionLoading || !decisionComment.trim()}
          >
            {decisionLoading ? 'Adding…' : 'Add Note'}
          </button>
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
