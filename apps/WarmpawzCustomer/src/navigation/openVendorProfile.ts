import { pickCustomerVendorAccountId, pickWalkerVendorId } from '@warmpawz/shared-types';

export type CustomerAppNavigate = (screen: string, params?: Record<string, unknown>) => void;

/**
 * Opens the unified VendorProfile stack screen with a canonical vendor id.
 */
export function openVendorProfile(
  onNavigate: CustomerAppNavigate | undefined,
  row: Record<string, unknown>
): boolean {
  const vendorId =
    pickCustomerVendorAccountId(row) || pickWalkerVendorId(row);
  if (!vendorId?.trim() || !onNavigate) {
    return false;
  }
  onNavigate('VendorProfile', { vendorId: vendorId.trim() });
  return true;
}
