import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Logo } from '../../components/Logo';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

export function MfaChallenge() {
  const { refreshMfaStatus, signOut } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const verified = data?.totp?.find((f) => f.status === 'verified');
      if (!verified) {
        // Shouldn't happen (parent only renders this when a verified
        // factor exists), but fall back gracefully if it does.
        setError('Не е намерен настроен фактор за MFA.');
        setLoading(false);
        return;
      }
      setFactorId(verified.id);
      setLoading(false);
    })();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setSubmitting(true);
    setError(null);

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(challengeError?.message || 'Грешка при създаване на предизвикателство.');
      setSubmitting(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    if (verifyError) {
      setError('Грешен код. Провери приложението и опитай пак.');
      setSubmitting(false);
      setCode('');
      return;
    }

    await refreshMfaStatus();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 to-cream-100 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Logo />
          <h1 className="font-serif text-2xl text-ink-800 mt-6 mb-1 flex items-center justify-center gap-2">
            <ShieldCheck className="w-6 h-6 text-yellow-500" /> Двуфакторна проверка
          </h1>
          <p className="text-sm text-ink-500">Въведи кода от приложението за автентикация.</p>
        </div>

        <div className="card p-6 sm:p-8 animate-slide-up">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="label">6-цифрен код</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  required
                  className="input-field text-center text-lg tracking-widest"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-error-50 border border-error-100 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-error-700">{error}</p>
                </div>
              )}

              <button type="submit" disabled={submitting || code.length < 6 || !factorId} className="btn-primary w-full">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Потвърди'}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <button onClick={() => signOut()} className="text-sm text-ink-500 hover:text-ink-700 transition-colors">
            Изход
          </button>
        </div>
      </div>
    </div>
  );
}
