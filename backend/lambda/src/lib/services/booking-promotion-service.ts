import { query } from '../../database/rds-connection';
import { DiscountDomain } from '../../discount-engine/enums/discount-domain';
import {
  calculateBookingPromotionsStack,
  normalizeServicePromotionRow,
  type BookingPromotionResult,
  type PlatformPromotionRow,
  type ServicePromotionRow,
} from '../../utils/service-promotion-engine';
import { countPriorVendorBookings } from '../../utils/vendor-promotion-usage';
import { shadowPlatformPromoEligibility } from '../../discount-engine/rules/adapters/shadow-adapters';
import { DiscountOwner } from '../../discount-engine/enums/discount-owner';
import { resolveBookingParamsToDiscountContext } from '../../discount-engine/adapters/context-mappers';
import {
  METADATA_PRIOR_VENDOR_BOOKING_COUNT,
} from '../../discount-engine/resolver/context-runtime';
import {
  invokeResolverAlongsideLegacy,
  resolveWithProductionMode,
} from '../../discount-engine/resolver/production-bridge';
import { mapResolverResultToBookingPromotion } from '../../discount-engine/resolver/resolver-result-mappers';
import { shouldCollapseToSingleWinner } from '../../discount-engine/resolver/policy-simulator';
import {
  mapLegacyBookingToUnifiedResponse,
  mapResolverResultToUnifiedResponse,
  type UnifiedResolverResponse,
} from '../../discount-engine/resolver/unified-resolver-response';
import { loadRuntimePolicy } from '../../discount-engine/policy/runtime-policy-loader';
import { DiscountTrigger } from '../../discount-engine/enums/discount-trigger';
import type { ResolverResult } from '../../discount-engine/resolver/types';
import { parseJsonMetaFromNotes } from '../../utils/booking-notes-meta';
import {
  expandPromotionServiceTokensForVendor,
  isAutoApplyPlatformPromotionRow,
  parsePromotionServicesList,
  platformPromoMatchesBookingContext,
} from '../../utils/platform-promotion-matching';

export type ResolveBookingPromotionsParams = {
  vendorId: string;
  serviceIds: string[];
  serviceStyle?: string;
  amount: number;
  customerId?: string;
  serviceCategory?: string;
  /** S5 — platform / vendor coupon code applied after auto promotion stack */
  couponCode?: string;
  /** Debug session — attaches agent diagnostics to calculate-booking when set to 3c1403 */
  debugSessionId?: string;
};

function normalizeStyle(raw: unknown): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'all') return '';
  if (value === 'home' || value === 'at_home' || value === 'home_visit') return 'at_home';
  if (value === 'clinic' || value === 'center' || value === 'at_center') return 'at_center';
  if (value === 'online' || value === 'tele') return 'tele';
  return value;
}

/**
 * Vendor promotions store vendor_services.id in applicable_services.
 * Callers may send either vendor_services.id or catalog services.service_id — normalize to vendor_services.id.
 */
export async function normalizeBookingServiceIds(
  vendorId: string,
  serviceIds: string[]
): Promise<string[]> {
  const unique = [...new Set(serviceIds.map((x) => String(x).trim()).filter(Boolean))];
  if (!vendorId || unique.length === 0) return unique;

  try {
    const res = await query(
      `SELECT id::text AS vendor_service_id, service_id::text AS catalog_service_id
       FROM vendor_services
       WHERE vendor_id = $1::uuid
         AND (id::text = ANY($2::text[]) OR service_id::text = ANY($2::text[]))`,
      [vendorId, unique]
    );
    const idMap = new Map<string, string>();
    for (const row of (res as { rows?: Record<string, unknown>[] }).rows || []) {
      const vsId = String(row.vendor_service_id || '');
      if (!vsId) continue;
      idMap.set(vsId, vsId);
      const catalogId = row.catalog_service_id ? String(row.catalog_service_id) : '';
      if (catalogId) idMap.set(catalogId, vsId);
    }
    return unique.map((id) => idMap.get(id) || id);
  } catch {
    return unique;
  }
}

