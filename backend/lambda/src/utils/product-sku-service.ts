/**
 * DB helpers for product_skus CRUD and SKU code uniqueness.
 */

import { query, insert, update, deleteRows } from '../database/rds-connection';
import {
  normalizeOptionValues,
  normalizeImagesArray,
  aggregateParentStock,
  applyListingSkuOrdering,
  deriveParentFromListingSku,
  type ProductSkuRow,
} from './product-sku-resolve';
import { generateVendorProductSku } from './product-ecommerce-validation';
import {
  processProductImagesForS3Storage,
  stripPresignFromProductImagesJsonb,
} from './product-sku-images';
import { cleanupRemovedProductS3Images, deleteAllManagedProductImages } from './product-s3-image';
import { isValidUUID } from '../types/entities';

export type SkuInput = {
  id?: string;
  option_values?: Record<string, unknown>;
  price?: number;
  compare_at_price?: number | null;
  stock?: number;
  barcode?: string | null;
  images?: unknown;
  sku?: string | null;
  is_active?: boolean;
  sort_order?: number;
};

async function isSkuCodeTaken(vendorId: string, skuCode: string, excludeId?: string): Promise<boolean> {
  const inProducts = await query(
    `SELECT 1 FROM products WHERE sku = $1 AND vendor_id = $2 LIMIT 1`,
    [skuCode, vendorId],
  );
  if (inProducts.rows.length > 0) return true;
  const inSkus = await query(
    excludeId
      ? `SELECT 1 FROM product_skus WHERE sku = $1 AND vendor_id = $2 AND id <> $3 LIMIT 1`
      : `SELECT 1 FROM product_skus WHERE sku = $1 AND vendor_id = $2 LIMIT 1`,
    excludeId ? [skuCode, vendorId, excludeId] : [skuCode, vendorId],
  );
  return inSkus.rows.length > 0;
}

async function assignUniqueSkuCode(
  vendorId: string,
  requested?: string | null,
  suffix?: string,
  excludeId?: string,
): Promise<string> {
  const trimmed = requested?.trim();
  if (trimmed && !await isSkuCodeTaken(vendorId, trimmed, excludeId)) {
    return trimmed;
  }
  for (let i = 0; i < 5; i++) {
    const code = generateVendorProductSku(vendorId, suffix ? `${suffix}-${i}` : undefined);
    if (!await isSkuCodeTaken(vendorId, code, excludeId)) return code;
  }
  return generateVendorProductSku(vendorId, `${Date.now()}`);
}

