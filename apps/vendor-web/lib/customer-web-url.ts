/**
 * Base URL for customer-facing web (prescription share links, deep links).
 * Prefer NEXT_PUBLIC_CUSTOMER_WEB_URL in deploy; otherwise infer from hostname.
 */
export function getCustomerWebOrigin(): string {
  const fromEnv =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_CUSTOMER_WEB_URL?.trim()) || '';
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (h === 'vendor.warmpawz.com') return 'https://customer.warmpawz.com';
    if (h.includes('vendor.') && h.includes('warmpawz.com')) {
      return `${window.location.protocol}//${h.replace(/^vendor\./, 'customer.')}`;
    }
    if (h === 'localhost' || h === '127.0.0.1') {
      return 'http://localhost:3001';
    }
  }

  return 'https://customer.warmpawz.com';
}