function platformPromoMatchesContextWithShadow(
  row: Record<string, unknown>,
  params: { category?: string; serviceStyle?: string; serviceIds: string[]; amount: number },
  expandedServiceTokens: Set<string>
): boolean {
  const legacy = platformPromoMatchesBookingContext(
    row,
    {
      category: params.category,
      serviceStyle: params.serviceStyle,
      serviceIds: params.serviceIds,
      amount: params.amount,
      expandedServiceTokens,
    },
    normalizeStyle
  );
  return shadowPlatformPromoEligibility(row, params, legacy);
}

async function loadVendorServicePromotions(vendorId: string): Promise<ServicePromotionRow[]> {
  try {
    const res = await query(
      `SELECT * FROM vendor_service_promotions
       WHERE vendor_id = $1::uuid
         AND is_active = true
         AND start_date <= NOW()
         AND end_date >= NOW()
         AND (usage_limit IS NULL OR usage_count < usage_limit)`,
      [vendorId]
    );
    return ((res as { rows?: Record<string, unknown>[] }).rows || []).map((row) =>
      normalizeServicePromotionRow(row)
    );
  } catch {
    return [];
  }
}

async function loadPlatformPromotions(
  params: ResolveBookingPromotionsParams
): Promise<PlatformPromotionRow[]> {
  try {
    const res = await query(
      `SELECT * FROM promotions
       WHERE is_active = true
         AND published = true
         AND start_date <= CURRENT_DATE
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         AND (usage_limit IS NULL OR usage_count < usage_limit)
         AND (max_uses IS NULL OR usage_count < max_uses)
         AND COALESCE(discount_value, 0) > 0`
    );
    const rows = (res as { rows?: Record<string, unknown>[] }).rows || [];
    const matched: Record<string, unknown>[] = [];
    for (const row of rows) {
      if (!isAutoApplyPlatformPromotionRow(row)) continue;
      const tokens = parsePromotionServicesList(row.applicable_services);
      const expanded = await expandPromotionServiceTokensForVendor(
        params.vendorId,
        tokens,
        query
      );
      if (
        platformPromoMatchesContextWithShadow(
          row,
          {
            category: params.serviceCategory,
            serviceStyle: params.serviceStyle,
            serviceIds: params.serviceIds,
            amount: params.amount,
          },
          expanded
        )
      ) {
        matched.push(row);
      }
    }
    return matched.map((row) => ({
      id: String(row.id),
      name: String(row.name || row.title || 'Offer'),
      discount_type: String(row.discount_type || 'percentage'),
      discount_value: parseFloat(String(row.discount_value ?? 0)) || 0,
      min_order_amount:
        row.min_order_amount != null ? parseFloat(String(row.min_order_amount)) : null,
      max_discount_amount:
        row.max_discount_amount != null ? parseFloat(String(row.max_discount_amount)) : null,
      is_spotlight: row.is_spotlight === true,
      published: row.published !== false,
    }));
  } catch {
    return [];
  }
}

