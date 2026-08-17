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
import { calculateFinalFees, mapCatalogCategoryToBusinessType } from './feeCalculator';
import {
  resolveCustomerGstLocation,
  resolveVendorGstLocation,
} from './calculate-authoritative-service-gst';
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
  isInterState: boolean;
  gstRate: number;
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
  let isInterState = false;
  let gstRate = 0;
  let taxBreakdown: PackageTaxBreakdownRow[] = [];

  try {
    const vendor = await resolveVendorGstLocation(comp.vendorId);
    const roleId = vendor.roleId;
    const vendorLocation = vendor.location?.state || vendor.location?.city
      ? { state: vendor.location.state || vendor.location.city || '', city: vendor.location.city }
      : undefined;
    const customerResolved = await resolveCustomerGstLocation({ customerId: comp.customerId });
    const customerLocation = customerResolved?.state || customerResolved?.city
      ? { state: customerResolved.state || customerResolved.city || '', city: customerResolved.city }
      : undefined;

    const { resolveServiceBookingTaxItem } = await import('./resolve-service-booking-tax-item');
    const { taxItem } = await resolveServiceBookingTaxItem({
      serviceId: comp.vendorServiceId,
      vendorId: comp.vendorId,
      vendorRoleId: roleId,
      amount: basePrice,
      quantity: 1,
      category: comp.serviceType,
      serviceStyle: comp.serviceStyle,
      itemId: comp.vendorServiceId,
    });

    const { taxCalculationService } = await import('../lib/services/tax-calculation-service');
    const taxResult = await taxCalculationService.calculateTax({
      items: [taxItem],
      customerLocation,
      vendorLocation,
      vendorId: comp.vendorId,
      serviceType: comp.serviceType,
      category: comp.serviceType,
    });

    const { snapshotFromTaxResult } = await import('./canonical-gst-snapshot');
    const snap = snapshotFromTaxResult(taxResult, basePrice);
    gstAmount = snap.gstAmount;
    cgstAmount = snap.cgstAmount;
    sgstAmount = snap.sgstAmount;
    igstAmount = snap.igstAmount;
    isInterState = snap.isInterState;
    gstRate = snap.gstRate;
    taxBreakdown = (taxResult.hsnSummary || []).map((h: any) => ({
      name: h.description || 'GST',
      rate: Number(h.gstRate) || 0,
      amount: Number(h.totalTax) || 0,
    }));
  } catch (taxErr) {
    console.error('[package-pricing] tax calculation failed:', taxErr);
    throw taxErr;
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
    isInterState,
    gstRate,
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
