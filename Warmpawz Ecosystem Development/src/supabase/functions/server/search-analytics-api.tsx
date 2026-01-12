import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 📊 SEARCH ANALYTICS API
 * 
 * Phase 7A: Critical Search & Discovery
 * Business Rule 5 Compliance: Search Analytics & Insights
 * 
 * Features:
 * - Track search queries
 * - Monitor click-through rates
 * - Analyze search trends
 * - Identify failed searches
 * - Conversion tracking
 * - Popular search terms
 * - Search performance metrics
 */

interface SearchAnalyticsEvent {
  eventId: string;
  query: string;
  userId?: string;
  timestamp: string;
  
  results: {
    count: number;
    topResults: string[];
  };
  
  userAction?: {
    clicked?: string;
    converted?: boolean;
    timeToClick?: number;
  };
  
  metadata: {
    source: string;
    deviceType?: string;
    index?: string;
  };
}

export function searchAnalyticsAPI(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // TRACK SEARCH EVENTS
  // ========================================

  // Track search query
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

      const eventId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const event: SearchAnalyticsEvent = {
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

      await kv.set(`search_analytics_${eventId}`, event);

      console.log(`📊 Tracked search: "${query}" (${event.results.count} results)`);

      return sendSuccess(c, { eventId }, 'Search tracked successfully');
    } catch (error) {
      console.error('Error tracking search:', error);
      return sendError(c, error, 500);
    }
  });

  // Track user click on search result
  app.post(`${BASE_PATH}/search/analytics/click`, async (c) => {
    try {
      const { eventId, clicked, timeToClick } = await c.req.json();

      if (!eventId || !clicked) {
        return sendError(c, 'eventId and clicked are required', 400);
      }

      const event = await kv.get(`search_analytics_${eventId}`);
      
      if (!event) {
        return sendError(c, 'Search event not found', 404);
      }

      event.userAction = {
        clicked,
        timeToClick,
        converted: false
      };

      await kv.set(`search_analytics_${eventId}`, event);

      console.log(`👆 Click tracked for search: ${eventId}`);

      return sendSuccess(c, {}, 'Click tracked successfully');
    } catch (error) {
      console.error('Error tracking click:', error);
      return sendError(c, error, 500);
    }
  });

  // Track conversion (booking/purchase)
  app.post(`${BASE_PATH}/search/analytics/convert`, async (c) => {
    try {
      const { eventId } = await c.req.json();

      if (!eventId) {
        return sendError(c, 'eventId is required', 400);
      }

      const event = await kv.get(`search_analytics_${eventId}`);
      
      if (!event) {
        return sendError(c, 'Search event not found', 404);
      }

      if (!event.userAction) {
        event.userAction = {};
      }

      event.userAction.converted = true;

      await kv.set(`search_analytics_${eventId}`, event);

      console.log(`✅ Conversion tracked for search: ${eventId}`);

      return sendSuccess(c, {}, 'Conversion tracked successfully');
    } catch (error) {
      console.error('Error tracking conversion:', error);
      return sendError(c, error, 500);
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

      const analyticsData = await kv.getByPrefix('search_analytics_');
      
      if (!analyticsData || analyticsData.length === 0) {
        return sendSuccess(c, { popular: [] });
      }

      // Filter by date and count frequencies
      const queryFrequency: Record<string, {
        count: number;
        totalResults: number;
        clicks: number;
        conversions: number;
      }> = {};

      analyticsData.forEach((item: any) => {
        const event = item.value || item;
        const eventDate = new Date(event.timestamp);

        if (eventDate < cutoffDate) return;

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
        queryFrequency[query].totalResults += event.results.count || 0;
        
        if (event.userAction?.clicked) {
          queryFrequency[query].clicks++;
        }
        
        if (event.userAction?.converted) {
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

      return sendSuccess(c, { popular, period: `${days} days` });
    } catch (error) {
      console.error('Error getting popular searches:', error);
      return sendError(c, error, 500);
    }
  });

  // Get search trends over time
  app.get(`${BASE_PATH}/search/analytics/trends`, async (c) => {
    try {
      const days = parseInt(c.req.query('days') || '30');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const analyticsData = await kv.getByPrefix('search_analytics_');
      
      if (!analyticsData || analyticsData.length === 0) {
        return sendSuccess(c, { trends: [] });
      }

      // Group by date
      const trendsByDate: Record<string, {
        totalSearches: number;
        uniqueQueries: Set<string>;
        clicks: number;
        conversions: number;
      }> = {};

      analyticsData.forEach((item: any) => {
        const event = item.value || item;
        const eventDate = new Date(event.timestamp);

        if (eventDate < cutoffDate) return;

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
        
        if (event.userAction?.clicked) {
          trendsByDate[dateKey].clicks++;
        }
        
        if (event.userAction?.converted) {
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

      return sendSuccess(c, { trends, period: `${days} days` });
    } catch (error) {
      console.error('Error getting search trends:', error);
      return sendError(c, error, 500);
    }
  });

  // Get failed searches (no results)
  app.get(`${BASE_PATH}/search/analytics/failed`, async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '20');
      const days = parseInt(c.req.query('days') || '7');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const analyticsData = await kv.getByPrefix('search_analytics_');
      
      if (!analyticsData || analyticsData.length === 0) {
        return sendSuccess(c, { failed: [] });
      }

      // Find searches with no results
      const failedSearches: Record<string, number> = {};

      analyticsData.forEach((item: any) => {
        const event = item.value || item;
        const eventDate = new Date(event.timestamp);

        if (eventDate < cutoffDate) return;

        if (event.results.count === 0) {
          const query = event.query;
          failedSearches[query] = (failedSearches[query] || 0) + 1;
        }
      });

      // Sort by frequency
      const failed = Object.entries(failedSearches)
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return sendSuccess(c, { failed, period: `${days} days` });
    } catch (error) {
      console.error('Error getting failed searches:', error);
      return sendError(c, error, 500);
    }
  });

  // Get click-through rates
  app.get(`${BASE_PATH}/search/analytics/click-through`, async (c) => {
    try {
      const days = parseInt(c.req.query('days') || '7');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const analyticsData = await kv.getByPrefix('search_analytics_');
      
      if (!analyticsData || analyticsData.length === 0) {
        return sendSuccess(c, {
          totalSearches: 0,
          searchesWithClicks: 0,
          clickThroughRate: 0,
          avgTimeToClick: 0
        });
      }

      let totalSearches = 0;
      let searchesWithClicks = 0;
      let totalTimeToClick = 0;
      let clickCount = 0;

      analyticsData.forEach((item: any) => {
        const event = item.value || item;
        const eventDate = new Date(event.timestamp);

        if (eventDate < cutoffDate) return;

        totalSearches++;

        if (event.userAction?.clicked) {
          searchesWithClicks++;
          
          if (event.userAction.timeToClick) {
            totalTimeToClick += event.userAction.timeToClick;
            clickCount++;
          }
        }
      });

      const clickThroughRate = totalSearches > 0 ? (searchesWithClicks / totalSearches * 100).toFixed(2) : '0.00';
      const avgTimeToClick = clickCount > 0 ? Math.round(totalTimeToClick / clickCount) : 0;

      return sendSuccess(c, {
        totalSearches,
        searchesWithClicks,
        clickThroughRate: parseFloat(clickThroughRate),
        avgTimeToClick
      });
    } catch (error) {
      console.error('Error getting click-through rates:', error);
      return sendError(c, error, 500);
    }
  });

  // Get comprehensive analytics dashboard
  app.get(`${BASE_PATH}/search/analytics/dashboard`, async (c) => {
    try {
      const days = parseInt(c.req.query('days') || '7');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const analyticsData = await kv.getByPrefix('search_analytics_');
      
      if (!analyticsData || analyticsData.length === 0) {
        return sendSuccess(c, {
          overview: {
            totalSearches: 0,
            uniqueQueries: 0,
            avgResultsPerSearch: 0,
            clickThroughRate: 0,
            conversionRate: 0
          },
          topQueries: [],
          failedSearches: [],
          trends: []
        });
      }

      let totalSearches = 0;
      const uniqueQueries = new Set<string>();
      let totalResults = 0;
      let clicks = 0;
      let conversions = 0;
      const queryFreq: Record<string, number> = {};
      const failedQueries: Record<string, number> = {};

      analyticsData.forEach((item: any) => {
        const event = item.value || item;
        const eventDate = new Date(event.timestamp);

        if (eventDate < cutoffDate) return;

        totalSearches++;
        uniqueQueries.add(event.query);
        totalResults += event.results.count || 0;

        queryFreq[event.query] = (queryFreq[event.query] || 0) + 1;

        if (event.results.count === 0) {
          failedQueries[event.query] = (failedQueries[event.query] || 0) + 1;
        }

        if (event.userAction?.clicked) clicks++;
        if (event.userAction?.converted) conversions++;
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

      return sendSuccess(c, {
        overview,
        topQueries,
        failedSearches,
        period: `${days} days`
      });
    } catch (error) {
      console.error('Error getting analytics dashboard:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Search Analytics API endpoints registered');
}
