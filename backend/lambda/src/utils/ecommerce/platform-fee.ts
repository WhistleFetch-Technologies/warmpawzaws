import { resolveWpayConfiguredFeeAmount } from '../../endpoints/customer/warmpawz-pay/shared/wpay-discount';
import type { WpayFeeMode } from '../../endpoints/warmpawz-pay/constants/wpay-convenience-settings';

export type EcommercePlatformFeeQuote = {
  platformFee: number;
  platformFeeMode: WpayFeeMode;
  platformFeeGstRate: number;
  platformFeeGstAmount: number;
  platformFeeGross: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Same customer charge as Pay Bill: fee is fixed rupees or a percent of the
 * post-discount amount, and GST is added on top of that fee.
 * Product GST inside MRP is not part of this charge.
 */
export function computeEcommercePlatformFee(input: {
  subtotalAfterDiscount: number;
  platformFee: number;
  platformFeeMode?: WpayFeeMode | null;
  platformFeeGstRate?: number | null;
}): EcommercePlatformFeeQuote {
  const base = round2(Math.max(0, Number(input.subtotalAfterDiscount) || 0));
  const mode: WpayFeeMode = input.platformFeeMode === 'percent' ? 'percent' : 'fixed';
  const platformFee = resolveWpayConfiguredFeeAmount({
    servicePayableAmount: base,
    configuredValue: Number(input.platformFee) || 0,
    mode,
  });
  const platformFeeGstRate = round2(Math.max(0, Number(input.platformFeeGstRate) || 0));
  const platformFeeGstAmount =
    platformFee > 0 && platformFeeGstRate > 0
      ? round2((platformFee * platformFeeGstRate) / 100)
      : 0;
  return {
    platformFee,
    platformFeeMode: mode,
    platformFeeGstRate,
    platformFeeGstAmount,
    platformFeeGross: round2(platformFee + platformFeeGstAmount),
  };
}

export function readStoredEcommercePlatformFee(metadata: unknown): {
  platformFee: number;
  platformFeeGstAmount: number;
} {
  let meta: Record<string, unknown> | null = null;
  if (typeof metadata === 'string') {
    try {
      meta = JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      meta = null;
    }
  } else if (metadata && typeof metadata === 'object') {
    meta = metadata as Record<string, unknown>;
  }
  const snap =
    meta?.checkoutSnapshot && typeof meta.checkoutSnapshot === 'object'
      ? (meta.checkoutSnapshot as Record<string, unknown>)
      : meta;
  return {
    platformFee: round2(Math.max(0, Number(snap?.platform_fee) || 0)),
    platformFeeGstAmount: round2(Math.max(0, Number(snap?.platform_fee_gst_amount) || 0)),
  };
}
