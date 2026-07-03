import { resolveProductCommission } from './resolve-ecommerce-commission-rate';
import { getSellerMonthlyRevenue } from './seller-commission-rate-helpers';
import { isCommissionConfigurationError } from './commission-configuration-error';

export interface SellerCommissionRateResult {
  rate: number | null;
  source: string | null;
  monthlyRevenue: number;
  configured: boolean;
  missing?: string[];
}

export { getSellerMonthlyRevenue };

/**
 * Ecommerce seller commission for analytics/tax.
 * Returns configured:false when commission is not set up (no silent fallback).
 */
export async function resolveSellerCommissionRate(
  vendorId: string,
  options?: { productId?: string | null; categoryId?: string | null }
): Promise<SellerCommissionRateResult> {
  const monthlyRevenue = await getSellerMonthlyRevenue(vendorId);
  try {
    const { rate, source } = await resolveProductCommission({
      vendorId,
      productId: options?.productId ?? null,
      categoryId: options?.categoryId ?? null,
    });
    return { rate, source, monthlyRevenue, configured: true };
  } catch (err) {
    if (isCommissionConfigurationError(err)) {
      return {
        rate: null,
        source: null,
        monthlyRevenue,
        configured: false,
        missing: err.missing,
      };
    }
    throw err;
  }
}
