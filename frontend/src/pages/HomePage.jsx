import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

const features = [
  {
    title: 'Smart procurement workflow',
    description: 'Submit purchase requests with guided steps, automated validations, and AI-assisted document parsing.',
    icon: '🧠',
  },
  {
    title: 'Layered approvals',
    description: 'Give approvers a clean queue with contextual data, instant actions, and full audit logs.',
    icon: '🛡️',
  },
  {
    title: 'Finance-grade handoff',
    description: 'Finance teams get reconciled records, receipt uploads, and PO downloads in one view.',
    icon: '💼',
  },
];

const steps = [
  'Create a request with supporting files in minutes.',
  'Collaborate with approvers via live status indicators.',
  'Upload receipts and finalize payouts with finance.',
];

const roleLanding = {
  staff: '/staff',
  approver_level_1: '/approver',
  approver_level_2: '/approver',
  finance: '/finance',
};

const HomePage = () => {
  const { isAuthenticated, user } = useAuth();
  const primaryCta = isAuthenticated ? roleLanding[user?.role] || '/staff' : '/login';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-black">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-16 px-6 py-16 lg:px-12 lg:py-24">
          <header className="flex items-center justify-between">
            <div className="text-xl font-semibold tracking-tight">IST Africa Approvals</div>
            <div className="flex gap-3">
              {isAuthenticated ? (
                <Link className="btn-primary" to={primaryCta}>
                  Open Dashboard
                </Link>
              ) : (
                <>
                  <Link className="btn-secondary" to="/login">
                    Login
                  </Link>
                  <Link className="btn-primary" to="/register">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </header>

          <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-10">
              <p className="inline-flex items-center rounded-full border border-white/20 px-4 py-1 text-sm uppercase tracking-wide text-white/70">
                Modern procure-to-pay operating system
              </p>
              <div className="space-y-6">
                <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                  Launch purchase requests, approvals, and finance handoffs in one place.
                </h1>
                <p className="text-lg text-white/70">
                  Fast onboarding, document automation, and delightful experiences for staff, approvers, and finance teams
                  working across Africa.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link className="btn-primary" to={primaryCta}>
                  {isAuthenticated ? 'Resume work' : 'Get started'}
                </Link>
                {!isAuthenticated && (
                  <Link className="btn-secondary" to="/register">
                    Create a free workspace
                  </Link>
                )}
              </div>
              <dl className="grid gap-6 sm:grid-cols-3">
                {[
                  { label: 'Requests automated', value: '250+' },
                  { label: 'Approval time saved', value: '68%' },
                  { label: 'Finance-ready documents', value: '100%' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <dt className="text-sm uppercase text-white/60">{stat.label}</dt>
                    <dd className="text-2xl font-semibold">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="glass-panel relative mx-auto w-full max-w-md p-8 text-slate-900">
              <div className="absolute -top-6 right-10 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase text-slate-600 shadow">
                Live demo
              </div>
              <p className="text-sm font-medium text-brand">Request flow</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Preview the experience</h2>
              <ul className="mt-6 space-y-4 text-slate-600">
                {steps.map((step, idx) => (
                  <li key={step} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/5 text-sm font-semibold text-slate-900">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 rounded-2xl bg-slate-900/90 px-6 py-4 text-white shadow-inner">
                <p className="text-sm uppercase tracking-wide text-white/60">Timeline</p>
                <div className="mt-4 space-y-3 text-sm">
                  <p>• Staff uploads proforma — AI extracts supplier records</p>
                  <p>• Approver L1 signs digitally with comments</p>
                  <p>• Finance downloads PO + receipt bundle</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-3xl">{feature.icon}</div>
                <h3 className="mt-4 text-2xl font-semibold">{feature.title}</h3>
                <p className="mt-3 text-white/70">{feature.description}</p>
              </div>
            ))}
          </section>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.2),_transparent_55%)]" />
      </div>
    </div>
  );
};

export default HomePage;