async function resolveBookingPromotionsInternal(
  params: ResolveBookingPromotionsParams
): Promise<{
  booking: BookingPromotionResult;
  source: 'v2' | 'legacy';
  resolverResult?: ResolverResult;
}> {
  const normalizedServiceIds = await normalizeBookingServiceIds(
    params.vendorId,
    params.serviceIds
  );
  const resolvedParams = { ...params, serviceIds: normalizedServiceIds };

  const priorVendorBookingCount =
    resolvedParams.customerId && resolvedParams.vendorId
      ? await countPriorVendorBookings(resolvedParams.customerId, resolvedParams.vendorId)
      : 0;

  const resolverContext = resolveBookingParamsToDiscountContext(resolvedParams, {
    couponCode: resolvedParams.couponCode,
    metadata: {
      [METADATA_PRIOR_VENDOR_BOOKING_COUNT]: priorVendorBookingCount,
    },
  });

  const { value, source, resolverResult } = await resolveWithProductionMode({
    label: 'resolveBookingPromotions',
    context: resolverContext,
    legacy: () =>
      resolveBookingPromotionsLegacy(resolvedParams, priorVendorBookingCount),
    mapResolverToLegacy: mapResolverResultToBookingPromotion,
    // Auto-discovery: a clean empty result IS the answer ("no promotions apply").
    // Only coupon-code requests must keep the legacy fallback for empty results.
    acceptEmptyResult: !resolvedParams.couponCode,
  });

  const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE);
  const booking =
    shouldCollapseToSingleWinner(runtimePolicy) || source === 'legacy'
      ? collapseBookingPromotionToSingleWinner(value)
      : value;

  return { booking, source, resolverResult };
}

export async function resolveBookingPromotions(
  params: ResolveBookingPromotionsParams
): Promise<BookingPromotionResult> {
  const { booking } = await resolveBookingPromotionsInternal(params);
  return booking;
}

/** Unified resolver quote — used by service page, booking summary, payment, simulator. */
export async function resolveBookingDiscountQuote(
  params: ResolveBookingPromotionsParams & { displayPromotionsOnly?: boolean }
): Promise<UnifiedResolverResponse> {
  const { booking, source, resolverResult } = await resolveBookingPromotionsInternal(params);
  const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE);

  if (resolverResult) {
    const unified = mapResolverResultToUnifiedResponse(resolverResult, runtimePolicy, {
      resolverSource: source,
      displayPromotionsOnly: params.displayPromotionsOnly,
    });
    if (params.displayPromotionsOnly) {
      unified.appliedOffers = unified.appliedOffers.filter((o) => o.trigger === 'AUTO');
      unified.appliedOffers = unified.appliedOffers.slice(0, 1);
      unified.winningPromotion = unified.appliedOffers[0] ?? null;
    } else if (shouldCollapseToSingleWinner(runtimePolicy) && unified.appliedOffers.length > 1) {
      const winner = unified.appliedOffers.reduce((best, cur) =>
        cur.discountAmount > best.discountAmount ? cur : best
      );
      unified.appliedOffers = [winner];
      unified.winningPromotion = winner;
    }
    unified.savings = {
      originalAmount: booking.originalAmount,
      totalSavings: booking.totalSavings,
      finalAmount: booking.finalAmount,
      vendorDiscountAmount: unified.appliedOffers
        .filter((o) => o.source === 'vendor')
        .reduce((s, o) => s + o.discountAmount, 0),
      platformDiscountAmount: unified.appliedOffers
        .filter((o) => o.source === 'platform')
        .reduce((s, o) => s + o.discountAmount, 0),
      couponDiscountAmount: unified.appliedOffers
        .filter((o) => o.source === 'coupon')
        .reduce((s, o) => s + o.discountAmount, 0),
    };
    // #region agent log
    console.warn(
      '[agent-debug-3c1403]',
      JSON.stringify({
        hypothesisId: 'H2-H5',
        location: 'booking-promotion-service.ts:resolveBookingDiscountQuote',
        message: 'quote result',
        data: {
          source,
          couponCode: params.couponCode,
          applied: unified.appliedOffers.map((o) => ({
            name: o.name,
            amount: o.discountAmount,
            trigger: o.trigger,
            source: o.source,
          })),
          rejected: unified.rejectedOffers,
          finalAmount: unified.savings.finalAmount,
          strategy: unified.currentPolicy.applicationStrategy,
        },
        timestamp: Date.now(),
      })
    );
    // #endregion
    return unified;
  }

  return mapLegacyBookingToUnifiedResponse(booking, runtimePolicy, {
    displayPromotionsOnly: params.displayPromotionsOnly,
    legacyCouponRejections: await buildLegacyCouponRejections(booking, params),
  });
}

