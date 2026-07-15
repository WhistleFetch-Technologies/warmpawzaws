/**
 * ============================================================================
 * SELF-MANAGED LOGISTICS ENDPOINTS
 * ============================================================================
 *
 * Vendor-managed shipping: vendor books courier externally and provides AWB.
 * Status updates via AfterShip webhooks + EventBridge sync job.
 * ============================================================================
 */

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { query, select, insert, update } from '../database/rds-connection';
import { buildTrackingUrl, getCarrierDisplayName } from '../utils/logistics/carrier-patterns';
import { markOrderShippedByVendor } from '../utils/logistics/vendor-mark-shipped';
import {
  getShipmentOverwriteLockedError,
  listCarriersForVendor,
  parseMarkShippedBody,
  toLegacyTrackingResponse,
  validateMarkShippedInput,
} from '../utils/logistics/shipment-tracking';
import { shipmentPincodeFieldsForInsert } from '../utils/logistics/shipment-pincodes';
import { syncVendorManagedShipments } from '../jobs/vendor-shipment-tracking-processor';
import {
  notifyShopOrderStatusChange,
  type ShopOrderLifecycleStatus,
} from '../utils/shop-order-notifications';

export function registerSelfManagedLogisticsEndpoints(app: Hono) {

  app.put('/vendor/:vendorId/logistics-settings', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const body = await c.req.json();
      const {
        fulfillmentType,
        defaultCarrier,
        returnAddress,
        shippingOriginPincode,
        processingDays,
      } = body;

      await update('vendors', { id: vendorId }, {
        fulfillment_type: fulfillmentType,
        default_carrier: defaultCarrier || null,
        return_address: returnAddress ? JSON.stringify(returnAddress) : null,
        shipping_origin_pincode: shippingOriginPincode || null,
        processing_days: processingDays || 1,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Logistics settings updated',
      });
    } catch (error: any) {
      console.error('Error updating logistics settings:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/vendor/:vendorId/logistics-settings', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      return c.json({
        success: true,
        settings: {
          fulfillmentType: vendor.fulfillment_type || 'self',
          defaultCarrier: vendor.default_carrier,
          returnAddress: vendor.return_address ?
            (typeof vendor.return_address === 'string' ? JSON.parse(vendor.return_address) : vendor.return_address)
            : null,
          shippingOriginPincode: vendor.shipping_origin_pincode,
          processingDays: vendor.processing_days || 1,
        },
        availableCarriers: listCarriersForVendor(),
      });
    } catch (error: any) {
      console.error('Error fetching logistics settings:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // VENDOR MARK AS SHIPPED (primary flow)
  // ============================================================================

  app.post('/vendor/:vendorId/orders/:orderId/mark-shipped', async (c) => {
    try {
      const { vendorId, orderId } = c.req.param();
      const body = await c.req.json();

      const result = await markOrderShippedByVendor({
        vendorId,
        orderId,
        ...body,
      });

      if (!result.success) {
        return c.json({ success: false, error: result.error }, (result.statusCode || 400) as ContentfulStatusCode);
      }

      return c.json({
        success: true,
        message: 'Order marked as shipped',
        tracking: result.tracking,
      });
    } catch (error: any) {
      console.error('Error marking order shipped:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // ADD TRACKING INFO (legacy / admin)
  // ============================================================================

  app.post('/orders/:orderId/tracking', async (c) => {
    try {
      const orderId = c.req.param('orderId');
      const body = await c.req.json();
      const parsed = parseMarkShippedBody(body);
      const validationError = validateMarkShippedInput(parsed);
      if (validationError) {
        return c.json({ success: false, error: validationError }, 400);
      }

      const { vendorId, estimatedDeliveryDate, notes } = body;
      const { carrierId, carrierName, trackingNumber, trackingUrl } = parsed;

      const orders = await select('orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }

      const order = orders[0];
      if (vendorId && order.vendor_id !== vendorId) {
        return c.json({ success: false, error: 'Order does not belong to this vendor' }, 403);
      }

      const existingShipment = await query(
        `SELECT id, awb_code FROM shipments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [orderId]
      );

      const lockedError = getShipmentOverwriteLockedError(
        order.order_status,
        existingShipment.rows[0]?.awb_code
      );
      if (lockedError) {
        return c.json({ success: false, error: lockedError }, 409);
      }

      const finalTrackingUrl = buildTrackingUrl(carrierId, trackingNumber, trackingUrl);

      const shipmentData = {
        order_id: orderId,
        logistics_partner: carrierId,
        courier_name: carrierName,
        awb_code: trackingNumber,
        tracking_url: finalTrackingUrl,
        estimated_delivery: estimatedDeliveryDate || null,
        vendor_notes: notes || null,
        fulfillment_type: 'vendor',
        tracking_provider: 'aftership',
        status: 'shipped',
        shipment_status: 'in_transit',
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingShipment.rows.length > 0) {
        await update('shipments', { id: existingShipment.rows[0].id }, shipmentData);
      } else {
        const vendors = order.vendor_id
          ? await select('vendors', { id: order.vendor_id })
          : [];
        await insert('shipments', {
          ...shipmentData,
          ...shipmentPincodeFieldsForInsert(order, vendors[0]),
          created_at: new Date().toISOString(),
        });
      }

      const now = new Date().toISOString();
      await update('orders', { id: orderId }, {
        order_status: 'shipped',
        tracking_number: trackingNumber,
        delivery_partner: carrierName,
        shipped_at: now,
        updated_at: now,
      });

      const tracking = toLegacyTrackingResponse({
        carrierId,
        carrierName,
        trackingNumber,
        trackingUrl: finalTrackingUrl,
        identifierType: 'UNKNOWN',
        shippedAt: now,
        locked: true,
      });

      return c.json({
        success: true,
        message: 'Tracking information added',
        tracking,
      });
    } catch (error: any) {
      console.error('Error adding tracking:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.put('/vendor/:vendorId/orders/:orderId/delivery-status', async (c) => {
    try {
      const { vendorId, orderId } = c.req.param();
      const body = await c.req.json();
      const {
        status,
        deliveryPhoto,
        recipientName,
        notes,
        actualDeliveryDate,
      } = body;

      const validStatuses = [
        'processing', 'packed', 'shipped', 'in_transit',
        'out_for_delivery', 'delivered', 'failed_delivery', 'returned'
      ];

      if (!validStatuses.includes(status)) {
        return c.json({ success: false, error: `Invalid status. Valid: ${validStatuses.join(', ')}` }, 400);
      }

      const orders = await select('orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }

      const order = orders[0];
      if (order.vendor_id !== vendorId) {
        return c.json({ success: false, error: 'Order does not belong to this vendor' }, 403);
      }

      const shipmentUpdate: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'delivered') {
        shipmentUpdate.delivered_at = actualDeliveryDate || new Date().toISOString();
        shipmentUpdate.delivery_photo = deliveryPhoto || null;
        shipmentUpdate.recipient_name = recipientName || null;
        shipmentUpdate.delivery_notes = notes || null;
      }

      await query(
        `UPDATE shipments SET 
          status = $1, 
          delivered_at = $2, 
          delivery_photo = $3,
          updated_at = NOW()
        WHERE order_id = $4`,
        [status, shipmentUpdate.delivered_at || null, deliveryPhoto || null, orderId]
      );

      const orderUpdate: any = {
        updated_at: new Date().toISOString(),
      };

      if (status === 'delivered') {
        orderUpdate.order_status = 'delivered';
        orderUpdate.delivered_at = actualDeliveryDate || new Date().toISOString();
        orderUpdate.delivery_status = 'completed';
      } else if (status === 'failed_delivery') {
        orderUpdate.delivery_status = 'failed';
      } else if (['shipped', 'in_transit', 'out_for_delivery'].includes(status)) {
        orderUpdate.order_status = 'shipped';
        orderUpdate.delivery_status = status;
      }

      await update('orders', { id: orderId }, orderUpdate);

      const lifecycleFromDelivery = (deliveryStatus: string): ShopOrderLifecycleStatus | null => {
        if (deliveryStatus === 'delivered') return 'delivered';
        if (deliveryStatus === 'out_for_delivery') return 'out_for_delivery';
        if (['shipped', 'in_transit'].includes(deliveryStatus)) return 'shipped';
        if (['processing', 'packed'].includes(deliveryStatus)) return 'processing';
        return null;
      };
      const notifyStatus =
        (orderUpdate.order_status as ShopOrderLifecycleStatus | undefined) ||
        lifecycleFromDelivery(status);
      if (notifyStatus && notifyStatus !== order.order_status) {
        void notifyShopOrderStatusChange({
          orderId,
          previousStatus: String(order.order_status),
          newStatus: notifyStatus,
          notifyVendor: false,
        }).catch((err) =>
          console.warn('[SELF-MANAGED-LOGISTICS] Shop notification failed:', err),
        );
      }

      try {
        await insert('order_status_history', {
          order_id: orderId,
          status,
          notes,
          changed_by: vendorId,
          changed_by_type: 'vendor',
          created_at: new Date().toISOString(),
        });
      } catch {
        // optional
      }

      return c.json({
        success: true,
        message: `Order status updated to ${status}`,
        order: {
          id: orderId,
          status,
          deliveredAt: orderUpdate.delivered_at,
        },
      });
    } catch (error: any) {
      console.error('Error updating delivery status:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/orders/:orderId/shipment', async (c) => {
    try {
      const orderId = c.req.param('orderId');

      const shipmentQuery = `
        SELECT 
          s.*,
          o.order_number,
          o.order_status,
          o.shipped_at,
          o.delivered_at as order_delivered_at
        FROM shipments s
        JOIN orders o ON s.order_id = o.id
        WHERE s.order_id = $1
        ORDER BY s.created_at DESC
        LIMIT 1
      `;

      const result = await query(shipmentQuery, [orderId]);

      if (result.rows.length === 0) {
        return c.json({ success: false, error: 'No shipment found for this order' }, 404);
      }

      const shipment = result.rows[0];
      const carrierKey = shipment.logistics_partner;

      return c.json({
        success: true,
        shipment: {
          id: shipment.id,
          orderId: shipment.order_id,
          orderNumber: shipment.order_number,
          carrier: carrierKey,
          carrierName: getCarrierDisplayName(carrierKey),
          awbNumber: shipment.awb_code,
          trackingUrl: shipment.tracking_url,
          status: shipment.status,
          fulfillmentType: shipment.fulfillment_type,
          estimatedDelivery: shipment.estimated_delivery,
          shippedAt: shipment.shipped_at,
          deliveredAt: shipment.delivered_at,
          lastPolledAt: shipment.last_polled_at,
          statusHistory: typeof shipment.status_history === 'string'
            ? JSON.parse(shipment.status_history || '[]')
            : (shipment.status_history || []),
        },
      });
    } catch (error: any) {
      console.error('Error fetching shipment:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // EventBridge / manual trigger: sync vendor shipments via AfterShip
  app.post('/logistics/vendor-shipments/sync-status', async (c) => {
    try {
      const results = await syncVendorManagedShipments();
      return c.json({
        success: true,
        message: 'Vendor shipment sync completed',
        results,
      });
    } catch (error: any) {
      console.error('Error syncing vendor shipments:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /** @deprecated Use POST /logistics/vendor-shipments/sync-status */
  app.post('/logistics/batch-poll', async (c) => {
    try {
      const results = await syncVendorManagedShipments();
      return c.json({
        success: true,
        message: 'Batch poll completed (delegated to AfterShip sync)',
        results,
      });
    } catch (error: any) {
      console.error('Error in batch poll:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}
