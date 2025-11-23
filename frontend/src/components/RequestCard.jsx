import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useState } from 'react';
import DocumentViewer from './DocumentViewer.jsx';

const amountFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const statusMeta = {
  PENDING: { badge: 'pending', label: 'Awaiting approvals' },
  APPROVED: { badge: 'approved', label: 'Ready for finance' },
  REJECTED: { badge: 'rejected', label: 'Requires attention' },
};

const RequestCard = ({ request }) => {
  const status = statusMeta[request.status] || statusMeta.PENDING;
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerTitle, setViewerTitle] = useState(null);

  const openFirstAttachment = () => {
    const att = Array.isArray(request.attachments) && request.attachments[0];
    if (!att) return (window.location.href = `/staff/request/${request.id}`);
    const url = att.external_url || att.file || att.download_url;
    setViewerUrl(url);
    setViewerTitle('Attachment');
  };

  return (
    <article className="glass-panel flex flex-col gap-4 rounded-3xl p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">
            Request
          </p>
          <h3 className="text-xl font-semibold text-slate-900">
            {request.title}
          </h3>
        </div>
        <span className={`status-pill ${status.badge}`}>{request.status}</span>
      </div>
      <p className="text-sm text-slate-600">{request.description}</p>
      {request.supplier && (
        <p className="text-sm text-slate-500">Supplier: {request.supplier}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs uppercase text-slate-500">Amount</p>
          <p className="text-lg font-semibold text-slate-900">
            {amountFormatter.format(Number(request.amount || 0))}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs uppercase text-slate-500">Last updated</p>
          <p className="text-lg font-semibold text-slate-900">
            {dayjs(request.updated_at).format('DD MMM YYYY')}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{status.label}</p>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={openFirstAttachment}>
            Preview
          </button>
          <Link className="btn-secondary" to={`/staff/request/${request.id}`}>
            View details
          </Link>
        </div>
        {viewerUrl && (
          <DocumentViewer
            url={viewerUrl}
            title={viewerTitle}
            onClose={() => setViewerUrl(null)}
          />
        )}
      </div>
    </article>
  );
};

export default RequestCard;
