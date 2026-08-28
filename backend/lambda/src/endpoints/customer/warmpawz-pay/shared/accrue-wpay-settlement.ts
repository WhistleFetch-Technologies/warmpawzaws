import { query } from '../../../../database/rds-connection';
import type { WpayPaymentRow } from '../repos/wpay-payment.repo';
import { dbLoadWapptBookingSettlementFacts } from '../repos/wpay-appointment-context.repo';
import { assertWapptSettlementEligible, resolveWapptSettlementBookingId } from './wpay-settlement-policy';

export type WpaySettlementAccrualResult = {
  inserted: boolean;
  settlementId: string | null;
  skippedReason?: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function readMetadataNumber(meta: Record<string, unknown> | null | undefined, key: string): number {
  if (!meta) return 0;
  const n = Number(meta[key]);
  return Number.isFinite(n) ? n : 0;
}

function readMetadataString(meta: Record<string, unknown> | null | undefined, key: string): string {
  if (!meta) return '';
  return String(meta[key] ?? '').trim();
}

/** Map settlements.settlement_status to vendor earnings transaction status. */
export function mapWpaySettlementLedgerStatus(raw: string | undefined | null): string {
  const key = String(raw || '').toLowerCase();
  if (key === 'completed' || key === 'processed') return 'settled';
  if (key === 'failed') return 'cancelled';
  return 'pending';
}

export async function resolveWpayPlatformWithholdPercent(vendorId: string): Promise<number> {
  const result = await query(
    `SELECT platform_withhold_percent
     FROM warmpawz_pay_merchant_pricing
     WHERE vendor_id = $1::uuid
     LIMIT 1`,
    [vendorId],
  );
  const raw = result.rows[0]?.platform_withhold_percent;
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return round2(Math.min(100, n));
}

function isTierCommissionPayment(meta: Record<string, unknown>): boolean {
  if (readMetadataString(meta, 'commercialModel') === 'tier_commission') return true;
  return Boolean(readMetadataString(meta, 'tierId') || readMetadataString(meta, 'tierIdSnapshot'));
}

export async function accrueWpaySettlement(
  payment: WpayPaymentRow,
): Promise<WpaySettlementAccrualResult> {
  const vendorId = payment.vendor_id ? String(payment.vendor_id) : '';
  if (!vendorId) {
    return { inserted: false, settlementId: null, skippedReason: 'missing_vendor' };
  }
  if (String(payment.payment_status).toLowerCase() !== 'completed') {
    return { inserted: false, settlementId: null, skippedReason: 'payment_not_completed' };
  }

  const settlementGate = await (async () => {
    const bookingId = resolveWapptSettlementBookingId(payment);
    const bookingFacts = bookingId ? await dbLoadWapptBookingSettlementFacts(bookingId) : null;
    return assertWapptSettlementEligible(payment, bookingFacts);
  })();
  if (!settlementGate.ok) {
    return { inserted: false, settlementId: null, skippedReason: settlementGate.skippedReason };
  }

  const existing = await query(
    `SELECT id::text AS id
     FROM settlements
     WHERE payment_id = $1::uuid
       AND order_type = 'warmpawz_pay'
     LIMIT 1`,
    [payment.id],
  );
  if (existing.rows[0]?.id) {
    return { inserted: false, settlementId: String(existing.rows[0].id) };
  }

  const payableAmount = round2(Number(payment.amount ?? 0));
  if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
    return { inserted: false, settlementId: null, skippedReason: 'invalid_payable_amount' };
  }

  const meta = (payment.metadata ?? {}) as Record<string, unknown>;
  const quotedAmount = round2(
    Number(payment.original_amount ?? readMetadataNumber(meta, 'quotedOriginalAmount') ?? payableAmount),
  );
  const discountAmount = round2(
    Number(payment.discount_amount ?? readMetadataNumber(meta, 'quotedDiscountAmount') ?? 0),
  );
  const appointmentFeeCredit = round2(readMetadataNumber(meta, 'appointmentFeeCredit'));
  const discountPercent = round2(
    readMetadataNumber(meta, 'quotedDiscountPercent') ||
      readMetadataNumber(meta, 'discountPercentSnapshot'),
  );

  const settlementDate = payment.completed_at
    ? new Date(payment.completed_at).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const bookingId = resolveWapptSettlementBookingId(payment);

  if (isTierCommissionPayment(meta)) {
    const vendorPayableAmount = round2(
      readMetadataNumber(meta, 'vendorPayableAmount') ||
        Math.max(0, quotedAmount - readMetadataNumber(meta, 'grossCommissionAmount')),
    );
    const wpayRevenueAmount = round2(
      readMetadataNumber(meta, 'wpayRevenueAmount') ||
        Math.max(0, readMetadataNumber(meta, 'grossCommissionAmount') - discountAmount),
    );
    const platformGstAmount = round2(readMetadataNumber(meta, 'platformGstAmount'));
    const convenienceGstAmount = round2(readMetadataNumber(meta, 'convenienceGstAmount'));
    const finalGstAmount = round2(
      readMetadataNumber(meta, 'finalGstAmount') || platformGstAmount + convenienceGstAmount,
    );

    const settlementBreakup = {
      flowType: 'pay_bill',
      commercialModel: 'tier_commission',
      quotedAmount,
      appointmentFeeCredit,
      discountPercent,
      discountAmount,
      payableAmount,
      tierId: readMetadataString(meta, 'tierId') || readMetadataString(meta, 'tierIdSnapshot') || null,
      tierNameSnapshot: readMetadataString(meta, 'tierNameSnapshot') || null,
      commissionPercentSnapshot: readMetadataNumber(meta, 'commissionPercentSnapshot'),
      grossCommissionAmount: readMetadataNumber(meta, 'grossCommissionAmount'),
      vendorPayableAmount,
      servicePayableAmount: readMetadataNumber(meta, 'servicePayableAmount'),
      wpayRevenueAmount,
      platformGstRateSnapshot: readMetadataNumber(meta, 'platformGstRateSnapshot'),
      platformGstAmount,
      netWpayRevenueAmount: readMetadataNumber(meta, 'netWpayRevenueAmount'),
      convenienceFee: readMetadataNumber(meta, 'convenienceFee'),
      convenienceGstRateSnapshot: readMetadataNumber(meta, 'convenienceGstRateSnapshot'),
      convenienceGstAmount,
      finalGstAmount,
      payNowAmount: readMetadataNumber(meta, 'payNowAmount') || payableAmount,
    };

    const insertResult = await query(
      `INSERT INTO settlements (
         vendor_id,
         payment_id,
         booking_id,
         order_type,
         total_amount,
         commission_amount,
         net_amount,
         settlement_status,
         settlement_period_start,
         settlement_period_end,
         payment_ids,
         settlement_breakup,
         settlement_date
       ) VALUES (
         $1::uuid,
         $2::uuid,
         $3::uuid,
         'warmpawz_pay',
         $4,
         $5,
         $6,
         'pending',
         $7::date,
         $7::date,
         ARRAY[$2::uuid],
         $8::jsonb,
         $7::date
       )
       ON CONFLICT DO NOTHING
       RETURNING id::text AS id`,
      [
        vendorId,
        payment.id,
        bookingId,
        payableAmount,
        wpayRevenueAmount,
        vendorPayableAmount,
        settlementDate,
        JSON.stringify(settlementBreakup),
      ],
    );

    const settlementId = insertResult.rows[0]?.id ? String(insertResult.rows[0].id) : null;
    if (settlementId) {
      return { inserted: true, settlementId };
    }

    const raced = await query(
      `SELECT id::text AS id
       FROM settlements
       WHERE payment_id = $1::uuid
         AND order_type = 'warmpawz_pay'
       LIMIT 1`,
      [payment.id],
    );
    return {
      inserted: false,
      settlementId: raced.rows[0]?.id ? String(raced.rows[0].id) : null,
    };
  }

  const snapRaw = meta.platformWithholdPercent;
  const platformWithholdPercent =
    snapRaw != null && Number.isFinite(Number(snapRaw))
      ? round2(Math.min(100, Number(snapRaw)))
      : await resolveWpayPlatformWithholdPercent(vendorId);
  const platformWithholdAmount = round2((payableAmount * platformWithholdPercent) / 100);
  const vendorNetAmount = round2(Math.max(0, payableAmount - platformWithholdAmount));

  const settlementBreakup = {
    flowType: 'pay_bill',
    commercialModel: 'withhold',
    quotedAmount,
    appointmentFeeCredit,
    discountPercent,
    discountAmount,
    payableAmount,
    platformWithholdPercent,
    platformWithholdAmount,
    vendorNetAmount,
  };

  const insertResult = await query(
    `INSERT INTO settlements (
       vendor_id,
       payment_id,
       booking_id,
       order_type,
       total_amount,
       commission_amount,
       net_amount,
       settlement_status,
       settlement_period_start,
       settlement_period_end,
       payment_ids,
       settlement_breakup,
       settlement_date
     ) VALUES (
       $1::uuid,
       $2::uuid,
       $3::uuid,
       'warmpawz_pay',
       $4,
       $5,
       $6,
       'pending',
       $7::date,
       $7::date,
       ARRAY[$2::uuid],
       $8::jsonb,
       $7::date
     )
     ON CONFLICT DO NOTHING
     RETURNING id::text AS id`,
    [
      vendorId,
      payment.id,
      bookingId,
      payableAmount,
      platformWithholdAmount,
      vendorNetAmount,
      settlementDate,
      JSON.stringify(settlementBreakup),
    ],
  );

  const settlementId = insertResult.rows[0]?.id ? String(insertResult.rows[0].id) : null;
  if (settlementId) {
    return { inserted: true, settlementId };
  }

  const raced = await query(
    `SELECT id::text AS id
     FROM settlements
     WHERE payment_id = $1::uuid
       AND order_type = 'warmpawz_pay'
     LIMIT 1`,
    [payment.id],
  );
  return {
    inserted: false,
    settlementId: raced.rows[0]?.id ? String(raced.rows[0].id) : null,
  };
}

/** After WAPPT service attestation (OTP), accrue Pay Bill settlements that were held pending OTP. */
export async function accruePendingWpaySettlementsForWapptBooking(
  bookingId: string,
  logPrefix = '[WAPPT-SETTLEMENT]',
): Promise<void> {
  const payments = await query(
    `SELECT id, customer_id, vendor_id, booking_id, amount, original_amount, discount_amount,
            payment_status, razorpay_order_id, razorpay_payment_id, razorpay_signature,
            metadata, completed_at, created_at
     FROM payments
     WHERE payment_source = 'warmpawz_pay'
       AND payment_status = 'completed'
       AND (
         booking_id = $1::uuid
         OR metadata->>'appointmentFeeBookingId' = $1::text
       )
       AND NOT EXISTS (
         SELECT 1 FROM settlements s
         WHERE s.payment_id = payments.id
           AND s.order_type = 'warmpawz_pay'
       )`,
    [bookingId],
  );

  for (const row of payments.rows as WpayPaymentRow[]) {
    try {
      await accrueWpaySettlement(row);
    } catch (error) {
      console.error(`${logPrefix} pending accrual failed`, { bookingId, paymentId: row.id, error });
    }
  }
}
