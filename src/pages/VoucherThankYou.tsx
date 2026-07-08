import { Link } from 'react-router-dom';
import { CheckCircle, Gift, Mail, ArrowRight, Sparkles } from 'lucide-react';

export function VoucherThankYou() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success-50 border-2 border-success-100 mb-6 animate-scale-in">
        <CheckCircle className="w-10 h-10 text-success-600" />
      </div>
      <h1 className="font-serif text-3xl sm:text-4xl text-ink-800 mb-3 animate-fade-in">
        Благодарим за покупката!
      </h1>
      <p className="text-ink-500 text-lg mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        Вашият подаръчен ваучер е готов и е изпратен по имейл. Очаквайте го в пощата си всеки момент.
      </p>

      <div className="card p-6 mb-8 text-left animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-start gap-3 mb-4">
          <Mail className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-ink-800">Изпратен имейл</p>
            <p className="text-sm text-ink-500">Ваучерът е изпратен на посочения имейл с кода и инструкциите.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 mb-4">
          <Gift className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-ink-800">Как се използва</p>
            <p className="text-sm text-ink-500">При резервация въведете кода на ваучера в стъпка „Плащане". Сумата ще бъде извадена автоматично.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-ink-800">Валидност</p>
            <p className="text-sm text-ink-500">Ваучерът е валиден 6 месеца от датата на покупка.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/" className="btn-primary">
          Резервирай фотосесия
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link to="/voucher" className="btn-secondary">
          Купи още ваучер
        </Link>
      </div>
    </div>
  );
}
