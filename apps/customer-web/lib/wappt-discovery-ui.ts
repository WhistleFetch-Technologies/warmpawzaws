import { isWarmpawzAppointmentsVendor } from '@/lib/warmpawz-appointments-customer';

/** True when this vendor row should hide all discovery pricing (WAPPT catalogue). */
export function shouldHideDiscoveryPricing(
  row: { raw?: Record<string, unknown> } | Record<string, unknown> | null | undefined
): boolean {
  const raw =
    row && typeof row === 'object' && 'raw' in row && row.raw
      ? (row.raw as Record<string, unknown>)
      : (row as Record<string, unknown> | null | undefined);
  return isWarmpawzAppointmentsVendor(raw);
}
