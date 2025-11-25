import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { formatError } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';

const landingByRole = {
  staff: '/staff',
  approver_level_1: '/approver',
  approver_level_2: '/approver',
  finance: '/finance',
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      console.log('Before');
      const { data } = await api.post('/auth/register/', form);
      login(data.access, data.user);
      navigate(landingByRole[data.user.role] || '/staff', { replace: true });
    } catch (err) {
      console.log('Error', err);
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-12 lg:flex-row lg:items-center lg:gap-16">
        <div className="flex-1 space-y-6 text-white">
          <p className="inline-flex rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-wide text-white/60">
            Welcome to IST Africa Approvals
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Create your workspace credentials.
          </h1>
          <p className="text-lg text-white/70">
            Spin up an account, invite your team later, and start automating
            purchase requests, approvals, and finance handoffs in minutes.
          </p>
        </div>

        <div className="glass-panel flex-1 p-10">
          <h2 className="text-2xl font-semibold text-slate-900">Register</h2>
          <p className="mt-2 text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-brand hover:text-brand-dark"
            >
              Log in
            </Link>
          </p>
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-600">
                First name
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                />
              </label>
              <label className="text-sm font-medium text-slate-600">
                Last name
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                />
              </label>
            </div>
            <label className="text-sm font-medium text-slate-600">
              Work email
              <input
                type="email"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Username
              <input
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-600">
                Password
                <input
                  type="password"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-600">
                Confirm password
                <input
                  type="password"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  name="confirm_password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>
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
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
