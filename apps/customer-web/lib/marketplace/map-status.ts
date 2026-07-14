/** Map domain status strings to unified marketplace status tones — UI only */

export type MarketplaceStatusTone = 'default' | 'success' | 'warning' | 'danger' | 'muted';

export function mapOrderStatusTone(status: string): MarketplaceStatusTone {
  const s = status.toLowerCase();
  if (s.includes('deliver') || s.includes('complete')) return 'success';
  if (s.includes('cancel') || s.includes('return')) return 'danger';
  if (s.includes('ship') || s.includes('transit') || s.includes('process')) return 'warning';
  return 'default';
}

export function mapBookingStatusTone(
  status: string,
  options?: { paymentHoldExpired?: boolean }
): MarketplaceStatusTone {
  if (options?.paymentHoldExpired) return 'danger';
  const s = status.toLowerCase();
  if (s === 'completed') return 'success';
  if (s === 'cancelled') return 'danger';
  if (s === 'pending_payment' || s === 'pending') return 'warning';
  if (s === 'in_progress' || s === 'arrived') return 'warning';
  if (s === 'confirmed') return 'default';
  return 'default';
}
