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

function parseJsonAddressStateCity(
  rawAddr: unknown
): { state?: string; city?: string; pincode?: string } | undefined {
  if (rawAddr == null || rawAddr === '') return undefined;
  try {
    let addr: any = null;
    if (typeof rawAddr === 'string') {
      if (rawAddr.startsWith('{') || rawAddr.startsWith('[')) {
        addr = JSON.parse(rawAddr);
      } else {
        return undefined;
      }
    } else if (typeof rawAddr === 'object') {
      addr = rawAddr;
    }
    if (addr?.state) {
      return {
        state: String(addr.state),
        city: addr.city != null ? String(addr.city) : undefined,
        pincode: addr.pincode != null ? String(addr.pincode) : undefined,
      };
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

async function resolveCustomerTaxLocation(
  customerId: string
): Promise<{ state: string; city?: string; pincode?: string } | undefined> {
  const cid = String(customerId || '').trim();
  if (!cid) return undefined;
  try {
    const r = await query(
      `SELECT city, state, pincode
       FROM customer_addresses
       WHERE customer_id = $1::uuid AND is_default = true
       LIMIT 1`,
      [cid]
    );
    const row = r.rows?.[0];
    if (row?.state) {
      return {
        state: String(row.state),
        city: row.city != null ? String(row.city) : undefined,
        pincode: row.pincode != null ? String(row.pincode) : undefined,
      };
    }
  } catch {
    /* ignore */
  }
  try {
    const r2 = await query(`SELECT address FROM customers WHERE id = $1::uuid LIMIT 1`, [cid]);
    const parsed = parseJsonAddressStateCity(r2.rows?.[0]?.address);
    if (parsed?.state) {
      return {
        state: parsed.state,
        city: parsed.city,
        pincode: parsed.pincode,
      };
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function vendorTaxLocationFromDbRow(
  row: Record<string, unknown> | undefined
): { state: string; city?: string } | undefined {
  if (!row) return undefined;
  const st = row.state != null ? String(row.state).trim() : '';
  if (st) {
    return {
      state: st,
      city: row.city != null ? String(row.city) : undefined,
    };
  }
  const fromAddr = parseJsonAddressStateCity(row.address);
  if (fromAddr?.state) {
    return { state: fromAddr.state, city: fromAddr.city };
  }
  return undefined;
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
    let vendorLocation: { state: string; city?: string } | undefined;
    let roleId: string | undefined;
    try {
      const vRes = await query(
        `SELECT state, city, address, role_id::text AS role_id
         FROM vendors WHERE id = $1::uuid LIMIT 1`,
        [comp.vendorId]
      );
      const vrow = vRes.rows?.[0] as Record<string, unknown> | undefined;
      vendorLocation = vendorTaxLocationFromDbRow(vrow);
      if (vrow?.role_id) roleId = String(vrow.role_id);
    } catch {
      vendorLocation = undefined;
    }

    let customerLocation: { state: string; city?: string; pincode?: string } | undefined;
    try {
      customerLocation = await resolveCustomerTaxLocation(comp.customerId);
    } catch {
      customerLocation = undefined;
    }

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
