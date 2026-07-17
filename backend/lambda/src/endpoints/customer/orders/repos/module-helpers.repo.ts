/**
 * ============================================================================
 * CUSTOMER ORDERS ENDPOINTS
 * ============================================================================
 * 
 * Handles customer order management:
 * - List orders
 * - Get order details
 * - Get order invoice
 * 
 * Date: 2026-01-07
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../../handler/base-handler';
import { query, insert, update } from '../../../../database/rds-connection';
import { buildStructuredTracking } from '../../../../utils/logistics/shipment-tracking';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import {
  resolveEcommerceOrderLine,
  decrementSkuStock,
} from '../../../../utils/product-sku-order';
import { assertProductDeliverableToCity } from '../../../../utils/product-delivery-regions';
import { resolveReturnWindowDays } from '../../../../utils/return-window';
import {
  assertReturnItemsAllowed,
  ReturnItemsNotAllowedError,
  buildReturnEligibilityFromJoinedRows,
} from '../../../../utils/category-return-eligibility';
import { computeEcommerceDeliveryFee } from '../../../../utils/ecommerce/delivery-fee';
import {
  buildShopOrderPaymentResumeContext,
  discardUnpaidShopOrder,
  expireShopPaymentHolds,
} from '../../../../utils/shop-payment-hold';

/** Module helpers (move-only). */

/** Maps checkout address shapes to NOT NULL `orders.shipping_*`; full object also in `metadata.address_snapshot`. */
export function shippingColumnsFromAddress(
  addr: Record<string, unknown> | null | undefined,
  fallbackPhone: string
): {
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  shipping_phone: string;
  missing: string[];
} {
  const a = addr && typeof addr === 'object' ? addr : {};
  const line1 = String(
    a.addressLine1 ?? a.address_line1 ?? a.line1 ?? a.street ?? a.address ?? ''
  ).trim();
  const line2 = [a.addressLine2, a.address_line2, a.landmark].filter(Boolean).map(String).join(', ');
  const shipping_address = [line1, line2].filter(Boolean).join(', ') || line1;
  const city = String(a.city ?? '').trim();
  const state = String(a.state ?? '').trim();
  const pincode = String(a.pincode ?? a.postalCode ?? a.zip ?? '').trim();
  const phone = String(a.phone ?? a.mobile ?? a.phone_number ?? fallbackPhone ?? '').trim();
  const missing: string[] = [];
  if (!line1) missing.push('addressLine1');
  if (!city) missing.push('city');
  if (!state) missing.push('state');
  if (!pincode) missing.push('pincode');
  if (!phone) missing.push('phone');
  return {
    shipping_address: shipping_address || line1,
    shipping_city: city,
    shipping_state: state,
    shipping_pincode: pincode,
    shipping_phone: phone,
    missing,
  };
}

// ============================================================================
// POST /customer/orders - Create order for customer
// ============================================================================

/** SQL/helpers only — handler classes live in services/. */
