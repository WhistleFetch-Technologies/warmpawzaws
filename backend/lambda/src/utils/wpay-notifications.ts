/**
 * Warmpawz Pay — vendor notification after successful Pay Bill payment.
 */

import { query } from '../database/rds-connection';
import { dispatchNotification } from './notification-dispatch';
import { computeWpayVendorSettlement } from '../endpoints/warmpawz-pay/shared/pricing/wpay-vendor-settlement';
import { notifyIfNotAlreadySent } from './notification-idempotency';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function readMetaNumber(meta: Record<string, unknown> | null | undefined, key: string): number {
  if (!meta) return 0;
  const n = Number(meta[key]);
  return Number.isFinite(n) ? n : 0;
}

export type WpayVendorNotifyBreakdown = {
  paymentId: string;
  vendorId: string;
  customerId: string;
  customerName: string;
  quotedAmount: number;
  paidAmount: number;
  discountAmount: number;
  discountPercent: number;
  platformWithholdPercent: number;
  platformWithholdAmount: number;
  vendorEarnings: number;
};

export function buildWpayVendorNotifyMessage(b: WpayVendorNotifyBreakdown): string {
  const discountPart =
    b.discountPercent > 0 ? `, ${b.discountPercent}% off` : b.discountAmount > 0 ? '' : '';
  return `${b.customerName} paid ₹${b.paidAmount.toFixed(2)} (bill ₹${b.quotedAmount.toFixed(2)}${discountPart}). Your earnings: ₹${b.vendorEarnings.toFixed(2)}`;
}

export async function loadWpayVendorNotifyBreakdown(
  paymentId: string,
): Promise<WpayVendorNotifyBreakdown | null> {
  const result = await query(
    `SELECT p.id,
            p.customer_id,
            p.vendor_id,
            p.amount,
            p.original_amount,
            p.discount_amount,
            p.metadata,
            p.payment_status,
            COALESCE(c.full_name, 'Customer') AS customer_name,
            s.net_amount,
            s.commission_amount,
            s.settlement_breakup
     FROM payments p
     LEFT JOIN customers c ON c.id = p.customer_id
     LEFT JOIN settlements s ON s.payment_id = p.id AND s.order_type = 'warmpawz_pay'
     WHERE p.id = $1::uuid
       AND p.payment_source = 'warmpawz_pay'
     LIMIT 1`,
    [paymentId],
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row?.vendor_id) return null;
  if (String(row.payment_status || '').toLowerCase() !== 'completed') return null;

  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const breakup =
    row.settlement_breakup && typeof row.settlement_breakup === 'object'
      ? (row.settlement_breakup as Record<string, unknown>)
      : {};

  const paidAmount = round2(Number(row.amount ?? 0));
  const quotedAmount = round2(
    Number(breakup.quotedAmount ?? row.original_amount ?? readMetaNumber(meta, 'quotedOriginalAmount') ?? paidAmount),
  );
  const discountAmount = round2(
    Number(row.discount_amount ?? breakup.discountAmount ?? readMetaNumber(meta, 'quotedDiscountAmount') ?? 0),
  );
  const discountPercent = round2(
    readMetaNumber(meta, 'quotedDiscountPercent') || readMetaNumber(breakup, 'discountPercent'),
  );

  let platformWithholdPercent = round2(
    readMetaNumber(breakup, 'platformWithholdPercent') || readMetaNumber(meta, 'platformWithholdPercent'),
  );
  let platformWithholdAmount = round2(
    Number(row.commission_amount ?? breakup.platformWithholdAmount ?? 0),
  );
  let vendorEarnings = round2(Number(row.net_amount ?? breakup.vendorNetAmount ?? 0));

  if (vendorEarnings <= 0 && paidAmount > 0) {
    if (platformWithholdPercent <= 0) {
      const pricing = await query(
        `SELECT platform_withhold_percent FROM warmpawz_pay_merchant_pricing WHERE vendor_id = $1::uuid LIMIT 1`,
        [String(row.vendor_id)],
      );
      platformWithholdPercent = round2(Number(pricing.rows[0]?.platform_withhold_percent ?? 0));
    }
    const computed = computeWpayVendorSettlement(paidAmount, platformWithholdPercent);
    platformWithholdAmount = computed.platformWithholdAmount;
    vendorEarnings = computed.vendorSettlementAmount;
  }

  return {
    paymentId: String(row.id),
    vendorId: String(row.vendor_id),
    customerId: String(row.customer_id ?? ''),
    customerName: String(row.customer_name || 'Customer'),
    quotedAmount,
    paidAmount,
    discountAmount,
    discountPercent,
    platformWithholdPercent,
    platformWithholdAmount,
    vendorEarnings,
  };
}

export async function notifyWpayPaymentCompleted(paymentId: string): Promise<void> {
  const breakdown = await loadWpayVendorNotifyBreakdown(paymentId);
  if (!breakdown) return;

  const dedupeKey = `wpay-${paymentId}-vendor`;
  const message = buildWpayVendorNotifyMessage(breakdown);

  await notifyIfNotAlreadySent({
    recipientId: breakdown.vendorId,
    recipientType: 'vendor',
    notificationType: 'warmpawz_pay_received',
    dedupeKey,
    notifyFn: async () => {
      await dispatchNotification({
        recipientId: breakdown.vendorId,
        recipientType: 'vendor',
        notificationType: 'warmpawz_pay_received',
        title: 'Payment received',
        message,
        channels: { inApp: true, push: true },
        priority: 'high',
        data: {
          paymentId: breakdown.paymentId,
          customerId: breakdown.customerId,
          customerName: breakdown.customerName,
          quotedAmount: breakdown.quotedAmount,
          paidAmount: breakdown.paidAmount,
          payableAmount: breakdown.paidAmount,
          discountAmount: breakdown.discountAmount,
          discountPercent: breakdown.discountPercent,
          platformWithholdPercent: breakdown.platformWithholdPercent,
          platformWithholdAmount: breakdown.platformWithholdAmount,
          vendorEarnings: breakdown.vendorEarnings,
          flowType: 'pay_bill',
          dedupeKey,
        },
      });
    },
  });
}
