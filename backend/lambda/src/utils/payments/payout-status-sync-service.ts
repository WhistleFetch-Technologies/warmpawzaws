/**
 * Reconciles local payouts rows with Razorpay GET /v1/payouts/:id.
 * Does not create payouts or touch settlement calculation.
 */

import { query } from '../../database/rds-connection';
import { getRazorpayClient } from './razorpay-client';

export type PayoutSyncRow = {
  id: string;
  payout_status: string;
  razorpay_payout_id: string;
  failure_reason?: string | null;
  payout_utr?: string | null;
};

export type PayoutSyncRunResult = {
  scanned: number;
  updated: number;
  skipped: number;
  errors: { payoutId: string; razorpayPayoutId: string; message: string }[];
};

function normStr(v: unknown): string {
  return String(v ?? '').trim();
}

function extractUtr(entity: Record<string, unknown> | null | undefined): string | null {
  if (!entity) return null;
  const u = entity.utr;
  if (u == null) return null;
  const s = String(u).trim();
  return s.length > 0 ? s : null;
}

function extractFailureDescription(entity: Record<string, unknown>): string {
  const sd = entity.status_details as Record<string, unknown> | undefined;
  const d = sd?.description ?? sd?.reason;
  return normStr(d);
}

export class PayoutStatusSyncService {
  static async fetchFromRazorpay(payoutId: string): Promise<Record<string, unknown>> {
    const client = getRazorpayClient();
    return (await client.payouts.fetch(payoutId)) as Record<string, unknown>;
  }

  /** Maps Razorpay payout status to DB payout_status. Unknown values return null (no status change). */
  static mapStatus(razorpayStatus: string | undefined | null): string | null {
    const s = String(razorpayStatus || '').toLowerCase().trim();
    switch (s) {
      case 'queued':
      case 'pending':
        return 'pending';
      case 'processing':
        return 'processing';
      case 'processed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'cancelled':
        return 'cancelled';
      case 'reversed':
        return 'cancelled';
      default:
        return null;
    }
  }

  /**
   * Fetches Razorpay by razorpay_payout_id, updates last_synced_at always on success.
   * Updates payout_status / payout_utr / failure_reason only when they materially change per rules.
   */
  static async syncPayoutRow(row: PayoutSyncRow): Promise<{ substantive: boolean; error?: string }> {
    const rzId = normStr(row.razorpay_payout_id);
    if (!rzId) {
      return { substantive: false, error: 'missing razorpay_payout_id' };
    }

    let entity: Record<string, unknown>;
    try {
      entity = await PayoutStatusSyncService.fetchFromRazorpay(rzId);
    } catch (e: any) {
      return { substantive: false, error: e?.message || String(e) };
    }

    const rawRz = String(entity.status || '').toLowerCase().trim();
    const mappedStatus = PayoutStatusSyncService.mapStatus(entity.status as string);
    const newUtr = extractUtr(entity);

    const oldStatus = normStr(row.payout_status);
    const oldUtr = row.payout_utr != null ? normStr(row.payout_utr) : '';
    const oldFr = row.failure_reason != null ? normStr(row.failure_reason) : '';

    let newFailure: string | null = row.failure_reason != null ? normStr(row.failure_reason) : null;
    if (newFailure === '') newFailure = null;

    if (rawRz === 'reversed') {
      const desc = extractFailureDescription(entity);
      newFailure = `reversed: ${desc || rawRz}`.trim();
    } else if (mappedStatus === 'failed' || mappedStatus === 'cancelled') {
      newFailure = extractFailureDescription(entity) || rawRz || mappedStatus || null;
      if (newFailure === '') newFailure = null;
    } else if (mappedStatus === 'completed') {
      newFailure = null;
    }

    const newStatus = mappedStatus != null ? mappedStatus : oldStatus;

    const statusChanged = mappedStatus != null && mappedStatus !== oldStatus;
    const utrNewlyAvailable = newUtr != null && newUtr !== '' && newUtr !== oldUtr;
    const failureReasonChanged = normStr(newFailure ?? '') !== oldFr;

    const substantive = statusChanged || utrNewlyAvailable || failureReasonChanged;

    const sets: string[] = ['last_synced_at = NOW()'];
    const params: unknown[] = [];

    if (statusChanged) {
      sets.push(`payout_status = $${params.length + 1}`);
      params.push(newStatus);
    }
    if (utrNewlyAvailable) {
      sets.push(`payout_utr = $${params.length + 1}`);
      params.push(newUtr);
    }
    if (failureReasonChanged) {
      sets.push(`failure_reason = $${params.length + 1}`);
      params.push(newFailure);
    }

    params.push(row.id);
    const whereIdx = params.length;
    await query(`UPDATE payouts SET ${sets.join(', ')} WHERE id = $${whereIdx}::uuid`, params);

    const oldStatusLog = oldStatus;
    console.log(
      '[PayoutStatusSync]',
      JSON.stringify({
        payoutId: row.id,
        razorpayPayoutId: rzId,
        transition: `${oldStatusLog} → ${newStatus}`,
        utrPresent: Boolean(newUtr),
        error: null as string | null,
      })
    );

    return { substantive };
  }

  static async run(limit = 100): Promise<PayoutSyncRunResult> {
    const lim = Number.isFinite(limit) ? Math.min(500, Math.max(1, Math.floor(limit))) : 100;

    const res = await query(
      `
      SELECT id, payout_status, razorpay_payout_id, failure_reason, payout_utr
      FROM payouts
      WHERE razorpay_payout_id IS NOT NULL
        AND TRIM(razorpay_payout_id) <> ''
        AND (
          payout_status NOT IN ('completed', 'failed', 'cancelled')
          OR (payout_status = 'completed' AND (payout_utr IS NULL OR TRIM(payout_utr) = ''))
        )
      ORDER BY last_synced_at ASC NULLS FIRST
      LIMIT $1
      `,
      [lim]
    );

    const rows = (res.rows || []) as PayoutSyncRow[];
    const out: PayoutSyncRunResult = {
      scanned: rows.length,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (const row of rows) {
      const rzId = normStr(row.razorpay_payout_id);
      const oldStatus = normStr(row.payout_status);
      const r = await PayoutStatusSyncService.syncPayoutRow(row);
      if (r.error) {
        out.errors.push({ payoutId: row.id, razorpayPayoutId: rzId, message: r.error });
        console.log(
          '[PayoutStatusSync]',
          JSON.stringify({
            payoutId: row.id,
            razorpayPayoutId: rzId,
            transition: `${oldStatus} → (error)`,
            utrPresent: false,
            error: r.error,
          })
        );
        continue;
      }
      if (r.substantive) out.updated += 1;
      else out.skipped += 1;
    }

    return out;
  }
}
