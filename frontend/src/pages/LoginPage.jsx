import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { formatError } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';

const roleLanding = {
  staff: '/staff',
  approver_level_1: '/approver',
  approver_level_2: '/approver',
  finance: '/finance',
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/auth/login/', form);
      login(data.access, data.user);
      navigate(roleLanding[data.user.role] || '/staff', { replace: true });
    } catch (err) {
      setError(
        formatError(err) || 'Unable to login. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to="/"
          className="text-blue-600 hover:underline font-semibold text-lg"
        >
          &larr; Back to Home
        </Link>
      </div>
      <div className="mx-auto grid min-h-screen max-w-6xl gap-10 px-6 py-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="space-y-8">
          <p className="inline-flex rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-wide text-white/60">
            Secure workspace login
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Reconnect with your approvals, finance workflows, and AI powered
            document processing.
          </h1>
          <ul className="space-y-4 text-white/70">
            <li>• View status timelines with live updates.</li>
            <li>
              • Upload proformas, receipts, and purchase orders in one
              interface.
            </li>
            <li>• Collaborate with finance and approvers instantly.</li>
          </ul>
        </div>

        <div className="glass-panel bg-white p-10 text-slate-900">
          <h2 className="text-2xl font-semibold text-slate-900">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            No account yet?{' '}
            <Link
              to="/register"
              className="font-semibold text-brand hover:text-brand-dark"
            >
              Create one
            </Link>
          </p>
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="text-sm font-medium text-slate-600">
              Username
              <input
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                autoComplete="username"
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Password
              <input
                type="password"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
            </label>
            {error && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            <button
              className="btn-primary w-full justify-center"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
