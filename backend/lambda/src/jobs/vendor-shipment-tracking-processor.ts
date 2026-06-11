/**
 * EventBridge / cron job: poll AfterShip for vendor-managed shipments and sync order status.
 */
import { ScheduledEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { query, update } from '../database/rds-connection';
import { getAfterShipTracking } from '../lib/services/aftership-tracking-service';
import {
  appendShipmentTrackingEvent,
  syncOrderStatusFromShipment,
} from '../utils/logistics/shipment-order-sync';
import { notifyShopShipmentUpdate } from '../utils/shop-order-notifications';
import { getAftershipSlug } from '../utils/logistics/carrier-patterns';

const BATCH_SIZE = 100;
const POLL_INTERVAL_HOURS = 2;

export interface VendorShipmentSyncResults {
  total: number;
  updated: number;
  unchanged: number;
  failed: number;
  errors: string[];
  timestamp: string;
}

export async function syncVendorManagedShipments(): Promise<VendorShipmentSyncResults> {
  const results: VendorShipmentSyncResults = {
    total: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  const shipments = await query(
    `SELECT id, order_id, awb_code, logistics_partner, status
     FROM shipments
     WHERE fulfillment_type = 'vendor'
       AND status NOT IN ('delivered', 'cancelled', 'returned')
       AND awb_code IS NOT NULL
       AND (last_polled_at IS NULL OR last_polled_at < NOW() - INTERVAL '${POLL_INTERVAL_HOURS} hours')
     ORDER BY last_polled_at NULLS FIRST
     LIMIT $1`,
    [BATCH_SIZE]
  );

  results.total = shipments.rows.length;

  for (const shipment of shipments.rows) {
    try {
      const slug = getAftershipSlug(shipment.logistics_partner) || shipment.logistics_partner;
      const tracking = await getAfterShipTracking(shipment.awb_code, slug);

      const pollUpdate: Record<string, unknown> = {
        last_polled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!tracking) {
        await update('shipments', { id: shipment.id }, pollUpdate);
        results.unchanged++;
        continue;
      }

      if (tracking.id) pollUpdate.aftership_tracking_id = tracking.id;
      if (tracking.trackingUrl) pollUpdate.tracking_url = tracking.trackingUrl;

      const previousStatus = shipment.status;
      const newStatus = tracking.shipmentStatus;

      if (newStatus !== previousStatus) {
        pollUpdate.status = newStatus;
        if (newStatus === 'delivered') {
          pollUpdate.delivered_at = new Date().toISOString();
        }

        await update('shipments', { id: shipment.id }, pollUpdate);

        await appendShipmentTrackingEvent(
          shipment.id,
          tracking.tag,
          tracking.checkpoint?.message || tracking.tag,
          tracking.checkpoint?.location,
          tracking.checkpoint?.checkpoint_time
        );

        await syncOrderStatusFromShipment(shipment.order_id, newStatus);
        void notifyShopShipmentUpdate(shipment.order_id, newStatus, previousStatus, {
          awb: shipment.awb_code,
        }).catch((err) =>
          console.warn('[VENDOR-SHIPMENT-SYNC] Shop notification failed:', err)
        );
        results.updated++;
      } else {
        await update('shipments', { id: shipment.id }, pollUpdate);
        results.unchanged++;
      }
    } catch (err: unknown) {
      results.failed++;
      const message = err instanceof Error ? err.message : String(err);
      results.errors.push(`Shipment ${shipment.id}: ${message}`);
    }
  }

  return results;
}

export async function handler(
  event: ScheduledEvent | { source?: string },
  context?: Context
): Promise<APIGatewayProxyResult> {
  console.log('[VENDOR-SHIPMENT-SYNC] Triggered', {
    time: new Date().toISOString(),
    requestId: context?.awsRequestId,
    source: (event as { source?: string }).source || 'scheduled',
  });

  const results = await syncVendorManagedShipments();

  console.log('[VENDOR-SHIPMENT-SYNC] Complete', results);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, ...results }),
  };
}
