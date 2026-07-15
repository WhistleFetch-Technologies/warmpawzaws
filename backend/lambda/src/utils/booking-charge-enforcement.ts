/**
 * Server-side payable enforcement for POST /razorpay/create-order booking payments.
 *
 * Historically the endpoint trusted the client-sent amount, so clients that never
 * called /payments/create (which computes GST + platform fees server-side) could
 * charge the bare service price — see prod booking 6b49e9bd (₹1,800 captured, no GST).
 *
 * This resolves the authoritative payable for a booking:
 *   1. Preferred: the pending "orphan" payments row created by /payments/create
 *      (its amount already includes server-computed GST + fees).
 *   2. Fallback: recompute base + GST + fees with the same pipeline
 *      (resolveServiceBookingTaxItem → taxCalculationService → calculateFinalFees).
 * Wallet debits and completed non-wallet payments for the booking are subtracted
 * to get the cash still payable via Razorpay.
 *
 * Callers must fail OPEN (keep the client amount) if this returns null or throws:
 * enforcement is defense-in-depth, not a payment gate.
 */

import { query } from '../database/rds-connection';

export interface ExpectedBookingCharge {
  /** Cash still payable via Razorpay (gross − wallet − completed non-wallet payments), ₹. */
  expectedCash: number;
  /** Base + GST + fees, ₹. */
  grossTotal: number;
  baseAmount: number;
  gst: { total: number; cgst: number; sgst: number; igst: number; ruleId: string | null } | null;
  feesTotal: number;
  walletPaid: number;
  completedNonWalletPaid: number;
  source: 'payments_row' | 'computed';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function sumWalletDebitsForBooking(bookingId: string): Promise<number> {
  const colsRes = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'wallet_transactions'`
  );
  const cols = new Set(colsRes.rows.map((r: { column_name: string }) => r.column_name));
  const clauses: string[] = [];
  if (cols.has('booking_id')) clauses.push(`booking_id = $1::uuid`);
  if (cols.has('reference_type') && cols.has('reference_id')) {
    clauses.push(`(reference_type = 'booking_payment' AND reference_id = $1)`);
  }
  if (clauses.length === 0) return 0;
  const res = await query(
    `SELECT COALESCE(SUM(amount), 0)::text AS total
     FROM wallet_transactions
     WHERE transaction_type = 'debit' AND (${clauses.join(' OR ')})`,
    [bookingId]
  );
  return round2(parseFloat(String(res.rows?.[0]?.total ?? '0')) || 0);
}

async function sumCompletedNonWalletPayments(bookingId: string): Promise<number> {
  // Wallet-method rows mirror wallet_transactions debits — excluded to avoid double counting.
  const res = await query(
    `SELECT COALESCE(SUM(amount), 0)::text AS total
     FROM payments
     WHERE booking_id = $1::uuid
       AND payment_status = 'completed'
       AND COALESCE(payment_method, '') <> 'wallet'`,
    [bookingId]
  );
  return round2(parseFloat(String(res.rows?.[0]?.total ?? '0')) || 0);
}

async function resolveServiceCategory(serviceId: string): Promise<string | null> {
  const vendorSvcs = await query(
    `SELECT vs.category, sc.category_id, sc.category_name
     FROM vendor_services vs
     LEFT JOIN service_catalog sc ON sc.id = vs.service_id
     WHERE vs.id = $1::uuid LIMIT 1`,
    [serviceId]
  ).catch(() => ({ rows: [] as any[] }));
  if (vendorSvcs.rows?.length > 0) {
    const row = vendorSvcs.rows[0];
    const cat = row.category_name || row.category_id || row.category;
    if (cat) return String(cat);
  }
  const catalogRows = await query(
    `SELECT category_id, category_name FROM service_catalog WHERE id = $1::uuid LIMIT 1`,
    [serviceId]
  ).catch(() => ({ rows: [] as any[] }));
  if (catalogRows.rows?.length > 0) {
    const row = catalogRows.rows[0];
    const cat = row.category_name || row.category_id;
    if (cat) return String(cat);
  }
  return null;
}

/**
 * Resolve the server-side expected charge for a booking payment.
 * Returns null when the payable cannot be determined (caller keeps client amount).
 */
export async function resolveExpectedBookingCharge(params: {
  bookingId: string;
  booking: Record<string, any>;
}): Promise<ExpectedBookingCharge | null> {
  const { bookingId, booking } = params;
  if (!bookingId || !booking) return null;

  const [walletPaid, completedNonWalletPaid] = await Promise.all([
    sumWalletDebitsForBooking(bookingId).catch(() => 0),
    sumCompletedNonWalletPayments(bookingId).catch(() => 0),
  ]);

  // 1. Pending row from /payments/create — amount is the server-computed gross total.
  const orphan = await query(
    `SELECT amount::text AS amount,
            gst_amount::text AS gst_amount,
            cgst_amount::text AS cgst_amount,
            sgst_amount::text AS sgst_amount,
            igst_amount::text AS igst_amount,
            gst_rule_id
     FROM payments
     WHERE booking_id = $1::uuid AND payment_status = 'pending' AND razorpay_order_id IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [bookingId]
  ).catch(() => ({ rows: [] as any[] }));

