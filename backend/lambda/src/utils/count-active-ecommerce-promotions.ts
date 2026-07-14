/**
 * Platform-active ecommerce promotion count for Admin Analytics KPI.
 * Matches Promotions inventory semantics (not vendor_promotions).
 *
 * Active = is_active + published + start/end window.
 * Sources: ecommerce_admin_promotions ∪ legacy promotions (ECOMMERCE domain)
 *          ∪ live platform coupons scoped to ecommerce/products.
 */

import { query } from '../database/rds-connection';

const ECOMMERCE_LEGACY_DOMAIN_SQL = `
  (
    UPPER(COALESCE(discount_domain, '')) = 'ECOMMERCE'
    OR (
      (discount_domain IS NULL OR TRIM(COALESCE(discount_domain, '')) = '')
      AND (
        LOWER(COALESCE(applicable_to, '')) = 'products'
        OR LOWER(COALESCE(service_category, '')) IN (
          'shop', 'ecommerce', 'product', 'retail', 'marketplace',
          'pet-shop', 'pet_shop', 'petshop'
        )
      )
    )
  )
`;

const ACTIVE_WINDOW_SQL = `
  is_active = true
  AND COALESCE(published, false) = true
  AND start_date <= NOW()
  AND (end_date IS NULL OR end_date >= NOW())
`;

/** Coupons table uses starts_at / expires_at (see migration 013). */
const ACTIVE_COUPON_WINDOW_SQL = `
  is_active = true
  AND (starts_at IS NULL OR starts_at <= NOW())
  AND (expires_at IS NULL OR expires_at >= NOW())
`;

const ECOMMERCE_COUPON_DOMAIN_SQL = `
  (
    UPPER(COALESCE(discount_domain, '')) = 'ECOMMERCE'
    OR (
      (discount_domain IS NULL OR TRIM(COALESCE(discount_domain, '')) = '')
      AND (
        LOWER(COALESCE(applicable_to, '')) IN ('products', 'all', '')
        OR applicable_to IS NULL
      )
    )
  )
`;

/**
 * Count distinct platform ecommerce promotions + live ecommerce coupons.
 */
export async function countActiveEcommerceAdminPromotions(): Promise<number> {
  const res = await query(
    `SELECT COUNT(*) AS count FROM (
       SELECT id FROM ecommerce_admin_promotions
       WHERE ${ACTIVE_WINDOW_SQL}
       UNION
       SELECT id FROM promotions
       WHERE ${ACTIVE_WINDOW_SQL}
         AND ${ECOMMERCE_LEGACY_DOMAIN_SQL}
       UNION
       SELECT id FROM coupons
       WHERE ${ACTIVE_COUPON_WINDOW_SQL}
         AND ${ECOMMERCE_COUPON_DOMAIN_SQL}
     ) active_ecommerce_promos`,
  ).catch(() => ({ rows: [{ count: '0' }] }));

  return parseInt(String(res.rows?.[0]?.count ?? '0'), 10) || 0;
}
