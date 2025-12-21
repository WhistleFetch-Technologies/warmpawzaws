import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * High-Volume Analytics Ingestion
 * Tracks clicks, impressions, and conversions
 */
export function registerAnalyticsIngestion(app: Hono) {

  /**
   * POST /make-server-3dd53475/analytics/track
   * Ingest batch of analytics events
   */
  app.post("/make-server-3dd53475/analytics/track", async (c) => {
    try {
      const { events } = await c.req.json();
      
      if (!Array.isArray(events)) {
          return sendError(c, 'Events must be an array', 400);
      }

      // In a real system (ClickHouse/BigQuery), we'd stream this.
      // In KV, we aggregate immediately into daily buckets to avoid write explosion.
      
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      for (const event of events) {
          const { type, vendorId, itemId } = event;
          if (!vendorId || !type) continue;

          // Key: stats:vendor:{id}:{date}
          const statsKey = `stats:vendor:${vendorId}:${dateStr}`;
          
          // Optimistic Locking / Atomic Increment simulation
          const currentStats = await kv.get(statsKey) || { 
              impressions: 0, 
              clicks: 0, 
              orders: 0,
              revenue: 0
          };

          if (type === 'impression') currentStats.impressions++;
          if (type === 'click') currentStats.clicks++;
          if (type === 'order') {
              currentStats.orders++;
              currentStats.revenue += (event.value || 0);
          }

          await kv.set(statsKey, currentStats);
          
          // Also track item specific stats if itemId provided
          if (itemId) {
              const itemStatsKey = `stats:item:${itemId}:${dateStr}`;
              const itemStats = await kv.get(itemStatsKey) || { views: 0, sales: 0 };
              if (type === 'click' || type === 'view') itemStats.views++;
              if (type === 'order') itemStats.sales++;
              await kv.set(itemStatsKey, itemStats);
          }
      }

      return sendSuccess(c, { processed: events.length });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}
