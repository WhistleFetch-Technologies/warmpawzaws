/**
 * Async bill extract worker. Loads S3 bytes by key, calls Gemini, merges billExtract
 * onto settlements.settlement_breakup without touching verify/settle flags.
 * Never throws — Event invoke retries on error would re-bill Gemini.
 */

import { query } from '../database/rds-connection';
import { getObjectBuffer } from '../services/image/image-repository';
import {
  readBillImageKey,
  toPersistedBillExtract,
  type WpayBillExtract,
} from '../endpoints/warmpawz-pay/shared/pet-store-walkin';
import {
  callGeminiBillExtract,
  mimeFromBillObject,
  WPAY_BILL_EXTRACT_MODEL,
} from './wpay-bill-extract-gemini';
import type { WpayBillExtractJobEvent } from './wpay-bill-extract-invoke';

type SettlementExtractRow = {
  id: string;
  billImageKey: string | null;
  quotedAmount: number;
};

async function loadSettlementForExtract(settlementId: string): Promise<SettlementExtractRow | null> {
  const result = await query(
    `SELECT s.id::text AS id,
            s.settlement_breakup,
            COALESCE(
              NULLIF(s.settlement_breakup->>'quotedAmount', '')::numeric,
              p.original_amount,
              s.total_amount,
              0
            ) AS quoted_amount
     FROM settlements s
     LEFT JOIN payments p ON p.id = s.payment_id
     WHERE s.id = $1::uuid
       AND s.order_type = 'warmpawz_pay'
     LIMIT 1`,
    [settlementId],
  );
  const row = (result.rows[0] || null) as Record<string, unknown> | null;
  if (!row) return null;
  const breakup =
    row.settlement_breakup && typeof row.settlement_breakup === 'object'
      ? (row.settlement_breakup as Record<string, unknown>)
      : null;
  return {
    id: String(row.id),
    billImageKey: readBillImageKey(breakup),
    quotedAmount: Number(row.quoted_amount || 0) || 0,
  };
}

async function persistBillExtract(
  settlementId: string,
  imageKey: string,
  extract: WpayBillExtract,
): Promise<boolean> {
  const result = await query(
    `UPDATE settlements
     SET settlement_breakup = COALESCE(settlement_breakup, '{}'::jsonb)
       || jsonb_build_object('billExtract', $2::jsonb)
     WHERE id = $1::uuid
       AND order_type = 'warmpawz_pay'
       AND NULLIF(TRIM(settlement_breakup->>'billImageKey'), '') = $3::text`,
    [settlementId, JSON.stringify(extract), imageKey],
  );
  return (result.rowCount || 0) > 0;
}

export async function processWpayBillExtractJob(event: WpayBillExtractJobEvent): Promise<void> {
  const settlementId = String(event.settlementId || '').trim();
  const imageKey = String(event.imageKey || '').trim();
  if (!settlementId || !imageKey) return;

  const fail = async (error: string) => {
    try {
      await persistBillExtract(
        settlementId,
        imageKey,
        toPersistedBillExtract({
          status: 'failed',
          error,
          model: WPAY_BILL_EXTRACT_MODEL,
        }),
      );
    } catch (persistErr) {
      console.error('[wpay-bill-extract] persist failed status:', (persistErr as Error)?.message || persistErr);
    }
  };

  try {
    const row = await loadSettlementForExtract(settlementId);
    if (!row || row.billImageKey !== imageKey) {
      console.warn(
        JSON.stringify({
          metric: 'wpay_bill_extract_skipped',
          settlementId,
          reason: row ? 'image_key_mismatch' : 'settlement_not_found',
        }),
      );
      return;
    }

    const object = await getObjectBuffer(imageKey);
    if (!object) {
      await fail('bill image missing from storage');
      return;
    }

    const lineItems = await callGeminiBillExtract({
      quotedAmount: row.quotedAmount,
      imageBytes: object.buffer,
      mimeType: mimeFromBillObject({ contentType: object.contentType, imageKey }),
    });

    const saved = await persistBillExtract(
      settlementId,
      imageKey,
      toPersistedBillExtract({
        status: 'ok',
        quotedAmount: row.quotedAmount,
        lineItems,
        model: WPAY_BILL_EXTRACT_MODEL,
      }),
    );
    console.log(
      JSON.stringify({
        metric: 'wpay_bill_extract_done',
        settlementId,
        saved,
        itemCount: lineItems.length,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'bill extract failed';
    console.error('[wpay-bill-extract] job failed:', message);
    await fail(message);
  }
}
