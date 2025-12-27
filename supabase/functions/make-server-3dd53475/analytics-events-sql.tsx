/**
 * ============================================================================
 * HIGH-VOLUME ANALYTICS INGESTION - SQL VERSION
 * ============================================================================
 * 
 * Tracks clicks, impressions, and conversions
 * Replaces: stats:vendor:{id}:{date} and stats:item:{id}:{date} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from "../../lib/db.ts";

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
      // In SQL, we aggregate immediately into daily buckets to avoid write explosion.
      
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const db = getDbClient();

      for (const event of events) {
          const { type, vendorId, itemId } = event;
          if (!vendorId || !type) continue;

          // ✅ SQL: Update vendor stats
          const { data: existingVendorStats } = await db
            .from('vendor_stats')
            .select('*')
            .eq('vendor_id', vendorId)
            .eq('stat_date', dateStr)
            .single();

          const currentStats = existingVendorStats || {
              impressions: 0,
              clicks: 0,
              bookings: 0,
              revenue: 0
          };

          if (type === 'impression') currentStats.impressions++;
          if (type === 'click') currentStats.clicks++;
          if (type === 'order') {
              currentStats.bookings++;
              currentStats.revenue += (event.value || 0);
          }

          // Upsert vendor stats
          await db
            .from('vendor_stats')
            .upsert({
              vendor_id: vendorId,
              stat_date: dateStr,
              impressions: currentStats.impressions,
              clicks: currentStats.clicks,
              bookings: currentStats.bookings,
              revenue: currentStats.revenue,
              created_at: existingVendorStats?.created_at || new Date().toISOString()
            }, {
              onConflict: 'vendor_id,stat_date'
            });
          
          // ✅ SQL: Also track item specific stats if itemId provided
          if (itemId) {
              const { data: existingItemStats } = await db
                .from('item_stats')
                .select('*')
                .eq('item_id', itemId)
                .eq('stat_date', dateStr)
                .single();

              const itemStats = existingItemStats || { views: 0, sales: 0, revenue: 0 };
              if (type === 'click' || type === 'view') itemStats.views++;
              if (type === 'order') {
                  itemStats.sales++;
                  itemStats.revenue += (event.value || 0);
              }

              // Determine item_type from event or default to 'service'
              const itemType = event.itemType || 'service';

              // Upsert item stats
              await db
                .from('item_stats')
                .upsert({
                  item_id: itemId,
                  item_type: itemType,
                  stat_date: dateStr,
                  views: itemStats.views,
                  sales: itemStats.sales,
                  revenue: itemStats.revenue,
                  created_at: existingItemStats?.created_at || new Date().toISOString()
                }, {
                  onConflict: 'item_id,item_type,stat_date'
                });
          }
      }

      return sendSuccess(c, { processed: events.length });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}
