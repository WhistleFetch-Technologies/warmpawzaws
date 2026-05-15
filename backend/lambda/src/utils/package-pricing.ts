/**
 * Package pricing — single source of truth for vendor-service packages.
 *
 * Reuses the SAME pipeline as normal bookings:
 *   - taxCalculationService → GST / CGST / SGST / IGST + breakdown
 *   - calculateFinalFees    → platform / convenience / delivery / packaging
 *
 * The output shape mirrors what `UniversalPaymentPage` consumes via
 * `/config/fees` + `/customer/pricing/quote`, so the Razorpay order amount
 * for a package equals the customer-visible total exactly.
 */

import { createHash } from 'crypto';
import { query } from '../database/rds-connection';
import { calculateFinalFees, mapCatalogCategoryToBusinessType } from './feeCalculator';
import type { VendorPackageComputation } from './vendor-package-razorpay-flow';

export type PackagePolicySnapshot = {
  cancellationPolicy: string;
  refundPolicy: string;
  /** Stable hash that identifies the (cancellation + refund) text combo. */
  version: string;
};

export type PackageTaxBreakdownRow = {
  name: string;
  rate: number;
  amount: number;
};

export type PackagePricingResult = {
  /** Subtotal (vendor package price) before tax and platform fees. */
  basePrice: number;
  /** Total GST amount on the base price. */
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxBreakdown: PackageTaxBreakdownRow[];
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  packagingFee: number;
  /** Sum charged to the customer / Razorpay order amount. */
  totalAmount: number;
  /** Echo of the normalised business service type used for fee resolution. */
  businessServiceType: string;
};

function resolvePackagePolicySnapshot(
  comp: VendorPackageComputation,
  fromPurchase?: Record<string, unknown> | null
): PackagePolicySnapshot {
  const fromMeta =
    (comp.details?.cancellationPolicy as string | undefined) ||
    (comp.meta?.cancellationPolicy as string | undefined) ||
    '';
  const fromMetaRefund =
    (comp.details?.refundPolicy as string | undefined) ||
    (comp.meta?.refundPolicy as string | undefined) ||
    '';

  const cancellationPolicy =
    (fromPurchase?.cancellation_policy as string | undefined) ||
    fromMeta ||
    '';
  const refundPolicy =
    (fromPurchase?.refund_policy as string | undefined) ||
    fromMetaRefund ||
    '';

  const version = createHash('sha1')
    .update(`${cancellationPolicy.trim()}|${refundPolicy.trim()}`)
    .digest('hex')
    .slice(0, 16);

  return { cancellationPolicy, refundPolicy, version };
}

/**
 * Compute package totals using the same pipeline as a normal booking.
 *
 * @throws Error('PACKAGE_PRICE_MISSING') when the package has no resolvable price.
 */
export async function quotePackagePricing(
  comp: VendorPackageComputation
): Promise<PackagePricingResult> {
  const basePrice = Math.max(0, Number(comp.priceNum) || 0);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    const err = new Error('PACKAGE_PRICE_MISSING');
    (err as Error & { code?: string }).code = 'PACKAGE_PRICE_MISSING';
    throw err;
  }

  const businessServiceType =
    mapCatalogCategoryToBusinessType(comp.serviceType || '') ||
    String(comp.serviceType || '').toLowerCase() ||
    '';

  // GST/Tax — same call shape as `payments-enhanced.ts` for normal bookings.
  let gstAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let taxBreakdown: PackageTaxBreakdownRow[] = [];

  try {
    let vendorLocation: { state: string; city?: string } | undefined;
    try {
      const vRes = await query(`SELECT state, city FROM vendors WHERE id = $1::uuid LIMIT 1`, [
        comp.vendorId,
      ]);
      if (vRes.rows?.[0]?.state) {
        vendorLocation = {
          state: String(vRes.rows[0].state),
          city: vRes.rows[0].city ? String(vRes.rows[0].city) : undefined,
        };
      }
    } catch {
      vendorLocation = undefined;
    }

    const { taxCalculationService } = await import('../lib/services/tax-calculation-service');
    const taxResult = await taxCalculationService.calculateTax({
      items: [
        {
          id: comp.vendorServiceId,
          type: 'service',
          amount: basePrice,
          quantity: 1,
          category: comp.serviceType,
          serviceStyle: comp.serviceStyle,
        },
      ],
      vendorLocation,
      vendorId: comp.vendorId,
      serviceType: comp.serviceType,
      category: comp.serviceType,
    });

    gstAmount = Number(taxResult.totalTax) || 0;
    cgstAmount = Number(taxResult.totalCGST) || 0;
    sgstAmount = Number(taxResult.totalSGST) || 0;
    igstAmount = Number(taxResult.totalIGST) || 0;
    taxBreakdown = (taxResult.hsnSummary || []).map((h: any) => ({
      name: h.description || 'GST',
      rate: Number(h.gstRate) || 0,
      amount: Number(h.totalTax) || 0,
    }));
  } catch (taxErr) {
    console.error('[package-pricing] tax calculation failed:', taxErr);
    gstAmount = 0;
    taxBreakdown = [];
  }

  const fees = await calculateFinalFees({
    amount: basePrice,
    type: 'booking',
    serviceStyle: comp.serviceStyle,
    businessServiceType,
  });

  const totalAmount =
    basePrice +
    gstAmount +
    fees.platformFee +
    fees.convenienceFee +
    fees.deliveryFee +
    fees.packagingFee;

  return {
    basePrice,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxBreakdown,
    platformFee: fees.platformFee,
    convenienceFee: fees.convenienceFee,
    deliveryFee: fees.deliveryFee,
    packagingFee: fees.packagingFee,
    totalAmount: Math.round(totalAmount * 100) / 100,
    businessServiceType,
  };
}

export { resolvePackagePolicySnapshot };
