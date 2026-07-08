import { useEffect, useState, useMemo } from 'react';
import { supabase, type TimeSlot } from '../../lib/supabase';
import { classNames, formatTime } from '../../lib/utils';
import { Plus, Ban, X, Loader2, Trash2, CalendarPlus, Clock } from 'lucide-react';
import { parseISO } from 'date-fns';
import { bg } from 'date-fns/locale';
import { format } from 'date-fns';

export function AdminSlots() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showBlock, setShowBlock] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('time_slots').select('*').order('starts_at');
    setSlots(data as TimeSlot[] || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const slotsByDate = useMemo(() => {
    const map: Record<string, TimeSlot[]> = {};
    slots.forEach((s) => {
      const key = format(parseISO(s.starts_at), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [slots]);

  const sortedDates = useMemo(() => Object.keys(slotsByDate).sort(), [slotsByDate]);

  const handleDelete = async (id: string) => {
    await supabase.from('time_slots').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink-800">Часове</h1>
          <p className="text-sm text-ink-500">{slots.length} часа · {sortedDates.length} дни</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)} className="btn-secondary text-sm">
            <CalendarPlus className="w-4 h-4" />
            Създай седмица
          </button>
          <button onClick={() => setShowBlock(true)} className="btn-secondary text-sm">
            <Ban className="w-4 h-4" />
            Блокирай
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            Нов час
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-yellow-400 animate-spin" /></div>
      ) : sortedDates.length === 0 ? (
        <div className="card p-12 text-center">
          <Clock className="w-12 h-12 text-ink-200 mx-auto mb-3" />
          <p className="text-ink-400 mb-4">Няма създадени часове</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Създай първия час
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDates.map((dateKey) => {
            const daySlots = slotsByDate[dateKey];
            const date = parseISO(dateKey);
            return (
              <div key={dateKey} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-serif text-lg text-ink-800 capitalize">{format(date, 'EEEE, d MMMM yyyy', { locale: bg })}</h3>
                  <span className="text-sm text-ink-400">{daySlots.length} часа</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={classNames(
                        'p-3 rounded-xl border text-sm',
                        slot.status === 'available' && 'bg-yellow-50 border-yellow-200 text-ink-700',
                        slot.status === 'booked' && 'bg-success-50 border-success-200 text-ink-700',
                        slot.status === 'blocked' && 'bg-ink-100 border-ink-200 text-ink-500'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{formatTime(slot.starts_at)}</span>
                        {slot.status === 'available' && (
                          <button onClick={() => handleDelete(slot.id)} className="text-ink-300 hover:text-error-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-ink-500">
                        {slot.status === 'available' && 'Свободен'}
                        {slot.status === 'booked' && 'Резервиран'}
                        {slot.status === 'blocked' && (slot.block_reason || 'Блокиран')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateSlotModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {showBulk && <BulkCreateModal onClose={() => setShowBulk(false)} onCreated={load} />}
      {showBlock && <BlockModal onClose={() => setShowBlock(false)} onCreated={load} />}
    </div>
  );
}

function CreateSlotModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('10:00');
  const [duration, setDuration] = useState(120);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const start = new Date(date + 'T' + startTime);
    const end = new Date(start.getTime() + duration * 60000);
    const { error: e } = await supabase.from('time_slots').insert({ starts_at: start.toISOString(), ends_at: end.toISOString(), status: 'available' });
    if (e) { setError(e.message); setSubmitting(false); return; }
    onCreated(); onClose();
  };

  return (
    <Modal title="Нов час" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Дата</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" /></div>
          <div><label className="label">Час</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-field" /></div>
        </div>
        <div>
          <label className="label">Продължителност</label>
          <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="input-field">
            <option value={60}>60 мин</option>
            <option value={90}>90 мин</option>
            <option value={120}>120 мин</option>
            <option value={180}>180 мин</option>
          </select>
        </div>
        {error && <p className="text-sm text-error-600">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="btn-secondary">Отказ</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Създай'}</button>
        </div>
      </div>
    </Modal>
  );
}

function BulkCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [days, setDays] = useState<number[]>([5, 6]); // Fri=5, Sat=6
  const [hours, setHours] = useState<number[]>([10, 12, 14]);
  const [duration, setDuration] = useState(120);
  const [numWeeks, setNumWeeks] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayNames = ['Пон', 'Вто', 'Сря', 'Чет', 'Пет', 'Съб', 'Нед'];
  const hourOptions = [9, 10, 11, 12, 13, 14, 15, 16, 17];

  const toggleDay = (d: number) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const toggleHour = (h: number) => setHours(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const slots: { starts_at: string; ends_at: string; status: 'available' }[] = [];
    const base = new Date(startDate + 'T00:00');

    for (let w = 0; w < numWeeks; w++) {
      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(base.getTime() + (w * 7 + d) * 86400000);
        const dayOfWeek = (dayDate.getDay() + 6) % 7; // Monday=0
        if (!days.includes(dayOfWeek)) continue;
        for (const h of hours) {
          const start = new Date(dayDate);
          start.setHours(h, 0, 0, 0);
          const end = new Date(start.getTime() + duration * 60000);
          slots.push({ starts_at: start.toISOString(), ends_at: end.toISOString(), status: 'available' });
        }
      }
    }

    if (slots.length === 0) {
      setError('Моля, изберете поне един ден и час.');
      setSubmitting(false);
      return;
    }

    const { error: e } = await supabase.from('time_slots').insert(slots);
    if (e) { setError(e.message); setSubmitting(false); return; }
    onCreated(); onClose();
  };

  return (
    <Modal title="Създай седмица" onClose={onClose}>
      <div className="space-y-4">
        <div><label className="label">Начална дата</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" /></div>
        <div>
          <label className="label">Дни от седмицата</label>
          <div className="flex gap-1">
            {dayNames.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)} className={classNames('flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all', days.includes(i) ? 'border-yellow-400 bg-yellow-50 text-ink-800' : 'border-ink-100 text-ink-400')}>{d}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Часове</label>
          <div className="grid grid-cols-5 gap-1">
            {hourOptions.map((h) => (
              <button key={h} onClick={() => toggleHour(h)} className={classNames('py-2 rounded-lg text-sm font-medium border-2 transition-all', hours.includes(h) ? 'border-yellow-400 bg-yellow-50 text-ink-800' : 'border-ink-100 text-ink-400')}>{h}:00</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Продължителност</label>
            <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="input-field">
              <option value={60}>60 мин</option>
              <option value={90}>90 мин</option>
              <option value={120}>120 мин</option>
              <option value={180}>180 мин</option>
            </select>
          </div>
          <div>
            <label className="label">Брой седмици</label>
            <input type="number" min={1} max={52} value={numWeeks} onChange={(e) => setNumWeeks(parseInt(e.target.value) || 1)} className="input-field" />
          </div>
        </div>
        <p className="text-sm text-ink-500">Ще се създадат ~{days.length * hours.length * numWeeks} часа</p>
        {error && <p className="text-sm text-error-600">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="btn-secondary">Отказ</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Създай'}</button>
        </div>
      </div>
    </Modal>
  );
}

function BlockModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const start = new Date(date + 'T' + startTime);
    const end = new Date(date + 'T' + endTime);

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
    onCreated(); onClose();
  };

  return (
    <Modal title="Блокирай час" onClose={onClose}>
      <div className="space-y-4">
        <div><label className="label">Дата</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">От</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-field" /></div>
          <div><label className="label">До</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-field" /></div>
        </div>
        <div><label className="label">Причина</label><input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Почивка, празник..." className="input-field" /></div>
        {error && <p className="text-sm text-error-600">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="btn-secondary">Отказ</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Блокирай'}</button>
        </div>
      </div>
    </Modal>
  );
}

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
