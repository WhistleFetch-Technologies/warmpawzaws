/**
 * Checkout helpers — resolve SKU lines, validate stock, build order_items payload.
 */

import { query } from '../database/rds-connection';
import { loadProductSkus } from './product-sku-service';
import {
  resolveSkuFromSelection,
  normalizeImagesArray,
  normalizeOptionValues,
  type ProductSkuRow,
} from './product-sku-resolve';

export function productHasVariantSkus(skus: ProductSkuRow[]): boolean {
  return skus.some((s) => {
    if (s.is_active === false) return false;
    const ov = normalizeOptionValues(s.option_values as Record<string, unknown>);
    return Object.keys(ov).length > 0;
  });
}

export type ResolvedOrderLine = {
  product_id: string;
  product_sku_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  vendor_id: string | null;
  variant_info: Record<string, unknown> | null;
  skuRowIdForStock: string | null;
};

export async function resolveEcommerceOrderLine(
  item: Record<string, unknown>,
): Promise<ResolvedOrderLine | null> {
  const productId = String(item.product_id ?? item.productId ?? '').trim();
  if (!productId) return null;
  const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
  const productSkuId = String(item.product_sku_id ?? item.productSkuId ?? '').trim();
  const selectedVariations =
    (item.selected_variations ?? item.selectedVariations) as Record<string, string> | undefined;

  const products = await query(
    `SELECT id, name, price, vendor_id, hsn_code, gst_rate FROM products WHERE id = $1`,
    [productId],
  );
  if (!products.rows.length) return null;
  const product = products.rows[0] as Record<string, unknown>;

  const allSkus = await loadProductSkus(productId);
  const requiresVariantSku = productHasVariantSkus(allSkus);

  let skuRow: ProductSkuRow | null = null;
  if (productSkuId) {
    const sk = await query(
      `SELECT id, sku, option_values, price, compare_at_price, stock, images, is_active
       FROM product_skus WHERE id = $1 AND product_id = $2`,
      [productSkuId, productId],
    );
    if (sk.rows.length) skuRow = sk.rows[0] as ProductSkuRow;
  } else if (selectedVariations && Object.keys(selectedVariations).length > 0) {
    skuRow = resolveSkuFromSelection(allSkus, selectedVariations) ?? null;
  }

  if (requiresVariantSku && !skuRow) {
    throw new Error(`Variant is not available for ${String(product.name)}`);
  }

  const unitPrice =
    skuRow && Number(skuRow.price) > 0
      ? Number(skuRow.price)
      : parseFloat(String(product.price));

  if (skuRow) {
    if (skuRow.is_active === false) {
      throw new Error(`Variant is not available for ${String(product.name)}`);
    }
    const stock = Number(skuRow.stock) || 0;
    if (stock < quantity) {
      throw new Error(`Insufficient stock for ${String(product.name)} (${skuRow.sku ?? 'variant'})`);
    }
  }

  const variant_info = skuRow
    ? {
        option_values: skuRow.option_values,
        sku: skuRow.sku,
        images: normalizeImagesArray(skuRow.images),
      }
    : null;

  return {
    product_id: productId,
    product_sku_id: skuRow?.id ? String(skuRow.id) : null,
    product_name: String(product.name),
    quantity,
    unit_price: unitPrice,
    total: unitPrice * quantity,
    vendor_id: product.vendor_id ? String(product.vendor_id) : null,
    variant_info,
    skuRowIdForStock: skuRow?.id ? String(skuRow.id) : null,
  };
}

async function syncParentProductStockFromSkus(productId: string): Promise<void> {
  await query(
    `UPDATE products p
     SET stock = COALESCE((
       SELECT SUM(stock) FROM product_skus WHERE product_id = p.id AND is_active = true
     ), 0),
     updated_at = NOW()
     WHERE p.id = $1 AND COALESCE(p.has_variations, false) = true`,
    [productId],
  );
}

export async function decrementSkuStock(skuRowId: string, quantity: number): Promise<void> {
  await query(
    `UPDATE product_skus
     SET stock = GREATEST(0, stock - $2), updated_at = NOW()
     WHERE id = $1`,
    [skuRowId, quantity],
  );
  const parent = await query(`SELECT product_id FROM product_skus WHERE id = $1`, [skuRowId]);
  const productId = parent.rows[0]?.product_id;
  if (productId) {
    await syncParentProductStockFromSkus(String(productId));
  }
}

/** Restore SKU stock after an unpaid checkout draft is discarded. */
export async function incrementSkuStock(skuRowId: string, quantity: number): Promise<void> {
  if (!skuRowId || quantity <= 0) return;
  await query(
    `UPDATE product_skus
     SET stock = stock + $2, updated_at = NOW()
     WHERE id = $1`,
    [skuRowId, quantity],
  );
  const parent = await query(`SELECT product_id FROM product_skus WHERE id = $1`, [skuRowId]);
  const productId = parent.rows[0]?.product_id;
  if (productId) {
    await syncParentProductStockFromSkus(String(productId));
  }
}
