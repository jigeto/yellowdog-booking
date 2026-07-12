import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, type Settings } from '../lib/supabase';
import { loadSettings, formatEUR } from '../lib/utils';
import { CheckCircle, Calendar, Clock, CreditCard, MapPin, Phone, Mail, ArrowRight, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { parseISO } from 'date-fns';
import { bg } from 'date-fns/locale';
import { format } from 'date-fns';

type BookingConfirmation = {
  reference: string;
  status: string;
  payment_status: string;
  total_eur: number;
  deposit_eur: number;
  amount_paid_eur: number;
  package_name_bg: string;
  package_slug: string;
  starts_at: string | null;
  ends_at: string | null;
  customer_name: string;
  customer_email: string;
  pet_name: string;
};

export function ConfirmationPage() {
  const { reference } = useParams<{ reference: string }>();
  const [booking, setBooking] = useState<BookingConfirmation | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      if (!reference) return;
      const [{ data, error: rpcError }, settingsData] = await Promise.all([
        supabase.rpc('get_booking_confirmation', { p_reference: reference }).single(),
        loadSettings(),
      ]);

      if (rpcError || !data) {
        console.error('[get_booking_confirmation] error:', rpcError, 'raw data:', data);
        setError(true);
        setLoading(false);
        return;
      }

      setBooking(data as BookingConfirmation);
      setSettings(settingsData);
      setLoading(false);
    })();
  }, [reference]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-error-500 mx-auto mb-4" />
        <h1 className="font-serif text-2xl text-ink-800 mb-2">Резервацията не е намерена</h1>
        <p className="text-ink-500 mb-6">Моля, проверете референтния номер или се свържете с нас.</p>
        <Link to="/" className="btn-primary">Към резервация</Link>
      </div>
    );
  }

  const isPaid = booking.payment_status !== 'deposit_pending';
  const slotDate = booking.starts_at ? parseISO(booking.starts_at) : null;
  const amountRemaining = Math.max(0, booking.total_eur - booking.amount_paid_eur);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Success header */}
      <div className="text-center mb-8 animate-scale-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success-50 border-2 border-success-100 mb-4">
          <CheckCircle className="w-10 h-10 text-success-600" />
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-ink-800 mb-2">
          {isPaid ? 'Резервацията е потвърдена!' : 'Резервацията е създадена!'}
        </h1>
        <p className="text-ink-500 text-lg">
          {isPaid
            ? 'Изпратихме потвърждение на вашия имейл. Очакваме ви в студиото!'
            : 'Моля, проверете имейла си за инструкции за плащане.'}
        </p>
      </div>

      {/* Reference card */}
      <div className="card p-6 sm:p-8 mb-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-ink-100">
          <div>
            <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Референтен номер</p>
            <p className="font-serif text-2xl text-ink-800">{booking.reference}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Статус</p>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
              isPaid ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-600'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isPaid ? 'bg-success-500' : 'bg-warning-500'}`} />
              {isPaid ? 'Потвърдена' : 'В очакване на плащане'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-ink-400 uppercase tracking-wider">Пакет</p>
                <p className="font-serif text-lg text-ink-800">{booking.package_name_bg}</p>
                <p className="text-sm text-ink-500">{formatEUR(booking.total_eur)}</p>
              </div>
            </div>

            {slotDate && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-ink-400 uppercase tracking-wider">Дата и час</p>
                  <p className="font-serif text-lg text-ink-800 capitalize">{format(slotDate, 'd MMMM yyyy', { locale: bg })}</p>
                  <p className="text-sm text-ink-500">{format(slotDate, 'HH:mm', { locale: bg })}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-ink-400 uppercase tracking-wider">Плащане</p>
                <p className="font-serif text-lg text-ink-800">Платено: {formatEUR(booking.amount_paid_eur)}</p>
                {amountRemaining > 0 && (
                  <p className="text-sm text-ink-500">Остатък на място: {formatEUR(amountRemaining)}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-ink-400 uppercase tracking-wider">Любимец</p>
                <p className="font-serif text-lg text-ink-800">{booking.pet_name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What's next */}
      <div className="card p-6 sm:p-8 mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="font-serif text-xl text-ink-800 mb-4">Какво следва?</h2>
        <ol className="space-y-4">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-yellow-400 text-ink-800 text-sm font-semibold flex items-center justify-center">1</span>
            <div>
              <p className="font-medium text-ink-800">Потвърждение по имейл</p>
              <p className="text-sm text-ink-500">Изпратихме всички детайли на {booking.customer_email}. Проверете и папката за спам.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-yellow-400 text-ink-800 text-sm font-semibold flex items-center justify-center">2</span>
            <div>
              <p className="font-medium text-ink-800">Подготовка</p>
              <p className="text-sm text-ink-500">Доведете любимеца си спокоен и отпочинал. Ние ще се погрижим за останалото.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-yellow-400 text-ink-800 text-sm font-semibold flex items-center justify-center">3</span>
            <div>
              <p className="font-medium text-ink-800">Фотосесия</p>
              <p className="text-sm text-ink-500">Очакваме ви в студиото 5 минути преди часа. Ако закъснявате, моля, обадете ни се.</p>
            </div>
          </li>
        </ol>
      </div>

      {/* Contact */}
      <div className="card p-6 sm:p-8 mb-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="font-serif text-xl text-ink-800 mb-1">Имате въпроси?</h2>
        <p className="text-sm text-ink-500 mb-4">Не се колебайте да се свържете с нас.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {settings.studio_phone && (
            <a href={`tel:${settings.studio_phone}`} className="flex items-center gap-3 p-3 rounded-xl bg-cream-50 hover:bg-yellow-50 transition-colors">
              <Phone className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-xs text-ink-400">Телефон</p>
                <p className="text-sm font-medium text-ink-800">{settings.studio_phone}</p>
              </div>
            </a>
          )}
          {settings.studio_email && (
            <a href={`mailto:${settings.studio_email}`} className="flex items-center gap-3 p-3 rounded-xl bg-cream-50 hover:bg-yellow-50 transition-colors">
              <Mail className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-xs text-ink-400">Имейл</p>
                <p className="text-sm font-medium text-ink-800">{settings.studio_email}</p>
              </div>
            </a>
          )}
          {settings.studio_address && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-cream-50">
              <MapPin className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-xs text-ink-400">Адрес</p>
                <p className="text-sm font-medium text-ink-800">{settings.studio_address}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-center">
        <Link to="/" className="btn-secondary">
          Назад към началото
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
