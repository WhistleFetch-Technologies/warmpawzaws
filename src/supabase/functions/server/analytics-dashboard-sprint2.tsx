/**
 * 📊 ADVANCED ANALYTICS DASHBOARD - SPRINT 2
 * Phase 7E - Sprint 2: Advanced Analytics & Reporting
 * Date: December 15, 2024
 * 
 * This file implements comprehensive analytics features:
 * - Real-time analytics dashboard
 * - User behavior tracking
 * - Conversion funnel analysis
 * - Revenue analytics
 * - Service performance metrics
 * - Automated reports
 * - Custom report builder
 */

import { Hono } from 'hono';
import * as kv from './kv_store';

const app = new Hono();

// ==========================================
// REAL-TIME ANALYTICS
// ==========================================

/**
 * GET /analytics/realtime - Get real-time platform metrics
 */
app.get('/analytics/realtime', async (c) => {
  try {
    const now = new Date();
    const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000);
    
    // Get recent activity
    const recentBookings = await kv.getByPrefix('booking_') || [];
    const recentUsers = await kv.getByPrefix('customer_') || [];
    const recentVendors = await kv.getByPrefix('vendor_') || [];
    
    // Calculate active users (users with activity in last 5 minutes)
    const activeUsers = recentUsers.filter((user: any) => {
      const lastActive = new Date(user.lastActive || user.createdAt);
      return lastActive >= last5Minutes;
    }).length;
    
    // Bookings in last hour
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const recentBookingsCount = recentBookings.filter((booking: any) => {
      const bookingDate = new Date(booking.createdAt);
      return bookingDate >= lastHour;
    }).length;
    
    // Calculate revenue per hour
    const recentRevenue = recentBookings
      .filter((booking: any) => {
        const bookingDate = new Date(booking.createdAt);
        return bookingDate >= lastHour && booking.status !== 'cancelled';
      })
      .reduce((sum: number, booking: any) => sum + (booking.totalAmount || 0), 0);
    
    // Service popularity (bookings per service in last 24 hours)
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const servicePopularity: Record<string, number> = {};
    
    recentBookings.forEach((booking: any) => {
      const bookingDate = new Date(booking.createdAt);
      if (bookingDate >= last24Hours) {
        const service = booking.serviceType || 'unknown';
        servicePopularity[service] = (servicePopularity[service] || 0) + 1;
      }
    });
    
    const topServices = Object.entries(servicePopularity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([service, count]) => ({ service, count }));
    
    // Store real-time metrics for historical tracking
    const metricsKey = `analytics_realtime_${now.toISOString().split('T')[0]}`;
    const dailyMetrics = await kv.get(metricsKey) || { snapshots: [] };
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
    
    await kv.set(metricsKey, dailyMetrics);
    
    return c.json({
      success: true,
      realtime: {
        activeUsers,
        bookingsPerHour: recentBookingsCount,
        revenuePerHour: recentRevenue,
        topServices,
        totalVendors: recentVendors.length,
        totalCustomers: recentUsers.length,
        timestamp: now.toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to fetch real-time analytics:', error);
    return c.json({ success: false, error: 'Failed to fetch analytics' }, 500);
  }
});

/**
 * GET /analytics/realtime/chart - Get real-time chart data for last 24 hours
 */
app.get('/analytics/realtime/chart', async (c) => {
  try {
    const now = new Date();
    const metricsKey = `analytics_realtime_${now.toISOString().split('T')[0]}`;
    const dailyMetrics = await kv.get(metricsKey) || { snapshots: [] };
    
    return c.json({
      success: true,
      chartData: dailyMetrics.snapshots || [],
      dataPoints: dailyMetrics.snapshots.length
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch chart data' }, 500);
  }
});

// ==========================================
// USER BEHAVIOR TRACKING
// ==========================================

/**
 * POST /analytics/track-event - Track user behavior event
 */
app.post('/analytics/track-event', async (c) => {
  try {
    const { 
      userId, 
      eventType, 
      eventData, 
      sessionId, 
      timestamp 
    } = await c.req.json();
    
    if (!eventType) {
      return c.json({ success: false, error: 'eventType is required' }, 400);
    }
    
    const event = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      sessionId,
      eventType,
      eventData,
      timestamp: timestamp || new Date().toISOString(),
      userAgent: c.req.header('user-agent'),
      ipAddress: c.req.header('x-forwarded-for') || 'unknown'
    };
    
    // Store event
    await kv.set(`analytics_event_${event.id}`, event);
    
    // Update event aggregates
    const today = new Date().toISOString().split('T')[0];
    const aggregateKey = `analytics_events_${today}`;
    const aggregates = await kv.get(aggregateKey) || { 
      events: [],
      eventCounts: {},
      userCounts: {}
    };
    
    aggregates.events.push(event.id);
    aggregates.eventCounts[eventType] = (aggregates.eventCounts[eventType] || 0) + 1;
    
    if (userId) {
      aggregates.userCounts[userId] = (aggregates.userCounts[userId] || 0) + 1;
    }
    
    await kv.set(aggregateKey, aggregates);
    
    return c.json({ success: true, eventId: event.id });
  } catch (error) {
    console.error('Failed to track event:', error);
    return c.json({ success: false, error: 'Failed to track event' }, 500);
  }
});

/**
 * GET /analytics/behavior/summary - Get user behavior summary
 */
app.get('/analytics/behavior/summary', async (c) => {
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
      const dayData = await kv.get(aggregateKey);
      
      if (dayData) {
        // Aggregate by event type
        Object.entries(dayData.eventCounts || {}).forEach(([type, count]) => {
          eventsByType[type] = (eventsByType[type] || 0) + (count as number);
        });
        
        // Aggregate by day
        eventsByDay[dateKey] = dayData.events?.length || 0;
        
        // Aggregate by user
        Object.entries(dayData.userCounts || {}).forEach(([userId, count]) => {
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
    
    return c.json({
      success: true,
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
    return c.json({ success: false, error: 'Failed to fetch summary' }, 500);
  }
});

// ==========================================
// CONVERSION FUNNEL ANALYSIS
// ==========================================

/**
 * GET /analytics/funnel/booking - Get booking conversion funnel
 */
app.get('/analytics/funnel/booking', async (c) => {
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
      const dayData = await kv.get(aggregateKey);
      
      if (dayData && dayData.eventCounts) {
        funnelStages.serviceView += dayData.eventCounts['service_view'] || 0;
        funnelStages.serviceClick += dayData.eventCounts['service_click'] || 0;
        funnelStages.bookingStarted += dayData.eventCounts['booking_started'] || 0;
        funnelStages.formCompleted += dayData.eventCounts['form_completed'] || 0;
        funnelStages.paymentInitiated += dayData.eventCounts['payment_initiated'] || 0;
        funnelStages.bookingConfirmed += dayData.eventCounts['booking_confirmed'] || 0;
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
    
    return c.json({
      success: true,
      funnel: {
        stages: funnelStages,
        conversionRates,
        dateRange: { start: start.toISOString(), end: end.toISOString() }
      }
    });
  } catch (error) {
    console.error('Failed to fetch funnel data:', error);
    return c.json({ success: false, error: 'Failed to fetch funnel' }, 500);
  }
});

/**
 * GET /analytics/funnel/dropoff - Identify funnel drop-off points
 */
app.get('/analytics/funnel/dropoff', async (c) => {
  try {
    // Get funnel data directly instead of internal request
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
      const dayData = await kv.get(aggregateKey);
      
      if (dayData && dayData.eventCounts) {
        funnelStages.serviceView += dayData.eventCounts['service_view'] || 0;
        funnelStages.serviceClick += dayData.eventCounts['service_click'] || 0;
        funnelStages.bookingStarted += dayData.eventCounts['booking_started'] || 0;
        funnelStages.formCompleted += dayData.eventCounts['form_completed'] || 0;
        funnelStages.paymentInitiated += dayData.eventCounts['payment_initiated'] || 0;
        funnelStages.bookingConfirmed += dayData.eventCounts['booking_confirmed'] || 0;
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
    
    return c.json({
      success: true,
      dropoffs,
      criticalDropoff: dropoffs[0]
    });
  } catch (error) {
    console.error('Failed to fetch dropoff data:', error);
    return c.json({ success: false, error: 'Failed to fetch dropoff data' }, 500);
  }
});

// ==========================================
// REVENUE ANALYTICS
// ==========================================

/**
 * GET /analytics/revenue/overview - Get revenue overview
 */
app.get('/analytics/revenue/overview', async (c) => {
  try {
    const { period = 'month' } = c.req.query();
    
    const bookings = await kv.getByPrefix('booking_') || [];
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
    
    // Filter bookings in period
    const periodBookings = bookings.filter((booking: any) => {
      const bookingDate = new Date(booking.createdAt);
      return bookingDate >= startDate && booking.status !== 'cancelled';
    });
    
    // Calculate metrics
    const totalRevenue = periodBookings.reduce((sum, b: any) => sum + (b.totalAmount || 0), 0);
    const totalCommission = periodBookings.reduce((sum, b: any) => 
      sum + ((b.totalAmount || 0) * 0.15), 0); // Assuming 15% commission
    
    // Revenue by service category
    const revenueByCategory: Record<string, number> = {};
    periodBookings.forEach((booking: any) => {
      const category = booking.serviceType || 'unknown';
      revenueByCategory[category] = (revenueByCategory[category] || 0) + (booking.totalAmount || 0);
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
      const vendorId = booking.vendorId || 'unknown';
      revenueByVendor[vendorId] = (revenueByVendor[vendorId] || 0) + (booking.totalAmount || 0);
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
      const date = new Date(booking.createdAt).toISOString().split('T')[0];
      revenueTrend[date] = (revenueTrend[date] || 0) + (booking.totalAmount || 0);
    });
    
    return c.json({
      success: true,
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
    return c.json({ success: false, error: 'Failed to fetch revenue data' }, 500);
  }
});

/**
 * GET /analytics/revenue/growth - Get revenue growth analysis
 */
app.get('/analytics/revenue/growth', async (c) => {
  try {
    const bookings = await kv.getByPrefix('booking_') || [];
    const now = new Date();
    
    // Current month
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthBookings = bookings.filter((b: any) => {
      const date = new Date(b.createdAt);
      return date >= currentMonth && b.status !== 'cancelled';
    });
    const currentMonthRevenue = currentMonthBookings.reduce((sum, b: any) => 
      sum + (b.totalAmount || 0), 0);
    
    // Previous month
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const previousMonthBookings = bookings.filter((b: any) => {
      const date = new Date(b.createdAt);
      return date >= previousMonth && date <= previousMonthEnd && b.status !== 'cancelled';
    });
    const previousMonthRevenue = previousMonthBookings.reduce((sum, b: any) => 
      sum + (b.totalAmount || 0), 0);
    
    // Calculate growth
    const revenueGrowth = previousMonthRevenue > 0
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue * 100).toFixed(2)
      : 100;
    
    const bookingGrowth = previousMonthBookings.length > 0
      ? ((currentMonthBookings.length - previousMonthBookings.length) / previousMonthBookings.length * 100).toFixed(2)
      : 100;
    
    return c.json({
      success: true,
      growth: {
        currentMonth: {
          revenue: currentMonthRevenue,
          bookings: currentMonthBookings.length
        },
        previousMonth: {
          revenue: previousMonthRevenue,
          bookings: previousMonthBookings.length
        },
        revenueGrowthPercent: parseFloat(revenueGrowth),
        bookingGrowthPercent: parseFloat(bookingGrowth)
      }
    });
  } catch (error) {
    console.error('Failed to fetch growth data:', error);
    return c.json({ success: false, error: 'Failed to fetch growth data' }, 500);
  }
});

// ==========================================
// SERVICE PERFORMANCE METRICS
// ==========================================

/**
 * GET /analytics/services/performance - Get service performance metrics
 */
app.get('/analytics/services/performance', async (c) => {
  try {
    const bookings = await kv.getByPrefix('booking_') || [];
    const reviews = await kv.getByPrefix('review_') || [];
    
    const serviceMetrics: Record<string, any> = {};
    
    // Calculate metrics per service
    bookings.forEach((booking: any) => {
      const serviceType = booking.serviceType || 'unknown';
      
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
        serviceMetrics[serviceType].totalRevenue += booking.totalAmount || 0;
      }
      
      if (booking.status === 'cancelled') {
        serviceMetrics[serviceType].cancelledBookings++;
      }
    });
    
    // Add ratings from reviews
    reviews.forEach((review: any) => {
      const serviceType = review.serviceType;
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
    
    return c.json({
      success: true,
      services: performanceData,
      totalServices: performanceData.length
    });
  } catch (error) {
    console.error('Failed to fetch service performance:', error);
    return c.json({ success: false, error: 'Failed to fetch performance data' }, 500);
  }
});

// ==========================================
// AUTOMATED REPORTS
// ==========================================

/**
 * POST /analytics/reports/generate - Generate automated report
 */
app.post('/analytics/reports/generate', async (c) => {
  try {
    const { reportType, period = 'month', format = 'json' } = await c.req.json();
    
    if (!reportType) {
      return c.json({ success: false, error: 'reportType is required' }, 400);
    }
    
    let reportData: any = {};
    
    // Generate report data based on type - use inline logic instead of internal requests
    if (reportType === 'revenue') {
      // Revenue report logic
      const bookings = await kv.getByPrefix('booking_') || [];
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
      
      const periodBookings = bookings.filter((booking: any) => {
        const bookingDate = new Date(booking.createdAt);
        return bookingDate >= startDate && booking.status !== 'cancelled';
      });
      
      const totalRevenue = periodBookings.reduce((sum, b: any) => sum + (b.totalAmount || 0), 0);
      
      reportData = {
        success: true,
        revenue: {
          totalRevenue,
          totalBookings: periodBookings.length,
          period
        }
      };
    } else if (reportType === 'service_performance') {
      // Service performance report logic
      const bookings = await kv.getByPrefix('booking_') || [];
      const reviews = await kv.getByPrefix('review_') || [];
      
      const serviceMetrics: Record<string, any> = {};
      
      bookings.forEach((booking: any) => {
        const serviceType = booking.serviceType || 'unknown';
        
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
          serviceMetrics[serviceType].totalRevenue += booking.totalAmount || 0;
        }
      });
      
      reviews.forEach((review: any) => {
        const serviceType = review.serviceType;
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
      // User behavior report logic
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();
      
      const eventsByType: Record<string, number> = {};
      
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const aggregateKey = `analytics_events_${dateKey}`;
        const dayData = await kv.get(aggregateKey);
        
        if (dayData && dayData.eventCounts) {
          Object.entries(dayData.eventCounts).forEach(([type, count]) => {
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
      // Conversion funnel report logic
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
        const dayData = await kv.get(aggregateKey);
        
        if (dayData && dayData.eventCounts) {
          funnelStages.serviceView += dayData.eventCounts['service_view'] || 0;
          funnelStages.serviceClick += dayData.eventCounts['service_click'] || 0;
          funnelStages.bookingStarted += dayData.eventCounts['booking_started'] || 0;
          funnelStages.formCompleted += dayData.eventCounts['form_completed'] || 0;
          funnelStages.paymentInitiated += dayData.eventCounts['payment_initiated'] || 0;
          funnelStages.bookingConfirmed += dayData.eventCounts['booking_confirmed'] || 0;
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
      return c.json({ success: false, error: 'Invalid report type' }, 400);
    }
    
    const report = {
      id: `report_${Date.now()}`,
      reportType,
      period,
      generatedAt: new Date().toISOString(),
      data: reportData,
      format
    };
    
    // Store report
    await kv.set(`analytics_report_${report.id}`, report);
    
    return c.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Failed to generate report:', error);
    return c.json({ success: false, error: 'Failed to generate report' }, 500);
  }
});

/**
 * GET /analytics/reports/:reportId - Get specific report
 */
app.get('/analytics/reports/:reportId', async (c) => {
  try {
    const reportId = c.req.param('reportId');
    const report = await kv.get(`analytics_report_${reportId}`);
    
    if (!report) {
      return c.json({ success: false, error: 'Report not found' }, 404);
    }
    
    return c.json({ success: true, report });
  } catch (error) {
    console.error('Failed to fetch report:', error);
    return c.json({ success: false, error: 'Failed to fetch report' }, 500);
  }
});

/**
 * GET /analytics/reports - List all reports
 */
app.get('/analytics/reports', async (c) => {
  try {
    const reports = await kv.getByPrefix('analytics_report_') || [];
    
    const reportList = reports.map((report: any) => ({
      id: report.id,
      reportType: report.reportType,
      period: report.period,
      generatedAt: report.generatedAt,
      format: report.format
    }));
    
    return c.json({
      success: true,
      reports: reportList,
      count: reportList.length
    });
  } catch (error) {
    console.error('Failed to list reports:', error);
    return c.json({ success: false, error: 'Failed to list reports' }, 500);
  }
});

// ==========================================
// CUSTOM REPORT BUILDER
// ==========================================

/**
 * POST /analytics/custom-report - Build custom report with filters
 */
app.post('/analytics/custom-report', async (c) => {
  try {
    const {
      metrics,
      dimensions,
      filters,
      dateRange,
      groupBy
    } = await c.req.json();
    
    if (!metrics || metrics.length === 0) {
      return c.json({ success: false, error: 'At least one metric is required' }, 400);
    }
    
    // Get all bookings
    let data = await kv.getByPrefix('booking_') || [];
    
    // Apply filters
    if (filters) {
      if (filters.serviceType) {
        data = data.filter((d: any) => d.serviceType === filters.serviceType);
      }
      if (filters.status) {
        data = data.filter((d: any) => d.status === filters.status);
      }
      if (filters.vendorId) {
        data = data.filter((d: any) => d.vendorId === filters.vendorId);
      }
    }
    
    // Apply date range
    if (dateRange) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      data = data.filter((d: any) => {
        const date = new Date(d.createdAt);
        return date >= start && date <= end;
      });
    }
    
    // Calculate metrics
    const results: any = {};
    
    if (metrics.includes('count')) {
      results.count = data.length;
    }
    
    if (metrics.includes('revenue')) {
      results.revenue = data.reduce((sum, d: any) => sum + (d.totalAmount || 0), 0);
    }
    
    if (metrics.includes('avgValue')) {
      const total = data.reduce((sum, d: any) => sum + (d.totalAmount || 0), 0);
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
        revenue: items.reduce((sum: number, i: any) => sum + (i.totalAmount || 0), 0)
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
    
    // Store custom report
    await kv.set(`analytics_custom_report_${customReport.id}`, customReport);
    
    return c.json({
      success: true,
      report: customReport
    });
  } catch (error) {
    console.error('Failed to build custom report:', error);
    return c.json({ success: false, error: 'Failed to build report' }, 500);
  }
});

export default app;