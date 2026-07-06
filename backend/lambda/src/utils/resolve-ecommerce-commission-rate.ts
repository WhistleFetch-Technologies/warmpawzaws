/**
 * Ecommerce commission V2 resolver.
 * Priority: vendor model branch → vendor default → category default → platform default → error.
 * No tier or hidden defaults.
 */

import { query } from '../database/rds-connection';
import { normalizeCommissionRate } from './ecommerce-commission-settings';
import {
  CommissionConfigurationError,
  type CommissionSource,
} from './commission-configuration-error';
import { getProductListingOwnership } from './compute-listing-ownership';

export type { CommissionSource } from './commission-configuration-error';
export { CommissionConfigurationError, isCommissionConfigurationError } from './commission-configuration-error';

export interface EcommerceCommissionContext {
  vendorId: string;
  productId?: string | null;
  categoryId?: string | null;
}

export interface EcommerceCommissionResult {
  rate: number;
  source: CommissionSource;
  listingOwnership?: string | null;
}

export interface OrderLineForCommission {
  lineSubtotal: number;
  productId?: string | null;
  categoryId?: string | null;
}

export interface OrderLineCommissionBreakdown {
  productId: string | null;
  categoryId: string | null;
  rate: number;
  commission: number;
  source: CommissionSource;
  listingOwnership?: string | null;
}

export interface OrderCommissionResult {
  commissionAmount: number;
  effectiveRate: number;
  orderSubtotal: number;
  lineBreakdown: OrderLineCommissionBreakdown[];
}

type VendorCommissionConfig = {
  commissionModel: 'category' | 'ownership';
  defaultCommissionRate: number | null;
  ownBrandCommissionRate: number | null;
  thirdPartyCommissionRate: number | null;
};


async function getVendorCommissionConfig(vendorId: string): Promise<VendorCommissionConfig | null> {
  try {
    const result = await query(
      `SELECT commission_model, default_commission_rate,
              own_brand_commission_rate, third_party_commission_rate
       FROM vendor_commission_config WHERE vendor_id = $1 LIMIT 1`,
      [vendorId]
    );
    const row = result.rows?.[0];
    if (!row?.commission_model) return null;
    const model = String(row.commission_model);
    if (model !== 'category' && model !== 'ownership') return null;
    return {
      commissionModel: model,
      defaultCommissionRate: normalizeCommissionRate(row.default_commission_rate),
      ownBrandCommissionRate: normalizeCommissionRate(row.own_brand_commission_rate),
      thirdPartyCommissionRate: normalizeCommissionRate(row.third_party_commission_rate),
    };
  } catch {
    return null;
  }
}

async function getVendorCategoryRate(
  vendorId: string,
  categoryId: string
): Promise<number | null> {
  try {
    const result = await query(
      `SELECT commission_rate FROM vendor_category_commission_rates
       WHERE vendor_id = $1 AND category_id = $2 AND is_active = true LIMIT 1`,
      [vendorId, categoryId]
    );
    return normalizeCommissionRate(result.rows?.[0]?.commission_rate);
  } catch {
    return null;
  }
}

async function getCategoryDefaultRate(categoryId: string): Promise<number | null> {
  try {
    const result = await query(
      `SELECT default_commission_rate FROM ecommerce_categories WHERE id = $1 LIMIT 1`,
      [categoryId]
    );
    return normalizeCommissionRate(result.rows?.[0]?.default_commission_rate);
  } catch {
    return null;
  }
}

async function getPlatformDefaultRate(): Promise<number | null> {
  try {
    const result = await query(
      `SELECT default_rate FROM ecommerce_commission_settings
       WHERE setting_key = 'default' LIMIT 1`
    );
    return normalizeCommissionRate(result.rows?.[0]?.default_rate);
  } catch {
    return null;
  }
}

/**
 * Resolve commission for a single product line.
 * Priority: product override → vendor model (category | ownership) → vendor default → category default → platform default.
 */
