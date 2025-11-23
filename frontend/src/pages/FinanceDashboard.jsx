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

  const fetchApproved = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/requests/approved/');
      const items = Array.isArray(data) ? data : data.results || data;
      setRequests(items);
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Unable to load approved requests'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApproved();
  }, []);

  const uploadReceipt = async (id, file) => {
    if (!file) return;
    setUploadingId(id);
    try {
      const url = await uploadToCloudinary(file);
      console.log(url);
      await api.post(`/requests/${id}/submit-receipt/`, {
        external_url: url,
      });
      toast.success('Receipt uploaded successfully');
      await fetchApproved();
    } catch (err) {
      toast.error('Unable to upload receipt');
      console.log(err);
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
            Approved requests
          </h2>
          <p className="text-slate-500">
            Download POs, upload receipts, and reconcile payables.
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

      {loading ? (
        <div className="glass-panel p-8 text-center text-slate-500">
          Loading finance queue…
        </div>
      ) : (
        <div className="space-y-4">
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
                  <p className="text-xs uppercase text-slate-500">PO bundle</p>
                  <button
                    className="btn-secondary mt-3"
                    onClick={() => generatePO(request)}
                  >
                    Generate & Download PO
                  </button>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase text-slate-500">Receipt</p>
                  {request.receipt || request.receipt_url ? (
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
