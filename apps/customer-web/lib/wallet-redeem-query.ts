export type WalletSpendChannel = 'tele' | 'appointment' | 'paybill' | 'ecommerce';

export type WalletRedeemContext = {
  serviceCategory?: string | null;
  channel?: WalletSpendChannel | null;
  vendorId?: string | null;
  categoryId?: string | null;
  ecommerceCategoryId?: string | null;
};

const TELE_STYLES = new Set([
  'tele',
  'video',
  'video_consultation',
  'online',
  'online_consultation',
  'tele_consult',
]);
const APPOINTMENT_STYLES = new Set([
  'appointment',
  'at_center',
  'at_clinic',
  'at_home',
  'home_visit',
  'clinic',
  'center',
]);

export function inferBookingSpendChannel(opts: {
  serviceStyle?: string | null;
  serviceType?: string | null;
  isWapptAppointment?: boolean;
}): WalletSpendChannel | null {
  const style = String(opts.serviceStyle || opts.serviceType || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  if (TELE_STYLES.has(style)) return 'tele';
  if (opts.isWapptAppointment) return 'appointment';
  if (APPOINTMENT_STYLES.has(style)) return 'appointment';
  return null;
}

export function buildCustomerWalletPath(phone: string, ctx?: WalletRedeemContext | null): string {
  const params = new URLSearchParams({ phone });
  const category = String(ctx?.serviceCategory || '').trim();
  if (category) params.set('serviceCategory', category);
  if (ctx?.channel) params.set('channel', ctx.channel);
  if (ctx?.vendorId) params.set('vendorId', String(ctx.vendorId));
  if (ctx?.categoryId) params.set('categoryId', String(ctx.categoryId));
  if (ctx?.ecommerceCategoryId) params.set('ecommerceCategoryId', String(ctx.ecommerceCategoryId));
  return `/customer/wallet?${params.toString()}`;
}