  if (orphan.rows?.length > 0) {
    const row = orphan.rows[0];
    const grossTotal = round2(parseFloat(String(row.amount ?? '0')) || 0);
    if (grossTotal <= 0) return null;
    const gstTotal = round2(parseFloat(String(row.gst_amount ?? '0')) || 0);
    return {
      expectedCash: Math.max(0, round2(grossTotal - walletPaid - completedNonWalletPaid)),
      grossTotal,
      baseAmount: round2(grossTotal - gstTotal),
      gst:
        gstTotal > 0
          ? {
              total: gstTotal,
              cgst: round2(parseFloat(String(row.cgst_amount ?? '0')) || 0),
              sgst: round2(parseFloat(String(row.sgst_amount ?? '0')) || 0),
              igst: round2(parseFloat(String(row.igst_amount ?? '0')) || 0),
              ruleId: row.gst_rule_id ? String(row.gst_rule_id) : null,
            }
          : null,
      feesTotal: 0,
      walletPaid,
      completedNonWalletPaid,
      source: 'payments_row',
    };
  }

  // 2. No server-priced row (client skipped /payments/create) — recompute like /payments/create.
  const baseAmount = round2(parseFloat(String(booking.total_amount ?? booking.amount ?? '0')) || 0);
  if (baseAmount <= 0) return null;

  const serviceId = booking.service_id ? String(booking.service_id) : '';
  const serviceCategory = serviceId ? await resolveServiceCategory(serviceId).catch(() => null) : null;
  const serviceStyle = booking.service_style ? String(booking.service_style) : '';

  let roleId: string | undefined;
  if (booking.vendor_id) {
    const vendors = await query(`SELECT role_id FROM vendors WHERE id = $1::uuid LIMIT 1`, [
      String(booking.vendor_id),
    ]).catch(() => ({ rows: [] as any[] }));
    roleId = vendors.rows?.[0]?.role_id ? String(vendors.rows[0].role_id) : undefined;
  }

  let gstTotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let gstRuleId: string | null = null;
  try {
    const { resolveServiceBookingTaxItem } = await import('./resolve-service-booking-tax-item');
    const { taxCalculationService } = await import('../lib/services/tax-calculation-service');
    const { taxItem } = await resolveServiceBookingTaxItem({
      serviceId: serviceId || undefined,
      vendorId: booking.vendor_id ? String(booking.vendor_id) : undefined,
      bookingId,
      vendorRoleId: roleId,
      amount: baseAmount,
      quantity: 1,
      category: serviceCategory || undefined,
      serviceStyle: serviceStyle || undefined,
      itemId: serviceId || bookingId,
    });
    const taxResult = await taxCalculationService.calculateTax({
      items: [taxItem],
      vendorId: booking.vendor_id ? String(booking.vendor_id) : undefined,
      serviceType: serviceCategory || undefined,
      category: serviceCategory || undefined,
    });
    gstTotal = round2(taxResult.totalTax || 0);
    cgst = round2(taxResult.totalCGST || 0);
    sgst = round2(taxResult.totalSGST || 0);
    igst = round2(taxResult.totalIGST || 0);
    gstRuleId = taxResult.items[0]?.taxRuleId || null;
  } catch (taxError: any) {
    console.error(
      '[BOOKING-CHARGE-ENFORCEMENT] Tax calculation failed, enforcing base + fees only:',
      taxError?.message || taxError
    );
    gstTotal = 0;
  }

  // Same fee rules and fallback as /payments/create so both paths agree on the payable.
  let feesTotal = 0;
  try {
    const { calculateFinalFees, mapCatalogCategoryToBusinessType } = await import('./feeCalculator');
    const fees = await calculateFinalFees({
      amount: baseAmount,
      type: 'booking',
      serviceStyle: String(serviceStyle || booking.service_type || ''),
      businessServiceType: mapCatalogCategoryToBusinessType(serviceCategory) || '',
    });
    feesTotal = round2(
      (fees.platformFee || 0) + (fees.convenienceFee || 0) + (fees.deliveryFee || 0) + (fees.packagingFee || 0)
    );
  } catch (feeError: any) {
    console.warn(
      '[BOOKING-CHARGE-ENFORCEMENT] Fee calculation failed, using default platform fee:',
      feeError?.message || feeError
    );
    feesTotal = Math.min(Math.round((baseAmount * 2) / 100), 200);
  }

  const grossTotal = round2(baseAmount + gstTotal + feesTotal);
  return {
    expectedCash: Math.max(0, round2(grossTotal - walletPaid - completedNonWalletPaid)),
    grossTotal,
    baseAmount,
    gst: gstTotal > 0 ? { total: gstTotal, cgst, sgst, igst, ruleId: gstRuleId } : null,
    feesTotal,
    walletPaid,
    completedNonWalletPaid,
    source: 'computed',
  };
}
