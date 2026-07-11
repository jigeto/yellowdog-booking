import { useEffect, useState } from 'react';
import { supabase, type Package } from '../../lib/supabase';
import { classNames, formatEUR } from '../../lib/utils';
import { Plus, X, Loader2, Camera, Star, Eye, EyeOff, Pencil } from 'lucide-react';

export function AdminPackages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Package | 'new' | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('packages').select('*').order('sort_order');
    setPackages((data as Package[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (pkg: Package) => {
    await supabase.from('packages').update({ active: !pkg.active }).eq('id', pkg.id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-ink-800">Пакети</h1>
          <p className="text-ink-400 mt-1">{packages.length} пакета</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Нов пакет
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-ink-100 text-xs text-ink-400 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Пакет</th>
                <th className="px-4 py-3 font-medium">Цена</th>
                <th className="px-4 py-3 font-medium">Кадри</th>
                <th className="px-4 py-3 font-medium">Времетраене</th>
                <th className="px-4 py-3 font-medium">Албум</th>
                <th className="px-4 py-3 font-medium">Най-популярен</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className={classNames('border-b border-ink-50', !pkg.active && 'opacity-50')}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-800">{pkg.name_bg}</div>
                    <div className="text-xs text-ink-400 font-mono">{pkg.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-600">{formatEUR(pkg.price_eur)}</td>
                  <td className="px-4 py-3 text-sm text-ink-600">{pkg.photo_count}</td>
                  <td className="px-4 py-3 text-sm text-ink-600">{pkg.duration_minutes} мин</td>
                  <td className="px-4 py-3 text-sm text-ink-600">{pkg.includes_album ? 'Да' : '—'}</td>
                  <td className="px-4 py-3">
                    {pkg.featured && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                  </td>
                  <td className="px-4 py-3">
                    <span className={classNames('px-2.5 py-1 rounded-full text-xs font-medium', pkg.active ? 'bg-success-100 text-success-700' : 'bg-ink-100 text-ink-500')}>
                      {pkg.active ? 'Активен' : 'Скрит'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => toggleActive(pkg)} className="p-1.5 hover:bg-ink-50 rounded-lg text-ink-400" title={pkg.active ? 'Скрий' : 'Покажи'}>
                        {pkg.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setEditing(pkg)} className="p-1.5 hover:bg-ink-50 rounded-lg text-ink-400" title="Редактирай">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-ink-400">
                    <Camera className="w-8 h-8 mx-auto mb-2 text-ink-200" />
                    Няма пакети още.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PackageModal
          pkg={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
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

function PackageModal({ pkg, onClose, onSaved }: { pkg: Package | null; onClose: () => void; onSaved: () => void }) {
  const [slug, setSlug] = useState(pkg?.slug || '');
  const [nameBg, setNameBg] = useState(pkg?.name_bg || '');
  const [descriptionBg, setDescriptionBg] = useState(pkg?.description_bg || '');
  const [priceEur, setPriceEur] = useState(pkg?.price_eur?.toString() || '');
  const [photoCount, setPhotoCount] = useState(pkg?.photo_count?.toString() || '10');
  const [durationMinutes, setDurationMinutes] = useState(pkg?.duration_minutes?.toString() || '120');
  const [includesAlbum, setIncludesAlbum] = useState(pkg?.includes_album || false);
  const [featured, setFeatured] = useState(pkg?.featured || false);
  const [active, setActive] = useState(pkg?.active ?? true);
  const [sortOrder, setSortOrder] = useState(pkg?.sort_order?.toString() || '0');
  const [featuresText, setFeaturesText] = useState((pkg?.features || []).join('\n'));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugify = (s: string) =>
    s.toLowerCase().trim()
      .replace(/[^a-z0-9а-яё\s-]/gi, '')
      .replace(/\s+/g, '-');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const payload = {
      slug: slug.trim() || slugify(nameBg),
      name_bg: nameBg.trim(),
      description_bg: descriptionBg.trim() || null,
      price_eur: parseFloat(priceEur) || 0,
      photo_count: parseInt(photoCount) || 0,
      duration_minutes: parseInt(durationMinutes) || 120,
      includes_album: includesAlbum,
      featured,
      active,
      sort_order: parseInt(sortOrder) || 0,
      features: featuresText.split('\n').map((f) => f.trim()).filter(Boolean),
    };

    if (!payload.name_bg) {
      setError('Името е задължително.');
      setSubmitting(false);
      return;
    }

    const { error: dbError } = pkg
      ? await supabase.from('packages').update(payload).eq('id', pkg.id)
      : await supabase.from('packages').insert(payload);

    if (dbError) {
      setError(dbError.message);
      setSubmitting(false);
      return;
    }

    onSaved();
  };

  return (
    <Modal title={pkg ? 'Редакция на пакет' : 'Нов пакет'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Име (напр. „Коледна фотосесия")</label>
          <input value={nameBg} onChange={(e) => setNameBg(e.target.value)} className="input-field" placeholder="ART" />
        </div>

        <div>
          <label className="label">Slug (код в системата, автоматично ако е празно)</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="input-field font-mono text-sm" placeholder={slugify(nameBg) || 'koledna-fotosesia'} />
        </div>

        <div>
          <label className="label">Описание</label>
          <textarea value={descriptionBg} onChange={(e) => setDescriptionBg(e.target.value)} className="input-field" rows={2} placeholder="Кратко описание, показва се на клиента" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Цена (€)</label>
            <input type="number" value={priceEur} onChange={(e) => setPriceEur(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label">Брой кадри</label>
            <input type="number" value={photoCount} onChange={(e) => setPhotoCount(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label">Минути</label>
            <input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className="input-field" />
          </div>
        </div>

        <div>
          <label className="label">Предимства (по едно на ред, показват се като списък)</label>
          <textarea value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} className="input-field font-mono text-sm" rows={4} placeholder={'20 обработени кадъра\nДигитален албум\n...'} />
        </div>

        <div>
          <label className="label">Ред на показване (по-малко число = по-напред)</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="input-field w-32" />
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includesAlbum} onChange={(e) => setIncludesAlbum(e.target.checked)} className="w-4 h-4 rounded border-ink-300 text-yellow-400" />
            <span className="text-sm text-ink-700">Включва албум</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="w-4 h-4 rounded border-ink-300 text-yellow-400" />
            <span className="text-sm text-ink-700">Маркирай като „Най-популярен"</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 rounded border-ink-300 text-yellow-400" />
            <span className="text-sm text-ink-700">Активен (виждат го клиентите)</span>
          </label>
        </div>

        {error && <p className="text-sm text-error-600">{error}</p>}

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="btn-secondary">Отказ</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Запази'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
