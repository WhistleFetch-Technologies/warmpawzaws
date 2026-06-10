/**
 * Ecommerce shop order notifications — unified dispatcher (inbox + FCM tray).
 * Scope: orders.order_type = 'ecommerce' (excludes meal_orders table flow).
 */

import { query } from '../database/rds-connection';
import { dispatchNotification } from './notification-dispatch';

export type ShopOrderLifecycleStatus =
  | 'paid'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned';

type ShopOrderContext = {
  orderId: string;
  orderNumber: string;
  customerId: string;
  vendorId: string;
  customerName: string;
  vendorName: string;
};

type ShipmentUpdateDetails = {
  awb?: string;
  location?: string;
  trackingUrl?: string;
};

function buildShopDedupeKey(orderId: string, event: string, recipientType: 'customer' | 'vendor'): string {
  return `shop-order-${orderId}-${event}-${recipientType}`;
}

function isEcommerceOrderType(orderType: unknown): boolean {
  const t = String(orderType || 'ecommerce').toLowerCase();
  return t === 'ecommerce' || t === 'shop' || t === 'shop_order';
}

async function loadShopOrderContext(orderId: string): Promise<ShopOrderContext | null> {
  try {
    const r = await query(
      `SELECT o.id, o.order_number, o.customer_id, o.vendor_id, o.order_type,
              c.full_name AS customer_name, c.name AS customer_name_alt,
              v.business_name AS vendor_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN vendors v ON v.id = o.vendor_id
       WHERE o.id = $1::uuid
       LIMIT 1`,
      [orderId]
    );
    const row = r.rows?.[0] as Record<string, unknown> | undefined;
    if (!row?.customer_id || !row?.vendor_id) return null;
    if (!isEcommerceOrderType(row.order_type)) return null;

    return {
      orderId: String(row.id),
      orderNumber: String(row.order_number || row.id).slice(0, 32),
      customerId: String(row.customer_id),
      vendorId: String(row.vendor_id),
      customerName: String(row.customer_name || row.customer_name_alt || 'Customer'),
      vendorName: String(row.vendor_name || 'Seller'),
    };
  } catch (e) {
    console.warn('[shop-notify] loadShopOrderContext failed:', (e as Error).message);
    return null;
  }
}

function mapStatusToCustomerEvent(status: ShopOrderLifecycleStatus): string {
  const map: Record<ShopOrderLifecycleStatus, string> = {
    paid: 'shop_order_confirmed',
    confirmed: 'shop_order_confirmed',
    processing: 'shop_order_processing',
    shipped: 'shop_order_shipped',
    out_for_delivery: 'shop_order_out_for_delivery',
    delivered: 'shop_order_delivered',
    cancelled: 'shop_order_cancelled',
    returned: 'shop_order_returned',
  };
  return map[status] || `shop_order_${status}`;
}

function mapStatusToVendorEvent(status: ShopOrderLifecycleStatus): string | null {
  if (status === 'paid') return 'vendor_shop_order_new';
  if (status === 'cancelled') return 'vendor_shop_order_cancelled';
  if (status === 'returned') return 'vendor_shop_order_returned';
  return null;
}

function customerTitle(status: ShopOrderLifecycleStatus, orderNumber: string): string {
  const labels: Record<ShopOrderLifecycleStatus, string> = {
    paid: 'Order confirmed',
    confirmed: 'Order confirmed',
    processing: 'Order processing',
    shipped: 'Order shipped',
    out_for_delivery: 'Out for delivery',
    delivered: 'Order delivered',
    cancelled: 'Order cancelled',
    returned: 'Order returned',
  };
  return `${labels[status] || 'Order update'} · #${orderNumber}`;
}

function customerMessage(
  status: ShopOrderLifecycleStatus,
  ctx: ShopOrderContext,
  extras?: { cancellationReason?: string; trackingNumber?: string }
): string {
  switch (status) {
    case 'paid':
    case 'confirmed':
      return `Your order from ${ctx.vendorName} is confirmed. We'll notify you when it ships.`;
    case 'processing':
      return `${ctx.vendorName} is preparing your order #${ctx.orderNumber}.`;
    case 'shipped':
      return extras?.trackingNumber
        ? `Your order #${ctx.orderNumber} has shipped. Tracking: ${extras.trackingNumber}`
        : `Your order #${ctx.orderNumber} has shipped.`;
    case 'out_for_delivery':
      return `Your order #${ctx.orderNumber} is out for delivery and will arrive soon.`;
    case 'delivered':
      return `Your order #${ctx.orderNumber} was delivered. Thank you for shopping with WarmPawz!`;
    case 'cancelled':
      return extras?.cancellationReason
        ? `Order #${ctx.orderNumber} was cancelled. Reason: ${extras.cancellationReason}`
        : `Order #${ctx.orderNumber} was cancelled.`;
    case 'returned':
      return `Order #${ctx.orderNumber} is being returned to the seller.`;
    default:
      return `Update on order #${ctx.orderNumber}.`;
  }
}

