import { useEffect, useState, useMemo } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey, type Voucher, type Package } from '../../lib/supabase';
import { classNames, formatEUR, formatDate } from '../../lib/utils';
import { Plus, X, Loader2, Search, Gift, Ticket, Filter, Copy, Check, Sparkles } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Чака плащане',
  active: 'Активен',
  redeemed: 'Използван',
  expired: 'Изтекъл',
  cancelled: 'Отказан',
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-700',
  active: 'bg-success-100 text-success-700',
  redeemed: 'bg-ink-100 text-ink-600',
  expired: 'bg-error-100 text-error-700',
  cancelled: 'bg-error-50 text-error-500',
};

const KIND_LABELS: Record<string, string> = {
  gift_package: 'Подаръчен ваучер',
  deposit_waiver: 'Код без капаро',
};

const SOURCE_LABELS: Record<string, string> = {
  purchase: 'Покупка',
  manual_admin: 'Ръчно издаден',
};

const SOURCE_COLORS: Record<string, string> = {
  purchase: 'bg-yellow-100 text-yellow-700',
  manual_admin: 'bg-blue-100 text-blue-700',
};

export function AdminVouchers() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResend = async (v: Voucher) => {
    setResendingId(v.id);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-voucher-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey },
        body: JSON.stringify({ voucher_code: v.code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.reason === 'no_email_on_file') {
        alert(body.reason === 'no_email_on_file' ? 'Няма записан имейл за този ваучер.' : `Грешка: ${body.error || 'неизвестна'}`);
      } else {
        alert('Изпратено.');
      }
    } catch (e) {
      alert(`Грешка: ${e instanceof Error ? e.message : 'неизвестна'}`);
    }
    setResendingId(null);
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('voucher_admin_view').select('*').order('created_at', { ascending: false });
    setVouchers((data as Voucher[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return vouchers.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (kindFilter !== 'all' && v.kind !== kindFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          v.code.toLowerCase().includes(s) ||
          (v.purchaser_name?.toLowerCase().includes(s) ?? false) ||
          (v.purchaser_email?.toLowerCase().includes(s) ?? false) ||
          (v.recipient_name?.toLowerCase().includes(s) ?? false) ||
          (v.recipient_email?.toLowerCase().includes(s) ?? false)
        );
      }
      return true;
    });
  }, [vouchers, search, statusFilter, kindFilter]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink-800">Ваучери</h1>
          <p className="text-sm text-ink-500">{filtered.length} ваучера</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          Издай код ръчно
        </button>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Търси по код, купувач, получател..." className="input-field pl-10" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-ink-400" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-auto">
              <option value="all">Всички статуси</option>
              <option value="pending_payment">Чакащи плащане</option>
              <option value="active">Активни</option>
              <option value="redeemed">Използвани</option>
              <option value="expired">Изтекли</option>
              <option value="cancelled">Отказани</option>
            </select>
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="input-field w-auto">
              <option value="all">Всички типове</option>
              <option value="gift_package">Подаръчен ваучер</option>
              <option value="deposit_waiver">Код без капаро</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-yellow-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Gift className="w-12 h-12 text-ink-200 mx-auto mb-3" />
          <p className="text-ink-400">Няма ваучери</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs text-ink-400 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Код</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">Сума</th>
                <th className="px-4 py-3 font-medium">Купувач</th>
                <th className="px-4 py-3 font-medium">Получател</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Валиден до</th>
                <th className="px-4 py-3 font-medium">Източник</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="border-b border-ink-50 hover:bg-cream-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm text-ink-800 whitespace-nowrap">{v.code}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs text-ink-600">
                      {v.kind === 'gift_package' ? <Gift className="w-3.5 h-3.5 text-yellow-500" /> : <Ticket className="w-3.5 h-3.5 text-blue-500" />}
                      {KIND_LABELS[v.kind] || v.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-ink-800 whitespace-nowrap">
                    {v.kind === 'gift_package' && v.package_price_eur != null
                      ? formatEUR(v.package_price_eur)
                      : '—'}
                    {v.kind === 'gift_package' && v.package_name_bg && (
                      <div className="text-xs text-ink-400">{v.package_name_bg}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-600">
                    {v.purchaser_name}
                    {v.purchaser_email && <div className="text-xs text-ink-400">{v.purchaser_email}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-600">
                    {v.recipient_name || '—'}
                    {v.recipient_email && <div className="text-xs text-ink-400">{v.recipient_email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={classNames('px-2 py-1 rounded-full text-xs font-medium', STATUS_COLORS[v.status])}>
                      {STATUS_LABELS[v.status] || v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-600 whitespace-nowrap">{v.expires_at ? formatDate(v.expires_at, 'd MMM yyyy') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={classNames('px-2 py-1 rounded-full text-xs font-medium', SOURCE_COLORS[v.source])}>
                      {SOURCE_LABELS[v.source] || v.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleResend(v)}
                      disabled={resendingId === v.id}
                      className="text-xs text-ink-500 hover:text-ink-700 underline whitespace-nowrap"
                    >
                      {resendingId === v.id ? 'Праща се...' : 'Изпрати по имейл'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <IssueVoucherModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function IssueVoucherModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [kind, setKind] = useState<'gift_package' | 'deposit_waiver'>('gift_package');
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [purchaserName, setPurchaserName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (kind === 'gift_package') {
      supabase.from('packages').select('*').eq('active', true).order('sort_order')
        .then(({ data }) => { if (data) setPackages(data as Package[]); });
    }
  }, [kind]);

  const handleSubmit = async () => {
    setError(null);
    if (kind === 'gift_package' && !selectedSlug) {
      setError('Моля, изберете пакет.');
      return;
    }
    if (!purchaserName) {
      setError('Моля, въведете име на купувача.');
      return;
    }

    setSubmitting(true);
    const { data, error: rpcError } = await supabase.rpc('admin_issue_voucher', {
      p_type: kind,
      p_package_slug: kind === 'gift_package' ? selectedSlug : null,
      p_recipient_name: recipientName || null,
      p_recipient_email: recipientEmail || null,
      p_purchaser_name: purchaserName,
      p_message: message || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(false);
      return;
    }

    // admin_issue_voucher returns a plain text value (the generated code),
    // not a row/object — read it directly.
    const code = data as string | null;
    if (code) {
      setIssuedCode(code);
      fetch(`${supabaseUrl}/functions/v1/send-voucher-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey },
        body: JSON.stringify({ voucher_code: code }),
      }).catch((e) => console.error('[send-voucher-email] failed:', e));
    } else {
      onCreated();
      onClose();
    }
  };

  const handleCopy = () => {
    if (issuedCode) {
      navigator.clipboard.writeText(issuedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    if (issuedCode) onCreated();
    onClose();
  };

  if (issuedCode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="absolute inset-0 bg-ink-800/50 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative bg-white rounded-2xl shadow-elevated max-w-md w-full p-8 animate-scale-in text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-50 border-2 border-success-100 mb-4">
            <Check className="w-8 h-8 text-success-600" />
          </div>
          <h3 className="font-serif text-xl text-ink-800 mb-2">Кодът е издаден!</h3>
          <p className="text-sm text-ink-500 mb-6">
            {kind === 'gift_package'
              ? 'Подаръчен ваучер е създаден успешно.'
              : 'Кодът без капаро е създаден успешно.'}
          </p>
          <div className="bg-cream-50 border-2 border-dashed border-yellow-300 rounded-xl p-4 mb-4">
            <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Код на ваучера</p>
            <p className="font-mono text-2xl text-ink-800 tracking-wider">{issuedCode}</p>
          </div>
          <button onClick={handleCopy} className="btn-secondary w-full mb-3">
            {copied ? <Check className="w-4 h-4 text-success-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Копиран!' : 'Копирай кода'}
          </button>
          <button onClick={handleClose} className="btn-primary w-full">Готово</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink-800/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-elevated max-w-lg w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl text-ink-800">Издай код ръчно</h3>
          <button onClick={onClose} className="p-1 hover:bg-ink-50 rounded-lg"><X className="w-5 h-5 text-ink-400" /></button>
        </div>

        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => setKind('gift_package')}
            className={classNames(
              'p-4 rounded-xl border-2 text-left transition-all',
              kind === 'gift_package' ? 'border-yellow-400 bg-yellow-50' : 'border-ink-100 hover:border-ink-200'
            )}
          >
            <Gift className={classNames('w-5 h-5 mb-2', kind === 'gift_package' ? 'text-yellow-600' : 'text-ink-400')} />
            <p className="font-medium text-sm text-ink-800">Подаръчен ваучер</p>
            <p className="text-xs text-ink-500 mt-0.5">За конкретен пакет</p>
          </button>
          <button
            onClick={() => setKind('deposit_waiver')}
            className={classNames(
              'p-4 rounded-xl border-2 text-left transition-all',
              kind === 'deposit_waiver' ? 'border-blue-400 bg-blue-50' : 'border-ink-100 hover:border-ink-200'
            )}
          >
            <Ticket className={classNames('w-5 h-5 mb-2', kind === 'deposit_waiver' ? 'text-blue-600' : 'text-ink-400')} />
            <p className="font-medium text-sm text-ink-800">Код без капаро</p>
            <p className="text-xs text-ink-500 mt-0.5">Маха капарото</p>
          </button>
        </div>

        <div className="space-y-4">
          {kind === 'gift_package' && (
            <div>
              <label className="label">Пакет *</label>
              <div className="space-y-2">
                {packages.map((pkg) => (
                  <button
                    key={pkg.slug}
                    onClick={() => setSelectedSlug(pkg.slug)}
                    className={classNames(
                      'w-full text-left p-3 rounded-xl border-2 transition-all flex items-center justify-between',
                      selectedSlug === pkg.slug ? 'border-yellow-400 bg-yellow-50' : 'border-ink-100 hover:border-ink-200'
                    )}
                  >
                    <div>
                      <p className="font-medium text-sm text-ink-800">{pkg.name_bg}</p>
                      <p className="text-xs text-ink-500">{pkg.photo_count} кадъра · {pkg.duration_minutes} мин</p>
                    </div>
                    <span className="font-serif text-sm text-ink-800">{formatEUR(pkg.price_eur)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {kind === 'deposit_waiver' && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Този код позволява на клиента да резервира без плащане на капаро. Плаща пълната сума на място.
              </p>
            </div>
          )}

          <div>
            <label className="label">Купувач име *</label>
            <input type="text" value={purchaserName} onChange={(e) => setPurchaserName(e.target.value)} className="input-field" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Получател име</label>
              <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Мария Иванова" className="input-field" />
            </div>
            <div>
              <label className="label">Получател имейл</label>
              <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className="input-field" />
            </div>
          </div>

          <div>
            <label className="label">Послание</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Честит рожден ден!..." className="input-field resize-none" />
          </div>

          {error && <p className="text-sm text-error-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onClose} className="btn-secondary">Отказ</button>
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Издай код
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
