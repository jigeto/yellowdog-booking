import { useEffect, useState, useMemo } from 'react';
import { supabase, supabaseUrl, type Booking } from '../../lib/supabase';
import { classNames, formatEUR, formatDateTime } from '../../lib/utils';
import { Search, Loader2, X, CheckCircle, Ban, AlertCircle, RotateCcw, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import { parseISO } from 'date-fns';
import { bg } from 'date-fns/locale';
import { format } from 'date-fns';

// Not real security — the admin panel is already behind login. This is
// just a speed bump so no one triggers a real Stripe refund by accident.
const REFUND_PIN = '1123';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Чакащ',
  confirmed: 'Потвърден',
  completed: 'Завършен',
  cancelled: 'Отказан',
  no_show: 'Не се яви',
};

const PAYMENT_LABELS: Record<string, string> = {
  deposit_pending: 'Чака плащане',
  deposit_paid: 'Капаро платено',
  paid_full: 'Платено изцяло',
  refunded: 'Възстановено',
  deposit_waived: 'Без капаро',
};

const PAYMENT_MODE_LABELS: Record<string, string> = {
  deposit: 'Капаро',
  full: 'Пълно',
  voucher: 'Ваучер',
  voucher_upgrade: 'Ваучер + доплащане',
  deposit_waived: 'Без капаро',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-success-100 text-success-700',
  completed: 'bg-ink-100 text-ink-600',
  cancelled: 'bg-error-100 text-error-700',
  no_show: 'bg-error-50 text-error-600',
};

