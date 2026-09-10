/**
 * WPay Pay Bill shadow evaluation against the ONE Discount Engine V2.
 * Existing computeWpayCommercialQuote / withhold quote remains authoritative.
 * Evaluation only — never commit usage, wallet, or settlement.
 */
import { getUnifiedDiscountResolver } from '../resolver/unified-discount-resolver';
import type { ResolverResult } from '../resolver/types';
import {
  getPbeCommerceContextMode,
  isPbeCommerceContextShadowEnabled,
} from '../policy/pbe-commerce-context-mode';
import { wpayQuoteToDiscountContext } from './commerce-context';

export type WpayShadowCategory =
  | 'MATCH'
  | 'DIFF_AMOUNT'
  | 'DIFF_ROUNDING'
  | 'NO_PROMOTION'
  | 'ENGINE_ERROR';

export type WpayPayBillShadowInput = {
  quotedAmount: number;
  vendorId?: string;
  customerId?: string;
  wpayDiscountAmount: number;
  wpayDiscountPercent: number;
};

export type WpayShadowComparison = {
  category: WpayShadowCategory;
  commerceModel: 'warmpawz_pay';
  transactionType: 'pay_bill';
  quotedAmount: number;
  wpayDiscountAmount: number;
  wpayDiscountPercent: number;
  shadowDiscountAmount: number | null;
  amountDelta: number | null;
  /** WPay D is vendor commercial pricing (pricing_discount_value), not a PBE benefit. */
  wpayDiscountKind: 'commercial_pricing';
  shadowDiscountKind: 'promotion_engine';
  shadowPromotionIds: string[];
  engineError?: string;
  durationMs: number;
};

const MATCH_EPS = 0.01;
const ROUNDING_EPS = 0.05;

export function compareWpayPayBillShadow(params: {
  quotedAmount: number;
  wpayDiscountAmount: number;
  wpayDiscountPercent: number;
  shadowDiscountAmount: number;
  shadowPromotionIds?: string[];
  durationMs?: number;
}): WpayShadowComparison {
  const wpayDiscountAmount = Number(params.wpayDiscountAmount) || 0;
  const shadowDiscountAmount = Number(params.shadowDiscountAmount) || 0;
  const amountDelta = Math.round((shadowDiscountAmount - wpayDiscountAmount) * 100) / 100;
  const absDelta = Math.abs(amountDelta);
  const shadowPromotionIds = params.shadowPromotionIds ?? [];

  let category: WpayShadowCategory;
  if (shadowPromotionIds.length === 0 && shadowDiscountAmount === 0 && wpayDiscountAmount > 0) {
    category = 'NO_PROMOTION';
  } else if (absDelta <= MATCH_EPS) {
    category = 'MATCH';
  } else if (absDelta <= ROUNDING_EPS) {
    category = 'DIFF_ROUNDING';
  } else {
    category = 'DIFF_AMOUNT';
  }

  return {
    category,
    commerceModel: 'warmpawz_pay',
    transactionType: 'pay_bill',
    quotedAmount: params.quotedAmount,
    wpayDiscountAmount,
    wpayDiscountPercent: params.wpayDiscountPercent,
    shadowDiscountAmount,
    amountDelta,
    wpayDiscountKind: 'commercial_pricing',
    shadowDiscountKind: 'promotion_engine',
    shadowPromotionIds,
    durationMs: params.durationMs ?? 0,
  };
}

export function logWpayPayBillShadow(comparison: WpayShadowComparison): void {
  const payload = {
    category: comparison.category,
    commerceModel: comparison.commerceModel,
    transactionType: comparison.transactionType,
    vendorScoped: true,
    quotedAmount: comparison.quotedAmount,
    wpayDiscountAmount: comparison.wpayDiscountAmount,
    wpayDiscountPercent: comparison.wpayDiscountPercent,
    shadowDiscountAmount: comparison.shadowDiscountAmount,
    amountDelta: comparison.amountDelta,
    wpayDiscountKind: comparison.wpayDiscountKind,
    shadowDiscountKind: comparison.shadowDiscountKind,
    shadowPromotionIds: comparison.shadowPromotionIds,
    durationMs: comparison.durationMs,
    engineError: comparison.engineError,
  };
  if (comparison.category === 'ENGINE_ERROR') {
    console.warn('[pbe-wpay-shadow]', payload);
    return;
  }
  console.info('[pbe-wpay-shadow]', payload);
}

type ResolveFn = (context: ReturnType<typeof wpayQuoteToDiscountContext>) => Promise<ResolverResult>;

export async function evaluateWpayPayBillShadow(
  input: WpayPayBillShadowInput,
  resolve: ResolveFn = (context) => getUnifiedDiscountResolver().resolve(context)
): Promise<WpayShadowComparison> {
  const started = Date.now();
  try {
    const context = wpayQuoteToDiscountContext({
      quotedAmount: input.quotedAmount,
      vendorId: input.vendorId,
      customerId: input.customerId,
    });
    const result = await resolve(context);
    const shadowPromotionIds = (result.applied ?? []).map((row) => String(row.id)).filter(Boolean);
    return compareWpayPayBillShadow({
      quotedAmount: input.quotedAmount,
      wpayDiscountAmount: input.wpayDiscountAmount,
      wpayDiscountPercent: input.wpayDiscountPercent,
      shadowDiscountAmount: Number(result.totalSavings) || 0,
      shadowPromotionIds,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    return {
      category: 'ENGINE_ERROR',
      commerceModel: 'warmpawz_pay',
      transactionType: 'pay_bill',
      quotedAmount: input.quotedAmount,
      wpayDiscountAmount: input.wpayDiscountAmount,
      wpayDiscountPercent: input.wpayDiscountPercent,
      shadowDiscountAmount: null,
      amountDelta: null,
      wpayDiscountKind: 'commercial_pricing',
      shadowDiscountKind: 'promotion_engine',
      shadowPromotionIds: [],
      engineError: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
    };
  }
}

/** Fire-and-forget. Shadow failure must never reject the WPay quote. */
export function scheduleWpayPayBillShadow(input: WpayPayBillShadowInput): void {
  if (!isPbeCommerceContextShadowEnabled()) return;
  if (getPbeCommerceContextMode() === 'AUTHORITATIVE') {
    console.warn(
      '[pbe-wpay-shadow] AUTHORITATIVE ignored; WPay calculation remains authoritative'
    );
  }
  void evaluateWpayPayBillShadow(input)
    .then(logWpayPayBillShadow)
    .catch((err) => {
      console.warn('[pbe-wpay-shadow]', {
        category: 'ENGINE_ERROR',
        engineError: err instanceof Error ? err.message : String(err),
      });
    });
}
