// Improved design for receipts & attachments in ApproverDashboard
// --- Full Component Below ---
// Changes made:
// 1. Added nicer button styling for receipts & attachments
// 2. Added icons (paperclip, file-text icon) from lucide-react
// 3. Converted plain text links to pill-style buttons
// 4. Better grouping with cards & spacing
// 5. More modern attachment list UI

import { useEffect, useState, useMemo } from 'react';
import { FileText, Paperclip } from 'lucide-react';
import api from '../api/client.js';
import DocumentViewer from '../components/DocumentViewer.jsx';
import dayjs from 'dayjs';

const ApproverDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [isDocumentViewOpen, setIsDocumentViewOpen] = useState(false);
  const [documentOpenUrl, setDocumentOpenUrl] = useState(null);
  const [documentTitle, setDocumentTitle] = useState('Document');
  const [activeTab, setActiveTab] = useState('pending');
  const [historyFilter, setHistoryFilter] = useState('all');

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

  const loadMyApprovals = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/requests/my-approvals/');
      const items = Array.isArray(data) ? data : data.results || data;
      setApprovals(items);
    } catch (err) {
      console.error('Error fetching approvals:', err);
      setError(err.response?.data?.detail || 'Unable to load approvals');
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') {
      loadPending();
    } else {
      loadMyApprovals();
    }
  }, [activeTab]);

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

  const filteredApprovals = useMemo(() => {
    if (!Array.isArray(approvals)) return [];
    if (historyFilter === 'approved') {
      return approvals.filter((approval) => approval.decision === 'APPROVED');
    } else if (historyFilter === 'rejected') {
      return approvals.filter((approval) => approval.decision === 'REJECTED');
    }
    return approvals;
  }, [approvals, historyFilter]);

  const openDoc = (url, title) => {
    setIsDocumentViewOpen(true);
    setDocumentOpenUrl(url);
    setDocumentTitle(title);
  };

  return (
    <section className="space-y-6">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 p-8">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">
            Approvals
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            {activeTab === 'pending' ? 'Pending queue' : 'My approval history'}
          </h2>
          <p className="text-slate-500">
            {activeTab === 'pending'
              ? 'Review context-rich requests and respond with one click.'
              : 'Review your approved and rejected requests.'}
          </p>
        </div>

        <button
          className="btn-secondary"
          onClick={activeTab === 'pending' ? loadPending : loadMyApprovals}
          disabled={loading}
        >
          {activeTab === 'pending' ? 'Refresh queue' : 'Refresh history'}
        </button>
      </div>

      {error && (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="glass-panel">
        <div className="border-b border-slate-200">
          <div className="flex gap-1 p-4">
            <button
              onClick={() => {
                setActiveTab('pending');
                setError(null);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                setError(null);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-slate-200 text-slate-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              My history
            </button>
          </div>
        </div>

        {activeTab === 'pending' && (
          <div>
            {loading ? (
              <div className="p-8 text-center text-slate-500">
                Loading pending requests…
              </div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                You are all caught up ✨
              </div>
            ) : (
              <div className="grid gap-6 p-6">
                {requests.map((request) => (
                  <article
                    key={request.id}
                    className="rounded-2xl bg-slate-50 space-y-6 p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase text-slate-500">
                          Request #{request.id}
                        </p>
                        <h3 className="text-2xl font-semibold text-slate-900">
                          {request.title}
                        </h3>
                      </div>
                      <span className="status-pill pending">
                        {request.status}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600">
                      {request.description}
                    </p>

                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs uppercase text-slate-500">Amount</p>
                      <p className="text-xl font-semibold text-slate-900">
                        {request.amount}
                      </p>
                    </div>

                    {/* DOCUMENT SECTION */}
                    <div className="space-y-4">
                      {/* Receipt Button */}
                      {request.receipt && (
                        <button
                          onClick={() => openDoc(request.receipt, 'Receipt')}
                          className="flex items-center gap-2 w-fit rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow hover:bg-slate-50 active:scale-95 transition"
                        >
                          <FileText size={16} /> Receipt
                        </button>
                      )}

                      {/* Attachments List */}
                      {request.attachments &&
                      request.attachments.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No attachments provided.
                        </p>
                      ) : request.attachments &&
                        request.attachments.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-700">
                            Attachments
                          </p>
                          <div className="flex flex-col gap-2">
                            {request.attachments.map((att, idx) => (
                              <button
                                key={att.id}
                                onClick={() =>
                                  openDoc(
                                    att.external_url,
                                    `Attachment ${idx + 1}`
                                  )
                                }
                                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-left text-sm font-medium shadow hover:bg-slate-50 active:scale-95 transition"
                              >
                                <Paperclip size={15} /> Attachment {idx + 1}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-4">
                      <button
                        className="btn-primary"
                        onClick={() => decide(request.id, 'approve')}
                        disabled={actioningId === `${request.id}-approve`}
                      >
                        {actioningId === `${request.id}-approve`
                          ? 'Approving…'
                          : 'Approve'}
                      </button>

                      <button
                        className="btn-secondary"
                        onClick={() => decide(request.id, 'reject')}
                        disabled={actioningId === `${request.id}-reject`}
                      >
                        {actioningId === `${request.id}-reject`
                          ? 'Rejecting…'
                          : 'Reject'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <div className="border-b border-slate-200 p-4">
              <div className="flex gap-1">
                <button
                  onClick={() => setHistoryFilter('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                    historyFilter === 'all'
                      ? 'bg-slate-200 text-slate-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setHistoryFilter('approved')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                    historyFilter === 'approved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Approved
                </button>
                <button
                  onClick={() => setHistoryFilter('rejected')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                    historyFilter === 'rejected'
                      ? 'bg-rose-100 text-rose-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Rejected
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500">
                Loading approval history…
              </div>
            ) : filteredApprovals.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No {historyFilter !== 'all' ? historyFilter : ''} approvals
                found.
              </div>
            ) : (
              <div className="space-y-4 p-6">
                {filteredApprovals.map((approval) => (
                  <article
                    key={approval.id}
                    className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {approval.request?.title || 'Request'}
                          </h3>
                          <span
                            className={`status-pill ${
                              approval.decision === 'APPROVED'
                                ? 'approved'
                                : 'rejected'
                            }`}
                          >
                            {approval.decision}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          {approval.request?.description}
                        </p>
                      </div>
                    </div>

                    {approval.comments && (
                      <div className="rounded-lg bg-white p-3 border border-slate-200">
                        <p className="text-xs font-semibold text-slate-600 uppercase">
                          Your comments
                        </p>
                        <p className="text-sm text-slate-700 mt-1">
                          {approval.comments}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <div>
                        <span>
                          Level {approval.level} •{' '}
                          {dayjs(approval.decided_at).format(
                            'MMM DD, YYYY • h:mm A'
                          )}
                        </span>
                      </div>
                      {approval.request?.proforma && (
                        <button
                          className="text-blue-600 hover:underline"
                          onClick={() =>
                            openDoc(approval.request?.proforma, 'Proforma')
                          }
                        >
                          View proforma
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isDocumentViewOpen && (
        <DocumentViewer
          url={documentOpenUrl}
          title={documentTitle}
          onClose={() => {
            setIsDocumentViewOpen(false);
            setDocumentOpenUrl(null);
            setDocumentTitle(null);
          }}
        />
      )}
    </section>
  );
};

export default ApproverDashboard;
