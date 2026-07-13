import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

type BookingInfo = {
  reference: string;
  customer_name: string | null;
  customer_email: string | null;
  starts_at: string | null;
};

type Step = 'loading' | 'not_found' | 'choose_type' | 'form' | 'signature' | 'submitting' | 'done_granted' | 'done_declined' | 'error';

const CATEGORIES = [
  { key: 'website', label: 'Уебсайт и портфолио на Студиото' },
  { key: 'social', label: 'Социални мрежи на Студиото' },
  { key: 'contests', label: 'Конкурси и изложби' },
  { key: 'print', label: 'Печатни и електронни материали — каталози, брошури, списания, презентации' },
  { key: 'media', label: 'Медийни, образователни и презентационни формати' },
];

export function ConsentForm() {
  const { reference } = useParams<{ reference: string }>();
  const [step, setStep] = useState<Step>('loading');
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [consentType, setConsentType] = useState<'adult' | 'child'>('adult');
  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [childName, setChildName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [otherCategory, setOtherCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasSignatureRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (!reference) {
        setStep('not_found');
        return;
      }
      const { data } = await supabase
        .from('booking_admin_view')
        .select('reference, customer_name, customer_email, starts_at')
        .eq('reference', reference)
        .maybeSingle();

      if (!data) {
        setStep('not_found');
        return;
      }
      setBooking(data);
      setFullName(data.customer_name || '');
      setContact(data.customer_email || '');
      setStep('choose_type');
    })();
  }, [reference]);

  const toggleCategory = (key: string) => {
    setCategories((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  };

  const submit = async (granted: boolean, signaturePng: string | null) => {
    setStep('submitting');
    setError(null);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-image-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey },
        body: JSON.stringify({
          booking_reference: reference,
          consent_type: consentType,
          full_name: fullName,
          contact,
          child_name: consentType === 'child' ? childName : null,
          granted,
          categories: granted ? categories : [],
          other_category: granted ? otherCategory : null,
          signature_png: signaturePng,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Възникна грешка при записа.');
      }
      setStep(granted ? 'done_granted' : 'done_declined');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Възникна грешка.');
      setStep('error');
    }
  };

  const handleDecline = () => submit(false, null);

  const handleAgreeContinue = () => {
    setStep('signature');
    hasSignatureRef.current = false;
  };

  // --- Signature canvas handlers ---
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1A1A17';
    ctx.lineTo(x, y);
    ctx.stroke();
    hasSignatureRef.current = true;
  };

  const endDraw = () => {
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignatureRef.current = false;
  };

  const confirmSignature = () => {
    if (!hasSignatureRef.current) {
      setError('Моля, подпишете се в полето по-горе.');
      return;
    }
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    submit(true, dataUrl);
  };

  // --- Render ---

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    );
  }

  if (step === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-error-500 mx-auto mb-3" />
          <p className="text-ink-700">Не намираме резервация с този код. Моля, помолете екипа да отвори линка отново.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50 px-4 py-8 flex flex-col items-center">
      <div className="mb-6"><Logo /></div>

      <div className="max-w-xl w-full">
        {step === 'choose_type' && (
          <div className="card p-6 sm:p-8 text-center animate-fade-in">
            <h1 className="font-serif text-2xl text-ink-800 mb-6">Тази фотосесия е за:</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => { setConsentType('adult'); setStep('form'); }}
                className="p-8 rounded-2xl border-2 border-ink-100 hover:border-yellow-400 hover:bg-yellow-50 transition-colors text-lg font-medium text-ink-800"
              >
                Мен
              </button>
              <button
                onClick={() => { setConsentType('child'); setStep('form'); }}
                className="p-8 rounded-2xl border-2 border-ink-100 hover:border-yellow-400 hover:bg-yellow-50 transition-colors text-lg font-medium text-ink-800"
              >
                Дете
              </button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="card p-6 sm:p-8 animate-fade-in">
            <h1 className="font-serif text-xl text-ink-800 mb-4">
              {consentType === 'adult'
                ? 'Отделно съгласие за използване на изображения за портфолио и маркетинг'
                : 'Съгласие за използване на изображения на дете за портфолио и маркетинг'}
            </h1>

            <p className="text-sm text-ink-600 leading-relaxed mb-5">
              {consentType === 'adult' ? (
                <>Аз, долуподписаният/долуподписаната, декларирам, че съм информиран/а и доброволно давам съгласието си Студио „Жълто куче“ да използва избрани изображения от фотосесията, на които се разпознавам, за посочените по-долу цели.</>
              ) : (
                <>Аз, долуподписаният/долуподписаната, декларирам, че съм родител/настойник/попечител/законен представител на детето и давам отделно, изрично и доброволно съгласие Студио „Жълто куче“ да използва избрани изображения от фотосесията, на които детето се разпознава, за посочените по-долу цели.</>
              )}
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="label">{consentType === 'adult' ? 'Име и фамилия' : 'Име и фамилия на родител/законен представител'}</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" />
              </div>
              {consentType === 'child' && (
                <div>
                  <label className="label">Име на детето</label>
                  <input value={childName} onChange={(e) => setChildName(e.target.value)} className="input-field" />
                </div>
              )}
              <div>
                <label className="label">E-mail / телефон</label>
                <input value={contact} onChange={(e) => setContact(e.target.value)} className="input-field" />
              </div>
            </div>

            <p className="text-sm font-medium text-ink-700 mb-2">Съгласявам се изображенията да се използват за:</p>
            <div className="space-y-2 mb-3">
              {CATEGORIES.map((c) => (
                <label key={c.key} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categories.includes(c.key)}
                    onChange={() => toggleCategory(c.key)}
                    className="mt-1 w-4 h-4 rounded border-ink-300 text-yellow-400"
                  />
                  <span className="text-sm text-ink-700">{c.label}</span>
                </label>
              ))}
            </div>
            <input
              value={otherCategory}
              onChange={(e) => setOtherCategory(e.target.value)}
              placeholder="Друго (по избор)"
              className="input-field mb-5"
            />

            <p className="text-xs text-ink-400 leading-relaxed mb-6">
              Съгласието е доброволно. Отказът не влияе върху цената или изпълнението на фотосесията. Можете да оттеглите съгласието си по всяко време чрез писмено уведомление до Студиото — оттеглянето не засяга законосъобразното използване преди него.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={handleDecline} className="btn-secondary w-full py-4 text-base">
                Не желая да дам съгласие
              </button>
              <button
                onClick={handleAgreeContinue}
                disabled={!fullName.trim() || (consentType === 'child' && !childName.trim())}
                className="btn-primary w-full py-4 text-base"
              >
                Съгласявам се и подписвам
              </button>
            </div>
          </div>
        )}

        {step === 'signature' && (
          <div className="card p-6 sm:p-8 animate-fade-in">
            <h2 className="font-serif text-xl text-ink-800 mb-1">Подпишете се по-долу</h2>
            <p className="text-sm text-ink-500 mb-4">С пръст, направо на екрана.</p>

            <canvas
              ref={canvasRef}
              width={500}
              height={220}
              className="w-full border-2 border-dashed border-ink-200 rounded-xl bg-white touch-none"
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
            />

            {error && (
              <div className="mt-3 p-3 rounded-xl bg-error-50 border border-error-100 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-error-700">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button onClick={clearSignature} className="btn-secondary w-full py-3">Изчисти</button>
              <button onClick={confirmSignature} className="btn-primary w-full py-3">Потвърди подписа</button>
            </div>
          </div>
        )}

        {step === 'submitting' && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
          </div>
        )}

        {(step === 'done_granted' || step === 'done_declined') && (
          <div className="card p-8 text-center animate-fade-in">
            <CheckCircle2 className="w-12 h-12 text-success-500 mx-auto mb-4" />
            <h2 className="font-serif text-xl text-ink-800 mb-2">Благодарим!</h2>
            <p className="text-sm text-ink-500">
              {step === 'done_granted'
                ? 'Съгласието е записано. Изпратихме и копие по имейл.'
                : 'Предпочитанието ви е записано. Благодарим за отделеното време.'}
            </p>
            <p className="text-xs text-ink-300 mt-6">Можете да върнете таблета на екипа.</p>
          </div>
        )}

        {step === 'error' && (
          <div className="card p-6 text-center">
            <AlertCircle className="w-10 h-10 text-error-500 mx-auto mb-3" />
            <p className="text-ink-700 mb-4">{error}</p>
            <button onClick={() => setStep('form')} className="btn-secondary">Опитай пак</button>
          </div>
        )}
      </div>
    </div>
  );
}
