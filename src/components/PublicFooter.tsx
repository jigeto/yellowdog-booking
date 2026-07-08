import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';
import { Phone, Mail, MapPin, Instagram, Facebook } from 'lucide-react';

export function PublicFooter() {
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('settings').select('key, value');
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
        setSettings(map);
      }
    })();
  }, []);

  return (
    <footer className="bg-ink-800 text-ink-100 mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="mb-4">
              <img
                src="https://yellowdog.bg/wp-content/uploads/2023/02/Logo_Yellow_Dog.png"
                alt="Студио Жълто куче"
                className="h-12 w-auto object-contain"
              />
            </div>
            <p className="text-sm text-ink-300 max-w-xs">
              Първото професионално студио за фотосесия на домашни любимци в България.
              Създаваме спомени, които остават завинаги.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Контакт</h4>
            <ul className="space-y-3 text-sm">
              {settings.studio_phone && (
                <li className="flex items-center gap-2 text-ink-300">
                  <Phone className="w-4 h-4 text-yellow-400" />
                  <a href={`tel:${settings.studio_phone}`} className="hover:text-white transition-colors">{settings.studio_phone}</a>
                </li>
              )}
              {settings.studio_email && (
                <li className="flex items-center gap-2 text-ink-300">
                  <Mail className="w-4 h-4 text-yellow-400" />
                  <a href={`mailto:${settings.studio_email}`} className="hover:text-white transition-colors">{settings.studio_email}</a>
                </li>
              )}
              {settings.studio_address && (
                <li className="flex items-center gap-2 text-ink-300">
                  <MapPin className="w-4 h-4 text-yellow-400" />
                  {settings.studio_address}
                </li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Следвайте ни</h4>
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 rounded-lg bg-ink-700 flex items-center justify-center hover:bg-yellow-400 hover:text-ink-800 transition-all" aria-label="Instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-ink-700 flex items-center justify-center hover:bg-yellow-400 hover:text-ink-800 transition-all" aria-label="Facebook">
                <Facebook className="w-5 h-5" />
              </a>
            </div>
            <p className="text-xs text-ink-400 mt-4">
              © {new Date().getFullYear()} Студио Жълто куче. Всички права запазени.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
