import { Hono } from 'hono';
import { query, select, update } from '../database/rds-connection';
import {
  parseAfterShipWebhookPayload,
  verifyAfterShipWebhookSignature,
} from '../lib/services/aftership-tracking-service';
import {
  appendShipmentTrackingEvent,
  syncOrderStatusFromShipment,
} from '../utils/logistics/shipment-order-sync';

export function registerTrackingWebhookEndpoints(app: Hono) {
  /**
   * POST /webhooks/aftership
   * Receives tracking status updates from AfterShip for vendor-managed shipments.
   */
  app.post('/webhooks/aftership', async (c) => {
    try {
      const rawBody = await c.req.text();
      const signature =
        c.req.header('aftership-hmac-sha256') ||
        c.req.header('Aftership-Hmac-Sha256') ||
        undefined;

      const valid = await verifyAfterShipWebhookSignature(rawBody, signature);
      if (!valid) {
        console.warn('[AFTERSHIP WEBHOOK] Invalid signature');
        return c.json({ error: 'Invalid signature' }, 401);
      }

      const payload = JSON.parse(rawBody);
      const parsed = parseAfterShipWebhookPayload(payload);
      if (!parsed) {
        return c.json({ success: true, message: 'No tracking data in payload' });
      }

      const trackingNumber =
        payload?.msg?.tracking?.tracking_number ||
        payload?.data?.tracking?.tracking_number ||
        payload?.tracking?.tracking_number;

      if (!trackingNumber) {
        return c.json({ success: true, message: 'No tracking number in payload' });
      }

      const shipmentResult = await query(
        `SELECT * FROM shipments
         WHERE awb_code = $1 AND fulfillment_type = 'vendor'
         ORDER BY created_at DESC LIMIT 1`,
        [trackingNumber]
      );

      if (shipmentResult.rows.length === 0) {
        console.warn('[AFTERSHIP WEBHOOK] Shipment not found for AWB:', trackingNumber);
        return c.json({ success: true, message: 'Shipment not found, ignored' });
      }

      const shipment = shipmentResult.rows[0];
      const previousStatus = shipment.status;
      const newStatus = parsed.shipmentStatus;

      if (newStatus !== previousStatus) {
        const shipmentUpdate: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };

        if (parsed.id) shipmentUpdate.aftership_tracking_id = parsed.id;
        if (parsed.trackingUrl) shipmentUpdate.tracking_url = parsed.trackingUrl;
        if (newStatus === 'delivered') {
          shipmentUpdate.delivered_at = new Date().toISOString();
        }

        await update('shipments', { id: shipment.id }, shipmentUpdate);

        await appendShipmentTrackingEvent(
          shipment.id,
          parsed.tag,
          parsed.checkpoint?.message || parsed.tag,
          parsed.checkpoint?.location,
          parsed.checkpoint?.checkpoint_time
        );

        await syncOrderStatusFromShipment(shipment.order_id, newStatus);
      }

      return c.json({
        success: true,
        orderId: shipment.order_id,
        previousStatus,
        newStatus,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[AFTERSHIP WEBHOOK] Error:', message);
      return c.json({ error: message }, 500);
    }
  });
}
