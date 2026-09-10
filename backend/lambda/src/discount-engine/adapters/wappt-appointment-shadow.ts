/**
 * Appointment shadow evaluation against the ONE Discount Engine V2.
 * Catalogue fee + applyWapptCatalogueFeeAmounts remain authoritative.
 * Evaluation only — never commit usage, wallet, GST, or settlement.
 */
import { getUnifiedDiscountResolver } from '../resolver/unified-discount-resolver';
import type { ResolverResult } from '../resolver/types';
import {
  getPbeCommerceContextMode,
  isPbeCommerceContextShadowEnabled,
} from '../policy/pbe-commerce-context-mode';
import { appointmentFeeToDiscountContext } from './commerce-context';

export type WapptShadowCategory = 'MATCH' | 'DIFF_AMOUNT' | 'NO_PROMOTION' | 'ENGINE_ERROR';

export type WapptAppointmentShadowInput = {
  appointmentFee: number;
  vendorId?: string;
  customerId?: string;
  couponCode?: string;
};

export type WapptShadowComparison = {
  category: WapptShadowCategory;
  commerceModel: 'warmpawz_pay';
  transactionType: 'appointment';
  appointmentFee: number;
  /** Current path skips promotions — discount is always 0. */
  currentDiscountAmount: number;
  shadowDiscountAmount: number | null;
  amountDelta: number | null;
  shadowPromotionIds: string[];
  engineError?: string;
  durationMs: number;
};

const MATCH_EPS = 0.01;

export function compareWapptAppointmentShadow(params: {
  appointmentFee: number;
  shadowDiscountAmount: number;
  shadowPromotionIds?: string[];
  durationMs?: number;
}): WapptShadowComparison {
  const currentDiscountAmount = 0;
  const shadowDiscountAmount = Number(params.shadowDiscountAmount) || 0;
  const amountDelta = Math.round((shadowDiscountAmount - currentDiscountAmount) * 100) / 100;
  const shadowPromotionIds = params.shadowPromotionIds ?? [];

  let category: WapptShadowCategory;
  if (shadowPromotionIds.length === 0 && shadowDiscountAmount === 0) {
    category = 'NO_PROMOTION';
  } else if (Math.abs(amountDelta) <= MATCH_EPS) {
    category = 'MATCH';
  } else {
    category = 'DIFF_AMOUNT';
  }

  return {
    category,
    commerceModel: 'warmpawz_pay',
    transactionType: 'appointment',
    appointmentFee: params.appointmentFee,
    currentDiscountAmount,
    shadowDiscountAmount,
    amountDelta,
    shadowPromotionIds,
    durationMs: params.durationMs ?? 0,
  };
}

export function logWapptAppointmentShadow(comparison: WapptShadowComparison): void {
  const payload = {
    category: comparison.category,
    commerceModel: comparison.commerceModel,
    transactionType: comparison.transactionType,
    appointmentFee: comparison.appointmentFee,
    currentDiscountAmount: comparison.currentDiscountAmount,
    shadowDiscountAmount: comparison.shadowDiscountAmount,
    amountDelta: comparison.amountDelta,
    shadowPromotionIds: comparison.shadowPromotionIds,
    durationMs: comparison.durationMs,
    engineError: comparison.engineError,
  };
  if (comparison.category === 'ENGINE_ERROR') {
    console.warn('[pbe-wappt-shadow]', payload);
    return;
  }
  console.info('[pbe-wappt-shadow]', payload);
}

type ResolveFn = (
  context: ReturnType<typeof appointmentFeeToDiscountContext>
) => Promise<ResolverResult>;

export async function evaluateWapptAppointmentShadow(
  input: WapptAppointmentShadowInput,
  resolve: ResolveFn = (context) => getUnifiedDiscountResolver().resolve(context)
): Promise<WapptShadowComparison> {
  const started = Date.now();
  try {
    const context = appointmentFeeToDiscountContext({
      appointmentFee: input.appointmentFee,
      vendorId: input.vendorId,
      customerId: input.customerId,
      couponCode: input.couponCode,
    });
    const result = await resolve(context);
    return compareWapptAppointmentShadow({
      appointmentFee: input.appointmentFee,
      shadowDiscountAmount: Number(result.totalSavings) || 0,
      shadowPromotionIds: (result.applied ?? []).map((row) => String(row.id)).filter(Boolean),
      durationMs: Date.now() - started,
    });
  } catch (err) {
    return {
      category: 'ENGINE_ERROR',
      commerceModel: 'warmpawz_pay',
      transactionType: 'appointment',
      appointmentFee: input.appointmentFee,
      currentDiscountAmount: 0,
      shadowDiscountAmount: null,
      amountDelta: null,
      shadowPromotionIds: [],
      engineError: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
    };
  }
}

/** Fire-and-forget. Shadow failure must never reject Appointment booking. */
export function scheduleWapptAppointmentShadow(input: WapptAppointmentShadowInput): void {
  if (!isPbeCommerceContextShadowEnabled()) return;
  if (getPbeCommerceContextMode() === 'AUTHORITATIVE') {
    console.warn(
      '[pbe-wappt-shadow] AUTHORITATIVE ignored; catalogue appointment fee remains authoritative'
    );
  }
  void evaluateWapptAppointmentShadow(input)
    .then(logWapptAppointmentShadow)
    .catch((err) => {
      console.warn('[pbe-wappt-shadow]', {
        category: 'ENGINE_ERROR',
        engineError: err instanceof Error ? err.message : String(err),
      });
    });
}
