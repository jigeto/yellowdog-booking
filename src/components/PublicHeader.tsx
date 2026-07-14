import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { Gift, Calendar } from 'lucide-react';

export function PublicHeader() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-cream-50/80 backdrop-blur-md border-b border-ink-100/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Logo href="https://yellowdog.bg" />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/"
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/' ? 'text-yellow-600 bg-yellow-50' : 'text-ink-600 hover:text-ink-800 hover:bg-ink-50'
            }`}
          >
            <Calendar className="w-4 h-4 inline sm:hidden" />
            <span className="hidden sm:inline">Резервирай</span>
          </Link>
          <Link
            to="/voucher"
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/voucher' ? 'text-yellow-600 bg-yellow-50' : 'text-ink-600 hover:text-ink-800 hover:bg-ink-50'
            }`}
          >
            <Gift className="w-4 h-4 inline sm:hidden" />
            <span className="hidden sm:inline">Ваучер</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
