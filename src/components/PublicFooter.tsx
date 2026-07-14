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

  const phone = settings.studio_phone || '+359 876 822 686';
  const email = settings.studio_email || 'office@yellowdog.bg';
  const address = settings.studio_address || 'София, бул. „Владимир Вазов" 90, вх. Б, ет. 2';

  return (
    <footer className="bg-ink-800 text-ink-100 mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="mb-4">
              <a href="https://yellowdog.bg" target="_blank" rel="noopener noreferrer">
                <img
                  src="https://yellowdog.bg/wp-content/uploads/2023/02/Logo_Yellow_Dog.png"
                  alt="Студио Жълто куче"
                  className="h-12 w-auto object-contain"
                />
              </a>
            </div>
            <p className="text-sm text-ink-300 max-w-xs">
              Първото професионално студио за фотосесия на домашни любимци в България.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Контакт</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2 text-ink-300">
                <Phone className="w-4 h-4 text-yellow-400" />
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-white transition-colors">{phone}</a>
              </li>
              <li className="flex items-center gap-2 text-ink-300">
                <Mail className="w-4 h-4 text-yellow-400" />
                <a href={`mailto:${email}`} className="hover:text-white transition-colors">{email}</a>
              </li>
              <li className="flex items-center gap-2 text-ink-300">
                <MapPin className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                {address}
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Следвайте ни</h4>
            <div className="flex gap-3">
              <a href="https://www.instagram.com/studio_yellow_dog/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-ink-700 flex items-center justify-center hover:bg-yellow-400 hover:text-ink-800 transition-all" aria-label="Instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://www.facebook.com/StudioYellowDog" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-ink-700 flex items-center justify-center hover:bg-yellow-400 hover:text-ink-800 transition-all" aria-label="Facebook">
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
