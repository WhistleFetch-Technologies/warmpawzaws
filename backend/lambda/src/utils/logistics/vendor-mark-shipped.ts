/**
 * Vendor mark-shipped: persist tracking on orders + shipments and register with AfterShip.
 * Source of truth for tracking number: shipments.awb_code
 * TODO: Deprecate orders.tracking_number — compatibility mirror only.
 */
import { query, select, insert, update } from '../../database/rds-connection';
import { createAfterShipTracking } from '../../lib/services/aftership-tracking-service';
import {
  buildTrackingUrl,
  getAftershipSlug,
} from '../../utils/logistics/carrier-patterns';
import { shipmentPincodeFieldsForInsert } from './shipment-pincodes';
import {
  getShipmentTrackingLockedError,
  parseMarkShippedBody,
  toLegacyTrackingResponse,
  validateMarkShippedInput,
  type MarkShippedBodyInput,
  type StructuredTracking,
} from './shipment-tracking';
import { notifyShopOrderStatusChange } from '../shop-order-notifications';

export interface MarkShippedInput extends MarkShippedBodyInput {
  vendorId: string;
  orderId: string;
}

export interface MarkShippedResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  tracking?: StructuredTracking & {
    aftershipRegistered?: boolean;
    awb?: string;
    partner?: string;
    partnerDisplay?: string;
  };
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
};

export async function markOrderShippedByVendor(input: MarkShippedInput): Promise<MarkShippedResult> {
  const { vendorId, orderId, ...body } = input;
  const parsed = parseMarkShippedBody(body);

  const validationError = validateMarkShippedInput(parsed);
  if (validationError) {
    return { success: false, error: validationError, statusCode: 400 };
  }

  const orders = await select('orders', { id: orderId });
  if (orders.length === 0) {
    return { success: false, error: 'Order not found', statusCode: 404 };
  }

  const order = orders[0];
  if (order.vendor_id !== vendorId) {
    return { success: false, error: 'Order does not belong to this vendor', statusCode: 403 };
  }

  const currentStatus = order.order_status;

  const lockedError = getShipmentTrackingLockedError(currentStatus);
  if (lockedError) {
    return { success: false, error: lockedError, statusCode: 409 };
  }

  if (!ALLOWED_TRANSITIONS[currentStatus]?.includes('shipped')) {
    return {
      success: false,
      error: `Cannot mark as shipped from status '${currentStatus}'. Order must be processing.`,
      statusCode: 400,
    };
  }

  const { carrierId, carrierName, trackingNumber, trackingUrl, notes } = parsed;
  const finalTrackingUrl = buildTrackingUrl(carrierId, trackingNumber, trackingUrl);
  const aftershipSlug = getAftershipSlug(carrierId);
  const now = new Date().toISOString();

  const existingShipment = await query(
    `SELECT id FROM shipments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );

  const shipmentData: Record<string, unknown> = {
    order_id: orderId,
    logistics_partner: carrierId,
    courier_name: carrierName,
    awb_code: trackingNumber,
    tracking_url: finalTrackingUrl,
    vendor_notes: notes || null,
    fulfillment_type: 'vendor',
    tracking_provider: 'aftership',
    status: 'shipped',
    shipment_status: 'in_transit',
    shipped_at: now,
    updated_at: now,
  };

  if (existingShipment.rows.length > 0) {
    await update('shipments', { id: existingShipment.rows[0].id }, shipmentData);
  } else {
    const vendors = await select('vendors', { id: vendorId });
    await insert('shipments', {
      ...shipmentData,
      ...shipmentPincodeFieldsForInsert(order, vendors[0]),
      created_at: now,
    });
  }

  // Compatibility mirror — prefer shipments.awb_code when reading
  await update('orders', { id: orderId }, {
    order_status: 'shipped',
    tracking_number: trackingNumber,
    delivery_partner: carrierName,
    shipped_at: now,
    updated_at: now,
  });

  try {
    await insert('order_status_history', {
      order_id: orderId,
      status: 'shipped',
      notes: notes || `Shipped via ${carrierName}, tracking ${trackingNumber}`,
      changed_by: vendorId,
      changed_by_type: 'vendor',
      created_at: now,
    });
  } catch {
    // optional audit table
  }

  const aftershipResult = await createAfterShipTracking(trackingNumber, aftershipSlug);

  const shipmentRowId =
    existingShipment.rows[0]?.id ||
    (await query(`SELECT id FROM shipments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`, [orderId]))
      .rows[0]?.id;

  if (aftershipResult.trackingId && shipmentRowId) {
    await update('shipments', { id: shipmentRowId }, {
      aftership_tracking_id: aftershipResult.trackingId,
    });
  }

  const structured = toLegacyTrackingResponse({
    carrierId,
    carrierName,
    trackingNumber,
    trackingUrl: finalTrackingUrl,
    identifierType: 'UNKNOWN',
    shippedAt: now,
    locked: true,
  });

  void notifyShopOrderStatusChange({
    orderId,
    previousStatus: currentStatus,
    newStatus: 'shipped',
    trackingNumber,
    notifyVendor: false,
  }).catch((err) => console.warn('[MARK-SHIPPED] Shop order notification failed:', err));

  return {
    success: true,
    tracking: {
      ...structured,
      aftershipRegistered: aftershipResult.success,
    },
  };
}
