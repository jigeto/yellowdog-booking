import { useState, useEffect } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey, type Settings, type Package } from '../lib/supabase';
import { loadSettings, formatEUR, classNames } from '../lib/utils';
import { Gift, Loader2, AlertCircle, Sparkles, Camera, Clock, Album, Check } from 'lucide-react';

export function VoucherPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [purchaserName, setPurchaserName] = useState('');
  const [purchaserEmail, setPurchaserEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [settingsData, pkgResult] = await Promise.all([
        loadSettings(),
        supabase.from('packages').select('*').eq('active', true).order('sort_order'),
      ]);
      setSettings(settingsData);
      if (pkgResult.data) {
        setPackages(pkgResult.data as Package[]);
      }
      setLoading(false);
    })();
  }, []);

  const validMonths = 6;
  const selectedPackage = packages.find(p => p.slug === selectedSlug);

  const handleSubmit = async () => {
    setError(null);

    if (!selectedSlug) {
      setError('Моля, изберете пакет за подаряване.');
      return;
    }
    if (!purchaserName || !purchaserEmail) {
      setError('Моля, въведете вашето име и имейл.');
      return;
    }
    if (!gdprConsent) {
      setError('Моля, приемете общите условия.');
      return;
    }

    setSubmitting(true);

    try {
      const apiUrl = `${supabaseUrl}/functions/v1/create-checkout-session`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          voucher: {
            package_slug: selectedSlug,
            purchaser: { name: purchaserName, email: purchaserEmail },
            recipient: { name: recipientName, email: recipientEmail },
            message,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to create checkout');
      const checkout = await response.json();
      if (checkout.url) {
        window.location.href = checkout.url;
        return;
      }
      throw new Error('No checkout URL');
    } catch {
      setError('Възникна грешка при стартиране на плащането. Моля, опитайте отново.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero */}
      <div className="text-center mb-10 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-medium mb-4">
          <Gift className="w-4 h-4" />
          Подарък, който оставя спомен
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl text-ink-800 mb-3 text-balance">
          Подарете фотосесия
        </h1>
        <p className="text-ink-500 text-lg max-w-xl mx-auto">
          Идеалният подарък за любимеца и неговия стопанин. Валиден {validMonths} месеца.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-6">
          {/* Package selection */}
          <div className="card p-6 animate-slide-up">
            <h2 className="font-serif text-xl text-ink-800 mb-4">1. Изберете пакет</h2>
            <div className="grid grid-cols-1 gap-3">
              {packages.map((pkg) => {
                const isSelected = selectedSlug === pkg.slug;
                const isPopular = pkg.slug === 'art';
                return (
                  <button
                    key={pkg.slug}
                    onClick={() => setSelectedSlug(pkg.slug)}
                    className={classNames(
                      'relative text-left p-5 rounded-2xl border-2 transition-all',
                      isSelected ? 'border-yellow-400 bg-yellow-50 shadow-elevated' : 'border-ink-100 bg-white hover:border-ink-200 hover:shadow-card',
                      isPopular && !isSelected && 'ring-1 ring-yellow-200'
                    )}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-yellow-400 text-ink-800 text-xs font-semibold">
                        Най-популярен
                      </span>
                    )}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {isSelected && <Check className="w-5 h-5 text-yellow-600" />}
                          <h3 className="font-serif text-xl text-ink-800">{pkg.name_bg}</h3>
                        </div>
                        <p className="text-sm text-ink-500 mb-2">{pkg.description_bg}</p>
                        <div className="flex items-center gap-3 text-xs text-ink-600">
                          <span className="flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5 text-yellow-500" />
                            {pkg.photo_count} кадъра
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-yellow-500" />
                            {pkg.duration_minutes} мин
                          </span>
                          {pkg.includes_album && (
                            <span className="flex items-center gap-1">
                              <Album className="w-3.5 h-3.5 text-yellow-500" />
                              Албум
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-serif text-xl text-ink-800 whitespace-nowrap">{formatEUR(pkg.price_eur)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Purchaser */}
          <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="font-serif text-xl text-ink-800 mb-4">2. Вашите данни</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Вашето име *</label>
                <input type="text" value={purchaserName} onChange={(e) => setPurchaserName(e.target.value)} placeholder="Иван Иванов" className="input-field" />
              </div>
              <div>
                <label className="label">Вашият имейл *</label>
                <input type="email" value={purchaserEmail} onChange={(e) => setPurchaserEmail(e.target.value)} placeholder="ivan@example.com" className="input-field" />
              </div>
            </div>
          </div>

          {/* Recipient */}
          <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h2 className="font-serif text-xl text-ink-800 mb-1">3. Получател (по желание)</h2>
            <p className="text-sm text-ink-500 mb-4">Оставете празно, ако ваучерът е за вас.</p>
            <div className="space-y-4">
              <div>
                <label className="label">Име на получателя</label>
                <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Мария Иванова" className="input-field" />
              </div>
              <div>
                <label className="label">Имейл на получателя</label>
                <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="maria@example.com" className="input-field" />
              </div>
              <div>
                <label className="label">Лично послание</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Честит рожден ден! С любов, Иван..." rows={3} className="input-field resize-none" />
              </div>
            </div>
          </div>

          {/* Consent */}
          <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={gdprConsent} onChange={(e) => setGdprConsent(e.target.checked)} className="mt-1 w-4 h-4 rounded border-ink-300 text-yellow-400 focus:ring-yellow-400" />
              <span className="text-sm text-ink-600">
                Съгласен съм с <a href="https://yellowdog.bg/uslovia" target="_blank" rel="noopener noreferrer" className="text-yellow-600 underline">общите условия</a> и <a href="https://yellowdog.bg/poveritelnost" target="_blank" rel="noopener noreferrer" className="text-yellow-600 underline">политиката за поверителност</a> (GDPR). *
              </span>
            </label>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-error-50 border border-error-100 flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-error-700">{error}</p>
            </div>
          )}

          <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full text-lg py-4">
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Стартиране на плащане...
              </>
            ) : (
              <>
                <Gift className="w-5 h-5" />
                Подарете {selectedPackage ? selectedPackage.name_bg : 'фотосесия'}
              </>
            )}
          </button>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-24 h-fit">
          <div className="relative animate-scale-in">
            <div className="absolute -top-3 -right-3 px-3 py-1 rounded-full bg-ink-800 text-white text-xs font-medium z-10">
              Преглед
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-800 to-ink-700 p-8 shadow-elevated">
              {/* Decorative pattern */}
              <div className="absolute top-0 right-0 w-32 h-32 -translate-y-12 translate-x-12 rounded-full bg-yellow-400/10 blur-2xl" />
              <div className="absolute bottom-0 left-0 w-40 h-40 translate-y-16 -translate-x-8 rounded-full bg-yellow-400/5 blur-2xl" />

              <div className="relative">
                <div className="flex items-center justify-between mb-8">
                  <img
                    src="https://yellowdog.bg/wp-content/uploads/2023/02/Logo_Yellow_Dog.png"
                    alt="Студио Жълто куче"
                    className="h-10 w-auto"
                  />
                  <Gift className="w-6 h-6 text-yellow-400" />
                </div>

                <div className="mb-6">
                  <p className="text-xs text-ink-300 uppercase tracking-wider mb-2">Подаръчен ваучер</p>
                  <p className="font-serif text-4xl text-yellow-400 mb-1">
                    {selectedPackage ? selectedPackage.name_bg : 'Изберете пакет'}
                  </p>
                  <p className="text-sm text-ink-300">за професионална фотосесия</p>
                </div>

                <div className="space-y-3 mb-6 pb-6 border-b border-ink-600">
                  <div>
                    <p className="text-xs text-ink-300 uppercase tracking-wider mb-1">За</p>
                    <p className="font-serif text-lg text-white">{recipientName || '—'}</p>
                  </div>
                  {message && (
                    <div>
                      <p className="text-xs text-ink-300 uppercase tracking-wider mb-1">Послание</p>
                      <p className="text-sm text-ink-100 italic">"{message}"</p>
                    </div>
                  )}
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-ink-300 uppercase tracking-wider mb-1">Валидност</p>
                    <p className="text-sm text-white">{validMonths} месеца</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ink-300 uppercase tracking-wider mb-1">Стойност</p>
                    <p className="text-sm text-white">{selectedPackage ? formatEUR(selectedPackage.price_eur) : '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-cream-50 border border-ink-100 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-ink-600">
                Ваучерът се изпраща по имейл веднага след плащане. Получателят може да го използва за всяка резервация в следващите {validMonths} месеца.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
