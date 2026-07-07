/**
 * Server-side delivery region validation for ecommerce orders.
 */

import { query } from '../database/rds-connection';
import {
  deliveryBlockMessage,
  isProductDeliverableToCity,
  normalizeDeliveryRegionsList,
} from '@warmpawz/shared-types';
import { extractDeliveryRegionsFromRow } from './product-storefront-normalize';

export { isProductDeliverableToCity, normalizeDeliveryRegionsList, deliveryBlockMessage };

let productsColCache: Set<string> | null = null;
let productsColCacheUntil = 0;
const PRODUCTS_COL_CACHE_TTL_MS = 60_000;

async function getProductsColumns(): Promise<Set<string>> {
  const now = Date.now();
  if (productsColCache && now < productsColCacheUntil) return productsColCache;
  const r = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'products'`,
  );
  productsColCache = new Set(
    (r.rows || []).map((row: { column_name: string }) => String(row.column_name).toLowerCase()),
  );
  productsColCacheUntil = now + PRODUCTS_COL_CACHE_TTL_MS;
  return productsColCache;
}

export async function loadProductDeliveryRegions(productId: string): Promise<string[]> {
  const cols = await getProductsColumns();
  const selectParts: string[] = [];
  if (cols.has('delivery_regions')) selectParts.push('delivery_regions');
  if (cols.has('metadata')) selectParts.push('metadata');
  if (cols.has('specifications')) selectParts.push('specifications');
  if (selectParts.length === 0) return [];

  const res = await query(`SELECT ${selectParts.join(', ')} FROM products WHERE id = $1`, [
    productId,
  ]);
  if (!res.rows.length) return [];
  return extractDeliveryRegionsFromRow(res.rows[0] as Record<string, unknown>);
}

export async function assertProductDeliverableToCity(
  productId: string,
  productName: string,
  customerCity: string | null | undefined,
): Promise<void> {
  const city = String(customerCity ?? '').trim();
  if (!city) return;
  const regions = await loadProductDeliveryRegions(productId);
  if (isProductDeliverableToCity(regions, city)) return;
  throw new Error(deliveryBlockMessage(productName, city, regions));
}
