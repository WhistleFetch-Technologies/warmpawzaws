/**
 * Shared booking promotion resolution — vendor service + platform stack.
 */
import { query } from '../../database/rds-connection';
import {
  calculateBookingPromotionsStack,
  normalizeServicePromotionRow,
  type BookingPromotionResult,
  type PlatformPromotionRow,
  type ServicePromotionRow,
} from '../../utils/service-promotion-engine';
import { countPriorVendorBookings } from '../../utils/vendor-promotion-usage';
import { shadowPlatformPromoEligibility } from '../../discount-engine/rules/adapters/shadow-adapters';

export type ResolveBookingPromotionsParams = {
  vendorId: string;
  serviceIds: string[];
  serviceStyle?: string;
  amount: number;
  customerId?: string;
  serviceCategory?: string;
};

function normalizeStyle(raw: unknown): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'all') return '';
  if (value === 'home' || value === 'at_home' || value === 'home_visit') return 'at_home';
  if (value === 'clinic' || value === 'center' || value === 'at_center') return 'at_center';
  if (value === 'online' || value === 'tele') return 'tele';
  return value;
}

function parseServicesList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((x) => String(x).trim()).filter(Boolean) : [];
    } catch {
      return [raw.trim()].filter(Boolean);
    }
  }
  return [];
}

function platformPromoMatchesContext(
  row: Record<string, unknown>,
  params: { category?: string; serviceStyle?: string; serviceIds: string[]; amount: number }
): boolean {
  const now = new Date();
  const start = row.start_date ? new Date(String(row.start_date)) : null;
  const end = row.end_date ? new Date(String(row.end_date)) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  if (row.published === false) return false;

  const minOrder = row.min_order_amount != null ? parseFloat(String(row.min_order_amount)) : 0;
  if (minOrder > 0 && params.amount > 0 && params.amount < minOrder) return false;

  const category = String(params.category || '').trim().toLowerCase();
  const style = normalizeStyle(params.serviceStyle);
  const services = parseServicesList(row.applicable_services);
  const rowCategory = String(
    row.service_category ?? row.target_category ?? ''
  )
    .trim()
    .toLowerCase();
  const rowStyle = normalizeStyle(row.service_style ?? row.target_service_style ?? '');

  if (rowCategory && category && rowCategory !== 'all' && rowCategory !== category) {
    const inServices = services.some((s) => !s.startsWith('style:') && s.toLowerCase() === category);
    if (!inServices) return false;
  }

  if (rowStyle && style && rowStyle !== 'all' && rowStyle !== style) {
    const styleToken = services.find((s) => s.startsWith('style:'));
    if (styleToken) {
      const fromToken = normalizeStyle(styleToken.replace(/^style:/, ''));
      if (fromToken && fromToken !== style) return false;
    } else if (rowStyle !== style) {
      return false;
    }
  }

  if (services.length > 0 && params.serviceIds.length > 0) {
    const nonStyle = services.filter((s) => !s.startsWith('style:'));
    if (nonStyle.length > 0) {
      const match = params.serviceIds.some((id) => nonStyle.includes(id));
      if (!match && category && !nonStyle.includes(category)) return false;
    }
  }

  return true;
}

function platformPromoMatchesContextWithShadow(
  row: Record<string, unknown>,
  params: { category?: string; serviceStyle?: string; serviceIds: string[]; amount: number }
): boolean {
  const legacy = platformPromoMatchesContext(row, params);
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
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)`
    );
    const rows = ((res as { rows?: Record<string, unknown>[] }).rows || []).filter((row) =>
      platformPromoMatchesContextWithShadow(row, {
        category: params.serviceCategory,
        serviceStyle: params.serviceStyle,
        serviceIds: params.serviceIds,
        amount: params.amount,
      })
    );
    return rows.map((row) => ({
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

export async function resolveBookingPromotions(
  params: ResolveBookingPromotionsParams
): Promise<BookingPromotionResult> {
  const priorVendorBookingCount =
    params.customerId && params.vendorId
      ? await countPriorVendorBookings(params.customerId, params.vendorId)
      : 0;

  const vendorPromotions = await loadVendorServicePromotions(params.vendorId);
  const platformPromotions = await loadPlatformPromotions(params);

  return calculateBookingPromotionsStack({
    vendorPromotions,
    platformPromotions,
    ctx: {
      vendorId: params.vendorId,
      customerId: params.customerId,
      serviceIds: params.serviceIds,
      serviceStyle: params.serviceStyle,
      bookingAmount: params.amount,
      priorVendorBookingCount,
    },
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
  const priorVendorBookingCount =
    params.customerId && params.vendorId
      ? await countPriorVendorBookings(params.customerId, params.vendorId)
      : 0;

  const vendorPromotions = await loadVendorServicePromotions(params.vendorId);
  const platformPromotions = await loadPlatformPromotions(params);

  const { evaluateAllServicePromotions, calculatePlatformDiscount } = await import(
    '../../utils/service-promotion-engine'
  );
  const ctx = {
    vendorId: params.vendorId,
    customerId: params.customerId,
    serviceIds: params.serviceIds,
    serviceStyle: params.serviceStyle,
    bookingAmount: params.amount,
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
    params.amount - (vendorOffers[0]?.discountAmount ?? 0);

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

  return [...vendorOffers, ...platformOffers];
}

export async function recordBookingPromotionUsageFromBooking(bookingId: string): Promise<void> {
  try {
    const res = await query(
      `SELECT id, vendor_id, customer_id, promotion_id, discount_amount, base_price, total_amount, notes
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
    const metaMatch = notes.match(/wp_promo_meta:(\{[^}]+\})/);
    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[1]) as Record<string, unknown>;
        vendorPromotionId = meta.vendorPromotionId ? String(meta.vendorPromotionId) : null;
        platformPromotionId = meta.platformPromotionId ? String(meta.platformPromotionId) : null;
        vendorDiscount = parseFloat(String(meta.vendorDiscount ?? 0)) || 0;
        platformDiscount = parseFloat(String(meta.platformDiscount ?? 0)) || 0;
      } catch {
        /* ignore */
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
  } catch (err) {
    console.warn('[recordBookingPromotionUsageFromBooking] failed:', err);
  }
}

export function buildBookingPromotionNotesMeta(meta: {
  vendorPromotionId?: string;
  platformPromotionId?: string;
  vendorDiscount?: number;
  platformDiscount?: number;
}): string {
  return `wp_promo_meta:${JSON.stringify(meta)}`;
}
