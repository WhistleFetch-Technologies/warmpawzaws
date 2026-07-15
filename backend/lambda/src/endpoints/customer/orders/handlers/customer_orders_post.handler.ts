import type { Context } from 'hono';
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

export async function customerOrdersPostHandler(c: Context) {
    try {
      const body = await c.req.json();
      const response = await createOrderHandler.handle({
        event: {
          body: JSON.stringify(body),
          queryStringParameters: c.req.query ? Object.fromEntries(Object.entries(c.req.query())) : {},
        } as any,
      } as HandlerContext);
      return c.json(JSON.parse(response.body), response.statusCode as 200 | 400 | 500);
    } catch (error: any) {
      console.error('Error creating order:', error);
      return c.json({ error: error.message || 'Failed to create order' }, 500);
    }
}
