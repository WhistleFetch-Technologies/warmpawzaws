/**
 * Vendor-facing ecommerce money SQL fragments.
 *
 * Revenue = catalog goods (subtotal) minus vendor-funded promotions only.
 * Shipping and customer total_amount are never included in vendor revenue.
 *
 * Alias `o` must be the orders table in all fragments below.
 */

import { SQL_SHOP_ORDER_VENDOR_VISIBLE } from './shop-vendor-visibility';

/**
 * Effective promotion source with legacy inference when promotion_source is null.
 */
export const SQL_VENDOR_EFFECTIVE_PROMOTION_SOURCE = `
  CASE
    WHEN LOWER(COALESCE(o.promotion_source, '')) IN ('vendor', 'admin', 'platform') THEN
      CASE WHEN LOWER(o.promotion_source) = 'platform' THEN 'admin' ELSE LOWER(o.promotion_source) END
    WHEN COALESCE(o.admin_promotion_amount, 0) > 0 AND COALESCE(o.vendor_promotion_amount, 0) <= 0 THEN 'admin'
    WHEN COALESCE(o.vendor_promotion_amount, 0) > 0 AND COALESCE(o.admin_promotion_amount, 0) <= 0 THEN 'vendor'
    ELSE NULL
  END
`;

/** Catalog subtotal fallback when subtotal column is missing. */
export const SQL_VENDOR_CATALOG_SUBTOTAL = `
  GREATEST(
    COALESCE(o.subtotal, o.total_amount - COALESCE(o.shipping_amount, 0) - COALESCE(o.tax_amount, 0) + COALESCE(o.discount_amount, 0)),
    0
  )
`;

/**
 * Vendor goods value used for revenue display and settlement base.
 * Admin/platform promos do not reduce this; vendor promos do.
 */
export const SQL_VENDOR_GOODS_AMOUNT = `
  GREATEST(
    (${SQL_VENDOR_CATALOG_SUBTOTAL})
    - CASE
        WHEN (${SQL_VENDOR_EFFECTIVE_PROMOTION_SOURCE}) = 'vendor'
        THEN COALESCE(o.vendor_promotion_amount, o.discount_amount, 0)
        ELSE 0
      END,
    0
  )
`;

export const SQL_VENDOR_COMMISSION_AMOUNT = `
  GREATEST(COALESCE(o.commission_amount, 0), 0)
`;

/**
 * Net vendor payout per order — prefers stored vendor_payout_amount.
 */
export const SQL_VENDOR_NET_AMOUNT = `
  GREATEST(
    COALESCE(
      o.vendor_payout_amount,
      (${SQL_VENDOR_GOODS_AMOUNT}) - (${SQL_VENDOR_COMMISSION_AMOUNT})
    ),
    0
  )
`;

/** Non-cancelled, vendor-visible paid shop orders. */
export const SQL_VENDOR_ECOMMERCE_ORDER_FILTER = `
  o.order_status != 'cancelled'
  AND o.order_status != 'pending_payment'
  AND ${SQL_SHOP_ORDER_VENDOR_VISIBLE}
`;
