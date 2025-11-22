import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

const roleLinks = {
  staff: [
    { to: '/staff', label: 'Dashboard' },
    { to: '/staff/create', label: 'Create request' },
  ],
  approver_level_1: [{ to: '/approver', label: 'Pending approvals' }],
  approver_level_2: [{ to: '/approver', label: 'Pending approvals' }],
  finance: [{ to: '/finance', label: 'Finance board' }],
};

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const links = user ? roleLinks[user.role] || [] : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-white/60">IST Africa</p>
            <h1 className="text-2xl font-semibold">Procure-to-Pay Control Center</h1>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold">{user.username}</p>
                <p className="text-xs uppercase tracking-wide text-white/70">{user.role.replace(/_/g, ' ')}</p>
              </div>
              <button className="btn-secondary !bg-white/10 !text-white !border-white/20" onClick={logout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </header>
      <nav className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
          {links.map((link) => {
            const active = location.pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
                to={link.to}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
};

export default Layout;