async function buildLegacyCouponRejections(
  booking: BookingPromotionResult,
  params: ResolveBookingPromotionsParams
): Promise<import('../../discount-engine/resolver/unified-resolver-response').UnifiedResolverRejectedOffer[]> {
  const code = params.couponCode?.trim();
  if (!code) return [];

  const appliedCoupon = booking.applied.find((a) => a.promotionType === 'coupon');
  if (appliedCoupon) return [];

  try {
    const { resolveBookingCouponDiscount } = await import('./booking-coupon-resolution');
    const originalAmount = booking.originalAmount || params.amount;
    const resolved = await resolveBookingCouponDiscount({
      vendorId: params.vendorId,
      customerId: params.customerId,
      serviceIds: params.serviceIds,
      serviceCategory: params.serviceCategory,
      couponCode: code,
      amount: originalAmount,
    });
    if (!resolved || resolved.discountAmount <= 0) {
      return [];
    }

    const autoWinner = booking.applied.find((a) => a.promotionType !== 'coupon');
    if (autoWinner && resolved.discountAmount <= (autoWinner.discountAmount ?? 0)) {
      return [
        {
          id: resolved.id,
          name: resolved.name,
          trigger: 'CODE',
          offerType: resolved.offerType,
          reasonCode: 'BEST_OFFER_ONLY_NOT_WINNER',
          reason: 'BEST_OFFER_ONLY_NOT_WINNER',
          discountAmount: resolved.discountAmount,
        },
      ];
    }
  } catch {
    return [];
  }
  return [];
}

/**
 * @deprecated Legacy booking stack — retained for OFF mode and V2 fallback (Phase 8C removal candidate).
 */
async function resolveBookingPromotionsLegacy(
  resolvedParams: ResolveBookingPromotionsParams,
  priorVendorBookingCount: number
): Promise<BookingPromotionResult> {
  const vendorPromotions = await loadVendorServicePromotions(resolvedParams.vendorId);
  const platformPromotions = await loadPlatformPromotions(resolvedParams);

  let legacy = calculateBookingPromotionsStack({
    vendorPromotions,
    platformPromotions,
    ctx: {
      vendorId: resolvedParams.vendorId,
      customerId: resolvedParams.customerId,
      serviceIds: resolvedParams.serviceIds,
      serviceStyle: resolvedParams.serviceStyle,
      bookingAmount: resolvedParams.amount,
      priorVendorBookingCount,
    },
  });

  if (resolvedParams.couponCode?.trim()) {
    legacy = await augmentLegacyBookingWithCoupon(legacy, resolvedParams);
  }

  invokeResolverAlongsideLegacy(
    'resolveBookingPromotions',
    resolveBookingParamsToDiscountContext(resolvedParams, {
      couponCode: resolvedParams.couponCode,
      metadata: {
        [METADATA_PRIOR_VENDOR_BOOKING_COUNT]: priorVendorBookingCount,
      },
    })
  );

  return legacy;
}

