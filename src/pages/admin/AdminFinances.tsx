import { useEffect, useState, useMemo } from 'react';
import { supabase, type Booking, type TimeSlot } from '../../lib/supabase';
import { formatEUR, formatDate } from '../../lib/utils';
import { Loader2, Download, TrendingUp, Camera, CreditCard, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { format, parseISO, subMonths, isSameMonth } from 'date-fns';
import { bg } from 'date-fns/locale';

type BookingWithSlot = Booking & { slot?: TimeSlot };

const PACKAGE_COLORS: Record<string, string> = {
  classic: '#F5B400',
  art: '#E0A300',
  premium: '#C08D00',
};

export function AdminFinances() {
  const [bookings, setBookings] = useState<BookingWithSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      const rows = (data || []) as Booking[];
      const slotIds = [...new Set(rows.map((b) => b.slot_id).filter(Boolean))] as string[];
      let slotMap: Record<string, TimeSlot> = {};
      if (slotIds.length > 0) {
        const { data: slotsData } = await supabase.from('time_slots').select('*').in('id', slotIds);
        if (slotsData) {
          (slotsData as TimeSlot[]).forEach((s) => { slotMap[s.id] = s; });
        }
      }
      const mapped = rows.map((b) => ({
        ...b,
        slot: b.slot_id ? slotMap[b.slot_id] : undefined,
      })) as BookingWithSlot[];
      setBookings(mapped);
      setLoading(false);
    })();
  }, []);

  const now = new Date();

  const thisMonthBookings = useMemo(
    () => bookings.filter(b => isSameMonth(parseISO(b.created_at), now)),
    [bookings]
  );

  const thisMonthRevenue = useMemo(
    () => thisMonthBookings.reduce((s, b) => s + b.amount_paid_eur, 0),
    [thisMonthBookings]
  );

  const avgValue = useMemo(
    () => thisMonthBookings.length ? thisMonthRevenue / thisMonthBookings.length : 0,
    [thisMonthBookings, thisMonthRevenue]
  );

  const monthlyData = useMemo(() => {
    const months: { month: string; revenue: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const month = subMonths(now, i);
      const monthBookings = bookings.filter(b => isSameMonth(parseISO(b.created_at), month));
      months.push({
        month: format(month, 'MMM', { locale: bg }),
        revenue: monthBookings.reduce((s, b) => s + b.amount_paid_eur, 0),
        count: monthBookings.length,
      });
    }
    return months;
  }, [bookings]);

  const packageData = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach(b => { counts[b.package_slug] = (counts[b.package_slug] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, color: PACKAGE_COLORS[name] || '#999' }));
  }, [bookings]);

  const paymentModeData = useMemo(() => {
    const counts: Record<string, number> = { deposit: 0, full: 0, voucher: 0, remainder: 0 };
    bookings.forEach(b => { if (b.payment_mode) counts[b.payment_mode] = (counts[b.payment_mode] || 0) + 1; });
    return [
      { name: 'Капаро', value: counts.deposit, color: '#F5B400' },
      { name: 'Пълно', value: counts.full, color: '#E0A300' },
      { name: 'Ваучер', value: counts.voucher, color: '#C08D00' },
      { name: 'Остатък', value: counts.remainder, color: '#9A6F00' },
    ].filter(d => d.value > 0);
  }, [bookings]);

  const handleExport = () => {
    const headers = ['Референция', 'Дата', 'Пакет', 'Статус', 'Плащане', 'Дължимо', 'Платено', 'Любимец'];
    const rows = bookings.map(b => [
      b.reference,
      b.slot ? format(parseISO(b.slot.starts_at), 'd.MM.yyyy HH:mm') : formatDate(b.created_at, 'd.MM.yyyy'),
      b.package_slug,
      b.status,
      b.payment_status,
      b.amount_due_eur.toString(),
      b.amount_paid_eur.toString(),
      b.pet_name || '',
    ]);
    const csv = '\ufeff' + [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `yellowdog-финанси-${format(now, 'yyyy-MM-dd')}.csv`);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-yellow-400 animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink-800">Финанси</h1>
          <p className="text-sm text-ink-500">Приходи и статистика</p>
        </div>
        <button onClick={handleExport} className="btn-secondary text-sm">
          <Download className="w-4 h-4" />
          Експорт CSV
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <p className="font-serif text-3xl text-ink-800 mb-1">{formatEUR(thisMonthRevenue)}</p>
          <p className="text-sm text-ink-500">Приходи {format(now, 'MMMM', { locale: bg })}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Camera className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <p className="font-serif text-3xl text-ink-800 mb-1">{thisMonthBookings.length}</p>
          <p className="text-sm text-ink-500">Сесии {format(now, 'MMMM', { locale: bg })}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <p className="font-serif text-3xl text-ink-800 mb-1">{formatEUR(avgValue)}</p>
          <p className="text-sm text-ink-500">Средна стойност</p>
        </div>
      </div>

      {/* Monthly revenue chart */}
      <div className="card p-5 mb-6">
        <h2 className="font-serif text-xl text-ink-800 mb-4">Приходи последните 12 месеца</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#7A7A6E' }} />
            <YAxis tick={{ fontSize: 12, fill: '#7A7A6E' }} tickFormatter={(v) => `${v}€`} />
            <Tooltip
              formatter={(value) => [`${value}€`, 'Приходи']}
              contentStyle={{ borderRadius: 12, border: '1px solid #E7E7E2', fontSize: 13 }}
            />
            <Bar dataKey="revenue" fill="#F5B400" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Session count chart */}
      <div className="card p-5 mb-6">
        <h2 className="font-serif text-xl text-ink-800 mb-4">Брой сесии последните 12 месеца</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#7A7A6E' }} />
            <YAxis tick={{ fontSize: 12, fill: '#7A7A6E' }} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [value, 'Сесии']}
              contentStyle={{ borderRadius: 12, border: '1px solid #E7E7E2', fontSize: 13 }}
            />
            <Line type="monotone" dataKey="count" stroke="#F5B400" strokeWidth={2.5} dot={{ fill: '#F5B400', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bookings by package */}
        {packageData.length > 0 && (
          <div className="card p-5">
            <h2 className="font-serif text-xl text-ink-800 mb-4">Резервации по пакет</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={packageData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {packageData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E7E7E2', fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Payment mode breakdown */}
        {paymentModeData.length > 0 && (
          <div className="card p-5">
            <h2 className="font-serif text-xl text-ink-800 mb-4">Капаро срещу пълно плащане</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={paymentModeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {paymentModeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E7E7E2', fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div className="card p-5 mt-6">
        <h2 className="font-serif text-xl text-ink-800 mb-4">Последни транзакции</h2>
        {bookings.length === 0 ? (
          <div className="text-center py-8">
            <BarChart2 className="w-12 h-12 text-ink-200 mx-auto mb-3" />
            <p className="text-ink-400">Няма данни</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-400 uppercase tracking-wider">
                  <th className="pb-2 pr-4 font-medium">Референция</th>
                  <th className="pb-2 pr-4 font-medium">Дата</th>
                  <th className="pb-2 pr-4 font-medium">Пакет</th>
                  <th className="pb-2 pr-4 font-medium">Платено</th>
                  <th className="pb-2 font-medium">Режим</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 20).map((b) => (
                  <tr key={b.id} className="border-b border-ink-50 text-sm">
                    <td className="py-2 pr-4 font-mono text-ink-800">{b.reference}</td>
                    <td className="py-2 pr-4 text-ink-600">{formatDate(b.created_at, 'd MMM yyyy')}</td>
                    <td className="py-2 pr-4 text-ink-600 capitalize">{b.package_slug}</td>
                    <td className="py-2 pr-4 font-medium text-ink-800">{formatEUR(b.amount_paid_eur)}</td>
                    <td className="py-2 text-ink-600">{b.payment_mode || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
