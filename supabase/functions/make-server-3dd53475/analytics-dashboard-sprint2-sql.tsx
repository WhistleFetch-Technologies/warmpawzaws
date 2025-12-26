/**
 * 📊 ADVANCED ANALYTICS DASHBOARD - SPRINT 2 (SQL-ONLY VERSION)
 * Phase 7E - Sprint 2: Advanced Analytics & Reporting
 * Date: December 15, 2024
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * This file implements comprehensive analytics features:
 * - Real-time analytics dashboard
 * - User behavior tracking
 * - Conversion funnel analysis
 * - Revenue analytics
 * - Service performance metrics
 * - Automated reports
 * - Custom report builder
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL repository calls
 * - All data now comes from SQL tables (bookings, customers, vendors, reviews)
 * - Analytics events stored in `platform_settings` or dedicated analytics table
 * 
 * Date: 2025-01-27
 * Migration: Batch 7 - Complete KV to SQL Migration
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getReviewsRepository } from '../../lib/repositories/reviews.ts';
import { getDbClient } from '../../lib/db.ts';

export function registerAnalyticsDashboardSprint2SQL(app: Hono) {
  console.log('✅ Registering Analytics Dashboard Sprint 2 (SQL-only)...');

  const BASE_PATH = "/make-server-3dd53475";
  const client = getDbClient();
  const bookingsRepo = getBookingsRepository();
  const customersRepo = getCustomersRepository();
  const vendorsRepo = getVendorsRepository();
  const reviewsRepo = getReviewsRepository();

  // ==========================================
  // REAL-TIME ANALYTICS
  // ==========================================

  /**
   * GET /analytics/realtime - Get real-time platform metrics
   */
  app.get(`${BASE_PATH}/analytics/realtime`, async (c) => {
    try {
      const now = new Date();
      const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000);
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get recent bookings from SQL
      const { data: recentBookings } = await client
        .from('bookings')
        .select('*')
        .gte('created_at', last24Hours.toISOString())
        .limit(1000);

      // Get recent customers (active in last 5 minutes)
      const { data: recentCustomers } = await client
        .from('customers')
        .select('id, last_login_at, created_at')
        .or(`last_login_at.gte.${last5Minutes.toISOString()},created_at.gte.${last5Minutes.toISOString()}`)
        .limit(1000);

      // Get all vendors
      const { data: recentVendors } = await client
        .from('vendors')
        .select('id')
        .eq('is_active', true);

      // Calculate active users
      const activeUsers = recentCustomers?.length || 0;

      // Bookings in last hour
      const recentBookingsCount = recentBookings?.filter((booking: any) => {
        const bookingDate = new Date(booking.created_at);
        return bookingDate >= lastHour;
      }).length || 0;

      // Calculate revenue per hour
      const recentRevenue = recentBookings
        ?.filter((booking: any) => {
          const bookingDate = new Date(booking.created_at);
          return bookingDate >= lastHour && booking.status !== 'cancelled';
        })
        .reduce((sum: number, booking: any) => sum + (parseFloat(booking.total_amount) || 0), 0) || 0;

      // Service popularity (bookings per service in last 24 hours)
      const servicePopularity: Record<string, number> = {};
      recentBookings?.forEach((booking: any) => {
        const bookingDate = new Date(booking.created_at);
        if (bookingDate >= last24Hours) {
          const service = booking.service_type || 'unknown';
          servicePopularity[service] = (servicePopularity[service] || 0) + 1;
        }
      });

      const topServices = Object.entries(servicePopularity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([service, count]) => ({ service, count }));

      // Store real-time metrics for historical tracking (in platform_settings)
      const metricsKey = `analytics_realtime_${now.toISOString().split('T')[0]}`;
      const { data: metricsData } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', metricsKey)
        .maybeSingle();

      const dailyMetrics = metricsData?.setting_value || { snapshots: [] };
      dailyMetrics.snapshots.push({
        timestamp: now.toISOString(),
        activeUsers,
        bookingsLastHour: recentBookingsCount,
        revenueLastHour: recentRevenue
      });

      // Keep only last 288 snapshots (24 hours at 5-minute intervals)
      if (dailyMetrics.snapshots.length > 288) {
        dailyMetrics.snapshots = dailyMetrics.snapshots.slice(-288);
      }

      // Update platform_settings
      await client
        .from('platform_settings')
        .upsert({
          setting_key: metricsKey,
          setting_value: dailyMetrics,
          updated_at: new Date().toISOString()
        });

      return sendSuccess(c, {
        realtime: {
          activeUsers,
          bookingsPerHour: recentBookingsCount,
          revenuePerHour: recentRevenue,
          topServices,
          totalVendors: recentVendors?.length || 0,
          totalCustomers: recentCustomers?.length || 0,
          timestamp: now.toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to fetch real-time analytics:', error);
      return sendError(c, 'Failed to fetch analytics', 500);
    }
  });

  /**
   * GET /analytics/realtime/chart - Get real-time chart data for last 24 hours
   */
  app.get(`${BASE_PATH}/analytics/realtime/chart`, async (c) => {
    try {
      const now = new Date();
      const metricsKey = `analytics_realtime_${now.toISOString().split('T')[0]}`;

      const { data: metricsData } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', metricsKey)
        .maybeSingle();

      const dailyMetrics = metricsData?.setting_value || { snapshots: [] };

      return sendSuccess(c, {
        chartData: dailyMetrics.snapshots || [],
        dataPoints: dailyMetrics.snapshots.length
      });
    } catch (error) {
      return sendError(c, 'Failed to fetch chart data', 500);
    }
  });

  // ==========================================
  // USER BEHAVIOR TRACKING
  // ==========================================

  /**
   * POST /analytics/track-event - Track user behavior event
   */
  app.post(`${BASE_PATH}/analytics/track-event`, async (c) => {
    try {
      const {
        userId,
        eventType,
        eventData,
        sessionId,
        timestamp
      } = await c.req.json();

      if (!eventType) {
        return sendError(c, 'eventType is required', 400);
      }

      const event = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        session_id: sessionId,
        event_type: eventType,
        event_data: eventData,
        timestamp: timestamp || new Date().toISOString(),
        user_agent: c.req.header('user-agent'),
        ip_address: c.req.header('x-forwarded-for') || 'unknown'
      };

      // Store event in platform_settings (analytics_events array)
      const today = new Date().toISOString().split('T')[0];
      const aggregateKey = `analytics_events_${today}`;

      const { data: aggregatesData } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', aggregateKey)
        .maybeSingle();

      const aggregates = aggregatesData?.setting_value || {
        events: [],
        eventCounts: {},
        userCounts: {}
      };

      aggregates.events.push(event.id);
      aggregates.eventCounts[eventType] = (aggregates.eventCounts[eventType] || 0) + 1;

      if (userId) {
        aggregates.userCounts[userId] = (aggregates.userCounts[userId] || 0) + 1;
      }

      // Store event details in events array
      if (!aggregates.eventDetails) aggregates.eventDetails = [];
      aggregates.eventDetails.push(event);

      await client
        .from('platform_settings')
        .upsert({
          setting_key: aggregateKey,
          setting_value: aggregates,
          updated_at: new Date().toISOString()
        });

      return sendSuccess(c, { eventId: event.id });
    } catch (error) {
      console.error('Failed to track event:', error);
      return sendError(c, 'Failed to track event', 500);
    }
  });

  /**
   * GET /analytics/behavior/summary - Get user behavior summary
   */
  app.get(`${BASE_PATH}/analytics/behavior/summary`, async (c) => {
    try {
      const { startDate, endDate } = c.req.query();

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const eventsByType: Record<string, number> = {};
      const eventsByDay: Record<string, number> = {};
      const topUsers: Record<string, number> = {};

      // Aggregate events for date range
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const aggregateKey = `analytics_events_${dateKey}`;

        const { data: dayData } = await client
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', aggregateKey)
          .maybeSingle();

        if (dayData?.setting_value) {
          const dayDataValue = dayData.setting_value;
          // Aggregate by event type
          Object.entries(dayDataValue.eventCounts || {}).forEach(([type, count]) => {
            eventsByType[type] = (eventsByType[type] || 0) + (count as number);
          });

          // Aggregate by day
          eventsByDay[dateKey] = dayDataValue.events?.length || 0;

          // Aggregate by user
          Object.entries(dayDataValue.userCounts || {}).forEach(([userId, count]) => {
            topUsers[userId] = (topUsers[userId] || 0) + (count as number);
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Sort top users
      const sortedUsers = Object.entries(topUsers)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, eventCount: count }));

      return sendSuccess(c, {
        summary: {
          totalEvents: Object.values(eventsByType).reduce((sum, count) => sum + count, 0),
          eventsByType,
          eventsByDay,
          topUsers: sortedUsers,
          dateRange: { start: start.toISOString(), end: end.toISOString() }
        }
      });
    } catch (error) {
      console.error('Failed to fetch behavior summary:', error);
      return sendError(c, 'Failed to fetch summary', 500);
    }
  });

  // ==========================================
  // CONVERSION FUNNEL ANALYSIS
  // ==========================================

  /**
   * GET /analytics/funnel/booking - Get booking conversion funnel
   */
  app.get(`${BASE_PATH}/analytics/funnel/booking`, async (c) => {
    try {
      const { startDate, endDate } = c.req.query();

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      // Define funnel stages
      const funnelStages = {
        serviceView: 0,
        serviceClick: 0,
        bookingStarted: 0,
        formCompleted: 0,
        paymentInitiated: 0,
        bookingConfirmed: 0
      };

      // Aggregate events for date range
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const aggregateKey = `analytics_events_${dateKey}`;

        const { data: dayData } = await client
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', aggregateKey)
          .maybeSingle();

        if (dayData?.setting_value?.eventCounts) {
          const eventCounts = dayData.setting_value.eventCounts;
          funnelStages.serviceView += eventCounts['service_view'] || 0;
          funnelStages.serviceClick += eventCounts['service_click'] || 0;
          funnelStages.bookingStarted += eventCounts['booking_started'] || 0;
          funnelStages.formCompleted += eventCounts['form_completed'] || 0;
          funnelStages.paymentInitiated += eventCounts['payment_initiated'] || 0;
          funnelStages.bookingConfirmed += eventCounts['booking_confirmed'] || 0;
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate conversion rates
      const conversionRates = {
        viewToClick: funnelStages.serviceView > 0
          ? (funnelStages.serviceClick / funnelStages.serviceView * 100).toFixed(2)
          : 0,
        clickToStart: funnelStages.serviceClick > 0
          ? (funnelStages.bookingStarted / funnelStages.serviceClick * 100).toFixed(2)
          : 0,
        startToComplete: funnelStages.bookingStarted > 0
          ? (funnelStages.formCompleted / funnelStages.bookingStarted * 100).toFixed(2)
          : 0,
        completeToPayment: funnelStages.formCompleted > 0
          ? (funnelStages.paymentInitiated / funnelStages.formCompleted * 100).toFixed(2)
          : 0,
        paymentToConfirmed: funnelStages.paymentInitiated > 0
          ? (funnelStages.bookingConfirmed / funnelStages.paymentInitiated * 100).toFixed(2)
          : 0,
        overallConversion: funnelStages.serviceView > 0
          ? (funnelStages.bookingConfirmed / funnelStages.serviceView * 100).toFixed(2)
          : 0
      };

      return sendSuccess(c, {
        funnel: {
          stages: funnelStages,
          conversionRates,
          dateRange: { start: start.toISOString(), end: end.toISOString() }
        }
      });
    } catch (error) {
      console.error('Failed to fetch funnel data:', error);
      return sendError(c, 'Failed to fetch funnel', 500);
    }
  });

  /**
   * GET /analytics/funnel/dropoff - Identify funnel drop-off points
   */
  app.get(`${BASE_PATH}/analytics/funnel/dropoff`, async (c) => {
    try {
      const { startDate, endDate } = c.req.query();

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      // Define funnel stages
      const funnelStages = {
        serviceView: 0,
        serviceClick: 0,
        bookingStarted: 0,
        formCompleted: 0,
        paymentInitiated: 0,
        bookingConfirmed: 0
      };

      // Aggregate events for date range
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const aggregateKey = `analytics_events_${dateKey}`;

        const { data: dayData } = await client
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', aggregateKey)
          .maybeSingle();

        if (dayData?.setting_value?.eventCounts) {
          const eventCounts = dayData.setting_value.eventCounts;
          funnelStages.serviceView += eventCounts['service_view'] || 0;
          funnelStages.serviceClick += eventCounts['service_click'] || 0;
          funnelStages.bookingStarted += eventCounts['booking_started'] || 0;
          funnelStages.formCompleted += eventCounts['form_completed'] || 0;
          funnelStages.paymentInitiated += eventCounts['payment_initiated'] || 0;
          funnelStages.bookingConfirmed += eventCounts['booking_confirmed'] || 0;
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      const stages = funnelStages;
      const dropoffs = [
        {
          stage: 'View to Click',
          dropped: stages.serviceView - stages.serviceClick,
          dropRate: stages.serviceView > 0 ? ((stages.serviceView - stages.serviceClick) / stages.serviceView * 100).toFixed(2) : '0'
        },
        {
          stage: 'Click to Start',
          dropped: stages.serviceClick - stages.bookingStarted,
          dropRate: stages.serviceClick > 0 ? ((stages.serviceClick - stages.bookingStarted) / stages.serviceClick * 100).toFixed(2) : '0'
        },
        {
          stage: 'Start to Complete',
          dropped: stages.bookingStarted - stages.formCompleted,
          dropRate: stages.bookingStarted > 0 ? ((stages.bookingStarted - stages.formCompleted) / stages.bookingStarted * 100).toFixed(2) : '0'
        },
        {
          stage: 'Complete to Payment',
          dropped: stages.formCompleted - stages.paymentInitiated,
          dropRate: stages.formCompleted > 0 ? ((stages.formCompleted - stages.paymentInitiated) / stages.formCompleted * 100).toFixed(2) : '0'
        },
        {
          stage: 'Payment to Confirmed',
          dropped: stages.paymentInitiated - stages.bookingConfirmed,
          dropRate: stages.paymentInitiated > 0 ? ((stages.paymentInitiated - stages.bookingConfirmed) / stages.paymentInitiated * 100).toFixed(2) : '0'
        }
      ].sort((a, b) => parseFloat(b.dropRate) - parseFloat(a.dropRate));

      return sendSuccess(c, {
        dropoffs,
        criticalDropoff: dropoffs[0]
      });
    } catch (error) {
      console.error('Failed to fetch dropoff data:', error);
      return sendError(c, 'Failed to fetch dropoff data', 500);
    }
  });

  // ==========================================
  // REVENUE ANALYTICS
  // ==========================================

  /**
   * GET /analytics/revenue/overview - Get revenue overview
   */
  app.get(`${BASE_PATH}/analytics/revenue/overview`, async (c) => {
    try {
      const { period = 'month' } = c.req.query();

      const now = new Date();
      let startDate: Date;
      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get bookings from SQL
      const { data: bookings } = await client
        .from('bookings')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .neq('status', 'cancelled');

      // Filter bookings in period
      const periodBookings = bookings || [];

      // Calculate metrics
      const totalRevenue = periodBookings.reduce((sum, b: any) => sum + (parseFloat(b.total_amount) || 0), 0);
      const totalCommission = periodBookings.reduce((sum, b: any) =>
        sum + ((parseFloat(b.total_amount) || 0) * 0.15), 0); // Assuming 15% commission

      // Revenue by service category
      const revenueByCategory: Record<string, number> = {};
      periodBookings.forEach((booking: any) => {
        const category = booking.service_type || 'unknown';
        revenueByCategory[category] = (revenueByCategory[category] || 0) + (parseFloat(booking.total_amount) || 0);
      });

      // Top revenue categories
      const topCategories = Object.entries(revenueByCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([category, revenue]) => ({
          category,
          revenue,
          percentage: ((revenue / totalRevenue) * 100).toFixed(2)
        }));

      // Revenue by vendor
      const revenueByVendor: Record<string, number> = {};
      periodBookings.forEach((booking: any) => {
        const vendorId = booking.vendor_id || 'unknown';
        revenueByVendor[vendorId] = (revenueByVendor[vendorId] || 0) + (parseFloat(booking.total_amount) || 0);
      });

      // Top revenue vendors
      const topVendors = Object.entries(revenueByVendor)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([vendorId, revenue]) => ({ vendorId, revenue }));

      // Calculate average transaction value
      const avgTransactionValue = periodBookings.length > 0
        ? totalRevenue / periodBookings.length
        : 0;

      // Revenue trend (daily breakdown)
      const revenueTrend: Record<string, number> = {};
      periodBookings.forEach((booking: any) => {
        const date = new Date(booking.created_at).toISOString().split('T')[0];
        revenueTrend[date] = (revenueTrend[date] || 0) + (parseFloat(booking.total_amount) || 0);
      });

      return sendSuccess(c, {
        revenue: {
          totalRevenue,
          totalCommission,
          totalBookings: periodBookings.length,
          avgTransactionValue,
          topCategories,
          topVendors,
          revenueTrend,
          period
        }
      });
    } catch (error) {
      console.error('Failed to fetch revenue overview:', error);
      return sendError(c, 'Failed to fetch revenue data', 500);
    }
  });

  /**
   * GET /analytics/revenue/growth - Get revenue growth analysis
   */
  app.get(`${BASE_PATH}/analytics/revenue/growth`, async (c) => {
    try {
      const now = new Date();

      // Current month
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data: currentMonthBookings } = await client
        .from('bookings')
        .select('*')
        .gte('created_at', currentMonth.toISOString())
        .neq('status', 'cancelled');

      const currentMonthRevenue = (currentMonthBookings || []).reduce((sum, b: any) =>
        sum + (parseFloat(b.total_amount) || 0), 0);

      // Previous month
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const { data: previousMonthBookings } = await client
        .from('bookings')
        .select('*')
        .gte('created_at', previousMonth.toISOString())
        .lte('created_at', previousMonthEnd.toISOString())
        .neq('status', 'cancelled');

      const previousMonthRevenue = (previousMonthBookings || []).reduce((sum, b: any) =>
        sum + (parseFloat(b.total_amount) || 0), 0);

      // Calculate growth
      const revenueGrowth = previousMonthRevenue > 0
        ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue * 100).toFixed(2)
        : 100;

      const bookingGrowth = (previousMonthBookings?.length || 0) > 0
        ? (((currentMonthBookings?.length || 0) - (previousMonthBookings?.length || 0)) / (previousMonthBookings?.length || 0) * 100).toFixed(2)
        : 100;

      return sendSuccess(c, {
        growth: {
          currentMonth: {
            revenue: currentMonthRevenue,
            bookings: currentMonthBookings?.length || 0
          },
          previousMonth: {
            revenue: previousMonthRevenue,
            bookings: previousMonthBookings?.length || 0
          },
          revenueGrowthPercent: parseFloat(revenueGrowth),
          bookingGrowthPercent: parseFloat(bookingGrowth)
        }
      });
    } catch (error) {
      console.error('Failed to fetch growth data:', error);
      return sendError(c, 'Failed to fetch growth data', 500);
    }
  });

  // ==========================================
  // SERVICE PERFORMANCE METRICS
  // ==========================================

  /**
   * GET /analytics/services/performance - Get service performance metrics
   */
  app.get(`${BASE_PATH}/analytics/services/performance`, async (c) => {
    try {
      // Get bookings from SQL
      const { data: bookings } = await client
        .from('bookings')
        .select('*')
        .limit(10000);

      // Get reviews from SQL
      const { data: reviews } = await client
        .from('reviews')
        .select('*')
        .limit(10000);

      const serviceMetrics: Record<string, any> = {};

      // Calculate metrics per service
      bookings?.forEach((booking: any) => {
        const serviceType = booking.service_type || 'unknown';

        if (!serviceMetrics[serviceType]) {
          serviceMetrics[serviceType] = {
            totalBookings: 0,
            completedBookings: 0,
            cancelledBookings: 0,
            totalRevenue: 0,
            ratings: [],
            responseTime: []
          };
        }

        serviceMetrics[serviceType].totalBookings++;

        if (booking.status === 'completed') {
          serviceMetrics[serviceType].completedBookings++;
          serviceMetrics[serviceType].totalRevenue += parseFloat(booking.total_amount) || 0;
        }

        if (booking.status === 'cancelled') {
          serviceMetrics[serviceType].cancelledBookings++;
        }
      });

      // Add ratings from reviews
      reviews?.forEach((review: any) => {
        const serviceType = review.service_type;
        if (serviceMetrics[serviceType]) {
          serviceMetrics[serviceType].ratings.push(review.rating || 0);
        }
      });

      // Calculate aggregates
      const performanceData = Object.entries(serviceMetrics).map(([serviceType, metrics]: [string, any]) => {
        const avgRating = metrics.ratings.length > 0
          ? metrics.ratings.reduce((sum: number, r: number) => sum + r, 0) / metrics.ratings.length
          : 0;

        const completionRate = metrics.totalBookings > 0
          ? (metrics.completedBookings / metrics.totalBookings * 100).toFixed(2)
          : 0;

        const cancellationRate = metrics.totalBookings > 0
          ? (metrics.cancelledBookings / metrics.totalBookings * 100).toFixed(2)
          : 0;

        return {
          serviceType,
          totalBookings: metrics.totalBookings,
          completedBookings: metrics.completedBookings,
          cancelledBookings: metrics.cancelledBookings,
          totalRevenue: metrics.totalRevenue,
          avgRating: avgRating.toFixed(2),
          completionRate: parseFloat(completionRate),
          cancellationRate: parseFloat(cancellationRate),
          reviewCount: metrics.ratings.length
        };
      }).sort((a, b) => b.totalRevenue - a.totalRevenue);

      return sendSuccess(c, {
        services: performanceData,
        totalServices: performanceData.length
      });
    } catch (error) {
      console.error('Failed to fetch service performance:', error);
      return sendError(c, 'Failed to fetch performance data', 500);
    }
  });

  // ==========================================
  // AUTOMATED REPORTS
  // ==========================================

  /**
   * POST /analytics/reports/generate - Generate automated report
   */
  app.post(`${BASE_PATH}/analytics/reports/generate`, async (c) => {
    try {
      const { reportType, period = 'month', format = 'json' } = await c.req.json();

      if (!reportType) {
        return sendError(c, 'reportType is required', 400);
      }

      let reportData: any = {};

      // Generate report data based on type
      if (reportType === 'revenue') {
        const now = new Date();
        let startDate: Date;
        switch (period) {
          case 'day':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        const { data: periodBookings } = await client
          .from('bookings')
          .select('*')
          .gte('created_at', startDate.toISOString())
          .neq('status', 'cancelled');

        const totalRevenue = (periodBookings || []).reduce((sum, b: any) => sum + (parseFloat(b.total_amount) || 0), 0);

        reportData = {
          success: true,
          revenue: {
            totalRevenue,
            totalBookings: periodBookings?.length || 0,
            period
          }
        };
      } else if (reportType === 'service_performance') {
        const { data: bookings } = await client
          .from('bookings')
          .select('*')
          .limit(10000);

        const { data: reviews } = await client
          .from('reviews')
          .select('*')
          .limit(10000);

        const serviceMetrics: Record<string, any> = {};

        bookings?.forEach((booking: any) => {
          const serviceType = booking.service_type || 'unknown';

          if (!serviceMetrics[serviceType]) {
            serviceMetrics[serviceType] = {
              totalBookings: 0,
              completedBookings: 0,
              totalRevenue: 0,
              ratings: []
            };
          }

          serviceMetrics[serviceType].totalBookings++;
          if (booking.status === 'completed') {
            serviceMetrics[serviceType].completedBookings++;
            serviceMetrics[serviceType].totalRevenue += parseFloat(booking.total_amount) || 0;
          }
        });

        reviews?.forEach((review: any) => {
          const serviceType = review.service_type;
          if (serviceMetrics[serviceType]) {
            serviceMetrics[serviceType].ratings.push(review.rating || 0);
          }
        });

        const performanceData = Object.entries(serviceMetrics).map(([serviceType, metrics]: [string, any]) => ({
          serviceType,
          totalBookings: metrics.totalBookings,
          completedBookings: metrics.completedBookings,
          totalRevenue: metrics.totalRevenue,
          avgRating: metrics.ratings.length > 0
            ? (metrics.ratings.reduce((sum: number, r: number) => sum + r, 0) / metrics.ratings.length).toFixed(2)
            : 0
        }));

        reportData = {
          success: true,
          services: performanceData
        };
      } else if (reportType === 'user_behavior') {
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const eventsByType: Record<string, number> = {};

        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateKey = currentDate.toISOString().split('T')[0];
          const aggregateKey = `analytics_events_${dateKey}`;

          const { data: dayData } = await client
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', aggregateKey)
            .maybeSingle();

          if (dayData?.setting_value?.eventCounts) {
            Object.entries(dayData.setting_value.eventCounts).forEach(([type, count]) => {
              eventsByType[type] = (eventsByType[type] || 0) + (count as number);
            });
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }

        reportData = {
          success: true,
          summary: {
            totalEvents: Object.values(eventsByType).reduce((sum, count) => sum + count, 0),
            eventsByType
          }
        };
      } else if (reportType === 'conversion') {
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const funnelStages = {
          serviceView: 0,
          serviceClick: 0,
          bookingStarted: 0,
          formCompleted: 0,
          paymentInitiated: 0,
          bookingConfirmed: 0
        };

        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateKey = currentDate.toISOString().split('T')[0];
          const aggregateKey = `analytics_events_${dateKey}`;

          const { data: dayData } = await client
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', aggregateKey)
            .maybeSingle();

          if (dayData?.setting_value?.eventCounts) {
            const eventCounts = dayData.setting_value.eventCounts;
            funnelStages.serviceView += eventCounts['service_view'] || 0;
            funnelStages.serviceClick += eventCounts['service_click'] || 0;
            funnelStages.bookingStarted += eventCounts['booking_started'] || 0;
            funnelStages.formCompleted += eventCounts['form_completed'] || 0;
            funnelStages.paymentInitiated += eventCounts['payment_initiated'] || 0;
            funnelStages.bookingConfirmed += eventCounts['booking_confirmed'] || 0;
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }

        const overallConversion = funnelStages.serviceView > 0
          ? (funnelStages.bookingConfirmed / funnelStages.serviceView * 100).toFixed(2)
          : 0;

        reportData = {
          success: true,
          funnel: {
            stages: funnelStages,
            overallConversion
          }
        };
      } else {
        return sendError(c, 'Invalid report type', 400);
      }

      const report = {
        id: `report_${Date.now()}`,
        reportType,
        period,
        generatedAt: new Date().toISOString(),
        data: reportData,
        format
      };

      // Store report in platform_settings
      const reportKey = `analytics_report_${report.id}`;
      await client
        .from('platform_settings')
        .upsert({
          setting_key: reportKey,
          setting_value: report,
          updated_at: new Date().toISOString()
        });

      return sendSuccess(c, { report });
    } catch (error) {
      console.error('Failed to generate report:', error);
      return sendError(c, 'Failed to generate report', 500);
    }
  });

  /**
   * GET /analytics/reports/:reportId - Get specific report
   */
  app.get(`${BASE_PATH}/analytics/reports/:reportId`, async (c) => {
    try {
      const reportId = c.req.param('reportId');
      const reportKey = `analytics_report_${reportId}`;

      const { data: reportData } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', reportKey)
        .maybeSingle();

      if (!reportData) {
        return sendError(c, 'Report not found', 404);
      }

      return sendSuccess(c, { report: reportData.setting_value });
    } catch (error) {
      console.error('Failed to fetch report:', error);
      return sendError(c, 'Failed to fetch report', 500);
    }
  });

  /**
   * GET /analytics/reports - List all reports
   */
  app.get(`${BASE_PATH}/analytics/reports`, async (c) => {
    try {
      const { data: reportsData } = await client
        .from('platform_settings')
        .select('setting_key, setting_value')
        .like('setting_key', 'analytics_report_%');

      const reportList = (reportsData || []).map((item: any) => {
        const report = item.setting_value;
        return {
          id: report.id,
          reportType: report.reportType,
          period: report.period,
          generatedAt: report.generatedAt,
          format: report.format
        };
      });

      return sendSuccess(c, {
        reports: reportList,
        count: reportList.length
      });
    } catch (error) {
      console.error('Failed to list reports:', error);
      return sendError(c, 'Failed to list reports', 500);
    }
  });

  // ==========================================
  // CUSTOM REPORT BUILDER
  // ==========================================

  /**
   * POST /analytics/custom-report - Build custom report with filters
   */
  app.post(`${BASE_PATH}/analytics/custom-report`, async (c) => {
    try {
      const {
        metrics,
        dimensions,
        filters,
        dateRange,
        groupBy
      } = await c.req.json();

      if (!metrics || metrics.length === 0) {
        return sendError(c, 'At least one metric is required', 400);
      }

      // Get all bookings from SQL
      let query = client.from('bookings').select('*');

      // Apply date range
      if (dateRange) {
        query = query
          .gte('created_at', new Date(dateRange.start).toISOString())
          .lte('created_at', new Date(dateRange.end).toISOString());
      }

      const { data: bookings } = await query.limit(10000);

      let data = bookings || [];

      // Apply filters
      if (filters) {
        if (filters.serviceType) {
          data = data.filter((d: any) => d.service_type === filters.serviceType);
        }
        if (filters.status) {
          data = data.filter((d: any) => d.status === filters.status);
        }
        if (filters.vendorId) {
          data = data.filter((d: any) => d.vendor_id === filters.vendorId);
        }
      }

      // Calculate metrics
      const results: any = {};

      if (metrics.includes('count')) {
        results.count = data.length;
      }

      if (metrics.includes('revenue')) {
        results.revenue = data.reduce((sum, d: any) => sum + (parseFloat(d.total_amount) || 0), 0);
      }

      if (metrics.includes('avgValue')) {
        const total = data.reduce((sum, d: any) => sum + (parseFloat(d.total_amount) || 0), 0);
        results.avgValue = data.length > 0 ? total / data.length : 0;
      }

      // Group by dimension
      if (groupBy) {
        const grouped: Record<string, any> = {};

        data.forEach((item: any) => {
          const key = item[groupBy] || 'unknown';
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(item);
        });

        results.grouped = Object.entries(grouped).map(([key, items]: [string, any]) => ({
          [groupBy]: key,
          count: items.length,
          revenue: items.reduce((sum: number, i: any) => sum + (parseFloat(i.total_amount) || 0), 0)
        }));
      }

      const customReport = {
        id: `custom_report_${Date.now()}`,
        metrics,
        dimensions,
        filters,
        dateRange,
        groupBy,
        results,
        generatedAt: new Date().toISOString()
      };

      // Store custom report in platform_settings
      const reportKey = `analytics_custom_report_${customReport.id}`;
      await client
        .from('platform_settings')
        .upsert({
          setting_key: reportKey,
          setting_value: customReport,
          updated_at: new Date().toISOString()
        });

      return sendSuccess(c, { report: customReport });
    } catch (error) {
      console.error('Failed to build custom report:', error);
      return sendError(c, 'Failed to build report', 500);
    }
  });
}

