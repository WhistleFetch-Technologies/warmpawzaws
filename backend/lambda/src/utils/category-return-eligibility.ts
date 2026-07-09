/**
 * Category-gated return eligibility for ecommerce order line items.
 * Returns are allowed only when ecommerce_categories.returns_enabled is true.
 */

import { query } from '../database/rds-connection';
import {
  resolveReturnWindowDays,
  isReturnWindowExpired,
  returnWindowDaysRemaining,
} from './return-window';

export class ReturnItemsNotAllowedError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ReturnItemsNotAllowedError';
  }
}

export type OrderItemReturnEligibilityInput = {
  orderStatus: string;
  deliveredAt: string | null | undefined;
  productIsReturnable: boolean | null | undefined;
  categoryReturnsEnabled: boolean | null | undefined;
  returnWindowDays: number;
  returnedQuantity?: number;
  orderQuantity: number;
};

export type OrderItemReturnEligibility = {
  orderItemId: string;
  productId: string | null;
  productName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  quantity: number;
  maxReturnQuantity: number;
  isReturnable: boolean;
  blockReason: string | null;
  returnWindowDays: number;
  daysRemaining: number;
};

export function computeItemReturnEligibility(
  input: OrderItemReturnEligibilityInput
): { isReturnable: boolean; blockReason: string | null; daysRemaining: number } {
  const { orderStatus, deliveredAt, productIsReturnable, categoryReturnsEnabled, returnWindowDays } =
    input;

  if (orderStatus !== 'delivered') {
    return {
      isReturnable: false,
      blockReason: `Order must be delivered to initiate a return (current status: ${orderStatus})`,
      daysRemaining: 0,
    };
  }

  if (!deliveredAt) {
    return {
      isReturnable: false,
      blockReason: 'Delivery date not recorded',
      daysRemaining: 0,
    };
  }

  const daysRemaining = returnWindowDaysRemaining(deliveredAt, returnWindowDays);
  if (isReturnWindowExpired(deliveredAt, returnWindowDays)) {
    return {
      isReturnable: false,
      blockReason: `Return window of ${returnWindowDays} day(s) has expired`,
      daysRemaining: 0,
    };
  }

  if (categoryReturnsEnabled !== true) {
    return {
      isReturnable: false,
      blockReason: 'Returns are not available for this product category',
      daysRemaining,
    };
  }

  if (productIsReturnable === false) {
    return {
      isReturnable: false,
      blockReason: 'This product is marked as non-returnable',
      daysRemaining,
    };
  }

  const returnedQty = Number(input.returnedQuantity) || 0;
  const orderQty = Number(input.orderQuantity) || 0;
  const maxReturnQuantity = Math.max(0, orderQty - returnedQty);
  if (maxReturnQuantity <= 0) {
    return {
      isReturnable: false,
      blockReason: 'All units of this item have already been returned',
      daysRemaining,
    };
  }

  return { isReturnable: true, blockReason: null, daysRemaining };
}

export async function isCategoryReturnsEnabled(categoryId: string | null | undefined): Promise<boolean> {
  if (!categoryId) return false;
  try {
    const result = await query(
      'SELECT returns_enabled FROM ecommerce_categories WHERE id = $1 LIMIT 1',
      [categoryId]
    );
    return result.rows[0]?.returns_enabled === true;
  } catch {
    return false;
  }
}

const ORDER_ITEMS_ELIGIBILITY_SQL = `
  SELECT
    oi.id AS order_item_id,
    oi.order_id,
    oi.product_id,
    oi.quantity,
    oi.unit_price,
    COALESCE(oi.returned_quantity, 0) AS returned_quantity,
    p.name AS product_name,
    p.is_returnable AS product_is_returnable,
    p.category_id,
    ec.name AS category_name,
    ec.returns_enabled AS category_returns_enabled,
    o.order_status,
    o.delivered_at,
    o.vendor_id,
    o.customer_id
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  LEFT JOIN products p ON p.id = oi.product_id
  LEFT JOIN ecommerce_categories ec ON ec.id = p.category_id
  WHERE oi.order_id = $1
`;

export async function loadOrderItemsWithReturnEligibility(
  orderId: string
): Promise<OrderItemReturnEligibility[]> {
  const result = await query(ORDER_ITEMS_ELIGIBILITY_SQL, [orderId]);
  const rows = result.rows || [];
  if (rows.length === 0) return [];

  const vendorId = rows[0]?.vendor_id;
  const returnWindowDays = await resolveReturnWindowDays(vendorId);

  return rows.map((row: Record<string, unknown>) => {
    const orderQty = Number(row.quantity) || 0;
    const returnedQty = Number(row.returned_quantity) || 0;
    const maxReturnQuantity = Math.max(0, orderQty - returnedQty);

    const computed = computeItemReturnEligibility({
      orderStatus: String(row.order_status ?? ''),
      deliveredAt: row.delivered_at != null ? String(row.delivered_at) : null,
      productIsReturnable: row.product_is_returnable as boolean | null | undefined,
      categoryReturnsEnabled: row.category_returns_enabled as boolean | null | undefined,
      returnWindowDays,
      returnedQuantity: returnedQty,
      orderQuantity: orderQty,
    });

    return {
      orderItemId: String(row.order_item_id),
      productId: row.product_id != null ? String(row.product_id) : null,
      productName: row.product_name != null ? String(row.product_name) : null,
      categoryId: row.category_id != null ? String(row.category_id) : null,
      categoryName: row.category_name != null ? String(row.category_name) : null,
      quantity: orderQty,
      maxReturnQuantity,
      isReturnable: computed.isReturnable,
      blockReason: computed.blockReason,
      returnWindowDays,
      daysRemaining: computed.daysRemaining,
    };
  });
}

