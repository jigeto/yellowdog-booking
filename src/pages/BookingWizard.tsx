import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, supabaseUrl, supabaseAnonKey, type Package, type TimeSlot, type Settings, type ValidateVoucherResult } from '../lib/supabase';
import { loadSettings, formatEUR, formatTime, classNames } from '../lib/utils';
import { Check, ChevronLeft, ChevronRight, Calendar, Clock, User, CreditCard, CheckCircle, Sparkles, Album, Camera, AlertCircle, Loader2, Dog, Cat, PawPrint, X } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { bg } from 'date-fns/locale';

type Step = 1 | 2 | 3 | 4 | 5;

type FormData = {
  packageSlug: string;
  slotId: string;
  fullName: string;
  email: string;
  phone: string;
  petName: string;
  petSpecies: 'dog' | 'cat' | 'other';
  petBreed: string;
  numPets: number;
  note: string;
  gdprConsent: boolean;
  marketingConsent: boolean;
  paymentOption: 'deposit' | 'full' | 'voucher';
  voucherCode: string;
};

const STEPS = [
  { num: 1, label: 'Пакет', icon: Camera },
  { num: 2, label: 'Час', icon: Calendar },
  { num: 3, label: 'Данни', icon: User },
  { num: 4, label: 'Плащане', icon: CreditCard },
  { num: 5, label: 'Потвърждение', icon: CheckCircle },
];

