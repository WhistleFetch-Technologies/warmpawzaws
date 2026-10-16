import { dbInsertEvaluation } from '../../../discount-engine/promo-engine/repos/promo-engine.repo';
import { evaluatePromotions } from '../../../discount-engine/promo-engine/services/evaluate.service';
import type {
  AppliedBenefit,
  EvaluateRequest,
  EvaluateResult,
} from '../../../discount-engine/promo-engine/types';

export type EcommercePromoLine = {
  id?: string;
  vendorId?: string | null;
  amount: number;
};

type EvaluateFn = (req: EvaluateRequest) => Promise<EvaluateResult>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function vendorKey(vendorId: string | null | undefined): string {
  return String(vendorId || '').trim();
}

function lineAmount(line: EcommercePromoLine): number {
  const amount = Number(line.amount) || 0;
  return amount > 0 ? round2(amount) : 0;
}

function hasOffer(result: EvaluateResult | null | undefined): boolean {
  if (!result) return false;
  return (Number(result.summary?.discount) || 0) > 0 || (Number(result.summary?.cashback) || 0) > 0;
}

function baseRequest(userId: string, amount: number, lines: EcommercePromoLine[]): EvaluateRequest {
  return {
    user_id: userId,
    persist: false,
    transaction: {
      type: 'ECOMMERCE',
      channel: 'ecommerce',
      service_category: 'ecommerce',
      amount,
      lines: lines.map((line) => ({
        id: line.id,
        amount: lineAmount(line),
        service_category: 'ecommerce',
      })),
    },
  };
}

/**
 * Ecommerce cart: each vendor promo is scored on that vendor's subtotal.
 * A vendor with no matching promo leaves those items for one platform (letter F) promo.
 * One persisted evaluation holds every winning benefit so commit records each promo.
 */
export async function evaluateEcommerceCartPromos(opts: {
  userId: string;
  lines: EcommercePromoLine[];
  persist?: boolean;
  evaluate?: EvaluateFn;
}): Promise<EvaluateResult> {
  const evaluate = opts.evaluate || evaluatePromotions;
  const userId = String(opts.userId || '').trim();
  const source = (opts.lines || [])
    .map((line) => ({ ...line, amount: lineAmount(line) }))
    .filter((line) => line.amount > 0);

  const groups = new Map<string, EcommercePromoLine[]>();
  for (const line of source) {
    const key = vendorKey(line.vendorId);
    const list = groups.get(key) || [];
    list.push(line);
    groups.set(key, list);
  }

  const benefits: AppliedBenefit[] = [];
  const matched: string[] = [];
  const rejected: EvaluateResult['explain']['rejected_promotions'] = [];
  const uncovered: EcommercePromoLine[] = [];
  let customerCopy: EvaluateResult['customer_copy'] = null;
  let benefitCap: EvaluateResult['benefit_cap'] = null;

  for (const [key, groupLines] of groups) {
    const amount = round2(groupLines.reduce((sum, line) => sum + line.amount, 0));
    if (!key) {
      uncovered.push(...groupLines);
      continue;
    }
    const result = await evaluate({
      ...baseRequest(userId, amount, groupLines),
      transaction: {
        ...baseRequest(userId, amount, groupLines).transaction,
        vendorId: key,
        vendor_id: key,
        publish_letters: ['V'],
      },
    });
    if (result.benefit_cap) benefitCap = result.benefit_cap;
    rejected.push(...(result.explain?.rejected_promotions || []));
    if (!hasOffer(result)) {
      uncovered.push(...groupLines);
      continue;
    }
    benefits.push(...(result.benefits || []));
    if (result.winner_promotion_id) matched.push(result.winner_promotion_id);
    if (!customerCopy && result.customer_copy) customerCopy = result.customer_copy;
  }

  const uncoveredAmount = round2(uncovered.reduce((sum, line) => sum + line.amount, 0));
  if (uncoveredAmount > 0) {
    const result = await evaluate({
      ...baseRequest(userId, uncoveredAmount, uncovered),
      transaction: {
        ...baseRequest(userId, uncoveredAmount, uncovered).transaction,
        publish_letters: ['F'],
      },
    });
    if (result.benefit_cap) benefitCap = result.benefit_cap;
    rejected.push(...(result.explain?.rejected_promotions || []));
    if (hasOffer(result)) {
      benefits.push(...(result.benefits || []));
      if (result.winner_promotion_id) matched.push(result.winner_promotion_id);
      if (!customerCopy && result.customer_copy) customerCopy = result.customer_copy;
    }
  }

  const gross = round2(source.reduce((sum, line) => sum + line.amount, 0));
  const discount = round2(
    benefits.filter((b) => b.benefit_type === 'DISCOUNT').reduce((sum, b) => sum + b.amount, 0),
  );
  const cashback = round2(
    benefits.filter((b) => b.benefit_type === 'CASHBACK').reduce((sum, b) => sum + b.amount, 0),
  );
  const body: EvaluateResult = {
    eligible: discount > 0 || cashback > 0,
    evaluation_id: '',
    winner_promotion_id: benefits[0]?.promotion_id || null,
    customer_copy: customerCopy,
    benefits,
    summary: {
      gross_amount: gross,
      discount,
      payable: round2(Math.max(0, gross - discount)),
      cashback,
    },
    explain: {
      failures: [],
      matched_promotions: matched,
      rejected_promotions: rejected,
    },
    ...(benefitCap ? { benefit_cap: benefitCap } : {}),
  };

  if (opts.persist === true && userId && (benefits.length > 0 || benefitCap)) {
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000);
    body.evaluation_id = await dbInsertEvaluation({
      user_id: userId,
      request_json: {
        user_id: userId,
        persist: true,
        transaction: {
          type: 'ECOMMERCE',
          channel: 'ecommerce',
          amount: gross,
          lines: source,
        },
        split: 'vendor',
      },
      result_json: {
        eligible: body.eligible,
        benefits: body.benefits,
        summary: body.summary,
        winner_promotion_id: body.winner_promotion_id ?? null,
        customer_copy: body.customer_copy ?? null,
        benefit_cap: body.benefit_cap ?? null,
      },
      explain_json: body.explain,
      expires_at: expires.toISOString(),
    });
  }

  return body;
}
