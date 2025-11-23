import { useEffect } from 'react';
import { X } from 'lucide-react'; // optional icon library

const getTypeFromUrl = (url = '') => {
  const u = url.split('?')[0];
  const ext = u.split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext))
    return 'image';
  return 'other';
};

const DocumentViewer = ({ url, onClose, title }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!url) return null;

  const type = getTypeFromUrl(url);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative h-[92vh] w-[92vw] rounded-xl bg-white shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b px-5 py-4 bg-slate-50">
          <h2 className="text-lg font-semibold">
            {title || 'Document preview'}
          </h2>

          <div className="flex items-center gap-3">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Open in new tab
            </a>

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="h-[calc(92vh-70px)] bg-slate-100 overflow-hidden flex items-center justify-center">
          {type === 'pdf' && (
            <iframe
              title="PDF"
              src={url}
              className="w-full h-full border-none"
            />
          )}

          {type === 'image' && (
            <img
              src={url}
              alt={title || 'attachment'}
              className="max-h-full max-w-full object-contain"
            />
          )}

          {type === 'other' && (
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <p className="text-gray-600 text-sm">
                Preview not available for this file type.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Open / Download
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
