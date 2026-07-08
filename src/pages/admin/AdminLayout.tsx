import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Logo } from '../../components/Logo';
import { Calendar, BookOpen, Clock, Gift, Users, DollarSign, LogOut, Loader2, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { classNames } from '../../lib/utils';

const NAV = [
  { to: '/admin', label: 'Календар', icon: Calendar, end: true },
  { to: '/admin/bookings', label: 'Резервации', icon: BookOpen, end: false },
  { to: '/admin/slots', label: 'Часове', icon: Clock, end: false },
  { to: '/admin/vouchers', label: 'Ваучери', icon: Gift, end: false },
  { to: '/admin/customers', label: 'Клиенти', icon: Users, end: false },
  { to: '/admin/finances', label: 'Финанси', icon: DollarSign, end: false },
];

export function AdminLayout() {
  const { session, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ink-50">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    );
  }

  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-ink-50 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-64 bg-ink-800 text-ink-100 flex-col fixed inset-y-0 left-0 z-30">
        <div className="p-5 border-b border-ink-700">
          <Logo />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  classNames(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-yellow-400 text-ink-800' : 'text-ink-300 hover:bg-ink-700 hover:text-white'
                  )
                }
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-ink-700">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-ink-400">Влезли като</p>
            <p className="text-sm text-white truncate">{session.user.email}</p>
          </div>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-300 hover:bg-ink-700 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
            Изход
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink-800/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-ink-800 text-ink-100 flex flex-col animate-slide-in">
            <div className="p-5 border-b border-ink-700 flex items-center justify-between">
              <Logo />
              <button onClick={() => setSidebarOpen(false)} className="text-ink-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1" onClick={() => setSidebarOpen(false)}>
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      classNames(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isActive ? 'bg-yellow-400 text-ink-800' : 'text-ink-300 hover:bg-ink-700 hover:text-white'
                      )
                    }
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
            <div className="p-3 border-t border-ink-700">
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-300 hover:bg-ink-700 hover:text-white transition-colors">
                <LogOut className="w-5 h-5" />
                Изход
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 bg-ink-800 text-white px-4 h-14 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-white">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-serif text-lg">Админ</span>
          <div className="w-6" />
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