export type ReturnItemRequest = {
  orderItemId: string;
  quantity?: number;
};

export async function assertReturnItemsAllowed(
  orderId: string,
  items: ReturnItemRequest[]
): Promise<{
  eligibleItems: OrderItemReturnEligibility[];
  order: { vendorId: string; customerId: string; deliveredAt: string | null };
}> {
  if (!items.length) {
    throw new ReturnItemsNotAllowedError('At least one item is required for return');
  }

  const allItems = await loadOrderItemsWithReturnEligibility(orderId);
  if (allItems.length === 0) {
    throw new ReturnItemsNotAllowedError('Order not found or has no items');
  }

  const orderMeta = await query(
    'SELECT vendor_id, customer_id, delivered_at, order_status FROM orders WHERE id = $1 LIMIT 1',
    [orderId]
  );
  const orderRow = orderMeta.rows[0];
  if (!orderRow) {
    throw new ReturnItemsNotAllowedError('Order not found');
  }

  const itemMap = new Map(allItems.map((item) => [item.orderItemId, item]));
  const eligibleItems: OrderItemReturnEligibility[] = [];

  for (const req of items) {
    const orderItemId = String(req.orderItemId ?? '').trim();
    if (!orderItemId) {
      throw new ReturnItemsNotAllowedError('Each return item must include orderItemId');
    }

    const item = itemMap.get(orderItemId);
    if (!item) {
      throw new ReturnItemsNotAllowedError(`Order item ${orderItemId} not found on this order`);
    }

    if (!item.isReturnable) {
      throw new ReturnItemsNotAllowedError(
        item.blockReason || `Order item ${orderItemId} is not eligible for return`
      );
    }

    const qty = req.quantity != null ? Number(req.quantity) : item.maxReturnQuantity;
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new ReturnItemsNotAllowedError(`Invalid return quantity for ${item.productName || orderItemId}`);
    }
    if (qty > item.maxReturnQuantity) {
      throw new ReturnItemsNotAllowedError(
        `Cannot return more than ${item.maxReturnQuantity} unit(s) for ${item.productName || orderItemId}`
      );
    }

    eligibleItems.push({ ...item, maxReturnQuantity: qty });
  }

  return {
    eligibleItems,
    order: {
      vendorId: String(orderRow.vendor_id),
      customerId: String(orderRow.customer_id),
      deliveredAt: orderRow.delivered_at != null ? String(orderRow.delivered_at) : null,
    },
  };
}

export function orderHasReturnableItems(items: OrderItemReturnEligibility[]): boolean {
  return items.some((item) => item.isReturnable);
}

/** Build eligibility from order + item rows that already join category columns (list API). */
export function buildReturnEligibilityFromJoinedRows(
  order: {
    order_status?: string;
    status?: string;
    delivered_at?: string | null;
  },
  itemRows: Array<Record<string, unknown>>,
  returnWindowDays: number
): { items: Array<Record<string, unknown>>; hasReturnableItems: boolean } {
  const orderStatus = String(order.order_status ?? order.status ?? '');
  const deliveredAt = order.delivered_at != null ? String(order.delivered_at) : null;

  const items = itemRows.map((raw) => {
    const orderQty = Number(raw.quantity) || 0;
    const returnedQty = Number(raw.returned_quantity) || 0;
    const computed = computeItemReturnEligibility({
      orderStatus,
      deliveredAt,
      productIsReturnable: raw.product_is_returnable as boolean | null | undefined,
      categoryReturnsEnabled: raw.category_returns_enabled as boolean | null | undefined,
      returnWindowDays,
      returnedQuantity: returnedQty,
      orderQuantity: orderQty,
    });

    return {
      ...raw,
      category_name: raw.category_name ?? null,
      category_id: raw.category_id ?? null,
      is_returnable: computed.isReturnable,
      return_block_reason: computed.blockReason,
    };
  });

  return {
    items,
    hasReturnableItems: items.some((item) => item.is_returnable === true),
  };
}

/** Attach is_returnable + category_name to raw order item rows for list APIs. */
export async function enrichOrderItemsWithReturnFlags(
  orderId: string,
  rawItems: Record<string, unknown>[]
): Promise<{
  items: Array<Record<string, unknown>>;
  hasReturnableItems: boolean;
}> {
  const eligibility = await loadOrderItemsWithReturnEligibility(orderId);
  const byId = new Map(eligibility.map((e) => [e.orderItemId, e]));

  const items = rawItems.map((raw) => {
    const id = String(raw.id ?? '');
    const info = byId.get(id);
    return {
      ...raw,
      category_name: info?.categoryName ?? raw.category_name ?? null,
      category_id: info?.categoryId ?? raw.category_id ?? null,
      is_returnable: info?.isReturnable ?? false,
      return_block_reason: info?.blockReason ?? null,
    };
  });

  return {
    items,
    hasReturnableItems: orderHasReturnableItems(eligibility),
  };
}
