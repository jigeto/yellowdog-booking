import { useEffect, useState, useMemo } from 'react';
import { supabase, type Customer, type Booking, type Pet } from '../../lib/supabase';
import { formatEUR, formatDate, formatDateTime } from '../../lib/utils';
import { Search, Loader2, X, Mail, Phone, PawPrint, BookOpen, ChevronLeft } from 'lucide-react';

type CustomerWithStats = Customer & {
  booking_count: number;
  total_spent: number;
  last_session: string | null;
};

export function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CustomerWithStats | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (!data) { setLoading(false); return; }

    const customersData = data as Customer[];
    const enriched: CustomerWithStats[] = await Promise.all(
      customersData.map(async (c) => {
        const { data: bookings } = await supabase.from('bookings').select('amount_paid_eur, created_at, status').eq('customer_id', c.id);
        const totalSpent = (bookings || []).reduce((sum, b) => sum + (b.amount_paid_eur || 0), 0);
        const lastSession = bookings && bookings.length > 0 ? bookings[0].created_at : null;
        return {
          ...c,
          booking_count: bookings?.length || 0,
          total_spent: totalSpent,
          last_session: lastSession,
        };
      })
    );
    setCustomers(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const s = search.toLowerCase();
    return customers.filter(c => c.full_name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || (c.phone?.includes(s) ?? false));
  }, [customers, search]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-ink-800">Клиенти</h1>
        <p className="text-sm text-ink-500">{filtered.length} клиента</p>
      </div>

      <div className="card p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Търси по име, имейл, телефон..." className="input-field pl-10" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-yellow-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-ink-400">Няма клиенти</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs text-ink-400 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Име</th>
                <th className="px-4 py-3 font-medium">Имейл</th>
                <th className="px-4 py-3 font-medium">Телефон</th>
                <th className="px-4 py-3 font-medium">Сесии</th>
                <th className="px-4 py-3 font-medium">Общо похарчено</th>
                <th className="px-4 py-3 font-medium">Последна сесия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-ink-50 hover:bg-cream-50 transition-colors cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="px-4 py-3 text-sm font-medium text-ink-800">{c.full_name}</td>
                  <td className="px-4 py-3 text-sm text-ink-600">{c.email}</td>
                  <td className="px-4 py-3 text-sm text-ink-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-ink-600">{c.booking_count}</td>
                  <td className="px-4 py-3 text-sm font-medium text-ink-800">{formatEUR(c.total_spent)}</td>
                  <td className="px-4 py-3 text-sm text-ink-600">{c.last_session ? formatDate(c.last_session, 'd MMM yyyy') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <CustomerDetailModal customer={selected} onClose={() => setSelected(null)} onUpdated={load} />}
    </div>
  );
}

function CustomerDetailModal({ customer, onClose, onUpdated }: { customer: CustomerWithStats; onClose: () => void; onUpdated: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [adminNotes, setAdminNotes] = useState(customer.admin_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [bRes, pRes] = await Promise.all([
        supabase.from('bookings').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
        supabase.from('pets').select('*').eq('customer_id', customer.id),
      ]);
      setBookings(bRes.data as Booking[] || []);
      setPets(pRes.data as Pet[] || []);
      setLoading(false);
    })();
  }, [customer.id]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await supabase.from('customers').update({ admin_notes: adminNotes }).eq('id', customer.id);
    setSavingNotes(false);
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink-800/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-elevated max-w-2xl w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1 hover:bg-ink-50 rounded-lg"><ChevronLeft className="w-5 h-5 text-ink-400" /></button>
            <h3 className="font-serif text-xl text-ink-800">{customer.full_name}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-ink-50 rounded-lg"><X className="w-5 h-5 text-ink-400" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 text-yellow-400 animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-cream-50 flex items-center gap-2">
                <Mail className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-ink-700">{customer.email}</span>
              </div>
              <div className="p-3 rounded-xl bg-cream-50 flex items-center gap-2">
                <Phone className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-ink-700">{customer.phone || '—'}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-yellow-50 text-center">
                <p className="font-serif text-2xl text-ink-800">{customer.booking_count}</p>
                <p className="text-xs text-ink-500">Сесии</p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-50 text-center">
                <p className="font-serif text-2xl text-ink-800">{formatEUR(customer.total_spent)}</p>
                <p className="text-xs text-ink-500">Общо</p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-50 text-center">
                <p className="font-serif text-2xl text-ink-800">{pets.length}</p>
                <p className="text-xs text-ink-500">Любимци</p>
              </div>
            </div>

            {/* Pets */}
            {pets.length > 0 && (
              <div>
                <h4 className="font-serif text-lg text-ink-800 mb-2 flex items-center gap-2"><PawPrint className="w-4 h-4 text-yellow-600" /> Любимци</h4>
                <div className="space-y-2">
                  {pets.map((p) => (
                    <div key={p.id} className="p-3 rounded-xl bg-cream-50 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-ink-800">{p.name}</p>
                        <p className="text-sm text-ink-500">{p.species} {p.breed && `· ${p.breed}`}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bookings */}
            {bookings.length > 0 && (
              <div>
                <h4 className="font-serif text-lg text-ink-800 mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4 text-yellow-600" /> Резервации</h4>
                <div className="space-y-2">
                  {bookings.map((b) => (
                    <div key={b.id} className="p-3 rounded-xl bg-cream-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-sm text-ink-800">{b.reference}</span>
                        <span className="text-sm font-medium text-ink-800">{formatEUR(b.amount_paid_eur)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-ink-500">
                        <span>{b.package_slug} · {b.status}</span>
                        <span>{formatDateTime(b.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin notes */}
            <div>
              <label className="label">Администраторски бележки</label>
              <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3} placeholder="Вътрешни бележки за клиента..." className="input-field resize-none" />
              <button onClick={handleSaveNotes} disabled={savingNotes} className="btn-secondary text-sm mt-2">
                {savingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Запази бележките'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
