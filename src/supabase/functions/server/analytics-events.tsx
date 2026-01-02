// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { getDbClient } from '../../../supabase/lib/db';

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

      // ✅ SQL: Store analytics events in analytics_events table (time-series optimized)
      // In production, use ClickHouse/BigQuery for high-volume analytics
      const db = getDbClient();
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      for (const event of events) {
          const { type, vendorId, itemId } = event;
          if (!vendorId || !type) continue;

          // ✅ SQL: Upsert vendor daily stats using SQL aggregation
          try {
            await db.rpc('increment_vendor_stats', {
              p_vendor_id: vendorId,
              p_date: dateStr,
              p_event_type: type,
              p_value: event.value || 0
            });
          } catch (error) {
            // If function doesn't exist, use insert/update pattern
            const { data: existing } = await db
              .from('vendor_daily_stats')
              .select('*')
              .eq('vendor_id', vendorId)
              .eq('date', dateStr)
              .single();
            
            if (existing) {
              await db
                .from('vendor_daily_stats')
                .update({
                  impressions: type === 'impression' ? (existing.impressions || 0) + 1 : existing.impressions,
                  clicks: type === 'click' ? (existing.clicks || 0) + 1 : existing.clicks,
                  orders: type === 'order' ? (existing.orders || 0) + 1 : existing.orders,
                  revenue: type === 'order' ? (existing.revenue || 0) + (event.value || 0) : existing.revenue,
                  updated_at: new Date().toISOString()
                })
                .eq('vendor_id', vendorId)
                .eq('date', dateStr);
            } else {
              await db
                .from('vendor_daily_stats')
                .insert({
                  vendor_id: vendorId,
                  date: dateStr,
                  impressions: type === 'impression' ? 1 : 0,
                  clicks: type === 'click' ? 1 : 0,
                  orders: type === 'order' ? 1 : 0,
                  revenue: type === 'order' ? (event.value || 0) : 0
                });
            }
          }
          
          // ✅ SQL: Track item-specific stats if itemId provided
          if (itemId) {
            try {
              const { data: existing } = await db
                .from('item_daily_stats')
                .select('*')
                .eq('item_id', itemId)
                .eq('date', dateStr)
                .single();
              
              if (existing) {
                await db
                  .from('item_daily_stats')
                  .update({
                    views: (type === 'click' || type === 'view') ? (existing.views || 0) + 1 : existing.views,
                    sales: type === 'order' ? (existing.sales || 0) + 1 : existing.sales,
                    updated_at: new Date().toISOString()
                  })
                  .eq('item_id', itemId)
                  .eq('date', dateStr);
              } else {
                await db
                  .from('item_daily_stats')
                  .insert({
                    item_id: itemId,
                    date: dateStr,
                    views: (type === 'click' || type === 'view') ? 1 : 0,
                    sales: type === 'order' ? 1 : 0
                  });
              }
            } catch (error) {
              console.warn('item_daily_stats table not available, skipping item stats');
            }
          }
      }

      return sendSuccess(c, { processed: events.length });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}
