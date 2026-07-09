/**
 * ============================================================================
 * ECOMMERCE BATCH SETTLEMENT PROCESSOR
 * ============================================================================
 * Invoke periodically via EventBridge schedule (mirrors analytics-retention.ts
 * invocation style — a plain handler(), not SQS-triggered like settlement-processor.ts).
 *
 * Groups `ecommerce_order_settlements` rows still in `pending_batch` by vendor,
 * creates one `ecommerce_settlement_batches` row per vendor covering the period,
 * and triggers a single RazorpayX payout for the pooled `vendor_payout_amount`.
 *
 * This pooling is exactly why e-commerce orders no longer use an instant per-order
 * Razorpay Route transfer (see write-ecommerce-order-settlement.ts /
 * razorpay.razorpay.ts): an individual order's `platform_net_amount` can be
 * negative (admin-promo subsidy), but the vendor is still owed the full
 * `vendor_payout_amount` for that order — only funding across many pooled orders
 * makes that possible.
 *
 * See Ecommerce Settlement Engine plan §1/§5 and migration 1064.
 * ============================================================================
 */

import { Context } from 'aws-lambda';
import { query } from '../database/rds-connection';
import { fetchVendorBankRowsForPayout } from '../utils/vendor-bank-for-payout';
import { getRazorpayClient, resolveRazorpayPayoutSourceAccountNumber } from '../utils/payments/razorpay-client';

type PendingSettlementRow = {
  id: string;
  order_id: string;
  vendor_id: string;
  merchandise_value: string | number;
  commission_amount: string | number;
  discount_amount: string | number;
  vendor_payout_amount: string | number;
  platform_net_amount: string | number;
};

type BatchResult = {
  vendorId: string;
  batchId: string;
  orderCount: number;
  vendorPayoutAmount: number;
  platformNetAmount: number;
  payoutStatus: 'skipped_no_bank' | 'skipped_below_minimum' | 'processing' | 'failed' | 'dry_run';
  failureReason?: string;
};

const MIN_BATCH_PAYOUT_AMOUNT_INR = Number(process.env.ECOMMERCE_MIN_BATCH_PAYOUT_INR ?? 100);

function toNumber(v: string | number | null | undefined): number {
  return Number(v) || 0;
}

/**
 * Groups pending ledger rows by vendor, creates one batch per vendor, and (unless
 * `dryRun`) triggers a RazorpayX payout for the pooled amount. Dry-run mode (the
 * default until Phase 8 rollout step 5 "enable live payouts") only writes batch rows
 * with status `draft`/`processing` for admin review — no money moves.
 */
export async function processEcommerceSettlementBatches(
  options: { dryRun?: boolean; periodStart?: Date; periodEnd?: Date } = {}
): Promise<{ batches: BatchResult[]; skippedNoRows: boolean }> {
  const dryRun = options.dryRun ?? process.env.ECOMMERCE_SETTLEMENT_LIVE_PAYOUTS !== 'true';
  const periodEnd = options.periodEnd ?? new Date();
  const periodStart = options.periodStart ?? new Date(0);

  const { rows } = await query(
    `SELECT id, order_id, vendor_id, merchandise_value, commission_amount,
            discount_amount, vendor_payout_amount, platform_net_amount
     FROM ecommerce_order_settlements
     WHERE status = 'pending_batch'
       AND created_at >= $1 AND created_at <= $2
     ORDER BY vendor_id, created_at ASC`,
    [periodStart.toISOString(), periodEnd.toISOString()]
  );
  const pending = (rows || []) as PendingSettlementRow[];
  if (pending.length === 0) {
    return { batches: [], skippedNoRows: true };
  }

  const byVendor = new Map<string, PendingSettlementRow[]>();
  for (const row of pending) {
    const list = byVendor.get(row.vendor_id) ?? [];
    list.push(row);
    byVendor.set(row.vendor_id, list);
  }

  const results: BatchResult[] = [];

  for (const [vendorId, orderRows] of byVendor.entries()) {
    const grossMerchandiseValue = orderRows.reduce((s, r) => s + toNumber(r.merchandise_value), 0);
    const totalCommissionAmount = orderRows.reduce((s, r) => s + toNumber(r.commission_amount), 0);
    const totalDiscountAmount = orderRows.reduce((s, r) => s + toNumber(r.discount_amount), 0);
    const totalVendorPayoutAmount = orderRows.reduce((s, r) => s + toNumber(r.vendor_payout_amount), 0);
    const totalPlatformNetAmount = orderRows.reduce((s, r) => s + toNumber(r.platform_net_amount), 0);

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

    const { rows: batchRows } = await query(
      `INSERT INTO ecommerce_settlement_batches (
         vendor_id, period_start, period_end, order_count, gross_merchandise_value,
         total_commission_amount, total_discount_amount, total_vendor_payout_amount,
         total_platform_net_amount, status
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
       RETURNING id`,
      [
        vendorId,
        periodStart.toISOString(),
        periodEnd.toISOString(),
        orderRows.length,
        round2(grossMerchandiseValue),
        round2(totalCommissionAmount),
        round2(totalDiscountAmount),
        round2(totalVendorPayoutAmount),
        round2(totalPlatformNetAmount),
      ]
    );
    const batchId = batchRows[0].id;

    await query(
      `UPDATE ecommerce_order_settlements SET status = 'batched', settlement_batch_id = $1::uuid, updated_at = NOW()
       WHERE id = ANY($2::uuid[])`,
      [batchId, orderRows.map((r) => r.id)]
    );

    const vendorPayoutAmount = round2(totalVendorPayoutAmount);

    if (dryRun) {
      results.push({
        vendorId,
        batchId,
        orderCount: orderRows.length,
        vendorPayoutAmount,
        platformNetAmount: round2(totalPlatformNetAmount),
        payoutStatus: 'dry_run',
      });
      continue;
    }

    if (vendorPayoutAmount < MIN_BATCH_PAYOUT_AMOUNT_INR) {
      results.push({
        vendorId,
        batchId,
        orderCount: orderRows.length,
        vendorPayoutAmount,
        platformNetAmount: round2(totalPlatformNetAmount),
        payoutStatus: 'skipped_below_minimum',
      });
      continue;
    }

    const outcome = await triggerVendorBatchPayout(vendorId, batchId, vendorPayoutAmount);
    results.push({
      vendorId,
      batchId,
      orderCount: orderRows.length,
      vendorPayoutAmount,
      platformNetAmount: round2(totalPlatformNetAmount),
      ...outcome,
    });
  }

  return { batches: results, skippedNoRows: false };
}