export async function resolveProductCommission(
  ctx: EcommerceCommissionContext
): Promise<EcommerceCommissionResult> {
  const { vendorId, productId, categoryId } = ctx;
  const missing: string[] = [];

  // Step 0: product-level override (highest priority — set by admin per product)
  if (productId) {
    try {
      const override = await query(
        `SELECT commission_rate FROM product_commission_overrides
         WHERE product_id = $1::uuid AND is_active = true LIMIT 1`,
        [productId]
      );
      const rate = normalizeCommissionRate(override.rows?.[0]?.commission_rate);
      if (rate != null) return { rate, source: 'product_override' };
    } catch {
      // table may not exist on older schemas — fall through to next level
    }
  }

  const config = await getVendorCommissionConfig(vendorId);
  if (!config) {
    missing.push('commission_model');
  } else if (config.commissionModel === 'category') {
    if (categoryId) {
      const vendorCategoryRate = await getVendorCategoryRate(vendorId, categoryId);
      if (vendorCategoryRate != null) {
        return { rate: vendorCategoryRate, source: 'vendor_category' };
      }
    }
  } else if (config.commissionModel === 'ownership') {
    if (!productId) {
      missing.push('product_id_for_ownership');
    } else {
      const ownership = await getProductListingOwnership(productId);
      if (!ownership) {
        missing.push('listing_ownership');
      } else if (ownership === 'own_brand') {
        if (config.ownBrandCommissionRate != null) {
          return {
            rate: config.ownBrandCommissionRate,
            source: 'vendor_own_brand',
            listingOwnership: ownership,
          };
        }
        missing.push('own_brand_commission_rate');
      } else {
        if (config.thirdPartyCommissionRate != null) {
          return {
            rate: config.thirdPartyCommissionRate,
            source: 'vendor_third_party',
            listingOwnership: ownership,
          };
        }
        missing.push('third_party_commission_rate');
      }
    }
  }

  if (config?.defaultCommissionRate != null) {
    return { rate: config.defaultCommissionRate, source: 'vendor_default' };
  }

  if (categoryId) {
    const categoryRate = await getCategoryDefaultRate(categoryId);
    if (categoryRate != null) {
      return { rate: categoryRate, source: 'category_default' };
    }
    missing.push('category_default');
  } else {
    missing.push('category_id');
  }

  const platformRate = await getPlatformDefaultRate();
  if (platformRate != null) {
    return { rate: platformRate, source: 'platform_default' };
  }
  missing.push('platform_default');

  throw new CommissionConfigurationError({
    vendorId,
    productId: productId ?? undefined,
    categoryId: categoryId ?? undefined,
    missing: missing.length ? missing : ['commission_rate'],
  });
}