/** Best-offer-only: compare entered coupon against auto promo on the original booking amount. */
async function augmentLegacyBookingWithCoupon(
  stack: BookingPromotionResult,
  params: ResolveBookingPromotionsParams
): Promise<BookingPromotionResult> {
  try {
    const { resolveBookingCouponDiscount } = await import('./booking-coupon-resolution');
    const originalAmount = stack.originalAmount || params.amount;
    const resolved = await resolveBookingCouponDiscount({
      vendorId: params.vendorId,
      customerId: params.customerId,
      serviceIds: params.serviceIds,
      serviceCategory: params.serviceCategory,
      couponCode: params.couponCode!.trim(),
      amount: originalAmount,
    });
    // #region agent log
    console.warn(
      '[agent-debug-3c1403]',
      JSON.stringify({
        hypothesisId: 'H1-fix',
        location: 'booking-promotion-service.ts:augmentLegacyBookingWithCoupon',
        message: 'unified booking coupon resolution',
        data: {
          code: params.couponCode?.trim(),
          originalAmount,
          resolved: resolved
            ? {
                discount: resolved.discountAmount,
                offerType: resolved.offerType,
                source: resolved.source,
              }
            : null,
          promoSavings: stack.totalSavings,
        },
        timestamp: Date.now(),
      })
    );
    // #endregion
    if (!resolved || resolved.discountAmount <= 0) {
      return stack;
    }
    const couponDiscount = resolved.discountAmount;
    const promoSavings = stack.totalSavings;

    if (promoSavings > 0 && couponDiscount <= promoSavings) {
      return stack;
    }

    const isVendor = resolved.source === 'vendor';
    return {
      originalAmount,
      vendorDiscountAmount: isVendor ? couponDiscount : 0,
      platformDiscountAmount: isVendor ? 0 : couponDiscount,
      totalSavings: couponDiscount,
      finalAmount: Math.max(0, originalAmount - couponDiscount),
      applied: [
        {
          source: isVendor ? 'vendor' : 'platform',
          id: resolved.id,
          name: resolved.name,
          discountAmount: couponDiscount,
          promotionType: 'coupon',
        },
      ],
      vendorPromotionId: isVendor ? resolved.id : undefined,
      platformPromotionId: !isVendor ? resolved.id : undefined,
    };
  } catch {
    return stack;
  }
}

/** Policy Center default: one winning offer per booking (promo OR coupon, not both). */
function collapseBookingPromotionToSingleWinner(
  result: BookingPromotionResult
): BookingPromotionResult {
  if (result.applied.length <= 1) return result;

  const winner = result.applied.reduce((best, cur) =>
    (cur.discountAmount ?? 0) > (best.discountAmount ?? 0) ? cur : best
  );
  const savings = winner.discountAmount ?? 0;
  const originalAmount = result.originalAmount;

  const isVendor = winner.source === 'vendor';
  const isCoupon = winner.promotionType === 'coupon';

  return {
    originalAmount,
    vendorDiscountAmount: isVendor && !isCoupon ? savings : 0,
    platformDiscountAmount: !isVendor || isCoupon ? savings : 0,
    totalSavings: savings,
    finalAmount: Math.max(0, originalAmount - savings),
    applied: [winner],
    vendorPromotionId: isVendor && !isCoupon ? winner.id : undefined,
    platformPromotionId: !isVendor || isCoupon ? winner.id : undefined,
    settlement: result.settlement,
  };
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
  const normalizedServiceIds = await normalizeBookingServiceIds(
    params.vendorId,
    params.serviceIds
  );
  const resolvedParams = { ...params, serviceIds: normalizedServiceIds };

  const priorVendorBookingCount =
    resolvedParams.customerId && resolvedParams.vendorId
      ? await countPriorVendorBookings(resolvedParams.customerId, resolvedParams.vendorId)
      : 0;

  const { value } = await resolveWithProductionMode({
    label: 'listApplicableBookingPromotions',
    context: resolveBookingParamsToDiscountContext(resolvedParams, {
      metadata: {
        [METADATA_PRIOR_VENDOR_BOOKING_COUNT]: priorVendorBookingCount,
      },
    }),
    legacy: () =>
      listApplicableBookingPromotionsLegacy(resolvedParams, priorVendorBookingCount),
    mapResolverToLegacy: mapResolverResultToApplicableOffers,
    // Listing auto promotions: empty is a valid v2 answer (no active promotions).
    acceptEmptyResult: true,
  });

  return value;
}

