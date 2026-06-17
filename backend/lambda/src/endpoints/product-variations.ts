/**
 * Shim: product variations API backed by product_skus (legacy UI compatibility).
 */

import { Hono } from 'hono';
import { query, select } from '../database/rds-connection';
import { loadProductSkus, syncProductSkus, type SkuInput } from '../utils/product-sku-service';
import {
  buildVariationAxes,
  mapSkusToCustomerVariations,
  normalizeOptionValues,
} from '../utils/product-sku-resolve';
import { presignProductSkusForDisplay } from '../utils/s3-media-presign';

function variationsPayloadToSkuInputs(
  variations: Array<{
    name: string;
    type: string;
    options?: Array<{
      value: string;
      price_modifier?: number;
      stock_quantity?: number;
      sku?: string;
      image_url?: string;
    }>;
  }>,
  parentPrice = 0,
): SkuInput[] {
  if (!variations?.length) return [];
  let combos: Record<string, string>[] = [{}];
  for (const axis of variations) {
    const key =
      axis.type === 'size'
        ? 'size'
        : axis.type === 'color'
          ? 'color'
          : axis.name.trim().toLowerCase() || 'option';
    const opts = (axis.options ?? []).filter((o) => o.value?.trim());
    if (!opts.length) continue;
    const next: Record<string, string>[] = [];
    for (const combo of combos) {
      for (const opt of opts) {
        next.push({ ...combo, [key]: opt.value.trim() });
      }
    }
    combos = next;
  }
  if (combos.length === 1 && Object.keys(combos[0]).length === 0) return [];

  return combos.map((ov, idx) => {
    const stock = variations
      .flatMap((v) => v.options ?? [])
      .filter((o) => Object.values(ov).includes(o.value))
      .reduce((sum, o) => sum + Number(o.stock_quantity ?? 0), 0);
    const modifier = variations
      .flatMap((v) => v.options ?? [])
      .filter((o) => Object.values(ov).includes(o.value))
      .reduce((max, o) => Math.max(max, Number(o.price_modifier ?? 0)), 0);
    const image = variations
      .flatMap((v) => v.options ?? [])
      .find((o) => Object.values(ov).includes(o.value))?.image_url;
    const skuCode = variations
      .flatMap((v) => v.options ?? [])
      .find((o) => Object.values(ov).includes(o.value))?.sku;
    return {
      option_values: normalizeOptionValues(ov),
      price: parentPrice + modifier,
      stock,
      sku: skuCode ?? null,
      images: image ? [image] : [],
      sort_order: idx,
    };
  });
}

export function registerProductVariationsEndpoints(app: Hono) {
  app.get('/vendor/:vendorId/products/:productId/variations', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const productId = c.req.param('productId');

      const products = await select('products', { id: productId, vendor_id: vendorId });
      if (products.length === 0) {
        return c.json({ success: false, error: 'Product not found' }, 404);
      }

      const skus = await loadProductSkus(productId);
      const axes = buildVariationAxes(skus);
      const variations = mapSkusToCustomerVariations(skus, axes).map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        is_required: true,
        options: v.options.map((o) => ({
          value: o.value,
          price_modifier: o.price_modifier ?? 0,
          stock_quantity: o.stock ?? 0,
          image_url: o.image,
          is_active: true,
        })),
      }));

      return c.json({ success: true, variations });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.post('/vendor/:vendorId/products/:productId/variations', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const productId = c.req.param('productId');
      const body = await c.req.json();
      const { variations } = body;

      const products = await select('products', { id: productId, vendor_id: vendorId });
      if (products.length === 0) {
        return c.json({ success: false, error: 'Product not found' }, 404);
      }

      const parent = products[0] as Record<string, unknown>;
      const parentPrice = Number(parent.price) || 0;
      const parentMrp =
        parent.compare_at_price != null ? Number(parent.compare_at_price) : null;

      const skuInputs = variationsPayloadToSkuInputs(variations ?? [], parentPrice);
      await syncProductSkus(vendorId, productId, skuInputs, {
        price: parentPrice,
        compare_at_price: parentMrp,
      });

      return c.json({
        success: true,
        message: 'Variations saved successfully',
        count: skuInputs.length,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.delete('/vendor/:vendorId/products/:productId/variations/:variationId', async (c) => {
    void c.req.param('variationId');
    return c.json({
      success: true,
      message: 'Use product SKU editor to remove variants',
    });
  });

  app.get('/products/:productId/variations', async (c) => {
    try {
      const productId = c.req.param('productId');
      const skus = await loadProductSkus(productId);
      const presigned = await presignProductSkusForDisplay(
        skus as Record<string, unknown>[],
      );
      const axes = buildVariationAxes(skus);
      const variations = mapSkusToCustomerVariations(skus, axes);
      return c.json({ success: true, variations, skus: presigned, variation_axes: axes });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.post('/products/:productId/view', async (c) => {
    try {
      const productId = c.req.param('productId');
      const body = await c.req.json().catch(() => ({}));
      const { customerId, sessionId, source } = body;

      await query(
        `INSERT INTO product_views (product_id, customer_id, session_id, source, viewed_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [productId, customerId || null, sessionId || null, source || 'direct'],
      );

      await query(
        `UPDATE products SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`,
        [productId],
      );

      return c.json({ success: true });
    } catch {
      return c.json({ success: true });
    }
  });
}
