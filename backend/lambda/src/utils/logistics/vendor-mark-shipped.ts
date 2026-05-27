/**
 * Vendor mark-shipped: persist tracking on orders + shipments and register with AfterShip.
 */
import { query, select, insert, update } from '../../database/rds-connection';
import { createAfterShipTracking } from '../../lib/services/aftership-tracking-service';
import {
  buildTrackingUrl,
  getAftershipSlug,
  getCarrierDisplayName,
  normalizeCarrierKey,
} from '../../utils/logistics/carrier-patterns';

export interface MarkShippedInput {
  vendorId: string;
  orderId: string;
  trackingNumber: string;
  deliveryPartner: string;
  trackingUrl?: string;
  notes?: string;
}

export interface MarkShippedResult {
  success: boolean;
  error?: string;
  tracking?: {
    awb: string;
    partner: string;
    partnerDisplay: string;
    trackingUrl: string | null;
    aftershipRegistered: boolean;
  };
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
};

export async function markOrderShippedByVendor(input: MarkShippedInput): Promise<MarkShippedResult> {
  const { vendorId, orderId, trackingNumber, deliveryPartner, trackingUrl, notes } = input;

  if (!trackingNumber?.trim()) {
    return { success: false, error: 'Tracking number is required' };
  }

  const orders = await select('orders', { id: orderId });
  if (orders.length === 0) {
    return { success: false, error: 'Order not found' };
  }

  const order = orders[0];
  if (order.vendor_id !== vendorId) {
    return { success: false, error: 'Order does not belong to this vendor' };
  }

  const currentStatus = order.order_status;
  if (currentStatus === 'shipped' || currentStatus === 'delivered') {
    return { success: false, error: `Order is already ${currentStatus}` };
  }

  if (!ALLOWED_TRANSITIONS[currentStatus]?.includes('shipped')) {
    return {
      success: false,
      error: `Cannot mark as shipped from status '${currentStatus}'. Order must be processing.`,
    };
  }

  const carrierKey = normalizeCarrierKey(deliveryPartner);
  const partnerDisplay = getCarrierDisplayName(carrierKey);
  const finalTrackingUrl = buildTrackingUrl(carrierKey, trackingNumber.trim(), trackingUrl);
  const aftershipSlug = getAftershipSlug(carrierKey);
  const now = new Date().toISOString();

  const existingShipment = await query(`SELECT id FROM shipments WHERE order_id = $1 LIMIT 1`, [
    orderId,
  ]);

  const shipmentData: Record<string, unknown> = {
    order_id: orderId,
    logistics_partner: carrierKey,
    awb_code: trackingNumber.trim(),
    tracking_url: finalTrackingUrl,
    vendor_notes: notes || null,
    fulfillment_type: 'vendor',
    tracking_provider: 'aftership',
    status: 'shipped',
    shipped_at: now,
    updated_at: now,
  };

  if (existingShipment.rows.length > 0) {
    await update('shipments', { id: existingShipment.rows[0].id }, shipmentData);
  } else {
    await insert('shipments', {
      ...shipmentData,
      created_at: now,
    });
  }

  await update('orders', { id: orderId }, {
    order_status: 'shipped',
    tracking_number: trackingNumber.trim(),
    delivery_partner: partnerDisplay,
    shipped_at: now,
    updated_at: now,
  });

  try {
    await insert('order_status_history', {
      order_id: orderId,
      status: 'shipped',
      notes: notes || `Shipped via ${partnerDisplay}, AWB ${trackingNumber.trim()}`,
      changed_by: vendorId,
      changed_by_type: 'vendor',
      created_at: now,
    });
  } catch {
    // optional audit table
  }

  const aftershipResult = await createAfterShipTracking(
    trackingNumber.trim(),
    aftershipSlug
  );

  if (aftershipResult.trackingId && existingShipment.rows.length > 0) {
    await update('shipments', { id: existingShipment.rows[0].id }, {
      aftership_tracking_id: aftershipResult.trackingId,
    });
  } else if (aftershipResult.trackingId) {
    const latest = await query(`SELECT id FROM shipments WHERE order_id = $1 LIMIT 1`, [orderId]);
    if (latest.rows[0]?.id) {
      await update('shipments', { id: latest.rows[0].id }, {
        aftership_tracking_id: aftershipResult.trackingId,
      });
    }
  }

  return {
    success: true,
    tracking: {
      awb: trackingNumber.trim(),
      partner: carrierKey,
      partnerDisplay,
      trackingUrl: finalTrackingUrl,
      aftershipRegistered: aftershipResult.success,
    },
  };
}
