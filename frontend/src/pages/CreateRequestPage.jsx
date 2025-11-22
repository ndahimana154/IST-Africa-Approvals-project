import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { upload } from '../api/client.js';

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

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleFiles = (e) => {
    setFiles(Array.from(e.target.files || []));
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
      console.log(files);
      // if files attached, upload them to the request attachments endpoint
      // if (files.length && data && data.id) {
      //   const formData = new FormData();
      //   files.forEach((file) => formData.append('files', file)); // 'files' matches serializer field

      //   // upload attachments
      //   await upload(`/requests/${data.id}/upload-attachments/`, formData, {
      //     headers: { 'Content-Type': 'multipart/form-data' },
      //   });
      // }

      navigate('/staff');
    } catch (err) {
      setError(err.response?.data || 'Unable to create request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="glass-panel p-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">
          New request
        </p>
        <h2 className="text-3xl font-semibold text-slate-900">
          Capture procurement needs
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
