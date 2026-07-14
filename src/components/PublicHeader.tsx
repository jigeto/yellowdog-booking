import { Link, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Logo } from './Logo';
import { Gift, Calendar, ChevronDown } from 'lucide-react';

const SITE_LINKS = [
  { label: 'За нас', href: 'https://yellowdog.bg/za-nas/' },
  { label: 'ЧЗВ', href: 'https://yellowdog.bg/chzv/' },
  { label: 'Цени', href: 'https://yellowdog.bg/ceni/' },
  { label: 'Блог', href: 'https://yellowdog.bg/blog/' },
  { label: 'Галерия', href: 'https://yellowdog.bg/portfolio/' },
  { label: 'За бизнеса', href: 'https://yellowdog.bg/biznes/' },
  { label: 'Контакти', href: 'https://yellowdog.bg/kontakti/' },
];

export function PublicHeader() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-cream-50/80 backdrop-blur-md border-b border-ink-100/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <a href="https://yellowdog.bg" target="_blank" rel="noopener noreferrer">
          <Logo />
        </a>
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

          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="px-3 sm:px-4 py-2 rounded-lg text-sm font-medium text-ink-600 hover:text-ink-800 hover:bg-ink-50 transition-colors flex items-center gap-1"
            >
              Още
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-elevated border border-ink-100 py-2 animate-fade-in">
                {SITE_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-sm text-ink-600 hover:bg-ink-50 hover:text-ink-800 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
