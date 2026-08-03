import { insert, update } from '../../database/rds-connection';

/** Map shipment status to ecommerce order status. */
const ORDER_STATUS_MAP: Record<string, string> = {
  awb_generated: 'processing',
  pickup_scheduled: 'processing',
  picked_up: 'shipped',
  shipped: 'shipped',
  in_transit: 'shipped',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  failed_delivery: 'shipped',
  rto_initiated: 'return_initiated',
  returned: 'returned',
  cancelled: 'cancelled',
};

export function mapShipmentStatusToOrderStatus(shipmentStatus: string): string {
  return ORDER_STATUS_MAP[shipmentStatus] || 'shipped';
}

/** Map AfterShip tag to internal shipment status. */
export function mapAfterShipTagToShipmentStatus(tag: string): string {
  const normalized = (tag || '').trim();
  const map: Record<string, string> = {
    InfoReceived: 'shipped',
    InTransit: 'in_transit',
    OutForDelivery: 'out_for_delivery',
    Delivered: 'delivered',
    Exception: 'failed_delivery',
    AttemptFail: 'failed_delivery',
    Expired: 'returned',
    ReturnToSender: 'returned',
    AvailableForPickup: 'shipped',
    Pending: 'shipped',
  };
  return map[normalized] || 'in_transit';
}

export async function syncOrderStatusFromShipment(
  orderId: string,
  shipmentStatus: string
): Promise<string> {
  const orderStatus = mapShipmentStatusToOrderStatus(shipmentStatus);
  const orderUpdate: Record<string, unknown> = {
    order_status: orderStatus,
    updated_at: new Date().toISOString(),
  };

  if (shipmentStatus === 'delivered') {
    orderUpdate.delivered_at = new Date().toISOString();
  } else if (shipmentStatus === 'returned') {
    orderUpdate.order_status = 'returned';
  }

  await update('orders', { id: orderId }, orderUpdate);
  return orderStatus;
}

export async function appendShipmentTrackingEvent(
  shipmentId: string,
  eventType: string,
  description: string,
  location?: string | null,
  eventTime?: string
): Promise<void> {
  try {
    await insert('shipment_tracking_events', {
      shipment_id: shipmentId,
      event_type: eventType,
      event_description: description,
      location: location || null,
      event_time: eventTime || new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[SHIPMENT-SYNC] Failed to insert tracking event:', err instanceof Error ? err.message : err);
  }
}
