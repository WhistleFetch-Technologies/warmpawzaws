import {
  dbAdjustBudgetConsumed,
  dbAdjustRuleBudgetConsumed,
  dbFindUsageByTransaction,
  dbInsertAudit,
  dbMarkUsageReversed,
} from '../repos/promo-engine.repo';
import { reversePromoCashbackForTransaction } from './wallet-cashback.service';
import { safeReverseVcfVisit } from './visit-writer.service';
import type { ReverseRequest } from '../types';

/**
 * Reverse a committed transaction: claw back unused cashback, release the usage row
 * (so per-user / daily / campaign limits free up) and return spend to the budget.
 * Idempotent — only rows not yet reversed are released.
 */
export async function reversePromotion(req: ReverseRequest): Promise<{
  success: boolean;
  reversed_cashback: number;
  usage_count: number;
  error?: string;
}> {
  const existingRows = await dbFindUsageByTransaction(req.transaction_id);
  const userIdHint =
    req.user_id ||
    (existingRows[0] ? String((existingRows[0] as { user_id?: string }).user_id || '') : '');
  if (userIdHint) {
    await safeReverseVcfVisit({ userId: userIdHint, referenceId: req.transaction_id });
  }

  const released = await dbMarkUsageReversed(req.transaction_id);
  if (!released.length) {
    return { success: true, reversed_cashback: 0, usage_count: 0 };
  }

  let reversed = 0;
  for (const row of released) {
    const userId = req.user_id || row.user_id;
    const cb = row.cashback_amount;
    if (cb > 0) {
      const result = await reversePromoCashbackForTransaction({
        transactionId: req.transaction_id,
        promotionId: row.promotion_id,
        userId,
      });
      if (result.reversed) reversed += cb;
    }
    const spend = row.discount_amount + row.cashback_amount;
    if (spend > 0) {
      await dbAdjustBudgetConsumed(row.promotion_id, -spend);
      if (row.rule_id) await dbAdjustRuleBudgetConsumed(row.rule_id, -spend);
    }
    await dbInsertAudit({
      promotion_id: row.promotion_id,
      evaluation_id: req.evaluation_id || row.evaluation_id,
      event_type: 'REVERSED',
      payload: {
        transaction_id: req.transaction_id,
        rule_id: row.rule_id,
        reason: req.reason,
        cashback_amount: cb,
        budget_released: spend,
      },
    });
  }

  return {
    success: true,
    reversed_cashback: reversed,
    usage_count: released.length,
  };
}
