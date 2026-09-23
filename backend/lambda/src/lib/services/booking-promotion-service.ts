import { query } from '../../database/rds-connection';
import { evaluatePromotions, normalizePromoCategory } from '../../discount-engine/promo-engine';
import type { EvaluateResult } from '../../discount-engine/promo-engine/types';
import type { UnifiedResolverResponse } from '../../discount-engine/resolver/unified-resolver-response';
import { parseJsonMetaFromNotes } from '../../utils/booking-notes-meta';
import type { BookingPromotionResult } from '../../utils/service-promotion-engine';

export type ResolveBookingPromotionsParams = {
  vendorId: string;
  serviceIds: string[];
  serviceStyle?: string;
  amount: number;
  customerId?: string;
  serviceCategory?: string;
  /** Ignored — legacy coupons are retired. */
  couponCode?: string;
  debugSessionId?: string;
};

type BookingResolveSharedContext = {
  preNormalizedServiceIds?: string[];
  priorVendorBookingCount?: number;
  preloadedRowsBySource?: Partial<Record<string, unknown[]>>;
};

/**
 * Vendor promotions stored vendor_services.id in applicable_services.
 * Callers may still send catalog ids — keep this map for booking create paths.
 */
export async function buildBookingServiceIdMap(
  vendorId: string,
  serviceIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(serviceIds.map((x) => String(x).trim()).filter(Boolean))];
  const idMap = new Map<string, string>();
  if (!vendorId || unique.length === 0) return idMap;

  try {
    const res = await query(
      `SELECT id::text AS vendor_service_id, service_id::text AS catalog_service_id
       FROM vendor_services
       WHERE vendor_id = $1::uuid
         AND (id::text = ANY($2::text[]) OR service_id::text = ANY($2::text[]))`,
      [vendorId, unique]
    );
    for (const row of (res as { rows?: Record<string, unknown>[] }).rows || []) {
      const vsId = String(row.vendor_service_id || '');
      if (!vsId) continue;
      idMap.set(vsId, vsId);
      const catalogId = row.catalog_service_id ? String(row.catalog_service_id) : '';
      if (catalogId) idMap.set(catalogId, vsId);
    }
  } catch {
    // Callers keep the ids they sent.
  }
  return idMap;
}

export async function normalizeBookingServiceIds(
  vendorId: string,
  serviceIds: string[]
): Promise<string[]> {
  const unique = [...new Set(serviceIds.map((x) => String(x).trim()).filter(Boolean))];
  if (!vendorId || unique.length === 0) return unique;
  const idMap = await buildBookingServiceIdMap(vendorId, unique);
  return unique.map((id) => idMap.get(id) || id);
}