export function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dateSort, setDateSort] = useState<'asc' | 'desc' | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('booking_admin_view')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setBookings(data as Booking[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const result = bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          b.reference.toLowerCase().includes(s) ||
          b.pet_name?.toLowerCase().includes(s) ||
          b.customer_name?.toLowerCase().includes(s) ||
          b.customer_phone?.toLowerCase().includes(s)
        );
      }
      return true;
    });
    if (dateSort) {
      result.sort((a, b) => {
        const aTime = a.starts_at ? new Date(a.starts_at).getTime() : 0;
        const bTime = b.starts_at ? new Date(b.starts_at).getTime() : 0;
        return dateSort === 'asc' ? aTime - bTime : bTime - aTime;
      });
    }
    return result;
  }, [bookings, search, statusFilter, dateSort]);

  const toggleDateSort = () => {
    setDateSort((prev) => (prev === null ? 'asc' : prev === 'asc' ? 'desc' : null));
  };

  const handleAction = async (booking: Booking, action: 'confirmed' | 'completed' | 'no_show' | 'cancelled') => {
    setActionLoading(true);
    setActionError(null);
    const { error, data } = await supabase.from('bookings').update({ status: action }).eq('id', booking.id).select();
    if (error) {
      console.error('[handleAction] update bookings failed:', error);
      setActionError(`Грешка: ${error.message}`);
      setActionLoading(false);
      return;
    }
    if (!data || data.length === 0) {
      console.error('[handleAction] update matched 0 rows (likely blocked by RLS) for booking', booking.id);
      setActionError('Промяната не мина — заявката не засегна нито един ред (вероятно RLS блокира директен update от admin панела).');
      setActionLoading(false);
      return;
    }
    if (action === 'cancelled' && booking.slot_id) {
      const { error: slotErr } = await supabase.from('time_slots').update({ status: 'available' }).eq('id', booking.slot_id);
      if (slotErr) {
        console.error('[handleAction] update time_slots failed:', slotErr);
        setActionError(`Резервацията е отказана, но часът не се освободи: ${slotErr.message}`);
        setActionLoading(false);
        load();
        return;
      }
    }
    setActionLoading(false);
    setSelectedBooking(null);
    load();
  };

  const handleRefund = async (booking: Booking) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const apiUrl = `${supabaseUrl}/functions/v1/refund`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ booking_id: booking.id }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Stripe refund failed (HTTP ${response.status})`);
      }
    } catch (refundErr) {
      console.error('[handleRefund] Stripe refund call failed:', refundErr);
      setActionError(`Грешка при връщане през Stripe: ${refundErr instanceof Error ? refundErr.message : 'Unknown error'}`);
      setActionLoading(false);
      return;
    }
    const { error, data } = await supabase.from('bookings').update({ payment_status: 'refunded' }).eq('id', booking.id).select();
    if (error) {
      console.error('[handleRefund] update bookings failed:', error);
      setActionError(`Грешка: ${error.message}`);
      setActionLoading(false);
      return;
    }
    if (!data || data.length === 0) {
      console.error('[handleRefund] update matched 0 rows (likely blocked by RLS) for booking', booking.id);
      setActionError('Възстановяването не мина — заявката не засегна нито един ред (вероятно RLS).');
      setActionLoading(false);
      return;
    }
    setActionLoading(false);
    setSelectedBooking(null);
    load();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink-800">Резервации</h1>
          <p className="text-sm text-ink-500">{filtered.length} резервации</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Търси по референция, любимец..."
              className="input-field pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-ink-400" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-auto">
              <option value="all">Всички</option>
              <option value="pending">Чакащи</option>
              <option value="confirmed">Потвърдени</option>
              <option value="completed">Завършени</option>
              <option value="cancelled">Отказани</option>
              <option value="no_show">Не се яви</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-yellow-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-ink-400">Няма резервации</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs text-ink-400 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Референция</th>
                <th className="px-4 py-3 font-medium">Клиент</th>
                <th className="px-4 py-3 font-medium select-none cursor-pointer hover:text-ink-600" onClick={toggleDateSort}>
                  <span className="inline-flex items-center gap-1">
                    Дата/час
                    {dateSort === 'asc' && <ArrowUp className="w-3 h-3" />}
                    {dateSort === 'desc' && <ArrowDown className="w-3 h-3" />}
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">Любимец</th>
                <th className="px-4 py-3 font-medium">Пакет</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Плащане</th>
                <th className="px-4 py-3 font-medium">Сума</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-ink-50 hover:bg-cream-50 transition-colors cursor-pointer" onClick={() => { setSelectedBooking(b); setActionError(null); }}>
                  <td className="px-4 py-3 font-mono text-sm text-ink-800">{b.reference}</td>
                  <td className="px-4 py-3 text-sm text-ink-600">
                    <div className="font-medium text-ink-800">{b.customer_name || '—'}</div>
                    <div className="text-xs text-ink-400">{b.customer_phone || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-600">
                    {b.starts_at ? format(parseISO(b.starts_at), 'd MMM, HH:mm', { locale: bg }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-600">{b.pet_name}</td>
                  <td className="px-4 py-3 text-sm text-ink-600 capitalize">{b.package_slug}</td>
                  <td className="px-4 py-3">
                    <span className={classNames('px-2 py-1 rounded-full text-xs font-medium', STATUS_COLORS[b.status])}>
                      {STATUS_LABELS[b.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-600">{PAYMENT_LABELS[b.payment_status]}</td>
                  <td className="px-4 py-3 text-sm font-medium text-ink-800">{formatEUR(b.amount_due_eur)}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost text-sm">Детайли</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => { setSelectedBooking(null); setActionError(null); }}
          onAction={handleAction}
          onRefund={handleRefund}
          actionLoading={actionLoading}
          actionError={actionError}
        />
      )}
    </div>
  );
}

function BookingDetailModal({
  booking,
  onClose,
  onAction,
  onRefund,
  actionLoading,
  actionError,
}: {
  booking: Booking;
  onClose: () => void;
  onAction: (b: Booking, a: 'confirmed' | 'completed' | 'no_show' | 'cancelled') => void;
  onRefund: (b: Booking) => void;
  actionLoading: boolean;
  actionError: string | null;
}) {
  const [showRefundPin, setShowRefundPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const confirmRefund = () => {
    if (pinInput !== REFUND_PIN) {
      setPinError('Грешен PIN.');
      return;
    }
    setPinError(null);
    setShowRefundPin(false);
    setPinInput('');
    onRefund(booking);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink-800/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-elevated max-w-lg w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl text-ink-800">Резервация {booking.reference}</h3>
          <button onClick={onClose} className="p-1 hover:bg-ink-50 rounded-lg"><X className="w-5 h-5 text-ink-400" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-ink-400 text-xs uppercase mb-1">Дата/час</p>
              <p className="text-ink-800">{booking.starts_at ? formatDateTime(booking.starts_at) : '—'}</p>
            </div>
            <div>
              <p className="text-ink-400 text-xs uppercase mb-1">Пакет</p>
              <p className="text-ink-800 capitalize">{booking.package_slug}</p>
            </div>
            <div>
              <p className="text-ink-400 text-xs uppercase mb-1">Любимец</p>
              <p className="text-ink-800">{booking.pet_name} ({booking.num_pets})</p>
            </div>
            <div>
              <p className="text-ink-400 text-xs uppercase mb-1">Вид/порода</p>
              <p className="text-ink-800">{booking.pet_species} {booking.pet_breed}</p>
            </div>
            <div>
              <p className="text-ink-400 text-xs uppercase mb-1">Статус</p>
              <span className={classNames('px-2 py-1 rounded-full text-xs font-medium', STATUS_COLORS[booking.status])}>
                {STATUS_LABELS[booking.status]}
              </span>
            </div>
            <div>
              <p className="text-ink-400 text-xs uppercase mb-1">Плащане</p>
              <p className="text-ink-800">{PAYMENT_LABELS[booking.payment_status]}</p>
            </div>
            <div>
              <p className="text-ink-400 text-xs uppercase mb-1">Сума</p>
              <p className="text-ink-800">{formatEUR(booking.amount_due_eur)} (платено: {formatEUR(booking.amount_paid_eur)})</p>
            </div>
            <div>
              <p className="text-ink-400 text-xs uppercase mb-1">Режим</p>
              <p className="text-ink-800">{PAYMENT_MODE_LABELS[booking.payment_mode || ''] || booking.payment_mode || '—'}</p>
            </div>
          </div>

          {booking.note && (
            <div className="p-3 rounded-xl bg-cream-50">
              <p className="text-xs text-ink-400 uppercase mb-1">Бележка</p>
              <p className="text-sm text-ink-700">{booking.note}</p>
            </div>
          )}

          {booking.voucher_code && (
            <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200">
              <p className="text-xs text-ink-400 uppercase mb-1">Ваучер</p>
              <p className="text-sm font-mono text-ink-800">{booking.voucher_code}</p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-ink-100 space-y-2">
            {actionError && (
              <p className="text-sm text-error-600 bg-error-50 rounded-lg px-3 py-2">{actionError}</p>
            )}
            {booking.status === 'pending' && (
              <button onClick={() => onAction(booking, 'confirmed')} disabled={actionLoading} className="btn-primary w-full text-sm">
                <CheckCircle className="w-4 h-4" /> Потвърди резервацията
              </button>
            )}
            {booking.status === 'confirmed' && (
              <>
                <button onClick={() => onAction(booking, 'completed')} disabled={actionLoading} className="btn-primary w-full text-sm">
                  <CheckCircle className="w-4 h-4" /> Маркирай като завършена
                </button>
                <button onClick={() => onAction(booking, 'no_show')} disabled={actionLoading} className="btn-secondary w-full text-sm">
                  <AlertCircle className="w-4 h-4" /> Не се яви
                </button>
              </>
            )}
            {(booking.status === 'pending' || booking.status === 'confirmed') && (
              <button onClick={() => onAction(booking, 'cancelled')} disabled={actionLoading} className="btn-secondary w-full text-sm text-error-600 border-error-200 hover:bg-error-50">
                <Ban className="w-4 h-4" /> Откажи
              </button>
            )}
            {(booking.payment_status === 'deposit_paid' || booking.payment_status === 'paid_full') && (
              showRefundPin ? (
                <div className="p-3 rounded-xl bg-error-50 border border-error-200 space-y-2">
                  <p className="text-sm text-ink-700">Въведи PIN, за да потвърдиш реално връщане на пари през Stripe:</p>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={pinInput}
                    onChange={(e) => { setPinInput(e.target.value); setPinError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmRefund(); }}
                    className="input-field"
                    autoFocus
                  />
                  {pinError && <p className="text-sm text-error-600">{pinError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => { setShowRefundPin(false); setPinInput(''); setPinError(null); }} className="btn-secondary flex-1 text-sm">Отказ</button>
                    <button onClick={confirmRefund} disabled={actionLoading} className="btn-primary flex-1 text-sm">Потвърди връщането</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowRefundPin(true)} disabled={actionLoading} className="btn-secondary w-full text-sm">
                  <RotateCcw className="w-4 h-4" /> Възстанови плащане (през Stripe)
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