async function triggerVendorBatchPayout(
  vendorId: string,
  batchId: string,
  amount: number
): Promise<{ payoutStatus: BatchResult['payoutStatus']; failureReason?: string }> {
  const bankRows = await fetchVendorBankRowsForPayout(vendorId);
  const bank = bankRows[0];
  const isVerified = bank?.is_verified === true || bank?.isVerified === true;
  if (!bank || !isVerified) {
    await query(
      `UPDATE ecommerce_settlement_batches SET status = 'failed', failure_reason = $2, updated_at = NOW() WHERE id = $1::uuid`,
      [batchId, 'Vendor bank account not verified']
    );
    return { payoutStatus: 'skipped_no_bank', failureReason: 'Vendor bank account not verified' };
  }

  const accountNumber = String(bank.account_number || '').replace(/\s/g, '');
  const ifscCode = String(bank.ifsc_code || bank.ifsc || '').toUpperCase().trim();
  const accountHolder = String(
    bank.account_holder_name || bank.account_holder || bank.beneficiary_name || 'Vendor'
  ).trim();
  if (!accountNumber || !ifscCode || !accountHolder) {
    await query(
      `UPDATE ecommerce_settlement_batches SET status = 'failed', failure_reason = $2, updated_at = NOW() WHERE id = $1::uuid`,
      [batchId, 'Vendor bank record incomplete']
    );
    return { payoutStatus: 'skipped_no_bank', failureReason: 'Vendor bank record incomplete' };
  }

  const payoutSourceAccount = (await resolveRazorpayPayoutSourceAccountNumber())?.trim();
  if (!payoutSourceAccount) {
    await query(
      `UPDATE ecommerce_settlement_batches SET status = 'failed', failure_reason = $2, updated_at = NOW() WHERE id = $1::uuid`,
      [batchId, 'Razorpay payout source account not configured']
    );
    return { payoutStatus: 'failed', failureReason: 'Razorpay payout source account not configured' };
  }

  await query(`UPDATE ecommerce_settlement_batches SET status = 'processing', updated_at = NOW() WHERE id = $1::uuid`, [
    batchId,
  ]);

  let vendorPhone = '0000000000';
  try {
    const v = await query(`SELECT phone FROM vendors WHERE id = $1::uuid LIMIT 1`, [vendorId]);
    if (v?.rows?.[0]?.phone) {
      vendorPhone = String(v.rows[0].phone).replace(/\D/g, '').slice(-10) || vendorPhone;
    }
  } catch {
    /* keep default */
  }

  try {
    const razorpayClient = getRazorpayClient();
    const payoutResponse = await razorpayClient.payouts.create(
      {
        account_number: payoutSourceAccount,
        amount: Math.round(amount * 100),
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'payout',
        fund_account: {
          account_type: 'bank_account',
          bank_account: { name: accountHolder, ifsc: ifscCode, account_number: accountNumber },
          contact: {
            name: accountHolder,
            email: `vendor-${vendorId}@payout.warmpawz.com`,
            contact: vendorPhone,
            type: 'vendor',
            reference_id: `vendor-${vendorId}`.slice(0, 40),
          },
        },
        queue_if_low_balance: true,
        reference_id: `ECOM-BATCH-${batchId}`.slice(0, 40),
      },
      batchId
    );

    await query(
      `UPDATE ecommerce_settlement_batches
       SET status = 'paid', razorpay_payout_id = $2, processed_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid`,
      [batchId, payoutResponse?.id ?? null]
    );
    await query(
      `UPDATE ecommerce_order_settlements SET status = 'paid', updated_at = NOW() WHERE settlement_batch_id = $1::uuid`,
      [batchId]
    );
    return { payoutStatus: 'processing' };
  } catch (rpErr: any) {
    const msg = rpErr?.message ?? rpErr?.error?.description ?? 'Razorpay payout failed';
    console.warn(`[ecommerce-settlement-processor] Razorpay payout failed for vendor ${vendorId}:`, msg);
    await query(
      `UPDATE ecommerce_settlement_batches SET status = 'failed', failure_reason = $2, updated_at = NOW() WHERE id = $1::uuid`,
      [batchId, msg]
    );
    return { payoutStatus: 'failed', failureReason: msg };
  }
}

export async function handler(
  _event?: unknown,
  _context?: Context
): Promise<{ statusCode: number; body: string }> {
  try {
    const result = await processEcommerceSettlementBatches();
    const body = JSON.stringify(result);
    console.log('[ecommerce-settlement-processor]', body);
    return { statusCode: 200, body };
  } catch (err: any) {
    console.error('[ecommerce-settlement-processor] failed:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err?.message || String(err) }) };
  }
}