async function evaluateEngine(
  params: ResolveBookingPromotionsParams & { displayPromotionsOnly?: boolean }
): Promise<EvaluateResult | null> {
  if (!params.customerId) return null;
  try {
    const { loadServerPaymentContext } = await import('../../discount-engine/promo-engine');
    const ctx = await loadServerPaymentContext({
      surface: 'booking',
      vendorId: params.vendorId,
      serviceStyle: params.serviceStyle,
      bookingCategoryId: params.serviceCategory,
    });
    return await evaluatePromotions({
      user_id: params.customerId,
      persist: params.displayPromotionsOnly === true ? false : true,
      transaction: {
        type: 'BOOKING',
        channel: ctx.channel || undefined,
        service_category: params.serviceCategory
          ? normalizePromoCategory(params.serviceCategory) || undefined
          : undefined,
        service_type: params.serviceStyle,
        vendor_id: ctx.vendorId || params.vendorId,
        vendorId: ctx.vendorId || params.vendorId,
        categoryId: ctx.categoryId || undefined,
        amount: params.amount,
      },
    });
  } catch (err) {
    console.warn('[promo-engine] evaluate skipped:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function buildUnifiedQuoteFromEngine(opts: {
  amount: number;
  result: EvaluateResult | null;
  couponCode?: string;
}): UnifiedResolverResponse {
  const discount = Math.max(0, Number(opts.result?.summary.discount ?? 0));
  const cashback = Math.max(0, Number(opts.result?.summary.cashback ?? 0));
  const payable =
    opts.result?.summary.payable != null
      ? Number(opts.result.summary.payable)
      : Math.max(0, opts.amount - discount);
  const matchedId = opts.result?.explain?.matched_promotions?.[0];
  const cashbackBenefit = (opts.result?.benefits || []).find((b) => b.benefit_type === 'CASHBACK');

  const appliedOffers =
    discount > 0
      ? [
          {
            id: matchedId || opts.result?.evaluation_id || 'promo-engine',
            name: 'Promotion',
            offerType: 'PROMO_ENGINE',
            source: 'platform' as const,
            discountAmount: discount,
            trigger: 'AUTO' as const,
            order: 1,
            benefitType: 'DISCOUNT',
          },
        ]
      : [];

  const rejectedOffers = opts.couponCode?.trim()
    ? [
        {
          id: opts.couponCode.trim(),
          name: opts.couponCode.trim(),
          reason: 'Coupons are retired. Offers apply automatically from the Promotion Engine.',
          reasonCode: 'COUPONS_RETIRED',
          trigger: 'CODE' as const,
        },
      ]
    : [];

  const displayMessages = [];
  if (cashback > 0) {
    displayMessages.push({
      type: 'info' as const,
      code: 'PROMO_ENGINE_PENDING_CASHBACK',
      message: `Earn ₹${cashback} cashback after completion (credited on payment confirm)`,
    });
  }

  return {
    success: true,
    resolverSource: 'v2',
    resolverVersion: 'promo-engine',
    currentPolicy: {
      applicationStrategy: 'BEST_OFFER_ONLY',
      resolverMode: 'promo-engine',
      settlementMode: 'off',
      stackMode: 'off',
      priorityMode: 'off',
    },
    appliedOffers,
    rejectedOffers,
    savings: {
      originalAmount: opts.amount,
      totalSavings: discount,
      finalAmount: Math.max(0, payable),
      vendorDiscountAmount: 0,
      platformDiscountAmount: discount,
      couponDiscountAmount: 0,
    },
    displayMessages,
    winningPromotion: appliedOffers[0] ?? null,
    promoEngine: opts.result
      ? {
          evaluationId: opts.result.evaluation_id,
          pendingCashback: cashback,
          engineDiscount: discount,
          eligible: opts.result.eligible,
          redeemScope: cashbackBenefit?.redeem_scope || [],
          expiryDays: cashbackBenefit?.expiry_days ?? null,
        }
      : undefined,
  };
}

function bookingResultFromEngine(
  amount: number,
  result: EvaluateResult | null
): BookingPromotionResult {
  const discount = Math.max(0, Number(result?.summary.discount ?? 0));
  const payable =
    result?.summary.payable != null ? Number(result.summary.payable) : Math.max(0, amount - discount);
  const matchedId = result?.explain?.matched_promotions?.[0];
  return {
    originalAmount: amount,
    vendorDiscountAmount: 0,
    platformDiscountAmount: discount,
    totalSavings: discount,
    finalAmount: Math.max(0, payable),
    applied:
      discount > 0
        ? [
            {
              source: 'platform',
              id: matchedId || result?.evaluation_id || 'promo-engine',
              name: 'Promotion',
              discountAmount: discount,
              promotionType: 'promo_engine',
            },
          ]
        : [],
    platformPromotionId: matchedId,
  };
}

export async function resolveBookingPromotions(
  params: ResolveBookingPromotionsParams
): Promise<BookingPromotionResult> {
  const result = await evaluateEngine(params);
  return bookingResultFromEngine(params.amount, result);
}

/** Unified quote — service page, booking summary, payment. Promotion Engine only. */
export async function resolveBookingDiscountQuote(
  params: ResolveBookingPromotionsParams & { displayPromotionsOnly?: boolean },
  _shared?: BookingResolveSharedContext
): Promise<UnifiedResolverResponse> {
  const result = await evaluateEngine(params);
  return buildUnifiedQuoteFromEngine({
    amount: params.amount,
    result,
    couponCode: params.couponCode,
  });
}

export type BookingDiscountQuoteBatchItem = {
  key: string;
  serviceIds: string[];
  amount: number;
  serviceStyle?: string;
  serviceCategory?: string;
};

export type BookingDiscountQuoteBatchResult = {
  key: string;
  quote: UnifiedResolverResponse | null;
  error?: string;
};

export async function resolveBookingDiscountQuoteBatch(params: {
  vendorId: string;
  customerId?: string;
  items: BookingDiscountQuoteBatchItem[];
}): Promise<BookingDiscountQuoteBatchResult[]> {
  const { vendorId, customerId, items } = params;
  if (items.length === 0) return [];

  if (!customerId) {
    return items.map((item) => ({
      key: item.key,
      quote: buildUnifiedQuoteFromEngine({ amount: item.amount, result: null }),
    }));
  }

  const {
    loadEvaluateSnapshot,
    evaluateAgainstSnapshot,
    loadBehaviourProfile,
  } = await import('../../discount-engine/promo-engine');
  const now = new Date();
  const behaviour = await loadBehaviourProfile(customerId);
  let categoryId: string | undefined;
  try {
    const { loadServerPaymentContext } = await import('../../discount-engine/promo-engine');
    const ctx = await loadServerPaymentContext({
      surface: 'booking',
      vendorId,
      serviceStyle: items[0]?.serviceStyle || null,
      bookingCategoryId: items[0]?.serviceCategory || null,
    });
    categoryId = ctx.categoryId || undefined;
  } catch {
    categoryId = undefined;
  }
  const snapshot = await loadEvaluateSnapshot({
    userId: customerId,
    now,
    behaviour,
    vendorId,
    categoryId,
    serviceCategory: items[0]?.serviceCategory
      ? normalizePromoCategory(items[0].serviceCategory) || undefined
      : undefined,
  });

  return items.map((item) => {
    try {
      const body = evaluateAgainstSnapshot(
        snapshot,
        {
          user_id: customerId,
          persist: false,
          transaction: {
            type: 'BOOKING',
            service_category: item.serviceCategory
              ? normalizePromoCategory(item.serviceCategory) || undefined
              : undefined,
            service_type: item.serviceStyle,
            vendor_id: vendorId,
            vendorId,
            categoryId,
            amount: item.amount,
          },
        },
        now,
      );
      return {
        key: item.key,
        quote: buildUnifiedQuoteFromEngine({
          amount: item.amount,
          result: { ...body, evaluation_id: '' },
        }),
      };
    } catch (err) {
      return {
        key: item.key,
        quote: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

export type ApplicablePromotionOffer = {
  id: string;
  source: 'vendor' | 'platform';
  title: string;
  description?: string;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  autoApplyEligible: boolean;
  promotionType?: string;
  isSpotlight?: boolean;
};

export async function listApplicableBookingPromotions(
  params: ResolveBookingPromotionsParams
): Promise<ApplicablePromotionOffer[]> {
  const quote = await resolveBookingDiscountQuote({
    ...params,
    displayPromotionsOnly: true,
  });
  return quote.appliedOffers.map((o) => ({
    id: o.id,
    source: o.source === 'vendor' ? 'vendor' : 'platform',
    title: o.name,
    description: quote.promoEngine?.pendingCashback
      ? `Includes pending cashback ₹${quote.promoEngine.pendingCashback}`
      : undefined,
    discountType: 'fixed',
    discountValue: o.discountAmount,
    discountAmount: o.discountAmount,
    autoApplyEligible: true,
    promotionType: 'promo_engine',
  }));
}

export async function recordBookingPromotionUsageFromBooking(bookingId: string): Promise<void> {
  try {
    const res = await query(
      `SELECT id, vendor_id, customer_id, promotion_id, discount_amount, base_price, total_amount, notes, coupon_code
       FROM bookings WHERE id = $1::uuid`,
      [bookingId]
    );
    const booking = res.rows?.[0];
    if (!booking) return;

    const notes = String(booking.notes || '');
    const meta = parseJsonMetaFromNotes(notes, 'wp_promo_meta');
    const engineEvalId =
      meta?.evaluationId != null
        ? String(meta.evaluationId)
        : meta?.evaluation_id != null
          ? String(meta.evaluation_id)
          : null;

    if (!engineEvalId) return;

    const { safeCommitPromotion } = await import('../../discount-engine/promo-engine');
    await safeCommitPromotion({
      evaluationId: engineEvalId,
      transactionId: String(bookingId),
      userId: booking.customer_id ? String(booking.customer_id) : null,
    });
  } catch (err) {
    console.warn('[recordBookingPromotionUsageFromBooking] failed:', err);
  }
}

export function buildBookingPromotionNotesMeta(meta: {
  vendorPromotionId?: string;
  platformPromotionId?: string;
  vendorDiscount?: number;
  platformDiscount?: number;
  promotionType?: string;
  promotionSource?: string;
  winningOffer?: Record<string, unknown>;
  fundingType?: string;
  policyFingerprint?: string;
  evaluationId?: string;
}): string {
  return `wp_promo_meta:${JSON.stringify(meta)}`;
}

export function bookingPromotionIdentityMissing(params: {
  discountAmount: number;
  vendorDiscount?: number;
  platformDiscount?: number;
  couponDiscount?: number;
  promotionId?: string | null;
  couponCode?: string | null;
  vendorPromotionId?: string | null;
  platformPromotionId?: string | null;
}): boolean {
  const totalDiscount =
    params.discountAmount > 0
      ? params.discountAmount
      : (params.vendorDiscount ?? 0) +
        (params.platformDiscount ?? 0) +
        (params.couponDiscount ?? 0);
  if (totalDiscount <= 0) return false;
  if (params.vendorPromotionId || params.platformPromotionId) return false;
  if (params.promotionId) return false;
  if (params.couponCode?.trim()) return false;
  return true;
}

export type BookingFinancialNotesMeta = {
  servicePrice: number;
  vendorDiscount?: number;
  platformDiscount?: number;
  couponDiscount?: number;
  subtotalAfterDiscounts?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalTax?: number;
  platformFee?: number;
  convenienceFee?: number;
  deliveryFee?: number;
  walletAmount?: number;
  finalPaid: number;
  settlementSnapshot?: Record<string, unknown>;
  winningOffer?: Record<string, unknown>;
  vendorBasePrice?: number;
  commissionBase?: number;
  commissionRate?: number;
  commissionAmount?: number;
  vendorSettlement?: number;
  couponFundingType?: 'VENDOR' | 'PLATFORM';
  vendorPromotionId?: string;
  platformPromotionId?: string;
  policyFingerprint?: string;
};

export function serializeBookingFinancialMeta(
  meta: BookingFinancialNotesMeta | Record<string, unknown>
): string {
  return `wp_financial_meta:${JSON.stringify(meta)}`;
}

export function buildBookingFinancialNotesMeta(meta: BookingFinancialNotesMeta): string {
  return serializeBookingFinancialMeta(meta);
}
