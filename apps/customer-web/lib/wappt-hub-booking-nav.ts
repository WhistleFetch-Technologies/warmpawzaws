import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import type { BoardingListVendor } from '@/lib/boarding-vendor-discovery-map';
import { buildWarmpawzAppointmentsBookingNav } from '@/lib/warmpawz-appointments-customer';

export function buildHubWarmpawzBookingNav(
  v: BoardingListVendor,
  opts: { category: string; serviceStyle: string }
) {
  const raw = (v.raw ?? {}) as Record<string, unknown>;
  const vendorId = pickCustomerVendorAccountId(raw) || v.id;
  return buildWarmpawzAppointmentsBookingNav({
    vendorId,
    vendorName: v.name,
    serviceStyle: opts.serviceStyle,
    category: opts.category,
  });
}
