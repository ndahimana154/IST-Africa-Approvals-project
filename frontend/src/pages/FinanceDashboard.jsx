import { useEffect, useState } from 'react';
import api, { uploadToCloudinary } from '../api/client.js';
import { jsPDF } from 'jspdf';
import toast, { Toaster } from 'react-hot-toast';
import DocumentViewer from '../components/DocumentViewer.jsx';

const FinanceDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerTitle, setViewerTitle] = useState(null);
  const [activeTab, setActiveTab] = useState('approved');

  const fetchApproved = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all request types based on the active tab
      let endpoint = '/requests/approved/';
      if (activeTab === 'rejected') {
        endpoint = '/requests/rejected/';
      } else if (activeTab === 'pending') {
        endpoint = '/requests/finance-pending/';
      }

      const { data } = await api.get(endpoint);
      const items = Array.isArray(data) ? data : data.results || data;
      setRequests(items);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApproved();
  }, [activeTab]);

  const uploadReceipt = async (id, file) => {
    if (!file) return;
    setUploadingId(id);
    try {
      const url = await uploadToCloudinary(file);
      await api.post(`/requests/${id}/submit-receipt/`, {
        external_url: url,
      });
      toast.success('Receipt uploaded successfully');
      await fetchApproved();
    } catch (err) {
      toast.error('Unable to upload receipt');
      setError(
        err.message || err.response?.data?.detail || 'Unable to upload receipt'
      );
    } finally {
      setUploadingId(null);
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

  const addFinanceComment = async (id, comment) => {
    if (!comment) return;
    try {
      await api.post(`/requests/${id}/finance-comment/`, { comment });
      toast.success('Comment added successfully');
      await fetchApproved();
    } catch (err) {
      toast.error(error.message || 'Unable to add comment');
      setError(err.response?.data?.detail || 'Unable to add comment');
    }
  };

  const generatePO = (request) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Purchase Order', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Request ID: ${request.id}`, 20, 40);
    doc.text(`Title: ${request.title}`, 20, 50);
    doc.text(`Description: ${request.description}`, 20, 60);
    doc.text(`Amount: $${request.amount}`, 20, 70);
    if (request.supplier) doc.text(`Supplier: ${request.supplier}`, 20, 80);

    doc.text(`Status: ${request.status}`, 20, 90);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 100);

    doc.save(`PO_Request_${request.id}.pdf`);
  };

  return (
    <section className="space-y-6">
      <Toaster position="top-right" />
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 p-8">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">
            Finance
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            {activeTab === 'approved' && 'Approved requests'}
            {activeTab === 'rejected' && 'Rejected requests'}
            {activeTab === 'pending' && 'Pending requests (View Only)'}
          </h2>
          <p className="text-slate-500">
            {activeTab === 'approved' &&
              'Download POs, upload receipts, and reconcile payables.'}
            {activeTab === 'rejected' && 'Review rejected requests.'}
            {activeTab === 'pending' && 'Monitor requests awaiting approval.'}
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={fetchApproved}
          disabled={loading}
        >
          Refresh list
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
              onClick={() => setActiveTab('approved')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'approved'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'rejected'
                  ? 'bg-rose-100 text-rose-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Rejected
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Pending (View Only)
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 m-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Loading finance queue…
          </div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No {activeTab} requests found.
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {requests.map((request) => (
              <article
                key={request.id}
                className="glass-panel flex flex-col gap-4 p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-slate-500">
                      Request #{request.id}
                    </p>
                    <h3 className="text-2xl font-semibold text-slate-900">
                      {request.title}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {request.description}
                    </p>
                  </div>
                  <span className="status-pill approved">{request.status}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase text-slate-500">Amount</p>
                    <p className="text-xl font-semibold text-slate-900">
                      {request.amount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase text-slate-500">
                      PO bundle
                    </p>
                    <button
                      className="btn-secondary mt-3"
                      onClick={() => generatePO(request)}
                    >
                      Download PO
                    </button>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase text-slate-500">Receipt</p>
                    {activeTab === 'pending' ? (
                      <p className="text-sm text-slate-500 mt-2">View only</p>
                    ) : request.receipt || request.receipt_url ? (
                      <button
                        className="btn-secondary mt-3 inline-flex"
                        onClick={() => openViewer(request.receipt, 'Receipt')}
                      >
                        View receipt
                      </button>
                    ) : (
                      <div className="mt-2">
                        <label className="flex cursor-pointer flex-col gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-4 text-sm text-slate-600">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(event) =>
                              uploadReceipt(request.id, event.target.files?.[0])
                            }
                            disabled={uploadingId === request.id}
                          />
                          <span>
                            {uploadingId === request.id
                              ? 'Uploading…'
                              : 'Upload receipt'}
                          </span>
                        </label>
                        <div className="mt-3">
                          <input
                            type="text"
                            placeholder="Add finance comment (optional)"
                            className="w-full rounded-md border p-2"
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                await addFinanceComment(
                                  request.id,
                                  e.target.value
                                );
                                e.target.value = '';
                              }
                            }}
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Press Enter to save comment
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
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

export default FinanceDashboard;