async function notifyShopRecipient(params: {
  ctx: ShopOrderContext;
  recipientId: string;
  recipientType: 'customer' | 'vendor';
  notificationType: string;
  title: string;
  message: string;
  dedupeEvent: string;
  priority?: 'normal' | 'high';
  extraData?: Record<string, unknown>;
}): Promise<void> {
  await dispatchNotification({
    recipientId: params.recipientId,
    recipientType: params.recipientType,
    notificationType: params.notificationType,
    title: params.title,
    message: params.message,
    channels: { inApp: true, push: true },
    priority: params.priority || 'normal',
    data: {
      orderId: params.ctx.orderId,
      orderNumber: params.ctx.orderNumber,
      orderType: 'ecommerce',
      vendorName: params.ctx.vendorName,
      customerName: params.ctx.customerName,
      dedupeKey: buildShopDedupeKey(params.ctx.orderId, params.dedupeEvent, params.recipientType),
      ...params.extraData,
    },
  });
}

/** Payment captured — customer confirmation + vendor new-order alert. */
export async function notifyShopOrderPaid(orderId: string): Promise<void> {
  const ctx = await loadShopOrderContext(orderId);
  if (!ctx) return;

  await Promise.all([
    notifyShopRecipient({
      ctx,
      recipientId: ctx.customerId,
      recipientType: 'customer',
      notificationType: 'shop_order_confirmed',
      title: customerTitle('paid', ctx.orderNumber),
      message: customerMessage('paid', ctx),
      dedupeEvent: 'paid',
      priority: 'high',
    }),
    notifyShopRecipient({
      ctx,
      recipientId: ctx.vendorId,
      recipientType: 'vendor',
      notificationType: 'vendor_shop_order_new',
      title: 'New shop order',
      message: `${ctx.customerName} placed order #${ctx.orderNumber}. Review and confirm.`,
      dedupeEvent: 'paid-vendor',
      priority: 'high',
    }),
  ]).catch((e) => console.warn('[shop-notify] notifyShopOrderPaid failed:', e));
}

/** Vendor or logistics status transition. */
export async function notifyShopOrderStatusChange(params: {
  orderId: string;
  previousStatus: string;
  newStatus: ShopOrderLifecycleStatus;
  cancellationReason?: string;
  trackingNumber?: string;
  notifyVendor?: boolean;
}): Promise<void> {
  const { orderId, previousStatus, newStatus } = params;
  if (previousStatus === newStatus) return;

  const ctx = await loadShopOrderContext(orderId);
  if (!ctx) return;

  const customerEvent = mapStatusToCustomerEvent(newStatus);
  const skipCustomerConfirmAfterPending = newStatus === 'confirmed' && previousStatus === 'pending';
  if (!skipCustomerConfirmAfterPending) {
    await notifyShopRecipient({
      ctx,
      recipientId: ctx.customerId,
      recipientType: 'customer',
      notificationType: customerEvent,
      title: customerTitle(newStatus, ctx.orderNumber),
      message: customerMessage(newStatus, ctx, {
        cancellationReason: params.cancellationReason,
        trackingNumber: params.trackingNumber,
      }),
      dedupeEvent: newStatus,
      priority: newStatus === 'delivered' || newStatus === 'cancelled' ? 'high' : 'normal',
      extraData: {
        cancellationReason: params.cancellationReason,
        trackingNumber: params.trackingNumber,
      },
    }).catch((e) => console.warn('[shop-notify] customer status notify failed:', e));
  }

  const vendorEvent = mapStatusToVendorEvent(newStatus);
  if (vendorEvent && params.notifyVendor !== false) {
    const vendorMessages: Partial<Record<ShopOrderLifecycleStatus, string>> = {
      paid: `${ctx.customerName} placed order #${ctx.orderNumber}.`,
      cancelled: `Order #${ctx.orderNumber} was cancelled${params.cancellationReason ? `: ${params.cancellationReason}` : '.'}`,
      returned: `Order #${ctx.orderNumber} was marked returned.`,
    };
    await notifyShopRecipient({
      ctx,
      recipientId: ctx.vendorId,
      recipientType: 'vendor',
      notificationType: vendorEvent,
      title: 'Shop order update',
      message: vendorMessages[newStatus] || `Order #${ctx.orderNumber} status: ${newStatus}`,
      dedupeEvent: `${newStatus}-vendor`,
    }).catch((e) => console.warn('[shop-notify] vendor status notify failed:', e));
  }
}

/** Carrier / AfterShip webhook shipment milestones (customer only). */
export async function notifyShopShipmentUpdate(
  orderId: string,
  shipmentStatus: string,
  previousStatus: string,
  details: ShipmentUpdateDetails = {}
): Promise<void> {
  if (shipmentStatus === previousStatus) return;

  const statusMap: Record<string, ShopOrderLifecycleStatus | null> = {
    picked_up: 'shipped',
    in_transit: 'shipped',
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered',
    rto_initiated: 'returned',
    returned: 'returned',
  };

  const mapped = statusMap[shipmentStatus];
  if (!mapped) return;

  await notifyShopOrderStatusChange({
    orderId,
    previousStatus,
    newStatus: mapped,
    trackingNumber: details.awb,
    notifyVendor: false,
  });
}