/** @deprecated Use resolveProductCommission — kept for analytics without product context */
export async function resolveEcommerceCommissionRate(
  ctx: EcommerceCommissionContext
): Promise<EcommerceCommissionResult> {
  return resolveProductCommission(ctx);
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export async function resolveOrderCommission(
  vendorId: string,
  lineItems: OrderLineForCommission[]
): Promise<OrderCommissionResult> {
  if (!lineItems.length) {
    throw new CommissionConfigurationError({
      vendorId,
      missing: ['order_line_items'],
    });
  }

  let totalCommission = 0;
  let orderSubtotal = 0;
  const lineBreakdown: OrderLineCommissionBreakdown[] = [];

  for (const line of lineItems) {
    const subtotal = Number(line.lineSubtotal) || 0;
    if (subtotal <= 0) continue;

    orderSubtotal += subtotal;
    const resolved = await resolveProductCommission({
      vendorId,
      productId: line.productId ?? null,
      categoryId: line.categoryId ?? null,
    });
    const lineCommission = roundMoney((subtotal * resolved.rate) / 100);
    totalCommission += lineCommission;
    lineBreakdown.push({
      productId: line.productId ?? null,
      categoryId: line.categoryId ?? null,
      rate: resolved.rate,
      commission: lineCommission,
      source: resolved.source,
      listingOwnership: resolved.listingOwnership ?? null,
    });
  }

  if (orderSubtotal <= 0) {
    throw new CommissionConfigurationError({
      vendorId,
      missing: ['order_subtotal'],
    });
  }

  const effectiveRate = roundMoney((totalCommission / orderSubtotal) * 100);

  return {
    commissionAmount: roundMoney(totalCommission),
    effectiveRate,
    orderSubtotal: roundMoney(orderSubtotal),
    lineBreakdown,
  };
}

export async function loadOrderLineItemsForCommission(
  orderId: string
): Promise<OrderLineForCommission[]> {
  try {
    const result = await query(
      `SELECT oi.total_price AS line_subtotal,
              oi.product_id::text AS product_id,
              p.category_id::text AS category_id
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1::uuid`,
      [orderId]
    );
    return (result.rows || []).map((row: Record<string, unknown>) => ({
      lineSubtotal: parseFloat(String(row.line_subtotal ?? 0)) || 0,
      productId: row.product_id != null ? String(row.product_id) : null,
      categoryId: row.category_id != null ? String(row.category_id) : null,
    }));
  } catch {
    return [];
  }
}

export async function resolveOrderCommissionByOrderId(
  vendorId: string,
  orderId: string
): Promise<OrderCommissionResult> {
  const lineItems = await loadOrderLineItemsForCommission(orderId);
  if (lineItems.length === 0) {
    throw new CommissionConfigurationError({
      vendorId,
      missing: ['order_line_items'],
    });
  }
  return resolveOrderCommission(vendorId, lineItems);
}

/** Persist line-level commission audit rows. */
export async function persistOrderItemCommission(
  orderId: string,
  lineBreakdown: OrderLineCommissionBreakdown[],
  orderItemIds: string[]
): Promise<void> {
  if (!lineBreakdown.length || !orderItemIds.length) return;
  const count = Math.min(lineBreakdown.length, orderItemIds.length);
  for (let i = 0; i < count; i++) {
    const line = lineBreakdown[i];
    const orderItemId = orderItemIds[i];
    if (!orderItemId) continue;
    try {
      await query(
        `INSERT INTO order_item_commission (
           order_item_id, product_id, commission_rate, commission_amount,
           commission_source, listing_ownership, resolved_at
         ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, NOW())
         ON CONFLICT (order_item_id) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           commission_rate = EXCLUDED.commission_rate,
           commission_amount = EXCLUDED.commission_amount,
           commission_source = EXCLUDED.commission_source,
           listing_ownership = EXCLUDED.listing_ownership,
           resolved_at = NOW()`,
        [
          orderItemId,
          line.productId,
          line.rate,
          line.commission,
          line.source,
          line.listingOwnership,
        ]
      );
    } catch (err) {
      console.warn('[COMMISSION] order_item_commission insert skipped:', err);
    }
  }
}

export async function loadOrderItemIds(orderId: string): Promise<string[]> {
  try {
    const result = await query(
      `SELECT id::text AS id FROM order_items WHERE order_id = $1::uuid ORDER BY created_at ASC`,
      [orderId]
    );
    return (result.rows || []).map((r: { id: string }) => String(r.id));
  } catch {
    return [];
  }
}

export interface CommissionSnapshot {
  effectiveRate: number;
  commissionAmount: number;
  orderSubtotal: number;
  lineBreakdown: OrderLineCommissionBreakdown[];
  resolvedAt: string;
}

export function buildCommissionSnapshot(result: OrderCommissionResult): CommissionSnapshot {
  return {
    effectiveRate: result.effectiveRate,
    commissionAmount: result.commissionAmount,
    orderSubtotal: result.orderSubtotal,
    lineBreakdown: result.lineBreakdown,
    resolvedAt: new Date().toISOString(),
  };
}

/** Apply stored snapshot (or re-resolve) to order audit columns + line items. */
export async function applyOrderCommissionAudit(
  orderId: string,
  vendorId: string,
  snapshot?: CommissionSnapshot | null
): Promise<CommissionSnapshot | null> {
  let snap = snapshot ?? null;

  if (!snap) {
    try {
      const snapRes = await query(
        `SELECT commission_snapshot FROM orders WHERE id = $1::uuid LIMIT 1`,
        [orderId]
      );
      const raw = snapRes.rows?.[0]?.commission_snapshot;
      if (raw) {
        snap = typeof raw === 'string' ? (JSON.parse(raw) as CommissionSnapshot) : (raw as CommissionSnapshot);
      }
    } catch {
      // column may not exist yet
    }
  }

  if (!snap) {
    try {
      const resolved = await resolveOrderCommissionByOrderId(vendorId, orderId);
      snap = buildCommissionSnapshot(resolved);
    } catch {
      return null;
    }
  }

  try {
    // Write commission columns and compute vendor_payout_amount in one atomic UPDATE.
    // vendor_payout_amount = GREATEST(subtotal - vendor_promotion_amount - commission_amount, 0)
    // COALESCE(commission_snapshot, ...) is idempotent: a stored snapshot is never overwritten.
    await query(
      `UPDATE orders SET
         commission_rate = $2,
         commission_amount = $3,
         vendor_payout_amount = GREATEST(
           COALESCE(subtotal, 0)
           - COALESCE(vendor_promotion_amount, 0)
           - $3,
           0
         ),
         commission_snapshot = COALESCE(commission_snapshot, $4::jsonb),
         updated_at = NOW()
       WHERE id = $1::uuid`,
      [orderId, snap.effectiveRate, snap.commissionAmount, JSON.stringify(snap)]
    );
  } catch (err) {
    console.warn('[COMMISSION] orders audit update skipped:', err);
  }

  if (snap.lineBreakdown?.length) {
    const orderItemIds = await loadOrderItemIds(orderId);
    await persistOrderItemCommission(orderId, snap.lineBreakdown, orderItemIds);
  }

  return snap;
}
