import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Logo } from '../../components/Logo';
import { Loader2, Lock, Mail, AlertCircle, ArrowLeft } from 'lucide-react';

export function AdminLogin() {
  const { session, isAdmin, loading, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ink-50">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    );
  }

  if (session && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (session && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
        <div className="max-w-md w-full card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-error-500 mx-auto mb-4" />
          <h1 className="font-serif text-2xl text-ink-800 mb-2">Нямате достъп</h1>
          <p className="text-ink-500 mb-6">Вашият акаунт не е в списъка с администратори. Моля, свържете се със студиото.</p>
          <button onClick={() => signOut()} className="btn-secondary">Изход</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      const msg = error === 'Invalid login credentials'
        ? 'Невалиден имейл или парола.'
        : `Грешка при вход: ${error}`;
      setError(msg);
      setSubmitting(false);
    } else {
      navigate('/admin');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 to-cream-100 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Logo />
          <h1 className="font-serif text-2xl text-ink-800 mt-6 mb-1">Админ панел</h1>
          <p className="text-sm text-ink-500">Влезте, за да управлявате резервациите</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 sm:p-8 animate-slide-up">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-error-50 border border-error-100 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-error-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="label">Имейл</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@yellowdog.bg"
                  required
                  className="input-field pl-10"
                />
              </div>
            </div>
            <div>
              <label className="label">Парола</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input-field pl-10"
                />
              </div>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full mt-6">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Влизане...
              </>
            ) : (
              'Влез'
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Обратно към сайта
          </Link>
        </div>
      </div>
    </div>
  );
}
