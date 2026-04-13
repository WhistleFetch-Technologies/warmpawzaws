/**
 * Legacy mock lab ids from DiagnosticsServicesLanding (center-1, center-2, …).
 * The API has no such vendors — block navigation and API calls.
 */
export function isLegacyMockDiagnosticVendorId(vendorId: string | undefined | null): boolean {
  if (!vendorId || typeof vendorId !== 'string') return false;
  return /^center-\d+$/i.test(vendorId.trim());
}
