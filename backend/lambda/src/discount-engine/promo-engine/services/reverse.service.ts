import {
  dbFindUsageByTransaction,
  dbInsertAudit,
} from '../repos/promo-engine.repo';
import { reversePromoCashbackForTransaction } from './wallet-cashback.service';
import type { ReverseRequest } from '../types';

export async function reversePromotion(req: ReverseRequest): Promise<{
  success: boolean;
  reversed_cashback: number;
  usage_count: number;
  error?: string;
}> {
  const rows = await dbFindUsageByTransaction(req.transaction_id);
  if (!rows.length) {
    return { success: true, reversed_cashback: 0, usage_count: 0 };
  }

  let reversed = 0;
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const promotionId = String(r.promotion_id);
    const userId = req.user_id || String(r.user_id);
    const cb = Number(r.cashback_amount || 0);
    if (cb > 0) {
      const result = await reversePromoCashbackForTransaction({
        transactionId: req.transaction_id,
        promotionId,
        userId,
      });
      if (result.reversed) reversed += cb;
    }
    await dbInsertAudit({
      promotion_id: promotionId,
      evaluation_id: req.evaluation_id || (r.evaluation_id ? String(r.evaluation_id) : null),
      event_type: 'REVERSED',
      payload: {
        transaction_id: req.transaction_id,
        reason: req.reason,
        cashback_amount: cb,
      },
    });
  }

  return {
    success: true,
    reversed_cashback: reversed,
    usage_count: rows.length,
  };
}
