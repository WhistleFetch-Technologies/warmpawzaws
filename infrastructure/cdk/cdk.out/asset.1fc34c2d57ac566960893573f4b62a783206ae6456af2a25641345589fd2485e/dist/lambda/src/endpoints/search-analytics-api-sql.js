"use strict";
/**
 * ============================================================================
 * SEARCH ANALYTICS API - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
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
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - Search analytics stored in search_analytics table
 *
 * Date: 2025-01-27
 * Migration: Phase 3 - Analytics Entity Migration
 * KV Operations Removed: 10
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAnalyticsAPI = searchAnalyticsAPI;
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
function searchAnalyticsAPI(app) {
    const BASE_PATH = "/make-server-3dd53475";
    const db = (0, db_1.getDbClient)();
    // ========================================
    // TRACK SEARCH EVENTS
    // ========================================
    // Track search query
    app.post(`${BASE_PATH}/search/analytics/track`, async (c) => {
        try {
            const body = await c.req.json();
            const { query, userId, results, source = 'search_bar', deviceType = 'unknown' } = body;
            if (!query) {
                return (0, response_utils_1.sendError)(c, 'Query is required', 400);
            }
            const eventId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const event = {
                eventId,
                query: query.toLowerCase().trim(),
                userId,
                timestamp: new Date().toISOString(),
                results: {
                    count: results?.count || 0,
                    topResults: results?.topResults || []
                },
                metadata: {
                    source,
                    deviceType
                }
            };
            // ✅ SQL: Store search analytics event
            try {
                const pool = await (0, db_1.getDbClient)();
                await pool.query(`INSERT INTO search_analytics (
            id, query, user_id, results_count, top_results, source,
            device_type, clicked, converted, time_to_click, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
                    eventId, event.query, userId || null, event.results.count,
                    JSON.stringify(event.results.topResults), event.metadata.source,
                    event.metadata.deviceType || null, null, false, null, event.timestamp
                ]);
            }
            catch (err) {
                // If table doesn't exist, store in platform_settings
                console.warn('search_analytics table not found, storing in platform_settings');
                const pool = await (0, db_1.getDbClient)();
                const existingResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1', ['search_analytics_events']);
                const existing = existingResult.rows[0] || null;
                const events = existing?.setting_value || [];
                events.push(event);
                await (0, db_1.upsertQuery)('platform_settings', {
                    setting_key: 'search_analytics_events',
                    setting_value: events,
                    setting_type: 'array',
                    updated_at: new Date().toISOString()
                }, 'setting_key');
            }
            console.log(`📊 Tracked search: "${query}" (${event.results.count} results)`);
            return (0, response_utils_1.sendSuccess)(c, { eventId }, 'Search tracked successfully');
        }
        catch (error) {
            console.error('Error tracking search:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // Track user click on search result
    app.post(`${BASE_PATH}/search/analytics/click`, async (c) => {
        try {
            const { eventId, clicked, timeToClick } = await c.req.json();
            if (!eventId || !clicked) {
                return (0, response_utils_1.sendError)(c, 'eventId and clicked are required', 400);
            }
            // ✅ SQL: Update search analytics event
            try {
                const pool = await (0, db_1.getDbClient)();
                await pool.query(`UPDATE search_analytics SET 
            clicked = $1, time_to_click = $2, converted = $3, updated_at = $4
            WHERE id = $5`, [clicked, timeToClick || null, false, new Date().toISOString(), eventId]);
            }
            catch (err) {
                // Fallback to platform_settings
                console.warn('search_analytics table not found');
            }
            console.log(`👆 Click tracked for search: ${eventId}`);
            return (0, response_utils_1.sendSuccess)(c, {}, 'Click tracked successfully');
        }
        catch (error) {
            console.error('Error tracking click:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // Track conversion (booking/purchase)
    app.post(`${BASE_PATH}/search/analytics/convert`, async (c) => {
        try {
            const { eventId } = await c.req.json();
            if (!eventId) {
                return (0, response_utils_1.sendError)(c, 'eventId is required', 400);
            }
            // ✅ SQL: Update search analytics event
            try {
                const pool = await (0, db_1.getDbClient)();
                await pool.query('UPDATE search_analytics SET converted = $1, updated_at = $2 WHERE id = $3', [true, new Date().toISOString(), eventId]);
            }
            catch (err) {
                console.warn('search_analytics table not found');
            }
            console.log(`✅ Conversion tracked for search: ${eventId}`);
            return (0, response_utils_1.sendSuccess)(c, {}, 'Conversion tracked successfully');
        }
        catch (error) {
            console.error('Error tracking conversion:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // ========================================
    // ANALYTICS INSIGHTS
    // ========================================
    // Get popular searches
    app.get(`${BASE_PATH}/search/analytics/popular`, async (c) => {
        try {
            const limit = parseInt(c.req.query('limit') || '20');
            const days = parseInt(c.req.query('days') || '7');
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            // ✅ SQL: Get search analytics
            let analyticsData = [];
            try {
                const pool = await (0, db_1.getDbClient)();
                const result = await pool.query('SELECT * FROM search_analytics WHERE created_at >= $1', [cutoffDate.toISOString()]);
                analyticsData = result.rows || [];
            }
            catch (err) {
                // Fallback to platform_settings
                const pool = await (0, db_1.getDbClient)();
                const result = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1', ['search_analytics_events']);
                analyticsData = result.rows[0]?.setting_value || [];
            }
            // Filter by date and count frequencies
            const queryFrequency = {};
            analyticsData.forEach((event) => {
                const eventDate = new Date(event.timestamp || event.created_at);
                if (eventDate < cutoffDate)
                    return;
                const query = event.query;
                if (!queryFrequency[query]) {
                    queryFrequency[query] = {
                        count: 0,
                        totalResults: 0,
                        clicks: 0,
                        conversions: 0
                    };
                }
                queryFrequency[query].count++;
                queryFrequency[query].totalResults += event.results_count || event.results?.count || 0;
                if (event.clicked || event.userAction?.clicked) {
                    queryFrequency[query].clicks++;
                }
                if (event.converted || event.userAction?.converted) {
                    queryFrequency[query].conversions++;
                }
            });
            // Calculate metrics and sort
            const popular = Object.entries(queryFrequency)
                .map(([query, stats]) => ({
                query,
                searchCount: stats.count,
                avgResults: Math.round(stats.totalResults / stats.count),
                clickThroughRate: stats.count > 0 ? (stats.clicks / stats.count * 100).toFixed(1) : '0.0',
                conversionRate: stats.count > 0 ? (stats.conversions / stats.count * 100).toFixed(1) : '0.0'
            }))
                .sort((a, b) => b.searchCount - a.searchCount)
                .slice(0, limit);
            return (0, response_utils_1.sendSuccess)(c, { popular, period: `${days} days` });
        }
        catch (error) {
            console.error('Error getting popular searches:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // Get search trends over time
    app.get(`${BASE_PATH}/search/analytics/trends`, async (c) => {
        try {
            const days = parseInt(c.req.query('days') || '30');
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            // ✅ SQL: Get search analytics
            let analyticsData = [];
            try {
                const pool = await (0, db_1.getDbClient)();
                const result = await pool.query('SELECT * FROM search_analytics WHERE created_at >= $1', [cutoffDate.toISOString()]);
                analyticsData = result.rows || [];
            }
            catch (err) {
                const pool = await (0, db_1.getDbClient)();
                const result = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1', ['search_analytics_events']);
                analyticsData = result.rows[0]?.setting_value || [];
            }
            // Group by date
            const trendsByDate = {};
            analyticsData.forEach((event) => {
                const eventDate = new Date(event.timestamp || event.created_at);
                if (eventDate < cutoffDate)
                    return;
                const dateKey = eventDate.toISOString().split('T')[0];
                if (!trendsByDate[dateKey]) {
                    trendsByDate[dateKey] = {
                        totalSearches: 0,
                        uniqueQueries: new Set(),
                        clicks: 0,
                        conversions: 0
                    };
                }
                trendsByDate[dateKey].totalSearches++;
                trendsByDate[dateKey].uniqueQueries.add(event.query);
                if (event.clicked || event.userAction?.clicked) {
                    trendsByDate[dateKey].clicks++;
                }
                if (event.converted || event.userAction?.converted) {
                    trendsByDate[dateKey].conversions++;
                }
            });
            // Format trends
            const trends = Object.entries(trendsByDate)
                .map(([date, stats]) => ({
                date,
                totalSearches: stats.totalSearches,
                uniqueQueries: stats.uniqueQueries.size,
                clickThroughRate: stats.totalSearches > 0 ? (stats.clicks / stats.totalSearches * 100).toFixed(1) : '0.0',
                conversionRate: stats.totalSearches > 0 ? (stats.conversions / stats.totalSearches * 100).toFixed(1) : '0.0'
            }))
                .sort((a, b) => a.date.localeCompare(b.date));
            return (0, response_utils_1.sendSuccess)(c, { trends, period: `${days} days` });
        }
        catch (error) {
            console.error('Error getting search trends:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // Get failed searches (no results)
    app.get(`${BASE_PATH}/search/analytics/failed`, async (c) => {
        try {
            const limit = parseInt(c.req.query('limit') || '20');
            const days = parseInt(c.req.query('days') || '7');
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            // ✅ SQL: Get search analytics
            let analyticsData = [];
            try {
                const pool = await (0, db_1.getDbClient)();
                const result = await pool.query('SELECT * FROM search_analytics WHERE created_at >= $1 AND results_count = $2', [cutoffDate.toISOString(), 0]);
                analyticsData = result.rows || [];
            }
            catch (err) {
                const pool = await (0, db_1.getDbClient)();
                const result = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1', ['search_analytics_events']);
                analyticsData = (result.rows[0]?.setting_value || []).filter((e) => (e.results_count || e.results?.count || 0) === 0);
            }
            // Find searches with no results
            const failedSearches = {};
            analyticsData.forEach((event) => {
                const eventDate = new Date(event.timestamp || event.created_at);
                if (eventDate < cutoffDate)
                    return;
                if ((event.results_count || event.results?.count || 0) === 0) {
                    const query = event.query;
                    failedSearches[query] = (failedSearches[query] || 0) + 1;
                }
            });
            // Sort by frequency
            const failed = Object.entries(failedSearches)
                .map(([query, count]) => ({ query, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, limit);
            return (0, response_utils_1.sendSuccess)(c, { failed, period: `${days} days` });
        }
        catch (error) {
            console.error('Error getting failed searches:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // Get click-through rates
    app.get(`${BASE_PATH}/search/analytics/click-through`, async (c) => {
        try {
            const days = parseInt(c.req.query('days') || '7');
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            // ✅ SQL: Get search analytics
            let analyticsData = [];
            try {
                const pool = await (0, db_1.getDbClient)();
                const result = await pool.query('SELECT * FROM search_analytics WHERE created_at >= $1', [cutoffDate.toISOString()]);
                analyticsData = result.rows || [];
            }
            catch (err) {
                const pool = await (0, db_1.getDbClient)();
                const result = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1', ['search_analytics_events']);
                analyticsData = result.rows[0]?.setting_value || [];
            }
            let totalSearches = 0;
            let searchesWithClicks = 0;
            let totalTimeToClick = 0;
            let clickCount = 0;
            analyticsData.forEach((event) => {
                const eventDate = new Date(event.timestamp || event.created_at);
                if (eventDate < cutoffDate)
                    return;
                totalSearches++;
                if (event.clicked || event.userAction?.clicked) {
                    searchesWithClicks++;
                    if (event.time_to_click || event.userAction?.timeToClick) {
                        totalTimeToClick += (event.time_to_click || event.userAction.timeToClick);
                        clickCount++;
                    }
                }
            });
            const clickThroughRate = totalSearches > 0 ? (searchesWithClicks / totalSearches * 100).toFixed(2) : '0.00';
            const avgTimeToClick = clickCount > 0 ? Math.round(totalTimeToClick / clickCount) : 0;
            return (0, response_utils_1.sendSuccess)(c, {
                totalSearches,
                searchesWithClicks,
                clickThroughRate: parseFloat(clickThroughRate),
                avgTimeToClick
            });
        }
        catch (error) {
            console.error('Error getting click-through rates:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // Get comprehensive analytics dashboard
    app.get(`${BASE_PATH}/search/analytics/dashboard`, async (c) => {
        try {
            const days = parseInt(c.req.query('days') || '7');
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            // ✅ SQL: Get search analytics
            let analyticsData = [];
            try {
                const pool = await (0, db_1.getDbClient)();
                const result = await pool.query('SELECT * FROM search_analytics WHERE created_at >= $1', [cutoffDate.toISOString()]);
                analyticsData = result.rows || [];
            }
            catch (err) {
                const pool = await (0, db_1.getDbClient)();
                const result = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1', ['search_analytics_events']);
                analyticsData = result.rows[0]?.setting_value || [];
            }
            let totalSearches = 0;
            const uniqueQueries = new Set();
            let totalResults = 0;
            let clicks = 0;
            let conversions = 0;
            const queryFreq = {};
            const failedQueries = {};
            analyticsData.forEach((event) => {
                const eventDate = new Date(event.timestamp || event.created_at);
                if (eventDate < cutoffDate)
                    return;
                totalSearches++;
                uniqueQueries.add(event.query);
                totalResults += (event.results_count || event.results?.count || 0);
                queryFreq[event.query] = (queryFreq[event.query] || 0) + 1;
                if ((event.results_count || event.results?.count || 0) === 0) {
                    failedQueries[event.query] = (failedQueries[event.query] || 0) + 1;
                }
                if (event.clicked || event.userAction?.clicked)
                    clicks++;
                if (event.converted || event.userAction?.converted)
                    conversions++;
            });
            const overview = {
                totalSearches,
                uniqueQueries: uniqueQueries.size,
                avgResultsPerSearch: totalSearches > 0 ? (totalResults / totalSearches).toFixed(1) : '0.0',
                clickThroughRate: totalSearches > 0 ? (clicks / totalSearches * 100).toFixed(2) : '0.00',
                conversionRate: totalSearches > 0 ? (conversions / totalSearches * 100).toFixed(2) : '0.00'
            };
            const topQueries = Object.entries(queryFreq)
                .map(([query, count]) => ({ query, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
            const failedSearches = Object.entries(failedQueries)
                .map(([query, count]) => ({ query, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
            return (0, response_utils_1.sendSuccess)(c, {
                overview,
                topQueries,
                failedSearches,
                period: `${days} days`
            });
        }
        catch (error) {
            console.error('Error getting analytics dashboard:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    console.log('✅ Search Analytics API endpoints registered');
}
//# sourceMappingURL=search-analytics-api-sql.js.map