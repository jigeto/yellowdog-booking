import { Routes, Route } from 'react-router-dom';
import { BookingWizard } from './pages/BookingWizard';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { VoucherPage } from './pages/VoucherPage';
import { VoucherThankYou } from './pages/VoucherThankYou';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminCalendar } from './pages/admin/AdminCalendar';
import { AdminBookings } from './pages/admin/AdminBookings';
import { AdminSlots } from './pages/admin/AdminSlots';
import { AdminVouchers } from './pages/admin/AdminVouchers';
import { AdminCustomers } from './pages/admin/AdminCustomers';
import { AdminFinances } from './pages/admin/AdminFinances';
import { PublicHeader } from './components/PublicHeader';
import { PublicFooter } from './components/PublicFooter';
import { useLocation } from 'react-router-dom';

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}

function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  if (isAdmin) {
    return (
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminCalendar />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="slots" element={<AdminSlots />} />
          <Route path="vouchers" element={<AdminVouchers />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="finances" element={<AdminFinances />} />
        </Route>
      </Routes>
    );
  }

  return (
    <PublicShell>
      <Routes>
        <Route path="/" element={<BookingWizard />} />
        <Route path="/booking/:reference/confirmation" element={<ConfirmationPage />} />
        <Route path="/voucher" element={<VoucherPage />} />
        <Route path="/voucher/thank-you" element={<VoucherThankYou />} />
      </Routes>
    </PublicShell>
  );
}

export default App;
