import { query } from '../../../../database/rds-connection';
import type { WpayPaymentRow } from '../repos/wpay-payment.repo';

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
  const discountPercent = round2(readMetadataNumber(meta, 'quotedDiscountPercent'));

  const platformWithholdPercent = await resolveWpayPlatformWithholdPercent(vendorId);
  const platformWithholdAmount = round2((payableAmount * platformWithholdPercent) / 100);
  const vendorNetAmount = round2(Math.max(0, payableAmount - platformWithholdAmount));

  const settlementDate = payment.completed_at
    ? new Date(payment.completed_at).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const settlementBreakup = {
    flowType: 'pay_bill',
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
       NULL,
       'warmpawz_pay',
       $3,
       $4,
       $5,
       'pending',
       $6::date,
       $6::date,
       ARRAY[$2::uuid],
       $7::jsonb,
       $6::date
     )
     ON CONFLICT DO NOTHING
     RETURNING id::text AS id`,
    [
      vendorId,
      payment.id,
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
