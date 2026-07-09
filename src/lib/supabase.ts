import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://ugzrzjxqkkkazloltazt.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnenJ6anhxa2trYXpsb2x0YXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTg5NjMsImV4cCI6MjA5Nzg3NDk2M30.jynMS4Pevoonclg4huXCjI7i_VJWfams9WwDW89hHog';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Package = {
  slug: string;
  name_bg: string;
  description_bg: string | null;
  price_eur: number;
  photo_count: number;
  includes_album: boolean;
  duration_minutes: number;
  features: string[] | null;
  active: boolean;
  sort_order: number;
};

export type TimeSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: 'available' | 'held' | 'booked' | 'blocked';
  blocked_reason: string | null;
};

// Shape returned by `booking_admin_view` — a joined, flat read model used by
// all admin pages. Not a real table; writes still go through the base
// `bookings` table or the RPC functions.
export type Booking = {
  id: string;
  reference: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  payment_status: 'deposit_pending' | 'deposit_paid' | 'paid_full' | 'refunded' | 'deposit_waived';
  payment_mode: 'deposit' | 'full' | 'voucher' | 'voucher_upgrade' | 'deposit_waived' | null;
  total_eur: number;
  deposit_eur: number;
  amount_paid_eur: number;
  amount_due_eur: number;
  num_pets: number;
  note: string | null;
  admin_note: string | null;
  created_at: string;
  package_id: string | null;
  package_slug: string | null;
  package_name_bg: string | null;
  package_price_eur: number | null;
  slot_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  slot_status: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  pet_id: string | null;
  pet_name: string | null;
  pet_species: 'dog' | 'cat' | 'other' | null;
  pet_breed: string | null;
  voucher_id: string | null;
  voucher_code: string | null;
  reminder_sent_at?: string | null;
};

export type Customer = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  marketing_consent: boolean;
  admin_note: string | null;
  created_at: string;
};

export type Pet = {
  id: string;
  customer_id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed: string | null;
  created_at: string;
};

// Shape returned by `voucher_admin_view`.
export type Voucher = {
  id: string;
  code: string;
  kind: 'gift_package' | 'deposit_waiver';
  package_id: string | null;
  package_slug: string | null;
  package_name_bg: string | null;
  package_price_eur: number | null;
  amount_eur: number;
  source: 'purchase' | 'manual_admin';
  purchaser_name: string | null;
  purchaser_email: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  message: string | null;
  status: 'pending_payment' | 'active' | 'redeemed' | 'expired' | 'cancelled';
  expires_at: string;
  redeemed_booking_id: string | null;
  created_at: string;
};

export type Settings = Record<string, string>;

export type ValidateVoucherResult = {
  valid: boolean;
  kind: 'gift_package' | 'deposit_waiver' | null;
  package_slug: string | null;
  package_name_bg: string | null;
  package_price_eur: number | null;
  reason: string;
};

export type CreateBookingResult = {
  booking_id: string;
  reference: string;
  amount_due_eur: number;
  payment_mode: string;
};
