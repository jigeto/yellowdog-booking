import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Logo } from '../../components/Logo';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

export function MfaEnroll() {
  const { refreshMfaStatus, signOut } = useAuth();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Clean up any stale unverified factor from a previous abandoned
      // attempt before enrolling a fresh one (Supabase allows only one
      // pending 'unverified' totp factor per user at a time).
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const staleUnverified = existing?.totp?.find((f) => f.status === 'unverified');
      if (staleUnverified) {
        await supabase.auth.mfa.unenroll({ factorId: staleUnverified.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
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
            <ShieldCheck className="w-6 h-6 text-yellow-500" /> Настрой двуфакторна защита
          </h1>
          <p className="text-sm text-ink-500">Задължителна стъпка за достъп до admin панела.</p>
        </div>

        <div className="card p-6 sm:p-8 animate-slide-up">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
            </div>
          ) : error && !qrCode ? (
            <p className="text-sm text-error-600">{error}</p>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm text-ink-600">
                1. Отвори приложение за автентикация (Google Authenticator, Authy, 1Password) на телефона си.<br />
                2. Сканирай кода по-долу.
              </p>

              {qrCode && (
                <div className="flex justify-center py-2">
                  <img src={qrCode} alt="QR код за MFA" className="w-48 h-48" />
                </div>
              )}

              {secret && (
                <p className="text-xs text-ink-400 text-center break-all">
                  Не можеш да сканираш? Въведи ръчно: <span className="font-mono">{secret}</span>
                </p>
              )}

              <div>
                <label className="label">3. Въведи 6-цифрения код от приложението</label>
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

              <button type="submit" disabled={submitting || code.length < 6} className="btn-primary w-full">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Потвърди и активирай'}
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
