import { useEffect, useState, useMemo } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey, type TimeSlot, type Booking, type Package } from '../../lib/supabase';
import { classNames, formatTime, formatEUR } from '../../lib/utils';
import { ChevronLeft, ChevronRight, Plus, Ban, X, Loader2, Calendar as CalIcon, Clock, UserPlus, CalendarClock, Unlock, AlertCircle } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfDay, endOfDay } from 'date-fns';
import { bg } from 'date-fns/locale';

type ViewMode = 'month' | 'week' | 'day';

export function AdminCalendar() {
  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showManualBooking, setShowManualBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ slot: TimeSlot; booking?: Booking } | null>(null);

  const load = async () => {
    setLoading(true);
    let startDate: Date, endDate: Date;
    if (view === 'month') {
      startDate = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
      endDate = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    } else if (view === 'week') {
      startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
      endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else {
      startDate = startOfDay(currentDate);
      endDate = endOfDay(currentDate);
    }

    const [slotsRes, bookingsRes] = await Promise.all([
      supabase.from('time_slots').select('*').gte('starts_at', startDate.toISOString()).lte('starts_at', endDate.toISOString()).order('starts_at'),
      supabase.from('booking_admin_view').select('*').gte('created_at', subMonths(startDate, 1).toISOString()),
    ]);

    setSlots(slotsRes.data as TimeSlot[] || []);
    setBookings(bookingsRes.data as Booking[] || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [view, currentDate]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, TimeSlot[]> = {};
    slots.forEach((s) => {
      const key = format(parseISO(s.starts_at), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [slots]);

  const bookingBySlotId = useMemo(() => {
    const map: Record<string, Booking> = {};
    bookings.forEach((b) => {
      if (b.slot_id) map[b.slot_id] = b;
    });
    return map;
  }, [bookings]);

  const statusColor = (slot: TimeSlot): string => {
    if (slot.status === 'blocked') return 'bg-ink-200 text-ink-500 border-l-4 border-ink-400';
    const booking = bookingBySlotId[slot.id];
    if (!booking) return 'bg-yellow-50 text-yellow-700 border-l-4 border-yellow-400';
    switch (booking.status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500';
      case 'confirmed': return 'bg-success-100 text-success-700 border-l-4 border-success-500';
      case 'completed': return 'bg-ink-100 text-ink-500 border-l-4 border-ink-400';
      case 'cancelled': return 'bg-error-100 text-error-700 border-l-4 border-error-500';
      case 'no_show': return 'bg-error-50 text-error-600 border-l-4 border-error-400';
      default: return 'bg-yellow-50 text-yellow-700 border-l-4 border-yellow-400';
    }
  };

  const navigate = (dir: 'prev' | 'next' | 'today') => {
    if (dir === 'today') { setCurrentDate(new Date()); return; }
    if (view === 'month') setCurrentDate(dir === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(dir === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(dir === 'next' ? new Date(currentDate.getTime() + 86400000) : new Date(currentDate.getTime() - 86400000));
  };

  const title = view === 'month' ? format(currentDate, 'MMMM yyyy', { locale: bg })
    : view === 'week' ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: bg })} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: bg })}`
    : format(currentDate, 'd MMMM yyyy', { locale: bg });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink-800 capitalize">{title}</h1>
          <p className="text-sm text-ink-500">Управление на часовете и резервациите</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => navigate('today')} className="btn-ghost text-sm">Днес</button>
          <div className="flex items-center bg-white rounded-lg border border-ink-200">
            <button onClick={() => navigate('prev')} className="p-2 hover:bg-ink-50 rounded-l-lg"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => navigate('next')} className="p-2 hover:bg-ink-50 rounded-r-lg border-l border-ink-200"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center bg-white rounded-lg border border-ink-200 p-0.5">
            {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={classNames('px-3 py-1.5 text-sm font-medium rounded-md transition-colors', view === v ? 'bg-ink-800 text-white' : 'text-ink-600 hover:bg-ink-50')}
              >
                {v === 'month' ? 'Месец' : v === 'week' ? 'Седмица' : 'Ден'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowManualBooking(true)} className="btn-primary text-sm">
            <UserPlus className="w-4 h-4" />
            Нова резервация
          </button>
          <button onClick={() => setShowSlotModal(true)} className="btn-secondary text-sm">
            <Plus className="w-4 h-4" />
            Нов час
          </button>
          <button onClick={() => setShowBlockModal(true)} className="btn-secondary text-sm">
            <Ban className="w-4 h-4" />
            Блокирай
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-400" /> Свободен</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-500" /> Чакащ</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-success-500" /> Потвърден</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-ink-400" /> Завършен</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-error-500" /> Отказан</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-ink-400 opacity-50 border border-ink-300" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, #999 3px, #999 4px)' }} /> Блокиран</span>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-yellow-400 animate-spin" /></div>
      ) : view === 'month' ? (
        <MonthView slotsByDate={slotsByDate} bookingBySlotId={bookingBySlotId} currentDate={currentDate} statusColor={statusColor} onSlotClick={(slot) => setSelectedSlot({ slot, booking: bookingBySlotId[slot.id] })} onDayClick={(day) => { setCurrentDate(day); setView('day'); }} />
      ) : view === 'week' ? (
        <WeekView slotsByDate={slotsByDate} bookingBySlotId={bookingBySlotId} currentDate={currentDate} statusColor={statusColor} onSlotClick={(slot) => setSelectedSlot({ slot, booking: bookingBySlotId[slot.id] })} />
      ) : (
        <DayView slots={slotsByDate[format(currentDate, 'yyyy-MM-dd')] || []} bookingBySlotId={bookingBySlotId} statusColor={statusColor} onSlotClick={(slot) => setSelectedSlot({ slot, booking: bookingBySlotId[slot.id] })} />
      )}

      {/* Modals */}
      {showSlotModal && <CreateSlotModal onClose={() => setShowSlotModal(false)} onCreated={load} />}
      {showBlockModal && <BlockSlotModal onClose={() => setShowBlockModal(false)} onCreated={load} />}
      {showManualBooking && <ManualBookingModal onClose={() => setShowManualBooking(false)} onCreated={load} />}
      {selectedSlot && <SlotDetailModal slot={selectedSlot.slot} booking={selectedSlot.booking} onClose={() => setSelectedSlot(null)} onUpdated={load} />}
    </div>
  );
}

// ============================================================
// Month View
// ============================================================

function MonthView({ slotsByDate, bookingBySlotId, currentDate, statusColor, onSlotClick, onDayClick }: {
  slotsByDate: Record<string, TimeSlot[]>;
  bookingBySlotId: Record<string, Booking>;
  currentDate: Date;
  statusColor: (s: TimeSlot) => string;
  onSlotClick: (s: TimeSlot) => void;
  onDayClick: (day: Date) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="card p-2 sm:p-4 overflow-x-auto">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Пон', 'Вто', 'Сря', 'Чет', 'Пет', 'Съб', 'Нед'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-ink-400 py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const daySlots = slotsByDate[key] || [];
          const hasSlots = daySlots.length > 0;
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={key}
              className={classNames(
                'min-h-[80px] sm:min-h-[120px] p-1.5 rounded-lg border',
                isSameMonth(day, currentDate) ? 'bg-white border-ink-100' : 'bg-ink-50/50 border-transparent',
                isToday && 'ring-2 ring-yellow-400'
              )}
            >
              <div className={classNames('text-xs font-medium mb-1', isToday ? 'text-yellow-600' : isSameMonth(day, currentDate) ? 'text-ink-600' : 'text-ink-300')}>
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {daySlots.slice(0, 3).map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => onSlotClick(slot)}
                    className={classNames('w-full text-left px-1.5 py-1 rounded text-xs truncate', statusColor(slot))}
                  >
                    {formatTime(slot.starts_at)} {slot.status === 'blocked' ? '—' : bookingBySlotId[slot.id]?.pet_name || 'свободен'}
                  </button>
                ))}
                {daySlots.length > 3 && (
                  <button
                    onClick={() => onDayClick(day)}
                    className="w-full text-left text-xs text-ink-400 hover:text-yellow-600 hover:underline px-1.5"
                  >
                    +{daySlots.length - 3} още
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Week View
// ============================================================

function WeekView({ slotsByDate, bookingBySlotId, currentDate, statusColor, onSlotClick }: {
  slotsByDate: Record<string, TimeSlot[]>;
  bookingBySlotId: Record<string, Booking>;
  currentDate: Date;
  statusColor: (s: TimeSlot) => string;
  onSlotClick: (s: TimeSlot) => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="card p-4 overflow-x-auto">
      <div className="grid grid-cols-7 gap-2 min-w-[700px]">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const daySlots = slotsByDate[key] || [];
          const isToday = isSameDay(day, new Date());

          return (
            <div key={key} className={classNames('min-h-[400px]', isToday && 'bg-yellow-50/50 rounded-lg p-1')}>
              <div className="text-center mb-2 pb-2 border-b border-ink-100">
                <p className="text-xs text-ink-400 uppercase">{format(day, 'EEEE', { locale: bg })}</p>
                <p className={classNames('font-serif text-lg', isToday ? 'text-yellow-600' : 'text-ink-800')}>{format(day, 'd')}</p>
              </div>
              <div className="space-y-1.5">
                {daySlots.length === 0 ? (
                  <p className="text-xs text-ink-300 text-center py-4">Няма часове</p>
                ) : daySlots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => onSlotClick(slot)}
                    className={classNames('w-full text-left px-2 py-1.5 rounded text-xs', statusColor(slot))}
                  >
                    <div className="font-medium">{formatTime(slot.starts_at)}</div>
                    {slot.status === 'blocked' ? (
                      <div className="text-[10px] opacity-70">{slot.blocked_reason || 'Блокиран'}</div>
                    ) : bookingBySlotId[slot.id] ? (
                      <div className="text-[10px] opacity-70 truncate">{bookingBySlotId[slot.id].pet_name}</div>
                    ) : (
                      <div className="text-[10px] opacity-70">Свободен</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Day View
// ============================================================

function DayView({ slots, bookingBySlotId, statusColor, onSlotClick }: {
  slots: TimeSlot[];
  bookingBySlotId: Record<string, Booking>;
  statusColor: (s: TimeSlot) => string;
  onSlotClick: (s: TimeSlot) => void;
}) {
  return (
    <div className="card p-4">
      {slots.length === 0 ? (
        <div className="text-center py-12">
          <CalIcon className="w-12 h-12 text-ink-200 mx-auto mb-3" />
          <p className="text-ink-400">Няма часове за този ден</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => onSlotClick(slot)}
              className={classNames('w-full text-left p-4 rounded-xl flex items-center gap-4', statusColor(slot))}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="font-medium">{formatTime(slot.starts_at)} – {formatTime(slot.ends_at)}</span>
              </div>
              <div className="flex-1">
                {slot.status === 'blocked' ? (
                  <span className="text-sm">{slot.blocked_reason || 'Блокиран'}</span>
                ) : bookingBySlotId[slot.id] ? (
                  <span className="text-sm">{bookingBySlotId[slot.id].pet_name} · {bookingBySlotId[slot.id].reference}</span>
                ) : (
                  <span className="text-sm opacity-70">Свободен</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Create Slot Modal
// ============================================================

const WEEKDAYS: { label: string; jsDay: number }[] = [
  { label: 'Пон', jsDay: 1 },
  { label: 'Вт', jsDay: 2 },
  { label: 'Ср', jsDay: 3 },
  { label: 'Чет', jsDay: 4 },
  { label: 'Пет', jsDay: 5 },
  { label: 'Съб', jsDay: 6 },
  { label: 'Нед', jsDay: 0 },
];

function CreateSlotModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 0]));
  const [times, setTimes] = useState<string[]>(['10:00']);
  const [duration, setDuration] = useState(120);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const toggleDay = (jsDay: number) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(jsDay)) next.delete(jsDay); else next.add(jsDay);
      return next;
    });
  };

  const updateTime = (i: number, value: string) => {
    setTimes((prev) => prev.map((t, idx) => (idx === i ? value : t)));
  };
  const addTime = () => setTimes((prev) => [...prev, '10:00']);
  const removeTime = (i: number) => setTimes((prev) => prev.filter((_, idx) => idx !== i));

  // Compute every (day, time) combination within the range that matches the
  // selected weekdays. This is the same list used both for the live preview
  // count and for the actual insert, so what the admin sees is exactly what
  // gets created.
  const computedSlots = useMemo(() => {
    const out: { starts_at: Date; ends_at: Date }[] = [];
    if (!dateFrom || !dateTo || times.length === 0 || selectedDays.size === 0) return out;
    const start = startOfDay(new Date(dateFrom + 'T00:00:00'));
    const end = startOfDay(new Date(dateTo + 'T00:00:00'));
    if (end < start) return out;
    const days = eachDayOfInterval({ start, end });
    for (const day of days) {
      if (!selectedDays.has(day.getDay())) continue;
      for (const t of times) {
        if (!t) continue;
        const starts_at = new Date(format(day, 'yyyy-MM-dd') + 'T' + t);
        const ends_at = new Date(starts_at.getTime() + duration * 60000);
        out.push({ starts_at, ends_at });
      }
    }
    return out.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
  }, [dateFrom, dateTo, selectedDays, times, duration]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);

    if (computedSlots.length === 0) {
      setError('Няма нито един час, който отговаря на избраните дни/дати.');
      setSubmitting(false);
      return;
    }

    // Avoid creating duplicates of slots that already exist in this range.
    const rangeStart = computedSlots[0].starts_at;
    const rangeEnd = computedSlots[computedSlots.length - 1].starts_at;
    const { data: existing, error: fetchErr } = await supabase
      .from('time_slots')
      .select('starts_at')
      .gte('starts_at', rangeStart.toISOString())
      .lte('starts_at', rangeEnd.toISOString());

    if (fetchErr) {
      setError(fetchErr.message);
      setSubmitting(false);
      return;
    }

    const existingSet = new Set((existing || []).map((s: { starts_at: string }) => new Date(s.starts_at).getTime()));
    const toInsert = computedSlots.filter((s) => !existingSet.has(s.starts_at.getTime()));
    const skipped = computedSlots.length - toInsert.length;

    if (toInsert.length === 0) {
      setResult({ created: 0, skipped });
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from('time_slots').insert(
      toInsert.map((s) => ({ starts_at: s.starts_at.toISOString(), ends_at: s.ends_at.toISOString(), status: 'available' as const }))
    );
    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    onCreated();
    if (skipped > 0) {
      setResult({ created: toInsert.length, skipped });
      setSubmitting(false);
    } else {
      onClose();
    }
  };

  return (
    <Modal title="Нови часове" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">От дата</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label">До дата</label>
            <input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="input-field" />
          </div>
        </div>

        <div>
          <label className="label">Дни от седмицата</label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => (
              <button
                key={d.jsDay}
                type="button"
                onClick={() => toggleDay(d.jsDay)}
                className={classNames(
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                  selectedDays.has(d.jsDay) ? 'bg-yellow-400 border-yellow-400 text-ink-800' : 'bg-white border-ink-200 text-ink-500 hover:bg-ink-50'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Часове на ден</label>
          <div className="space-y-2">
            {times.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="time" value={t} onChange={(e) => updateTime(i, e.target.value)} className="input-field" />
                {times.length > 1 && (
                  <button type="button" onClick={() => removeTime(i)} className="p-2 hover:bg-ink-50 rounded-lg text-ink-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addTime} className="text-sm text-ink-600 hover:text-ink-800 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Добави час
            </button>
          </div>
        </div>

        <div>
          <label className="label">Продължителност (минути)</label>
          <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="input-field">
            <option value={60}>60 мин</option>
            <option value={90}>90 мин</option>
            <option value={120}>120 мин</option>
            <option value={180}>180 мин</option>
          </select>
        </div>

        <div className="bg-ink-50 rounded-lg px-3 py-2 text-sm text-ink-600">
          Ще бъдат създадени <strong className="text-ink-800">{computedSlots.length}</strong> часа.
        </div>

        {result && (
          <p className="text-sm text-success-600">
            Създадени: {result.created}. {result.skipped > 0 && `Пропуснати (вече съществуват): ${result.skipped}.`}
          </p>
        )}
        {error && <p className="text-sm text-error-600">{error}</p>}

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="btn-secondary">{result ? 'Затвори' : 'Отказ'}</button>
          <button onClick={handleSubmit} disabled={submitting || computedSlots.length === 0} className="btn-primary">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Създай'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Block Slot Modal — calls admin_block_slots RPC
// ============================================================

function BlockSlotModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const start = new Date(startDate + 'T' + startTime);
    const end = new Date(endDate + 'T' + endTime);

    if (end <= start) {
      setError('Крайният час трябва да бъде след началния.');
      setSubmitting(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc('admin_block_slots', {
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_reason: reason || 'Почивка',
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('existing_bookings_conflict')) {
        setError('В избрания диапазон има платени резервации. Моля, първо ги пренасочете или отменете.');
      } else {
        setError(msg);
      }
      setSubmitting(false);
      return;
    }

    onCreated();
    onClose();
  };

  return (
    <Modal title="Блокирай диапазон" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Начална дата</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label">Крайна дата</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">От час</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label">До час</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-field" />
          </div>
        </div>
        <div>
          <label className="label">Причина</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Почивка, празник, частно събитие..." className="input-field" />
        </div>
        <p className="text-xs text-ink-500">Можете да блокирате един час или цели дни — просто изберете диапазон.</p>
        {error && (
          <div className="p-3 rounded-xl bg-error-50 border border-error-100 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-error-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="btn-secondary">Отказ</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Блокирай'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Manual Booking Modal — calls admin_create_booking RPC
// ============================================================

function ManualBookingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [pkgSlug, setPkgSlug] = useState('');
  const [slotId, setSlotId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState<'dog' | 'cat' | 'other'>('dog');
  const [petBreed, setPetBreed] = useState('');
  const [numPets, setNumPets] = useState(1);
  const [note, setNote] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('deposit_paid');
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ reference: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [pkgRes, slotRes] = await Promise.all([
        supabase.from('packages').select('*').eq('active', true).order('sort_order'),
        supabase.from('time_slots').select('*').eq('status', 'available').gt('starts_at', new Date().toISOString()).order('starts_at'),
      ]);
      if (pkgRes.data) setPackages(pkgRes.data as Package[]);
      if (slotRes.data) setSlots(slotRes.data as TimeSlot[]);
    })();
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (!pkgSlug || !slotId || !fullName || !email || !petName) {
      setError('Моля, попълнете всички задължителни полета.');
      setSubmitting(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc('admin_create_booking', {
      p_slot_id: slotId,
      p_package_slug: pkgSlug,
      p_full_name: fullName,
      p_email: email,
      p_phone: phone,
      p_pet_name: petName,
      p_pet_species: petSpecies,
      p_pet_breed: petBreed,
      p_num_pets: numPets,
      p_note: note,
      p_payment_status: paymentStatus,
      p_admin_note: adminNote,
    }).single();

    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(false);
      return;
    }

    const result = data as { booking_id: string; reference: string };
    setSuccess({ reference: result.reference });

    // Manual bookings never go through Stripe/the booking wizard, so no
    // confirmation email was ever sent for them — fire it now, the same
    // way the online booking wizard does for instant-confirm bookings.
    fetch(`${supabaseUrl}/functions/v1/send-confirmation-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey },
      body: JSON.stringify({ booking_reference: result.reference }),
    }).catch((e) => console.error('[send-confirmation-email] failed:', e));

    setSubmitting(false);
    onCreated();
  };

  if (success) {
    return (
      <Modal title="Резервацията е създадена" onClose={onClose}>
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-50 mb-4">
            <CalIcon className="w-8 h-8 text-success-600" />
          </div>
          <p className="font-serif text-xl text-ink-800 mb-2">Готово!</p>
          <p className="text-sm text-ink-500 mb-4">Резервацията е създадена успешно.</p>
          <p className="font-mono text-lg text-ink-800 mb-6">{success.reference}</p>
          <button onClick={onClose} className="btn-primary">Затвори</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Нова резервация (телефон/на място)" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Пакет *</label>
          <select value={pkgSlug} onChange={(e) => setPkgSlug(e.target.value)} className="input-field">
            <option value="">Изберете пакет...</option>
            {packages.map((p) => <option key={p.slug} value={p.slug}>{p.name_bg} — {formatEUR(p.price_eur)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Час *</label>
          <select value={slotId} onChange={(e) => setSlotId(e.target.value)} className="input-field">
            <option value="">Изберете час...</option>
            {slots.map((s) => <option key={s.id} value={s.id}>{format(parseISO(s.starts_at), 'd MMM yyyy, HH:mm', { locale: bg })}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Име на клиент *</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" /></div>
          <div><label className="label">Телефон</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" /></div>
        </div>
        <div><label className="label">Имейл *</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Име на любимец *</label><input type="text" value={petName} onChange={(e) => setPetName(e.target.value)} className="input-field" /></div>
          <div>
            <label className="label">Вид</label>
            <select value={petSpecies} onChange={(e) => setPetSpecies(e.target.value as 'dog' | 'cat' | 'other')} className="input-field">
              <option value="dog">Куче</option>
              <option value="cat">Котка</option>
              <option value="other">Друго</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Порода</label><input type="text" value={petBreed} onChange={(e) => setPetBreed(e.target.value)} className="input-field" /></div>
          <div><label className="label">Брой любимци</label><input type="number" min={1} value={numPets} onChange={(e) => setNumPets(parseInt(e.target.value) || 1)} className="input-field" /></div>
        </div>
        <div>
          <label className="label">Статус на плащане</label>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="input-field">
            <option value="deposit_pending">Чака плащане</option>
            <option value="deposit_paid">Капаро платено</option>
            <option value="paid_full">Платено изцяло</option>
            <option value="deposit_waived">Без капаро (доверен клиент)</option>
          </select>
        </div>
        <div><label className="label">Бележка</label><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input-field resize-none" /></div>
        <div><label className="label">Админ бележка</label><textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2} className="input-field resize-none" /></div>
        {error && <p className="text-sm text-error-600">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="btn-secondary">Отказ</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Създай резервация'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Slot Detail Modal — with unblock, reschedule, cancel
// ============================================================

function SlotDetailModal({ slot, booking, onClose, onUpdated }: { slot: TimeSlot; booking?: Booking; onClose: () => void; onUpdated: () => void }) {
  const [action, setAction] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [newSlotId, setNewSlotId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (newStatus: 'confirmed' | 'completed' | 'no_show' | 'cancelled') => {
    setSubmitting(true);
    setError(null);
    if (booking) {
      const update: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'cancelled') update.admin_note = cancelReason;
      const { error: updateErr } = await supabase.from('bookings').update(update).eq('id', booking.id);
      if (updateErr) {
        console.error('[SlotDetailModal] update bookings failed:', updateErr);
        setError(updateErr.message);
        setSubmitting(false);
        return;
      }
    }
    if (newStatus === 'cancelled' && slot.status === 'booked') {
      const { error: slotErr } = await supabase.from('time_slots').update({ status: 'available' }).eq('id', slot.id);
      if (slotErr) {
        console.error('[SlotDetailModal] update time_slots failed:', slotErr);
        setError(slotErr.message);
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(false);
    onUpdated();
    onClose();
  };

  const handleDeleteSlot = async () => {
    setSubmitting(true);
    await supabase.from('time_slots').delete().eq('id', slot.id);
    setSubmitting(false);
    onUpdated();
    onClose();
  };

  const handleUnblock = async () => {
    setSubmitting(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('admin_unblock_slot', { p_slot_id: slot.id });
    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onUpdated();
    onClose();
  };

  const loadAvailableSlots = async () => {
    const { data } = await supabase.from('time_slots').select('*').eq('status', 'available').gt('starts_at', new Date().toISOString()).order('starts_at');
    setAvailableSlots(data as TimeSlot[] || []);
  };

  const handleReschedule = async () => {
    if (!booking || !newSlotId) return;
    setSubmitting(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('admin_reschedule_booking', {
      p_booking_id: booking.id,
      p_new_slot_id: newSlotId,
    });
    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onUpdated();
    onClose();
  };

  return (
    <Modal title="Детайли на часа" onClose={onClose}>
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-cream-50">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="font-medium text-ink-800">{format(parseISO(slot.starts_at), 'd MMMM yyyy, HH:mm', { locale: bg })}</span>
          </div>
          <p className="text-sm text-ink-500">{formatTime(slot.starts_at)} – {formatTime(slot.ends_at)}</p>
          <p className="text-sm text-ink-500 mt-1">Статус: <span className="font-medium">{slot.status === 'available' ? 'Свободен' : slot.status === 'blocked' ? 'Блокиран' : 'Резервиран'}</span></p>
          {slot.status === 'blocked' && slot.blocked_reason && (
            <p className="text-sm text-ink-500 mt-1">Причина: {slot.blocked_reason}</p>
          )}
        </div>

        {booking && (
          <div className="p-4 rounded-xl bg-white border border-ink-100">
            <h4 className="font-serif text-lg text-ink-800 mb-3">Резервация</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-ink-400 text-xs">Референция</p><p className="font-mono text-ink-800">{booking.reference}</p></div>
              <div><p className="text-ink-400 text-xs">Пакет</p><p className="text-ink-800">{booking.package_slug}</p></div>
              <div><p className="text-ink-400 text-xs">Любимец</p><p className="text-ink-800">{booking.pet_name} ({booking.num_pets})</p></div>
              <div><p className="text-ink-400 text-xs">Сума</p><p className="text-ink-800">{formatEUR(booking.amount_due_eur)}</p></div>
              <div><p className="text-ink-400 text-xs">Плащане</p><p className="text-ink-800">{booking.payment_status}</p></div>
              <div><p className="text-ink-400 text-xs">Статус</p><p className="text-ink-800">{booking.status}</p></div>
            </div>
            {booking.note && <p className="text-sm text-ink-600 mt-3 pt-3 border-t border-ink-100"><strong>Бележка:</strong> {booking.note}</p>}
          </div>
        )}

        {booking && (booking.status === 'pending' || booking.status === 'confirmed') && (
          <button onClick={() => { setAction('reschedule'); loadAvailableSlots(); }} disabled={submitting} className="btn-secondary text-sm w-full">
            <CalendarClock className="w-4 h-4" />
            Пренасочи
          </button>
        )}

        {action === 'reschedule' && (
          <div className="animate-fade-in space-y-2">
            <label className="label">Нов час</label>
            <select value={newSlotId} onChange={(e) => setNewSlotId(e.target.value)} className="input-field">
              <option value="">Изберете нов час...</option>
              {availableSlots.map((s) => <option key={s.id} value={s.id}>{format(parseISO(s.starts_at), 'd MMM yyyy, HH:mm', { locale: bg })}</option>)}
            </select>
            <button onClick={handleReschedule} disabled={submitting || !newSlotId} className="btn-primary text-sm w-full">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Потвърди пренасочване'}
            </button>
          </div>
        )}

        {booking && booking.status === 'pending' && (
          <div className="flex gap-2">
            <button onClick={() => handleAction('confirmed')} disabled={submitting} className="btn-primary text-sm flex-1">Потвърди</button>
            <button onClick={() => setAction('cancel')} disabled={submitting} className="btn-secondary text-sm flex-1">Откажи</button>
          </div>
        )}
        {booking && booking.status === 'confirmed' && (
          <div className="flex gap-2">
            <button onClick={() => handleAction('completed')} disabled={submitting} className="btn-primary text-sm flex-1">Завърши</button>
            <button onClick={() => setAction('noshow')} disabled={submitting} className="btn-secondary text-sm flex-1">Не се яви</button>
            <button onClick={() => setAction('cancel')} disabled={submitting} className="btn-secondary text-sm flex-1">Откажи</button>
          </div>
        )}

        {action === 'cancel' && (
          <div className="animate-fade-in">
            <label className="label">Причина за отменяне</label>
            <input type="text" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Клиент отмени, конфликт в графика..." className="input-field" />
            <button onClick={() => handleAction('cancelled')} disabled={submitting} className="btn-primary text-sm w-full mt-2">Потвърди отменяне</button>
          </div>
        )}
        {action === 'noshow' && (
          <button onClick={() => handleAction('no_show')} disabled={submitting} className="btn-primary text-sm w-full">Потвърди — не се яви</button>
        )}

        {slot.status === 'blocked' && (
          <button onClick={handleUnblock} disabled={submitting} className="btn-secondary text-sm w-full">
            <Unlock className="w-4 h-4" />
            Отблокирай
          </button>
        )}

        {slot.status === 'available' && !booking && (
          <button onClick={handleDeleteSlot} disabled={submitting} className="btn-secondary text-sm w-full text-error-600 border-error-200 hover:bg-error-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Изтрий час'}
          </button>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-error-50 border border-error-100 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-error-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ============================================================
// Modal wrapper
// ============================================================

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink-800/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-elevated max-w-lg w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl text-ink-800">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-ink-50 rounded-lg"><X className="w-5 h-5 text-ink-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
