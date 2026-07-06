/**
 * Strip internal payment snapshots from booking notes before showing vendors.
 * Customer checkout appends `wp_financial_meta:{...}` to `bookings.notes`.
 */
export function formatVendorFacingCustomerNotes(raw: unknown): string {
  if (raw == null || raw === '') return '';
  const text = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  if (!text) return '';

  const marker = 'wp_financial_meta:';
  const idx = text.indexOf(marker);
  if (idx === -1) return text;

  let cleaned = text.slice(0, idx).trim();
  if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1).trim();
  return cleaned;
}
