import { supabase, type Settings } from './supabase';
import { format, parseISO } from 'date-fns';
import { bg } from 'date-fns/locale';

export async function loadSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) return {};
  const map: Settings = {};
  data.forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
  return map;
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('bg-BG', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, fmt: string = 'd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt, { locale: bg });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMM yyyy, HH:mm', { locale: bg });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm', { locale: bg });
}

export function getMonthName(month: number): string {
  return format(new Date(2024, month, 1), 'MMMM', { locale: bg });
}

export function getDayName(date: Date): string {
  return format(date, 'EEEE', { locale: bg });
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'YDS-';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
    if (i === 3) code += '-';
  }
  return code;
}
