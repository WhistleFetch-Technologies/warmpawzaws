import type { PaymentChannel } from './types';

const TELE = new Set(['tele', 'video_consultation', 'video', 'online', 'online_consultation']);
const APPOINTMENT = new Set([
  'appointment',
  'at_center',
  'at_clinic',
  'at_home',
  'home_visit',
  'clinic',
  'center',
]);

function token(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

/**
 * Closed channel set. Pay Bill is a surface, never inferred from a category name.
 */
export function classifyPaymentChannel(opts: {
  surface?: 'paybill' | 'ecommerce' | 'booking';
  serviceStyle?: string | null;
  serviceType?: string | null;
}): PaymentChannel | null {
  if (opts.surface === 'paybill') return 'paybill';
  if (opts.surface === 'ecommerce') return 'ecommerce';
  const style = token(opts.serviceStyle || opts.serviceType);
  if (!style) return opts.surface === 'booking' ? null : null;
  if (TELE.has(style)) return 'tele';
  if (APPOINTMENT.has(style)) return 'appointment';
  return null;
}

export function isCountChannel(channel: PaymentChannel): channel is 'tele' | 'appointment' | 'paybill' {
  return channel === 'tele' || channel === 'appointment' || channel === 'paybill';
}

export function isSpendChannel(raw: unknown): raw is PaymentChannel {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  return s === 'tele' || s === 'appointment' || s === 'paybill' || s === 'ecommerce';
}

/** Booking debit fallback when the caller did not pass a spend channel. */
export function resolveSpendChannelFromBooking(row: {
  service_style?: string | null;
  service_type?: string | null;
  commerce_mode?: string | null;
}): PaymentChannel | null {
  const classified = classifyPaymentChannel({
    surface: 'booking',
    serviceStyle: row.service_style || row.service_type,
    serviceType: row.service_type,
  });
  if (classified) return classified;
  if (String(row.commerce_mode || '').trim().toLowerCase() === 'warmpawz_appointments') {
    return 'appointment';
  }
  return null;
}