function mapResolverResultToApplicableOffers(
  result: ResolverResult
): ApplicablePromotionOffer[] {
  return result.benefitResults
    .filter((b) => b.discountAmount > 0 && b.candidate.trigger === DiscountTrigger.AUTO)
    .map((b) => {
      const promo = b.candidate.originalEntity;
      return {
        id: b.candidate.id,
        source: b.candidate.owner === DiscountOwner.VENDOR ? 'vendor' : 'platform',
        title: b.candidate.name,
        description:
          typeof promo.description === 'string'
            ? promo.description
            : b.candidate.name,
        discountType: String(promo.discount_type ?? b.candidate.benefits.type ?? 'percentage'),
        discountValue: parseFloat(String(promo.discount_value ?? b.candidate.benefits.value ?? 0)) || 0,
        discountAmount: b.discountAmount,
        autoApplyEligible: true,
        promotionType: String(promo.promotion_type ?? b.candidate.metadata?.promotionType ?? ''),
        isSpotlight: promo.is_spotlight === true,
      };
    });
}

async function listApplicableBookingPromotionsLegacy(
  resolvedParams: ResolveBookingPromotionsParams,
  priorVendorBookingCount: number
): Promise<ApplicablePromotionOffer[]> {
  const vendorPromotions = await loadVendorServicePromotions(resolvedParams.vendorId);
  const platformPromotions = await loadPlatformPromotions(resolvedParams);

  const { evaluateAllServicePromotions, calculatePlatformDiscount } = await import(
    '../../utils/service-promotion-engine'
  );
  const ctx = {
    vendorId: resolvedParams.vendorId,
    customerId: resolvedParams.customerId,
    serviceIds: resolvedParams.serviceIds,
    serviceStyle: resolvedParams.serviceStyle,
    bookingAmount: resolvedParams.amount,
    priorVendorBookingCount,
  };

  const vendorOffers: ApplicablePromotionOffer[] = evaluateAllServicePromotions(
    vendorPromotions,
    ctx
  )
    .filter((e) => e.autoApplyEligible)
    .map((e) => ({
      id: e.promotionId,
      source: 'vendor' as const,
      title: e.label,
      description: e.description,
      discountType: e.promotion.discount_type,
      discountValue: e.promotion.discount_value,
      discountAmount: e.discountAmount,
      autoApplyEligible: true,
      promotionType: e.promotionType,
    }));

  const afterVendor =
    resolvedParams.amount - (vendorOffers[0]?.discountAmount ?? 0);

  const platformOffers: ApplicablePromotionOffer[] = platformPromotions
    .map((p) => ({
      promo: p,
      discountAmount: calculatePlatformDiscount(p, Math.max(0, afterVendor)),
    }))
    .filter((x) => x.discountAmount > 0)
    .map(({ promo, discountAmount }) => ({
      id: promo.id,
      source: 'platform' as const,
      title: promo.name,
      description: promo.name,
      discountType: promo.discount_type,
      discountValue: promo.discount_value,
      discountAmount,
      autoApplyEligible: true,
      isSpotlight: promo.is_spotlight === true,
    }));

  invokeListApplicableResolver(resolvedParams, priorVendorBookingCount);

  return [...vendorOffers, ...platformOffers];
}

