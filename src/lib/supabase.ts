import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

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
  status: 'available' | 'blocked' | 'booked';
  block_reason: string | null;
};

export type Booking = {
  id: string;
  reference: string;
  slot_id: string | null;
  package_slug: string;
  customer_id: string | null;
  pet_name: string | null;
  pet_species: 'dog' | 'cat' | 'other' | null;
  pet_breed: string | null;
  num_pets: number;
  note: string | null;
  marketing_consent: boolean;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  payment_status: 'unpaid' | 'deposit_paid' | 'full_paid' | 'voucher_paid' | 'refunded' | 'partially_refunded';
  payment_mode: 'deposit' | 'full' | 'voucher' | 'voucher_upgrade' | 'deposit_waived' | null;
  amount_due_eur: number;
  amount_paid_eur: number;
  voucher_code: string | null;
  voucher_id: string | null;
  stripe_session_id: string | null;
  stripe_session_url: string | null;
  hold_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  marketing_consent: boolean;
  gdpr_consent: boolean;
  admin_notes: string | null;
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

export type Voucher = {
  id: string;
  code: string;
  kind: 'gift_package' | 'deposit_waiver';
  package_slug: string | null;
  package_name_bg: string | null;
  package_price_eur: number | null;
  purchaser_name: string;
  purchaser_email: string;
  recipient_name: string | null;
  recipient_email: string | null;
  message: string | null;
  status: 'active' | 'redeemed' | 'expired';
  source: 'purchase' | 'manual_admin';
  stripe_session_id: string | null;
  stripe_payment_id: string | null;
  expires_at: string;
  redeemed_at: string | null;
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
