/**
 * Canonical vendor / practitioner IDs for customer-facing profile & booking flows.
 * Used by customer-web and WarmpawzCustomer so list rows never pass a staff id
 * where a vendor account id is required (or vice versa for vet doctor profile).
 */

export function firstNonEmptyString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return undefined;
}

/**
 * Vendor account UUID used for `/vendor/:id`, facility, grooming/training embed profile, shop, walker hub, etc.
 * For staff rows, prefers parent `vendorId` when present.
 */
export function pickCustomerVendorAccountId(row: Record<string, unknown>): string {
  const type = String(row.type ?? row.providerType ?? 'vendor').toLowerCase();
  const explicitVendor = firstNonEmptyString(row.vendorId, row.vendor_id);
  if ((type === 'staff' || type === 'salon_staff' || type === 'team') && explicitVendor) {
    return explicitVendor;
  }
  if (type === 'vendor' || type === 'center' || type === 'business') {
    return (
      explicitVendor ||
      firstNonEmptyString(row.providerId, row.provider_id, row.id) ||
      ''
    );
  }
  return (
    explicitVendor ||
    firstNonEmptyString(row.providerId, row.provider_id, row.id) ||
    ''
  );
}

/**
 * Entity id for vet **practitioner** profile (tele/home staff or independent vet).
 * For clinic **vendor** rows, returns the vendor account id (caller routes to clinic profile instead).
 */
export function pickVetPractitionerProfileEntityId(row: Record<string, unknown>): string {
  const type = String(row.type ?? row.providerType ?? 'vendor').toLowerCase();
  if (type === 'staff' || type === 'individual') {
    return firstNonEmptyString(row.providerId, row.provider_id, row.id) || '';
  }
  return firstNonEmptyString(row.providerId, row.provider_id, row.vendorId, row.vendor_id, row.id) || '';
}

/** Walker / generic discover row: prefer explicit vendorId over opaque list id. */
export function pickWalkerVendorId(row: Record<string, unknown>): string {
  return (
    firstNonEmptyString(
      row.vendorId,
      row.vendor_id,
      row.walkerVendorId,
      row.walker_vendor_id,
      row.providerId,
      row.provider_id
    ) ||
    firstNonEmptyString(row.id) ||
    ''
  );
}