function invokeListApplicableResolver(
  params: ResolveBookingPromotionsParams,
  priorVendorBookingCount: number
): void {
  invokeResolverAlongsideLegacy(
    'listApplicableBookingPromotions',
    resolveBookingParamsToDiscountContext(params, {
      metadata: {
        [METADATA_PRIOR_VENDOR_BOOKING_COUNT]: priorVendorBookingCount,
      },
    })
  );
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

    const discountTotal = parseFloat(String(booking.discount_amount ?? 0)) || 0;
    if (discountTotal <= 0) return;

    let vendorPromotionId: string | null = null;
    let platformPromotionId: string | null = null;
    let vendorDiscount = 0;
    let platformDiscount = 0;

    const notes = String(booking.notes || '');
    const meta = parseJsonMetaFromNotes(notes, 'wp_promo_meta');
    if (meta) {
      vendorPromotionId = meta.vendorPromotionId ? String(meta.vendorPromotionId) : null;
      platformPromotionId = meta.platformPromotionId ? String(meta.platformPromotionId) : null;
      vendorDiscount = parseFloat(String(meta.vendorDiscount ?? 0)) || 0;
      platformDiscount = parseFloat(String(meta.platformDiscount ?? 0)) || 0;
    }

    if (!vendorPromotionId && !platformPromotionId) {
      const finMeta = parseJsonMetaFromNotes(notes, 'wp_financial_meta');
      if (finMeta) {
        if (!vendorPromotionId && finMeta.vendorPromotionId) {
          vendorPromotionId = String(finMeta.vendorPromotionId);
          vendorDiscount =
            parseFloat(String(finMeta.vendorDiscount ?? 0)) ||
            vendorDiscount ||
            discountTotal;
        }
        if (!platformPromotionId && finMeta.platformPromotionId) {
          platformPromotionId = String(finMeta.platformPromotionId);
          platformDiscount =
            parseFloat(String(finMeta.platformDiscount ?? 0)) ||
            platformDiscount ||
            discountTotal;
        }
      }
    }

    if (!vendorPromotionId && !platformPromotionId && booking.promotion_id) {
      const promoId = String(booking.promotion_id);
      const vendorCheck = await query(
        `SELECT id FROM vendor_service_promotions WHERE id = $1::uuid LIMIT 1`,
        [promoId]
      );
      if (vendorCheck.rows?.length) {
        vendorPromotionId = promoId;
        vendorDiscount = discountTotal;
      } else {
        platformPromotionId = promoId;
        platformDiscount = discountTotal;
      }
    }

    const originalAmount =
      parseFloat(String(booking.base_price ?? booking.total_amount ?? 0)) || 0;
    const { recordServicePromotionUsage, recordPlatformPromotionUsage } = await import(
      '../../utils/vendor-promotion-usage'
    );

    if (vendorPromotionId && vendorDiscount > 0) {
      await recordServicePromotionUsage({
        promotionId: vendorPromotionId,
        bookingId,
        customerId: booking.customer_id ? String(booking.customer_id) : null,
        discountAmount: vendorDiscount,
        originalAmount,
      });
    }

    if (platformPromotionId && platformDiscount > 0) {
      await recordPlatformPromotionUsage({
        promotionId: platformPromotionId,
        bookingId,
        customerId: booking.customer_id ? String(booking.customer_id) : null,
        discountAmount: platformDiscount,
        originalAmount,
      });
    }

    const couponCode = booking.coupon_code ? String(booking.coupon_code).trim() : '';
    if (couponCode && !vendorPromotionId && !platformPromotionId && discountTotal > 0) {
      const { validateCouponForAmount } = await import('./platform-coupon-service');
      const { commitResolverUsageEntries } = await import(
        '../../discount-engine/adapters/legacy-usage-tracker'
      );
      const validation = await validateCouponForAmount(
        couponCode,
        originalAmount,
        DiscountDomain.SERVICE
      );
      if (validation.valid && validation.couponId && validation.discountAmount) {
        await commitResolverUsageEntries({
          entries: [
            {
              candidateId: validation.couponId,
              source: 'PLATFORM_COUPON',
              owner: 'PLATFORM',
              domain: 'SERVICE',
              discountAmount: validation.discountAmount,
              prepared: true,
              metadata: { trigger: 'CODE', promotionType: 'coupon' },
            },
          ],
          customerId: booking.customer_id ? String(booking.customer_id) : '',
          referenceId: bookingId,
          referenceType: 'booking',
          originalAmount,
        });
      }
    }
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
}): string {
  return `wp_promo_meta:${JSON.stringify(meta)}`;
}

/** True when booking has discount savings but no persisted promotion identity. */
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
  /** Finance S2 — persisted settlement snapshot fields */
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

export function serializeBookingFinancialMeta(meta: BookingFinancialNotesMeta | Record<string, unknown>): string {
  return `wp_financial_meta:${JSON.stringify(meta)}`;
}

export function buildBookingFinancialNotesMeta(meta: BookingFinancialNotesMeta): string {
  return serializeBookingFinancialMeta(meta);
}
