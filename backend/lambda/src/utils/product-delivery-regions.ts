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

export async function loadProductDeliveryRegions(productId: string): Promise<string[]> {
  const res = await query(`SELECT metadata, specifications FROM products WHERE id = $1`, [
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
