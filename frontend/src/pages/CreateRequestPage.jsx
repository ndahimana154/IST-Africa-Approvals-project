import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import api, { uploadToCloudinary } from '../api/client.js';

const CreateRequestPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    amount: '',
    supplier: '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState([]);

  // files: [{ file, preview, progress, uploadedUrl }]

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleFiles = (e) => {
    const list = Array.from(e.target.files || []).map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      progress: 0,
      uploadedUrl: null,
    }));
    setFiles(list);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post('/requests/', {
        ...form,
        amount: Number(form.amount),
      });

      if (files.length && data && data.id) {
        const urls = [];
        // upload each file with progress
        for (let i = 0; i < files.length; i++) {
          const item = files[i];
          try {
            const url = await uploadToCloudinary(item.file, {
              onProgress: (p) => {
                setFiles((prev) => {
                  const copy = [...prev];
                  if (copy[i]) copy[i].progress = p;
                  return copy;
                });
              },
            });
            urls.push(url);
            // mark uploadedUrl
            setFiles((prev) => {
              const copy = [...prev];
              if (copy[i]) copy[i].uploadedUrl = url;
              return copy;
            });
          } catch (err) {
            console.error('cloudinary upload failed', err);
          }
        }
        if (urls.length) {
          await api.post(`/requests/${data.id}/upload-attachments/`, {
            external_urls: urls,
          });
        }
      }
      toast.success('Request created successfully');
      // navigate('/staff');
      setTimeout(() => {
        navigate('/staff');
      }, 2500);
    } catch (err) {
      toast.error(err.message || 'Failed to create request');
      setError(err.response?.data || 'Unable to create request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Toaster position="top-right" />{' '}
      <div className="glass-panel p-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">
          New request
        </p>
        <h2 className="text-3xl font-semibold text-slate-900">
          Capture request needs
        </h2>
        <p className="text-slate-500">
          Include clear descriptions so approvers can sign off faster.
        </p>
        <form
          className="mt-8 space-y-6"
          encType="multipart/form-data"
          onSubmit={handleSubmit}
        >
          <label className="block text-sm font-medium text-slate-600">
            Request title
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Description
            <textarea
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              name="description"
              rows={4}
              value={form.description}
              onChange={handleChange}
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Supplier (optional)
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              name="supplier"
              value={form.supplier}
              onChange={handleChange}
            />
          </label>

          <label className="block text-sm font-medium text-slate-600">
            Attach images (optional)
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleFiles}
              className="mt-2"
            />
          </label>
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              {files.map((f, idx) => (
                <div key={idx} className="space-y-2">
                  {f.preview && (
                    <img
                      src={f.preview}
                      alt={f.file.name}
                      className="h-24 w-full object-cover rounded"
                    />
                  )}
                  <div className="h-2 w-full rounded bg-slate-200">
                    <div
                      className="h-full bg-brand rounded"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500">
                    {f.file.name} - {f.progress}%
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && (
            <pre className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {typeof error === 'string'
                ? error
                : JSON.stringify(error, null, 2)}
            </pre>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              className="btn-secondary"
              type="button"
              onClick={() => navigate('/staff')}
            >
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default CreateRequestPage;
