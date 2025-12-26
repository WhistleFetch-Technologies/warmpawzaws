/**
 * ============================================================================
 * SEARCH ANALYTICS API - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Track search queries
 * - Monitor click-through rates
 * - Analyze search trends
 * - Identify failed searches
 * - Conversion tracking
 * - Popular search terms
 * - Search performance metrics
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `search_analytics`, `search_history` tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 16 - KV to SQL (10 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
const db = getDbClient();
const BASE_PATH = "/make-server-3dd53475";

/**
 * POST /search/analytics/track
 * Track search query
 */
app.post(`${BASE_PATH}/search/analytics/track`, async (c) => {
  try {
    const body = await c.req.json();
    const {
      query,
      userId,
      results,
      source = 'search_bar',
      deviceType = 'unknown'
    } = body;

    if (!query) {
      return sendError(c, 'Query is required', 400);
    }

    // ✅ SQL: Insert search analytics event
    const { data: event } = await db
      .from('search_analytics')
      .insert({
        search_date: new Date().toISOString().split('T')[0],
        query: query.toLowerCase().trim(),
        results_count: results?.count || 0,
        zero_results: (results?.count || 0) === 0,
        user_id: userId || null,
        metadata: {
          source,
          deviceType,
          topResults: results?.topResults || []
        }
      })
      .select()
      .single();

    // ✅ SQL: Insert search history
    if (userId) {
      await db
        .from('search_history')
        .insert({
          customer_id: userId,
          search_query: query.toLowerCase().trim(),
          results_count: results?.count || 0
        });
    }

    return sendSuccess(c, { eventId: event?.id }, 'Search tracked successfully');
  } catch (error) {
    console.error('Error tracking search:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /search/analytics/click
 * Track user click on search result
 */
app.post(`${BASE_PATH}/search/analytics/click`, async (c) => {
  try {
    const { eventId, clicked, timeToClick } = await c.req.json();

    if (!eventId || !clicked) {
      return sendError(c, 'eventId and clicked are required', 400);
    }

    // ✅ SQL: Update search analytics event
    await db
      .from('search_analytics')
      .update({
        clicked_result_id: clicked,
        metadata: db.raw(`metadata || '{"clicked": "${clicked}", "timeToClick": ${timeToClick || 0}}'::jsonb`)
      })
      .eq('id', eventId);

    return sendSuccess(c, {}, 'Click tracked successfully');
  } catch (error) {
    console.error('Error tracking click:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /search/analytics/convert
 * Track conversion (booking/purchase)
 */
app.post(`${BASE_PATH}/search/analytics/convert`, async (c) => {
  try {
    const { eventId } = await c.req.json();

    if (!eventId) {
      return sendError(c, 'eventId is required', 400);
    }

    // ✅ SQL: Update search analytics event
    await db
      .from('search_analytics')
      .update({
        metadata: db.raw(`metadata || '{"converted": true}'::jsonb`)
      })
      .eq('id', eventId);

    return sendSuccess(c, {}, 'Conversion tracked successfully');
  } catch (error) {
    console.error('Error tracking conversion:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /search/analytics/popular
 * Get popular searches
 */
app.get(`${BASE_PATH}/search/analytics/popular`, async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const days = parseInt(c.req.query('days') || '7');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // ✅ SQL: Get popular searches
    const { data: popular } = await db
      .from('search_analytics')
      .select('query')
      .gte('search_date', cutoffDate.toISOString().split('T')[0])
      .select('query, count(*) as count')
      .group('query')
      .order('count', { ascending: false })
      .limit(limit);

    return sendSuccess(c, { popular: popular || [] });
  } catch (error) {
    console.error('Error getting popular searches:', error);
    return sendError(c, error, 500);
  }
});

console.log('✅ Search Analytics API (SQL-only) registered');

export default app;