export async function loadProductSkus(productId: string): Promise<ProductSkuRow[]> {
  try {
    const r = await query(
      `SELECT id, sku, option_values, price, compare_at_price, stock, barcode, images, is_active, sort_order
       FROM product_skus
       WHERE product_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [productId],
    );
    return (r.rows || []) as ProductSkuRow[];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('product_skus') && msg.includes('does not exist')) return [];
    throw e;
  }
}

export async function loadProductSkusForProducts(productIds: string[]): Promise<Map<string, ProductSkuRow[]>> {
  const map = new Map<string, ProductSkuRow[]>();
  if (productIds.length === 0) return map;
  try {
    const r = await query(
      `SELECT id, product_id, sku, option_values, price, compare_at_price, stock, barcode, images, is_active, sort_order
       FROM product_skus
       WHERE product_id = ANY($1::uuid[])
       ORDER BY product_id, sort_order ASC, created_at ASC`,
      [productIds],
    );
    for (const row of r.rows || []) {
      const rec = row as ProductSkuRow & { product_id: string };
      const pid = String(rec.product_id);
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(rec);
    }
  } catch {
    /* table may not exist yet */
  }
  return map;
}

async function findSkuIdByOptionValues(
  productId: string,
  option_values: Record<string, string>,
): Promise<string | null> {
  const r = await query(
    `SELECT id FROM product_skus WHERE product_id = $1 AND option_values = $2::jsonb LIMIT 1`,
    [productId, JSON.stringify(option_values)],
  );
  const id = r.rows[0]?.id;
  return id ? String(id) : null;
}

function resolveSyncTargetSkuId(
  input: SkuInput,
  existingIds: Set<string>,
  productId: string,
  option_values: Record<string, string>,
): Promise<string | null> {
  const rawId = input.id ? String(input.id).trim() : '';
  if (rawId && isValidUUID(rawId) && existingIds.has(rawId)) {
    return Promise.resolve(rawId);
  }
  return findSkuIdByOptionValues(productId, option_values);
}

export async function syncProductSkus(
  vendorId: string,
  productId: string,
  skuInputs: SkuInput[],
  _parentDefaults?: { price: number; compare_at_price?: number | null },
): Promise<ProductSkuRow[]> {
  const existing = await loadProductSkus(productId);
  if (skuInputs.length === 0 && existing.length === 0) {
    return [];
  }
  const existingIds = new Set(existing.map((s) => String(s.id)));
  const keptIds = new Set<string>();

  for (let i = 0; i < skuInputs.length; i++) {
    const input = skuInputs[i];
    const option_values = normalizeOptionValues(input.option_values as Record<string, unknown>);
    const priceNum = Number(input.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      throw new Error('Each SKU must have a selling price greater than 0');
    }
    const price = priceNum;
    const compare_at_price = null;
    const stock = Math.max(0, Math.floor(Number(input.stock) || 0));
    let imagesNorm = normalizeImagesArray(input.images);
    const targetId = await resolveSyncTargetSkuId(input, existingIds, productId, option_values);
    const prevSku = targetId ? existing.find((s) => String(s.id) === targetId) : undefined;

    if (imagesNorm.length > 0) {
      imagesNorm = await processProductImagesForS3Storage(vendorId, imagesNorm);
      imagesNorm = stripPresignFromProductImagesJsonb(imagesNorm) as string[];
      // Evict any of this SKU's previously-managed S3 images that are no
      // longer referenced after the replacement, so a swapped photo doesn't
      // leave the old file orphaned in the bucket.
      if (prevSku) {
        const prevImages = normalizeImagesArray(prevSku.images);
        if (prevImages.length > 0) {
          await cleanupRemovedProductS3Images(prevImages, imagesNorm, vendorId);
        }
      }
    } else if (prevSku) {
      imagesNorm = normalizeImagesArray(prevSku.images);
    }

    const sortOrder =
      input.sort_order != null && Number.isFinite(Number(input.sort_order))
        ? Math.max(0, Math.floor(Number(input.sort_order)))
        : i;
    let skuCode: string;
    if (targetId && prevSku?.sku && !input.sku?.trim()) {
      skuCode = String(prevSku.sku);
    } else {
      skuCode = await assignUniqueSkuCode(
        vendorId,
        input.sku,
        `${productId.slice(0, 8)}-s${sortOrder}`,
        targetId ?? undefined,
      );
    }

    if (targetId) {
      keptIds.add(targetId);
      await update(
        'product_skus',
        { id: targetId },
        {
          sku: skuCode,
          option_values: option_values,
          price,
          compare_at_price,
          stock,
          barcode: input.barcode?.trim() || null,
          images: imagesNorm,
          is_active: input.is_active !== false,
          sort_order: sortOrder,
          updated_at: new Date().toISOString(),
        },
      );
    } else {
      const rows = await insert('product_skus', {
        product_id: productId,
        vendor_id: vendorId,
        sku: skuCode,
        option_values: option_values,
        price,
        compare_at_price,
        stock,
        barcode: input.barcode?.trim() || null,
        images: imagesNorm,
        is_active: input.is_active !== false,
        sort_order: sortOrder,
      });
      if (rows[0]?.id) keptIds.add(String(rows[0].id));
    }
  }

  for (const ex of existing) {
    if (ex.id && !keptIds.has(String(ex.id))) {
      // Evict this variant's own S3-managed images before dropping the row —
      // otherwise a removed variant leaves its photos orphaned in the bucket
      // forever (nothing else references that S3 key once the row is gone).
      const removedImages = normalizeImagesArray(ex.images);
      if (removedImages.length > 0) {
        await deleteAllManagedProductImages(removedImages, vendorId);
      }
      await deleteRows('product_skus', { id: ex.id });
    }
  }

  let synced = await loadProductSkus(productId);

  const ordering = applyListingSkuOrdering(synced);
  for (const { id, sort_order } of ordering) {
    await update(
      'product_skus',
      { id },
      { sort_order, updated_at: new Date().toISOString() },
    );
  }
  if (ordering.length > 0) {
    synced = await loadProductSkus(productId);
  }

  const parentDerived = deriveParentFromListingSku(synced);

  await update(
    'products',
    { id: productId },
    {
      has_variations: synced.length > 0,
      stock: parentDerived.stock,
      ...(parentDerived.price != null ? { price: parentDerived.price } : {}),
      ...(parentDerived.compare_at_price != null
        ? { compare_at_price: parentDerived.compare_at_price }
        : {}),
      ...(parentDerived.images != null ? { images: parentDerived.images } : {}),
      updated_at: new Date().toISOString(),
    },
  );

  return synced;
}

/** Update one SKU stock and re-aggregate parent products.stock. */
export async function updateProductSkuStock(
  vendorId: string,
  productId: string,
  skuId: string,
  stock: number,
): Promise<{ sku: ProductSkuRow; parent_stock: number }> {
  if (!isValidUUID(productId) || !isValidUUID(skuId)) {
    throw new Error('Invalid product or SKU id');
  }
  const stockNum = Math.max(0, Math.floor(Number(stock)));
  if (!Number.isFinite(stockNum)) {
    throw new Error('Stock must be a non-negative integer');
  }

  const existing = await query(
    `SELECT id FROM product_skus
     WHERE id = $1 AND product_id = $2 AND vendor_id = $3
     LIMIT 1`,
    [skuId, productId, vendorId],
  );
  if (!existing.rows?.length) {
    throw new Error('SKU not found or access denied');
  }

  await update(
    'product_skus',
    { id: skuId },
    {
      stock: stockNum,
      updated_at: new Date().toISOString(),
    },
  );

  const synced = await loadProductSkus(productId);
  const parentDerived = deriveParentFromListingSku(synced);

  await update(
    'products',
    { id: productId },
    {
      stock: parentDerived.stock,
      ...(parentDerived.price != null ? { price: parentDerived.price } : {}),
      ...(parentDerived.compare_at_price != null
        ? { compare_at_price: parentDerived.compare_at_price }
        : {}),
      updated_at: new Date().toISOString(),
    },
  );

  const updatedSku = synced.find((s) => String(s.id) === skuId);
  if (!updatedSku) {
    throw new Error('SKU not found after update');
  }

  return { sku: updatedSku, parent_stock: parentDerived.stock };
}

/** Upsert a single SKU row for bulk upload (does not delete sibling SKUs). */
export async function upsertProductSkuRow(
  vendorId: string,
  productId: string,
  input: SkuInput,
  _parentDefaults?: { price: number; compare_at_price?: number | null },
): Promise<void> {
  const option_values = normalizeOptionValues(input.option_values as Record<string, unknown>);
  const priceNum = Number(input.price);
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    throw new Error('SKU selling price must be greater than 0');
  }
  const price = priceNum;
  const compare_at_price = null;
  const stock = Math.max(0, Math.floor(Number(input.stock) || 0));
  let imagesNorm = normalizeImagesArray(input.images);
  if (imagesNorm.length > 0) {
    imagesNorm = await processProductImagesForS3Storage(vendorId, imagesNorm);
    imagesNorm = stripPresignFromProductImagesJsonb(imagesNorm) as string[];
  }

  const existing = await query(
    `SELECT id FROM product_skus WHERE product_id = $1 AND option_values = $2::jsonb LIMIT 1`,
    [productId, JSON.stringify(option_values)],
  );
  const skuCode = await assignUniqueSkuCode(
    vendorId,
    input.sku,
    `${productId.slice(0, 8)}-bulk`,
    existing.rows[0]?.id as string | undefined,
  );

  if (existing.rows.length > 0) {
    await update(
      'product_skus',
      { id: existing.rows[0].id },
      {
        sku: skuCode,
        price,
        compare_at_price,
        stock,
        barcode: input.barcode?.trim() || null,
        images: imagesNorm,
        is_active: input.is_active !== false,
        updated_at: new Date().toISOString(),
      },
    );
  } else {
    await insert('product_skus', {
      product_id: productId,
      vendor_id: vendorId,
      sku: skuCode,
      option_values: option_values,
      price,
      compare_at_price,
      stock,
      barcode: input.barcode?.trim() || null,
      images: imagesNorm,
      is_active: input.is_active !== false,
      sort_order: input.sort_order ?? 0,
    });
  }

  let synced = await loadProductSkus(productId);
  const ordering = applyListingSkuOrdering(synced);
  for (const { id, sort_order } of ordering) {
    await update(
      'product_skus',
      { id },
      { sort_order, updated_at: new Date().toISOString() },
    );
  }
  if (ordering.length > 0) {
    synced = await loadProductSkus(productId);
  }
  const parentDerived = deriveParentFromListingSku(synced);

  await update(
    'products',
    { id: productId },
    {
      has_variations: synced.length > 0,
      stock: parentDerived.stock,
      ...(parentDerived.price != null ? { price: parentDerived.price } : {}),
      ...(parentDerived.compare_at_price != null
        ? { compare_at_price: parentDerived.compare_at_price }
        : {}),
      ...(parentDerived.images != null ? { images: parentDerived.images } : {}),
      updated_at: new Date().toISOString(),
    },
  );
}
