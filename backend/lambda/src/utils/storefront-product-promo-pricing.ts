/**
 * Storefront read-time promo pricing for shop PLP and PDP.
 * Evaluates vendor auto promos + admin auto campaigns for a single-item cart line,
 * picks the higher discount (never stacks), and sets transient compare_at / price fields.
 */
import { query } from '../database/rds-connection';
import { parsePositiveMoney, productDiscountPercent } from './product-ecommerce-pricing';
import { getActiveCommercialCampaignPromotions } from './resolve-commercial-campaign';
import {
  calculateBestCartPromotion,
  calculateBestCartPromotionAsync,
  normalizePromotionRow,
  type CartLineItem,
  type PromotionEvaluation,
  type PromotionRow,
} from './vendor-promotion-engine';
import { countPriorVendorOrders } from './vendor-promotion-usage';

export type StorefrontPromoApplied = {
  source: 'vendor' | 'admin';
  id: string;
  label: string;
  discountPercent: number;
};

function buildSingleItemCartLine(
  product: Record<string, unknown>,
  catalogPrice: number,
): CartLineItem {
  const productId = String(product.id ?? '');
  const categoryId = product.category_id ? String(product.category_id) : undefined;
  const category =
    product.category != null && String(product.category).trim()
      ? String(product.category)
      : undefined;
  return {
    productId,
    id: productId || undefined,
    quantity: 1,
    price: catalogPrice,
    categoryId,
    category,
  };
}

function promoLabelFromEvaluation(eval_: PromotionEvaluation): string {
  return (
    eval_.description?.trim() ||
    eval_.label?.trim() ||
    String(eval_.promotion?.name ?? '').trim() ||
    'Promotion'
  );
}

function applyPromoToProductRow(
  row: Record<string, unknown>,
  catalogPrice: number,
  discountAmount: number,
  promo: StorefrontPromoApplied,
): Record<string, unknown> {
  if (discountAmount <= 0 || catalogPrice <= 0) return row;
  const discountedPrice = Math.max(0, Math.round((catalogPrice - discountAmount) * 100) / 100);
  if (discountedPrice >= catalogPrice) return row;
  return {
    ...row,
    price: discountedPrice,
    original_price: catalogPrice,
    compare_at_price: catalogPrice,
    promo_applied: promo,
  };
}

async function loadVendorPromotionsByVendorIds(
  vendorIds: string[],
): Promise<Map<string, PromotionRow[]>> {
  const map = new Map<string, PromotionRow[]>();
  if (vendorIds.length === 0) return map;

  const res = await query(
    `SELECT * FROM vendor_promotions
     WHERE vendor_id = ANY($1::uuid[])
       AND is_active = true
       AND start_date <= NOW()
       AND end_date >= NOW()
       AND (usage_limit IS NULL OR usage_count < usage_limit)`,
    [vendorIds],
  );

  for (const row of res.rows || []) {
    const vid = String((row as Record<string, unknown>).vendor_id ?? '');
    if (!vid) continue;
    const list = map.get(vid) ?? [];
    list.push(normalizePromotionRow(row as Record<string, unknown>));
    map.set(vid, list);
  }
  return map;
}

async function loadPriorVendorOrderCounts(
  customerId: string,
  vendorIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  await Promise.all(
    vendorIds.map(async (vendorId) => {
      const count = await countPriorVendorOrders(customerId, vendorId);
      map.set(vendorId, count);
    }),
  );
  return map;
}

/**
 * Enrich a page of storefront product rows with auto-applied promo pricing.
 * Coded promos are excluded (auto-apply only).
 */
export async function enrichStorefrontProductsWithPromoPricing(
  rows: Record<string, unknown>[],
  customerId?: string | null,
): Promise<Record<string, unknown>[]> {
  if (rows.length === 0) return rows;

  const vendorIds = [
    ...new Set(
      rows
        .map((r) => String(r.vendor_id ?? '').trim())
        .filter((id) => id.length > 0),
    ),
  ];

  const [vendorPromosMap, adminCampaigns, priorOrderMap] = await Promise.all([
    loadVendorPromotionsByVendorIds(vendorIds),
    getActiveCommercialCampaignPromotions(),
    customerId
      ? loadPriorVendorOrderCounts(String(customerId), vendorIds)
      : Promise.resolve(new Map<string, number>()),
  ]);

  const adminPromos = adminCampaigns.promos;

  return Promise.all(
    rows.map(async (row) => {
      const catalogPrice = parsePositiveMoney(row.price);
      if (catalogPrice == null) return row;

      const vendorId = String(row.vendor_id ?? '').trim();
      const line = buildSingleItemCartLine(row, catalogPrice);
      const priorVendorOrderCount = priorOrderMap.get(vendorId) ?? 0;

      let vendorDiscount = 0;
      let vendorEval: PromotionEvaluation | null = null;
      const vendorPromos = vendorPromosMap.get(vendorId) ?? [];
      if (vendorId && vendorPromos.length > 0) {
        const vendorResult = await calculateBestCartPromotionAsync(vendorPromos, [line], {
          vendorId,
          customerId: customerId ? String(customerId) : undefined,
          priorVendorOrderCount,
        });
        vendorEval = vendorResult.bestPromotion;
        vendorDiscount = vendorEval?.discountAmount ?? 0;
      }

      let adminDiscount = 0;
      let adminEval: PromotionEvaluation | null = null;
      if (adminPromos.length > 0) {
        const adminResult = calculateBestCartPromotion(adminPromos, [line], {
          customerId: customerId ? String(customerId) : undefined,
        });
        adminEval = adminResult.bestPromotion;
        adminDiscount = adminEval?.discountAmount ?? 0;
      }

      const winner =
        adminDiscount > vendorDiscount
          ? adminEval
          : vendorDiscount > 0
            ? vendorEval
            : null;
      const discount = Math.max(vendorDiscount, adminDiscount);
      if (!winner || discount <= 0) return row;

      const source: 'vendor' | 'admin' = adminDiscount > vendorDiscount ? 'admin' : 'vendor';
      const discountedPrice = Math.max(0, catalogPrice - discount);
      const promo: StorefrontPromoApplied = {
        source,
        id: winner.promotionId,
        label: promoLabelFromEvaluation(winner),
        discountPercent: productDiscountPercent(catalogPrice, discountedPrice),
      };

      return applyPromoToProductRow(row, catalogPrice, discount, promo);
    }),
  );
}