export function BookingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCancelledNotice, setShowCancelledNotice] = useState(() => searchParams.get('cancelled') === '1');

  useEffect(() => {
    if (searchParams.get('cancelled') === '1') {
      setSearchParams({}, { replace: true });
    }
    if (searchParams.get('voucher') || searchParams.get('email') || searchParams.get('name')) {
      setSearchParams({}, { replace: true });
      if (searchParams.get('voucher')) validateVoucher();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [packages, setPackages] = useState<Package[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voucherResult, setVoucherResult] = useState<ValidateVoucherResult | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  const [form, setForm] = useState<FormData>(() => {
    const voucherFromUrl = searchParams.get('voucher')?.trim().toUpperCase() || '';
    const emailFromUrl = searchParams.get('email')?.trim() || '';
    const nameFromUrl = searchParams.get('name')?.trim() || '';
    return {
      packageSlug: '',
      slotId: '',
      fullName: nameFromUrl,
      email: emailFromUrl,
      phone: '',
      petName: '',
      petSpecies: 'dog',
      petBreed: '',
      numPets: 1,
      note: '',
      gdprConsent: false,
      marketingConsent: false,
      paymentOption: voucherFromUrl ? 'voucher' : 'deposit',
      voucherCode: voucherFromUrl,
    };
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [pkgResult, slotsResult, settingsData] = await Promise.all([
        supabase.from('packages').select('*').eq('active', true).order('sort_order'),
        supabase.from('time_slots').select('*').eq('status', 'available').order('starts_at'),
        loadSettings(),
      ]);
      if (pkgResult.data) setPackages(pkgResult.data as Package[]);
      if (slotsResult.data) setSlots(slotsResult.data as TimeSlot[]);
      setSettings(settingsData);
      setLoading(false);
    })();
  }, []);

  const selectedPackage = useMemo(() => packages.find(p => p.slug === form.packageSlug), [packages, form.packageSlug]);
  const selectedSlot = useMemo(() => slots.find(s => s.id === form.slotId), [slots, form.slotId]);

  const minLeadHours = parseInt(settings.min_lead_hours || '48', 10);
  const depositEur = parseFloat(settings.deposit_eur || '50');
  const discountPct = parseFloat(settings.prepay_discount_pct || '5');

  const discountedTotal = selectedPackage ? selectedPackage.price_eur * (1 - discountPct / 100) : 0;

  const updateForm = (patch: Partial<FormData>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setError(null);
  };

  const validateVoucher = useCallback(async () => {
    if (!form.voucherCode.trim()) {
      setVoucherResult(null);
      return;
    }
    setVoucherLoading(true);
    const { data, error: rpcError } = await supabase.rpc('validate_voucher', { p_code: form.voucherCode.trim() }).single();
    if (rpcError) {
      setVoucherResult({ valid: false, kind: null, package_slug: null, package_name_bg: null, package_price_eur: null, reason: 'Грешка при проверка' });
    } else {
      setVoucherResult(data as ValidateVoucherResult);
    }
    setVoucherLoading(false);
  }, [form.voucherCode]);

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return !!form.packageSlug;
      case 2: return !!form.slotId;
      case 3: return !!form.fullName && !!form.email && !!form.phone && !!form.petName && form.gdprConsent;
      case 4: {
        if (form.paymentOption === 'voucher') return !!voucherResult?.valid;
        return true;
      }
      case 5: return true;
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;
    if (step < 5) setStep((step + 1) as Step);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('create_booking_hold', {
      p_slot_id: form.slotId,
      p_package_slug: form.packageSlug,
      p_full_name: form.fullName,
      p_email: form.email,
      p_phone: form.phone,
      p_pet_name: form.petName,
      p_pet_species: form.petSpecies,
      p_pet_breed: form.petBreed,
      p_num_pets: form.numPets,
      p_note: form.note,
      p_marketing: form.marketingConsent,
      p_voucher_code: form.paymentOption === 'voucher' ? form.voucherCode : null,
      p_pay_full: form.paymentOption === 'full',
    }).single();

    if (rpcError) {
      console.error('[create_booking_hold] RPC error:', {
        message: rpcError.message,
        details: (rpcError as any).details,
        hint: (rpcError as any).hint,
        code: (rpcError as any).code,
        full: rpcError,
      });
      const msg = rpcError.message || '';
      if (msg.includes('slot_unavailable')) setError('За съжаление избраният час вече е зает. Моля, изберете друг час.');
      else if (msg.includes('too_late_lead_time')) setError('Резервацията трябва да бъде направена по-рано. Моля, изберете по-далечен час.');
      else if (msg.includes('invalid_voucher')) setError('Ваучерът не е валиден. Моля, проверете кода.');
      else setError('Възникна грешка при резервацията. Моля, опитайте отново.');
      setSubmitting(false);
      return;
    }

    const result = data as { booking_id: string; reference: string; amount_due_eur: number; payment_mode: string };

    if (result.payment_mode === 'deposit_waived' || result.payment_mode === 'voucher' || result.payment_mode === 'voucher_upgrade' || result.amount_due_eur <= 0) {
      fetch(`${supabaseUrl}/functions/v1/send-confirmation-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey },
        body: JSON.stringify({ booking_reference: result.reference }),
      }).catch((e) => console.error('[send-confirmation-email] failed:', e));
      navigate(`/booking/${result.reference}/confirmation`);
      return;
    }

    if (result.amount_due_eur > 0) {
      try {
        const apiUrl = `${supabaseUrl}/functions/v1/create-checkout-session`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({ booking_reference: result.reference, mode: result.payment_mode }),
        });
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status}: ${body}`);
        }
        const checkout = await response.json();
        if (!checkout.url) throw new Error(`No URL in response: ${JSON.stringify(checkout)}`);
        window.location.href = checkout.url;
      } catch (fetchErr) {
        console.error('[create-checkout-session] failed:', fetchErr);
        setError(`Резервацията е създадена (референция: ${result.reference}), но плащането не може да бъде стартирано. Свържете се с нас с тази референция.`);
        setSubmitting(false);
        return;
      }
    } else {
      navigate(`/booking/${result.reference}/confirmation`);
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {showCancelledNotice && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl bg-yellow-50 border border-yellow-200 px-5 py-4 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-ink-700">
              Плащането беше прекъснато или отказано, затова резервацията не е завършена. Часът остава свободен само за кратко — ако все още го искате, моля направете резервацията отначало.
            </p>
          </div>
          <button onClick={() => setShowCancelledNotice(false)} className="text-ink-400 hover:text-ink-600 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero */}
      <div className="text-center mb-10 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          Първото фото студио за домашни любимци в България
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl text-ink-800 mb-3 text-balance">
          Резервирайте своята фотосесия
        </h1>
        <p className="text-ink-500 text-lg max-w-xl mx-auto">
          Създаваме портрети, които ще обичате и след години. Резервирайте своята фотосесия само за няколко минути.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="mb-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <div key={s.num} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={classNames(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                      isDone && 'bg-yellow-400 text-ink-800',
                      isActive && 'bg-ink-800 text-white ring-4 ring-yellow-100',
                      !isActive && !isDone && 'bg-ink-100 text-ink-400'
                    )}
                  >
                    {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={classNames('text-xs font-medium hidden sm:block', isActive ? 'text-ink-800' : 'text-ink-400')}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={classNames('h-0.5 flex-1 mx-2 transition-colors', isDone ? 'bg-yellow-400' : 'bg-ink-100')} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="card p-6 sm:p-8 animate-slide-up" key={step}>
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-error-50 border border-error-100 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}

        {step === 1 && <StepPackage packages={packages} selected={form.packageSlug} onSelect={(slug) => updateForm({ packageSlug: slug })} />}
        {step === 2 && <StepSlot slots={slots} selected={form.slotId} onSelect={(id) => updateForm({ slotId: id })} minLeadHours={minLeadHours} />}
        {step === 3 && <StepDetails form={form} updateForm={updateForm} />}
        {step === 4 && (
          <StepPayment
            form={form}
            updateForm={updateForm}
            selectedPackage={selectedPackage}
            depositEur={depositEur}
            discountPct={discountPct}
            discountedTotal={discountedTotal}
            voucherResult={voucherResult}
            voucherLoading={voucherLoading}
            onValidateVoucher={validateVoucher}
          />
        )}
        {step === 5 && <StepReview form={form} selectedPackage={selectedPackage} selectedSlot={selectedSlot} depositEur={depositEur} discountedTotal={discountedTotal} voucherResult={voucherResult} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={handleBack}
          disabled={step === 1 || submitting}
          className="btn-ghost disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
          Назад
        </button>
        {step < 5 ? (
          <button onClick={handleNext} disabled={!canProceed()} className="btn-primary">
            Продължи
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Създаване...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Потвърди резервацията
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// STEP 1: Package selection
// ============================================================

function StepPackage({ packages, selected, onSelect }: { packages: Package[]; selected: string; onSelect: (slug: string) => void }) {
  return (
    <div>
      <h2 className="font-serif text-2xl text-ink-800 mb-1">Изберете пакет</h2>
      <p className="text-ink-500 text-sm mb-6">Всички пакети включват фотосесия в нашето студио.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {packages.map((pkg) => {
          const isSelected = selected === pkg.slug;
          const isPopular = pkg.featured;
          return (
            <button
              key={pkg.slug}
              onClick={() => onSelect(pkg.slug)}
              className={classNames(
                'relative text-left p-6 rounded-2xl border-2 transition-all duration-200 animate-scale-in',
                isSelected ? 'border-yellow-400 bg-yellow-50 shadow-elevated' : 'border-ink-100 bg-white hover:border-ink-200 hover:shadow-card',
                isPopular && !isSelected && 'ring-1 ring-yellow-200'
              )}
            >
              {isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-yellow-400 text-ink-800 text-xs font-semibold">
                  Най-популярен
                </span>
              )}
              <div className="mb-4">
                <h3 className="font-serif text-2xl text-ink-800 mb-1">{pkg.name_bg}</h3>
                <p className="text-sm text-ink-500 leading-relaxed">{pkg.description_bg}</p>
              </div>
              <div className="mb-4">
                <span className="font-serif text-3xl text-ink-800">{formatEUR(pkg.price_eur)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-ink-600 mb-4">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-yellow-500" />
                  {pkg.photo_count} кадъра
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  {pkg.duration_minutes} мин
                </span>
                {pkg.includes_album && (
                  <span className="flex items-center gap-1.5">
                    <Album className="w-4 h-4 text-yellow-500" />
                    Албум
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {pkg.features?.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                    <Check className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center">
                  <Check className="w-4 h-4 text-ink-800" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// STEP 2: Slot selection (calendar)
// ============================================================

function StepSlot({ slots, selected, onSelect, minLeadHours }: { slots: TimeSlot[]; selected: string; onSelect: (id: string) => void; minLeadHours: number }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const minDate = new Date(Date.now() + minLeadHours * 60 * 60 * 1000);

  const slotsByDate = useMemo(() => {
    const map: Record<string, TimeSlot[]> = {};
    slots
      .filter((slot) => slot.status === 'available')
      .forEach((slot) => {
      const dateKey = format(parseISO(slot.starts_at), 'yyyy-MM-dd');
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(slot);
    });
    return map;
  }, [slots]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const selectedSlot = slots.find(s => s.id === selected);
  const selectedDate = selectedSlot ? parseISO(selectedSlot.starts_at) : null;
  const selectedDateSlots = selectedDate ? slotsByDate[format(selectedDate, 'yyyy-MM-dd')] || [] : [];

  return (
    <div>
      <h2 className="font-serif text-2xl text-ink-800 mb-1">Изберете час</h2>
      <p className="text-ink-500 text-sm mb-6">Показваме всички свободни часове. Можете да резервирате до 12 месеца напред.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn-ghost p-2">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-serif text-lg text-ink-800 capitalize">{format(currentMonth, 'MMMM yyyy', { locale: bg })}</h3>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn-ghost p-2">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['П', 'В', 'С', 'Ч', 'П', 'С', 'Н'].map((d, i) => (
              <div key={i} className="text-center text-xs font-medium text-ink-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const daySlots = slotsByDate[dateKey] || [];
              const hasSlots = daySlots.length > 0;
              const isPast = day < minDate;
              const inMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={dateKey}
                  onClick={() => hasSlots && !isPast && onSelect(daySlots[0].id)}
                  disabled={!hasSlots || isPast}
                  className={classNames(
                    'aspect-square rounded-lg text-sm font-medium transition-all relative',
                    !inMonth && 'text-ink-300',
                    isPast && 'text-ink-300 cursor-not-allowed',
                    hasSlots && !isPast && !isSelected && 'text-ink-700 hover:bg-yellow-50 border border-ink-100',
                    isSelected && 'bg-yellow-400 text-ink-800 shadow-soft',
                    !hasSlots && !isPast && 'text-ink-300 cursor-not-allowed'
                  )}
                >
                  {format(day, 'd')}
                  {hasSlots && !isSelected && !isPast && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-yellow-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time slots for selected date */}
        <div>
          <h3 className="font-serif text-lg text-ink-800 mb-4">
            {selectedDate ? (
              <span className="capitalize">{format(selectedDate, 'd MMMM, EEEE', { locale: bg })}</span>
            ) : (
              'Изберете дата'
            )}
          </h3>
          {selectedDateSlots.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {selectedDateSlots.map((slot) => {
                const isSelected = selected === slot.id;
                return (
                  <button
                    key={slot.id}
                    onClick={() => onSelect(slot.id)}
                    className={classNames(
                      'py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-2',
                      isSelected ? 'border-yellow-400 bg-yellow-50 text-ink-800' : 'border-ink-100 bg-white text-ink-600 hover:border-ink-200'
                    )}
                  >
                    <Clock className="w-4 h-4" />
                    {formatTime(slot.starts_at)}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-ink-50 text-center">
              <Calendar className="w-8 h-8 text-ink-300 mx-auto mb-2" />
              <p className="text-sm text-ink-400">
                {selectedDate ? 'Няма свободни часове за тази дата' : 'Моля, изберете дата от календара'}
              </p>
            </div>
          )}
          {selectedSlot && (
            <div className="mt-4 p-4 rounded-xl bg-yellow-50 border border-yellow-200 flex items-center gap-3 animate-fade-in">
              <CheckCircle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-ink-800">Избран час:</p>
                <p className="text-sm text-ink-600 capitalize">{format(parseISO(selectedSlot.starts_at), 'd MMMM yyyy, HH:mm', { locale: bg })}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STEP 3: Customer & pet details
// ============================================================

function StepDetails({ form, updateForm }: { form: FormData; updateForm: (patch: Partial<FormData>) => void }) {
  return (
    <div>
      <h2 className="font-serif text-2xl text-ink-800 mb-1">Вашите данни</h2>
      <p className="text-ink-500 text-sm mb-6">Нужни са ни само основните ви данни за потвърждение и контакт.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="label">Вашето име *</label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => updateForm({ fullName: e.target.value })}
            className="input-field"
          />
        </div>
        <div>
          <label className="label">Телефон *</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => updateForm({ phone: e.target.value })}
            className="input-field"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Имейл *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateForm({ email: e.target.value })}
            className="input-field"
          />
        </div>
      </div>

      <div className="pt-6 border-t border-ink-100">
        <h3 className="font-serif text-lg text-ink-800 mb-4">За вашия любимец</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Име на любимеца *</label>
            <input
              type="text"
              value={form.petName}
              onChange={(e) => updateForm({ petName: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Вид *</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'dog', label: 'Куче', icon: Dog },
                { value: 'cat', label: 'Котка', icon: Cat },
                { value: 'other', label: 'Друго', icon: PawPrint },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => updateForm({ petSpecies: s.value as 'dog' | 'cat' | 'other' })}
                    className={classNames(
                      'py-3 px-2 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-1',
                      form.petSpecies === s.value ? 'border-yellow-400 bg-yellow-50 text-ink-800' : 'border-ink-100 text-ink-500 hover:border-ink-200'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="label">Порода</label>
            <input
              type="text"
              value={form.petBreed}
              onChange={(e) => updateForm({ petBreed: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Брой любимци</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateForm({ numPets: Math.max(1, form.numPets - 1) })}
                className="w-10 h-10 rounded-xl border border-ink-200 flex items-center justify-center hover:bg-ink-50 transition-colors"
              >
                −
              </button>
              <span className="text-xl font-serif text-ink-800 min-w-[2rem] text-center">{form.numPets}</span>
              <button
                type="button"
                onClick={() => updateForm({ numPets: form.numPets + 1 })}
                className="w-10 h-10 rounded-xl border border-ink-200 flex items-center justify-center hover:bg-ink-50 transition-colors"
              >
                +
              </button>
              <span className="text-sm text-ink-400 ml-2">Без доплащане — всички са добре дошли!</span>
            </div>
          </div>
        </div>
        <div>
          <label className="label">Бележка (по желание)</label>
          <textarea
            value={form.note}
            onChange={(e) => updateForm({ note: e.target.value })}
            placeholder="Алергии, характер на любимеца, и други важни неща, които трябва да знаем..."
            rows={3}
            className="input-field resize-none"
          />
        </div>
      </div>

      <div className="pt-6 border-t border-ink-100 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.gdprConsent}
            onChange={(e) => updateForm({ gdprConsent: e.target.checked })}
            className="mt-1 w-4 h-4 rounded border-ink-300 text-yellow-400 focus:ring-yellow-400"
          />
          <span className="text-sm text-ink-600">
            Съгласен съм с <a href="https://yellowdog.bg/uslovia" target="_blank" rel="noopener noreferrer" className="text-yellow-600 underline">общите условия</a> и <a href="https://yellowdog.bg/poveritelnost" target="_blank" rel="noopener noreferrer" className="text-yellow-600 underline">политиката за поверителност</a> на студиото (GDPR). *
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.marketingConsent}
            onChange={(e) => updateForm({ marketingConsent: e.target.checked })}
            className="mt-1 w-4 h-4 rounded border-ink-300 text-yellow-400 focus:ring-yellow-400"
          />
          <span className="text-sm text-ink-600">
            Искам да получавам новини и промоции от Студио Жълто куче (по желание)
          </span>
        </label>
      </div>
    </div>
  );
}

// ============================================================
// STEP 4: Payment
// ============================================================

function StepPayment({
  form,
  updateForm,
  selectedPackage,
  depositEur,
  discountPct,
  discountedTotal,
  voucherResult,
  voucherLoading,
  onValidateVoucher,
}: {
  form: FormData;
  updateForm: (patch: Partial<FormData>) => void;
  selectedPackage?: Package;
  depositEur: number;
  discountPct: number;
  discountedTotal: number;
  voucherResult: ValidateVoucherResult | null;
  voucherLoading: boolean;
  onValidateVoucher: () => void;
}) {
  if (!selectedPackage) return null;

  return (
    <div>
      <h2 className="font-serif text-2xl text-ink-800 mb-1">Начин на плащане</h2>
      <p className="text-ink-500 text-sm mb-6">Изберете как предпочитате да платите за вашата фотосесия.</p>

      <div className="space-y-3">
        {/* Deposit */}
        <button
          onClick={() => updateForm({ paymentOption: 'deposit' })}
          className={classNames(
            'w-full text-left p-5 rounded-2xl border-2 transition-all',
            form.paymentOption === 'deposit' ? 'border-yellow-400 bg-yellow-50' : 'border-ink-100 hover:border-ink-200'
          )}
        >
          <div className="flex items-start gap-4">
            <div className={classNames('w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center', form.paymentOption === 'deposit' ? 'border-yellow-400' : 'border-ink-300')}>
              {form.paymentOption === 'deposit' && <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-serif text-lg text-ink-800">Капаро</h3>
                <span className="font-serif text-xl text-ink-800">{formatEUR(depositEur)}</span>
              </div>
              <p className="text-sm text-ink-500">Платете {formatEUR(depositEur)} сега, остатъкът от {formatEUR(selectedPackage.price_eur - depositEur)} на място преди фотосесията.</p>
            </div>
          </div>
        </button>

        {/* Full payment */}
        <button
          onClick={() => updateForm({ paymentOption: 'full' })}
          className={classNames(
            'w-full text-left p-5 rounded-2xl border-2 transition-all relative',
            form.paymentOption === 'full' ? 'border-yellow-400 bg-yellow-50' : 'border-ink-100 hover:border-ink-200'
          )}
        >
          <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-success-100 text-success-700 text-xs font-semibold">
            −{discountPct}%
          </span>
          <div className="flex items-start gap-4">
            <div className={classNames('w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center', form.paymentOption === 'full' ? 'border-yellow-400' : 'border-ink-300')}>
              {form.paymentOption === 'full' && <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-serif text-lg text-ink-800">Пълно плащане</h3>
                <div className="text-right">
                  <span className="text-sm text-ink-400 line-through mr-2">{formatEUR(selectedPackage.price_eur)}</span>
                  <span className="font-serif text-xl text-ink-800">{formatEUR(discountedTotal)}</span>
                </div>
              </div>
              <p className="text-sm text-ink-500">Платете цялата сума сега и спестете {formatEUR(selectedPackage.price_eur - discountedTotal)} с {discountPct}% отстъпка.</p>
            </div>
          </div>
        </button>

        {/* Voucher */}
        <div className={classNames('p-5 rounded-2xl border-2 transition-all', form.paymentOption === 'voucher' ? 'border-yellow-400 bg-yellow-50' : 'border-ink-100')}>
          <button
            onClick={() => updateForm({ paymentOption: 'voucher' })}
            className="w-full text-left flex items-start gap-4"
          >
            <div className={classNames('w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center', form.paymentOption === 'voucher' ? 'border-yellow-400' : 'border-ink-300')}>
              {form.paymentOption === 'voucher' && <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />}
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-lg text-ink-800 mb-1">Имам ваучер</h3>
              <p className="text-sm text-ink-500">Въведете кода на вашия подаръчен ваучер.</p>
            </div>
          </button>
          {form.paymentOption === 'voucher' && (
            <div className="mt-4 ml-9 animate-fade-in">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.voucherCode}
                  onChange={(e) => updateForm({ voucherCode: e.target.value.toUpperCase() })}
                  placeholder="YDS-XXXX-XXXX"
                  className="input-field font-mono"
                />
                <button onClick={onValidateVoucher} disabled={voucherLoading || !form.voucherCode.trim()} className="btn-secondary whitespace-nowrap">
                  {voucherLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Провери'}
                </button>
              </div>
              {voucherResult && (
                <div className={classNames('mt-3 p-3 rounded-xl flex items-start gap-2 animate-fade-in', voucherResult.valid ? 'bg-success-50 border border-success-100' : 'bg-error-50 border border-error-100')}>
                  {voucherResult.valid ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-success-700 font-medium">{voucherResult.reason}</p>
                        {voucherResult.kind === 'deposit_waiver' && (
                          <p className="text-ink-600 mt-1">Този код маха капарото — плащате пълната сума на място.</p>
                        )}
                        {voucherResult.kind === 'gift_package' && voucherResult.package_name_bg && (
                          <>
                            <p className="text-ink-600 mt-1">Подаръчен ваучер за пакет: <strong>{voucherResult.package_name_bg}</strong></p>
                            {voucherResult.package_price_eur != null && selectedPackage && voucherResult.package_slug === selectedPackage.slug ? (
                              <p className="text-success-700 mt-1">Напълно покрито от ваучера — без доплащане.</p>
                            ) : voucherResult.package_price_eur != null && selectedPackage && voucherResult.package_price_eur < selectedPackage.price_eur ? (
                              <p className="text-ink-600 mt-1">Доплащате само разликата от {formatEUR(selectedPackage.price_eur - voucherResult.package_price_eur)}.</p>
                            ) : (
                              <p className="text-success-700 mt-1">Напълно покрито от ваучера — без доплащане.</p>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-error-700">{voucherResult.reason}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STEP 5: Review & confirm
// ============================================================

function StepReview({
  form,
  selectedPackage,
  selectedSlot,
  depositEur,
  discountedTotal,
  voucherResult,
}: {
  form: FormData;
  selectedPackage?: Package;
  selectedSlot?: TimeSlot;
  depositEur: number;
  discountedTotal: number;
  voucherResult: ValidateVoucherResult | null;
}) {
  if (!selectedPackage || !selectedSlot) return null;

  const amountDue =
    form.paymentOption === 'full' ? discountedTotal :
    form.paymentOption === 'voucher' && voucherResult ? (
      voucherResult.kind === 'deposit_waiver' ? selectedPackage.price_eur :
      voucherResult.kind === 'gift_package' && voucherResult.package_price_eur != null
        ? Math.max(0, selectedPackage.price_eur - voucherResult.package_price_eur)
        : 0
    ) :
    depositEur;

  return (
    <div>
      <h2 className="font-serif text-2xl text-ink-800 mb-1">Потвърждение</h2>
      <p className="text-ink-500 text-sm mb-6">Моля, проверете детайлите преди да потвърдите.</p>

      <div className="space-y-4">
        <div className="p-5 rounded-xl bg-cream-50 border border-ink-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Camera className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-ink-400 uppercase tracking-wider">Пакет</p>
              <p className="font-serif text-lg text-ink-800">{selectedPackage.name_bg} — {formatEUR(selectedPackage.price_eur)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-ink-400 uppercase tracking-wider">Час</p>
              <p className="font-serif text-lg text-ink-800 capitalize">{format(parseISO(selectedSlot.starts_at), 'd MMMM yyyy, HH:mm', { locale: bg })}</p>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-cream-50 border border-ink-100">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Клиент</p>
              <p className="text-ink-800 font-medium">{form.fullName}</p>
              <p className="text-ink-500">{form.email}</p>
              <p className="text-ink-500">{form.phone}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Любимец</p>
              <p className="text-ink-800 font-medium">{form.petName}</p>
              <p className="text-ink-500">{form.petBreed || '—'}</p>
              <p className="text-ink-500">{form.numPets} бр.</p>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-yellow-50 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Плащане</p>
              <p className="font-serif text-lg text-ink-800">
                {form.paymentOption === 'deposit' && `Капаро — ${formatEUR(depositEur)}`}
                {form.paymentOption === 'full' && `Пълно плащане — ${formatEUR(discountedTotal)}`}
                {form.paymentOption === 'voucher' && voucherResult?.kind === 'deposit_waiver' && 'Код без капаро — плащане на място'}
                {form.paymentOption === 'voucher' && voucherResult?.kind === 'gift_package' && `Ваучер — ${voucherResult.package_name_bg}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                {form.paymentOption === 'voucher' ? 'Доплащане на място' : 'За плащане сега'}
              </p>
              <p className="font-serif text-2xl text-ink-800">{formatEUR(amountDue)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
