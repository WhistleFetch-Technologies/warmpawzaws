/**
 * ADMIN OPERATIONS DASHBOARD ENDPOINTS
 * 
 * Real-time operational monitoring and insights
 * Features:
 * - Live booking activity
 * - Vendor performance monitoring
 * - Service quality metrics
 * - Customer satisfaction tracking
 * - Financial reconciliation
 * - Integration health
 * - System alerts
 */

import type { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const BASE_PATH = '/make-server-3dd53475';

export function adminOperationsDashboard(app: Hono) {

  /**
   * GET /admin/operations/dashboard
   * Comprehensive operations dashboard
   */
  app.get(`${BASE_PATH}/admin/operations/dashboard`, async (c) => {
    try {
      const timeRange = c.req.query('timeRange') || '24h';
      const now = new Date();
      const startTime = getStartTime(timeRange, now);

      // Optimized: Fetch data once and reuse
      const [bookingsData, vendorsData, reviewsData, razorpayConfig, shiprocketConfig] = await Promise.all([
        kv.getByPrefix('booking:'),
        kv.getByPrefix('vendor:'),
        kv.getByPrefix('review:'),
        kv.get('platform:integrations:razorpay'),
        kv.get('platform:settings:logistics')
      ]);

      // Filter data once
      const recentBookings = bookingsData.filter((b: any) => 
        new Date(b.value.createdAt) > startTime
      );
      const activeVendors = vendorsData.filter((v: any) => v.value.status === 'approved');
      const recentReviews = reviewsData.filter((r: any) => 
        new Date(r.value.createdAt) > startTime
      );

      // Calculate metrics inline to avoid multiple iterations
      const liveBookings = {
        totalBookings: recentBookings.length,
        activeBookings: recentBookings.filter((b: any) => 
          ['pending', 'confirmed', 'in_progress'].includes(b.value.status)
        ).length,
        completedBookings: recentBookings.filter((b: any) => 
          b.value.status === 'completed'
        ).length,
        cancelledBookings: recentBookings.filter((b: any) => 
          b.value.status === 'cancelled'
        ).length
      };

      const vendorMetrics = {
        totalActiveVendors: activeVendors.length,
        avgRating: calculateAverage(activeVendors.map((v: any) => v.value), 'rating')
      };

      const avgRating = recentReviews.length > 0
        ? recentReviews.reduce((sum: number, r: any) => sum + r.value.rating, 0) / recentReviews.length
        : 0;

      const serviceMetrics = {
        totalReviews: recentReviews.length,
        avgRating,
        satisfactionScore: (avgRating / 5) * 100,
        totalBookings: recentBookings.length,
        completedBookings: liveBookings.completedBookings,
        responseTime: 15 // Simplified
      };

      const paidBookings = recentBookings.filter((b: any) => 
        b.value.paymentStatus === 'completed'
      );

      const totalRevenue = paidBookings.reduce((sum: number, b: any) => 
        sum + (b.value.amount || b.value.price || 0), 0
      );

      const financialMetrics = {
        totalRevenue,
        transactionCount: paidBookings.length,
        avgTransactionValue: paidBookings.length > 0 ? totalRevenue / paidBookings.length : 0
      };

      const integrationHealth = {
        razorpay: razorpayConfig?.value?.enabled ? 'healthy' : 'disabled',
        shiprocket: shiprocketConfig?.value?.shiprocket?.enabled ? 'healthy' : 'disabled'
      };

      const systemAlerts = {
        alerts: [],
        totalAlerts: 0,
        criticalAlerts: 0
      };

      return c.json({
        success: true,
        dashboard: {
          timeRange,
          generatedAt: now.toISOString(),
          liveBookings,
          vendorMetrics,
          serviceMetrics,
          financialMetrics,
          integrationHealth,
          systemAlerts
        }
      });

    } catch (error: any) {
      console.error('Error fetching operations dashboard:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/operations/live-activity
   * Real-time booking and service activity
   */
  app.get(`${BASE_PATH}/admin/operations/live-activity`, async (c) => {
    try {
      const bookings = await kv.getByPrefix('booking:');
      const now = new Date();
      const last30Min = new Date(now.getTime() - 30 * 60 * 1000);

      // Filter active bookings
      const activeBookings = bookings.filter((b: any) => {
        const booking = b.value;
        const bookingDate = new Date(booking.scheduledDate || booking.createdAt);
        const isToday = bookingDate.toDateString() === now.toDateString();
        const isActive = ['pending', 'confirmed', 'in_progress'].includes(booking.status);
        return isToday && isActive;
      });

      // Recent activity (last 30 minutes)
      const recentActivity = bookings
        .filter((b: any) => new Date(b.value.createdAt) > last30Min)
        .map((b: any) => ({
          id: b.value.id,
          type: 'booking_created',
          serviceName: b.value.serviceName,
          vendorId: b.value.vendorId,
          customerId: b.value.customerId,
          amount: b.value.amount || b.value.price,
          status: b.value.status,
          timestamp: b.value.createdAt
        }))
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);

      // Service style breakdown
      const serviceStyleStats = {
        at_home: activeBookings.filter((b: any) => b.value.serviceStyle === 'at_home').length,
        at_center: activeBookings.filter((b: any) => b.value.serviceStyle === 'at_center').length,
        tele: activeBookings.filter((b: any) => b.value.serviceStyle === 'tele').length
      };

      return c.json({
        success: true,
        liveActivity: {
          activeBookingsCount: activeBookings.length,
          recentActivityCount: recentActivity.length,
          serviceStyleStats,
          activeBookings: activeBookings.slice(0, 20).map((b: any) => ({
            id: b.value.id,
            serviceName: b.value.serviceName,
            serviceStyle: b.value.serviceStyle,
            vendorId: b.value.vendorId,
            status: b.value.status,
            scheduledDate: b.value.scheduledDate,
            amount: b.value.amount || b.value.price
          })),
          recentActivity: recentActivity.slice(0, 10)
        }
      });

    } catch (error: any) {
      console.error('Error fetching live activity:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/operations/vendor-performance
   * Vendor performance analytics
   */
  app.get(`${BASE_PATH}/admin/operations/vendor-performance`, async (c) => {
    try {
      const timeRange = c.req.query('timeRange') || '7d';
      const limit = parseInt(c.req.query('limit') || '50'); // Limit results
      const startTime = getStartTime(timeRange, new Date());

      // Fetch only what we need with limits
      const vendorsResult = await kv.getByPrefix('vendor:');
      const approvedVendors = vendorsResult
        .filter((v: any) => v.value.status === 'approved')
        .slice(0, limit); // Limit vendors processed

      const bookingsResult = await kv.getByPrefix('booking:');
      
      // Filter bookings by time first to reduce processing
      const recentBookings = bookingsResult.filter((b: any) => 
        new Date(b.value.createdAt) > startTime
      );

      // Build vendor performance with optimized logic
      const vendorPerformance = approvedVendors.map((v: any) => {
        const vendor = v.value;
        
        // Filter bookings for this vendor
        const vendorBookings = recentBookings.filter((b: any) => 
          b.value.vendorId === vendor.id
        );

        const completedBookings = vendorBookings.filter((b: any) => 
          b.value.status === 'completed'
        );

        const totalRevenue = vendorBookings.reduce((sum: number, b: any) => 
          sum + (b.value.amount || b.value.price || 0), 0
        );

        const avgRating = vendor.rating || 0;
        const completionRate = vendorBookings.length > 0 
          ? (completedBookings.length / vendorBookings.length) * 100 
          : 0;

        return {
          vendorId: vendor.id,
          businessName: vendor.businessName,
          roleId: vendor.roleId,
          totalBookings: vendorBookings.length,
          completedBookings: completedBookings.length,
          totalRevenue,
          avgRating,
          responseTime: 15, // Simplified - avoid complex calculation
          completionRate,
          status: vendor.status
        };
      }).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);

      // Top performers (limit to 10)
      const topPerformers = vendorPerformance.slice(0, 10);

      // Underperformers (limit to 10)
      const underperformers = vendorPerformance
        .filter((v: any) => v.totalBookings > 0 && (v.completionRate < 80 || v.avgRating < 3.5))
        .slice(0, 10);

      // Role-wise performance (simplified)
      const roleWisePerformance = aggregateByRole(vendorPerformance.slice(0, 50));

      return c.json({
        success: true,
        vendorPerformance: {
          totalVendors: approvedVendors.length,
          topPerformers,
          underperformers,
          roleWisePerformance,
          avgCompletionRate: calculateAverage(vendorPerformance.slice(0, 50), 'completionRate'),
          avgRating: calculateAverage(vendorPerformance.slice(0, 50), 'avgRating')
        }
      });

    } catch (error: any) {
      console.error('Error fetching vendor performance:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/operations/service-quality
   * Service quality metrics and monitoring
   */
  app.get(`${BASE_PATH}/admin/operations/service-quality`, async (c) => {
    try {
      const bookings = await kv.getByPrefix('booking:');
      const reviews = await kv.getByPrefix('review:');
      const timeRange = c.req.query('timeRange') || '30d';
      const startTime = getStartTime(timeRange, new Date());

      const recentBookings = bookings.filter((b: any) => 
        new Date(b.value.createdAt) > startTime
      );

      const recentReviews = reviews.filter((r: any) => 
        new Date(r.value.createdAt) > startTime
      );

      // Service style quality
      const serviceStyleQuality = {
        at_home: analyzeServiceQuality(recentBookings, 'at_home', recentReviews),
        at_center: analyzeServiceQuality(recentBookings, 'at_center', recentReviews),
        tele: analyzeServiceQuality(recentBookings, 'tele', recentReviews)
      };

      // Issue tracking
      const issues = recentBookings.filter((b: any) => 
        ['cancelled', 'failed', 'payment_failed'].includes(b.value.status)
      );

      const issueBreakdown = {
        cancellations: issues.filter((b: any) => b.value.status === 'cancelled').length,
        failures: issues.filter((b: any) => b.value.status === 'failed').length,
        paymentFailures: issues.filter((b: any) => b.value.status === 'payment_failed').length
      };

      // Customer satisfaction
      const avgRating = recentReviews.length > 0
        ? recentReviews.reduce((sum: number, r: any) => sum + r.value.rating, 0) / recentReviews.length
        : 0;

      const satisfactionScore = calculateSatisfactionScore(recentReviews);

      return c.json({
        success: true,
        serviceQuality: {
          totalBookings: recentBookings.length,
          completedBookings: recentBookings.filter((b: any) => b.value.status === 'completed').length,
          serviceStyleQuality,
          issueBreakdown,
          avgRating,
          satisfactionScore,
          totalReviews: recentReviews.length,
          responseTime: calculateAvgResponseTime(recentBookings)
        }
      });

    } catch (error: any) {
      console.error('Error fetching service quality:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/operations/financial-overview
   * Financial metrics and reconciliation
   */
  app.get(`${BASE_PATH}/admin/operations/financial-overview`, async (c) => {
    try {
      const bookings = await kv.getByPrefix('booking:');
      const vendors = await kv.getByPrefix('vendor:');
      const timeRange = c.req.query('timeRange') || '30d';
      const startTime = getStartTime(timeRange, new Date());

      const paidBookings = bookings.filter((b: any) => 
        b.value.paymentStatus === 'completed' &&
        new Date(b.value.createdAt) > startTime
      );

      const totalRevenue = paidBookings.reduce((sum: number, b: any) => 
        sum + (b.value.amount || b.value.price || 0), 0
      );

      const commission = totalRevenue * 0.15; // 15% platform commission
      const vendorPayout = totalRevenue - commission;

      // Pending payouts
      const pendingPayouts = vendors.reduce((sum: number, v: any) => 
        sum + (v.value.pendingPayouts || 0), 0
      );

      // Payment method breakdown
      const paymentMethods = paidBookings.reduce((acc: any, b: any) => {
        const method = b.value.paymentMethod || 'razorpay';
        acc[method] = (acc[method] || 0) + (b.value.amount || b.value.price || 0);
        return acc;
      }, {});

      // Daily revenue trend
      const dailyRevenue = calculateDailyRevenue(paidBookings, startTime);

      return c.json({
        success: true,
        financialOverview: {
          totalRevenue,
          commission,
          vendorPayout,
          pendingPayouts,
          transactionCount: paidBookings.length,
          avgTransactionValue: paidBookings.length > 0 ? totalRevenue / paidBookings.length : 0,
          paymentMethods,
          dailyRevenue
        }
      });

    } catch (error: any) {
      console.error('Error fetching financial overview:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/operations/integration-health
   * Monitor integration status and health
   */
  app.get(`${BASE_PATH}/admin/operations/integration-health`, async (c) => {
    try {
      const razorpayConfig = await kv.get('platform:integrations:razorpay');
      const shiprocketConfig = await kv.get('platform:settings:logistics');

      const integrationStatus = {
        razorpay: {
          configured: !!(razorpayConfig?.value?.keyId),
          enabled: razorpayConfig?.value?.enabled || false,
          status: razorpayConfig?.value?.enabled ? 'active' : 'disabled',
          lastChecked: new Date().toISOString()
        },
        shiprocket: {
          configured: !!(shiprocketConfig?.value?.shiprocket?.email),
          enabled: shiprocketConfig?.value?.shiprocket?.enabled || false,
          status: shiprocketConfig?.value?.shiprocket?.enabled ? 'active' : 'disabled',
          lastChecked: new Date().toISOString()
        }
      };

      // Check recent payment activities
      const recentPayments = await kv.getByPrefix('payment:razorpay:order:');
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentPaymentCount = recentPayments.filter((p: any) => 
        new Date(p.value.createdAt) > last24h
      ).length;

      // Check recent shipments
      const recentShipments = await kv.getByPrefix('logistics:shiprocket:order:');
      const recentShipmentCount = recentShipments.filter((s: any) => 
        new Date(s.value.createdAt) > last24h
      ).length;

      integrationStatus.razorpay.recentTransactions = recentPaymentCount;
      integrationStatus.shiprocket.recentShipments = recentShipmentCount;

      return c.json({
        success: true,
        integrationHealth: integrationStatus
      });

    } catch (error: any) {
      console.error('Error fetching integration health:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/operations/system-alerts
   * Get system alerts and warnings
   */
  app.get(`${BASE_PATH}/admin/operations/system-alerts`, async (c) => {
    try {
      const alerts: any[] = [];

      // Check for vendors with pending applications
      const applications = await kv.getByPrefix('application:');
      const pendingApps = applications.filter((a: any) => a.value.status === 'pending');
      if (pendingApps.length > 0) {
        alerts.push({
          id: 'pending_applications',
          type: 'warning',
          severity: 'medium',
          title: 'Pending Vendor Applications',
          message: `${pendingApps.length} vendor applications awaiting review`,
          count: pendingApps.length,
          action: '/admin/vendors/pending'
        });
      }

      // Check for failed payments
      const bookings = await kv.getByPrefix('booking:');
      const failedPayments = bookings.filter((b: any) => 
        b.value.paymentStatus === 'failed' &&
        new Date(b.value.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      if (failedPayments.length > 0) {
        alerts.push({
          id: 'failed_payments',
          type: 'error',
          severity: 'high',
          title: 'Failed Payments',
          message: `${failedPayments.length} payment failures in the last 24 hours`,
          count: failedPayments.length,
          action: '/admin/operations/financial-overview'
        });
      }

      // Check for vendors with low ratings
      const vendors = await kv.getByPrefix('vendor:');
      const lowRatedVendors = vendors.filter((v: any) => 
        v.value.status === 'approved' && 
        v.value.rating && 
        v.value.rating < 3.0
      );
      if (lowRatedVendors.length > 0) {
        alerts.push({
          id: 'low_rated_vendors',
          type: 'warning',
          severity: 'medium',
          title: 'Low-Rated Vendors',
          message: `${lowRatedVendors.length} vendors with rating below 3.0`,
          count: lowRatedVendors.length,
          action: '/admin/operations/vendor-performance'
        });
      }

      // Check for incomplete bookings (stuck in pending)
      const oldPendingBookings = bookings.filter((b: any) => {
        const createdAt = new Date(b.value.createdAt);
        const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        return b.value.status === 'pending' && hoursSinceCreation > 24;
      });
      if (oldPendingBookings.length > 0) {
        alerts.push({
          id: 'stale_bookings',
          type: 'warning',
          severity: 'medium',
          title: 'Stale Bookings',
          message: `${oldPendingBookings.length} bookings pending for over 24 hours`,
          count: oldPendingBookings.length,
          action: '/admin/bookings'
        });
      }

      return c.json({
        success: true,
        alerts: alerts.sort((a: any, b: any) => {
          const severityOrder = { high: 0, medium: 1, low: 2 };
          return severityOrder[a.severity as keyof typeof severityOrder] - 
                 severityOrder[b.severity as keyof typeof severityOrder];
        }),
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter((a: any) => a.severity === 'high').length
      });

    } catch (error: any) {
      console.error('Error fetching system alerts:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Admin Operations Dashboard endpoints registered');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStartTime(timeRange: string, now: Date): Date {
  const ranges: { [key: string]: number } = {
    '1h': 1,
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30,
    '90d': 24 * 90
  };
  const hours = ranges[timeRange] || 24;
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

async function getLiveBookingActivity(startTime: Date): Promise<any> {
  const bookings = await kv.getByPrefix('booking:');
  const recentBookings = bookings.filter((b: any) => 
    new Date(b.value.createdAt) > startTime
  );

  return {
    totalBookings: recentBookings.length,
    activeBookings: recentBookings.filter((b: any) => 
      ['pending', 'confirmed', 'in_progress'].includes(b.value.status)
    ).length,
    completedBookings: recentBookings.filter((b: any) => 
      b.value.status === 'completed'
    ).length,
    cancelledBookings: recentBookings.filter((b: any) => 
      b.value.status === 'cancelled'
    ).length
  };
}

async function getVendorPerformanceMetrics(startTime: Date): Promise<any> {
  const vendors = await kv.getByPrefix('vendor:');
  const activeVendors = vendors.filter((v: any) => v.value.status === 'approved');

  return {
    totalActiveVendors: activeVendors.length,
    avgRating: calculateAverage(activeVendors.map((v: any) => v.value), 'rating'),
    topPerformers: activeVendors.slice(0, 5).map((v: any) => ({
      id: v.value.id,
      name: v.value.businessName,
      rating: v.value.rating || 0
    }))
  };
}

async function getServiceQualityMetrics(startTime: Date): Promise<any> {
  const reviews = await kv.getByPrefix('review:');
  const recentReviews = reviews.filter((r: any) => 
    new Date(r.value.createdAt) > startTime
  );

  const avgRating = recentReviews.length > 0
    ? recentReviews.reduce((sum: number, r: any) => sum + r.value.rating, 0) / recentReviews.length
    : 0;

  return {
    totalReviews: recentReviews.length,
    avgRating,
    satisfactionScore: (avgRating / 5) * 100
  };
}

async function getFinancialMetrics(startTime: Date): Promise<any> {
  const bookings = await kv.getByPrefix('booking:');
  const paidBookings = bookings.filter((b: any) => 
    b.value.paymentStatus === 'completed' &&
    new Date(b.value.createdAt) > startTime
  );

  const totalRevenue = paidBookings.reduce((sum: number, b: any) => 
    sum + (b.value.amount || b.value.price || 0), 0
  );

  return {
    totalRevenue,
    transactionCount: paidBookings.length,
    avgTransactionValue: paidBookings.length > 0 ? totalRevenue / paidBookings.length : 0
  };
}

async function getIntegrationHealthStatus(): Promise<any> {
  const razorpayConfig = await kv.get('platform:integrations:razorpay');
  const shiprocketConfig = await kv.get('platform:settings:logistics');

  return {
    razorpay: razorpayConfig?.value?.enabled ? 'healthy' : 'disabled',
    shiprocket: shiprocketConfig?.value?.shiprocket?.enabled ? 'healthy' : 'disabled'
  };
}

async function getSystemAlerts(): Promise<any[]> {
  return []; // Populated by dedicated endpoint
}

function calculateAvgResponseTime(bookings: any[]): number {
  // Mock calculation - in real implementation, would calculate from actual timestamps
  return Math.floor(Math.random() * 30) + 10; // 10-40 minutes
}

function calculateAverage(items: any[], field: string): number {
  if (items.length === 0) return 0;
  const sum = items.reduce((acc: number, item: any) => acc + (item[field] || 0), 0);
  return sum / items.length;
}

function aggregateByRole(vendorPerformance: any[]): any {
  const roleAgg: any = {};
  vendorPerformance.forEach((v: any) => {
    if (!roleAgg[v.roleId]) {
      roleAgg[v.roleId] = {
        roleId: v.roleId,
        count: 0,
        totalBookings: 0,
        totalRevenue: 0,
        avgRating: 0
      };
    }
    roleAgg[v.roleId].count++;
    roleAgg[v.roleId].totalBookings += v.totalBookings;
    roleAgg[v.roleId].totalRevenue += v.totalRevenue;
    roleAgg[v.roleId].avgRating += v.avgRating;
  });

  Object.keys(roleAgg).forEach(key => {
    roleAgg[key].avgRating /= roleAgg[key].count;
  });

  return Object.values(roleAgg);
}

function analyzeServiceQuality(bookings: any[], serviceStyle: string, reviews: any[]): any {
  const styleBookings = bookings.filter((b: any) => b.value.serviceStyle === serviceStyle);
  const completedBookings = styleBookings.filter((b: any) => b.value.status === 'completed');

  return {
    totalBookings: styleBookings.length,
    completedBookings: completedBookings.length,
    completionRate: styleBookings.length > 0 
      ? (completedBookings.length / styleBookings.length) * 100 
      : 0
  };
}

function calculateSatisfactionScore(reviews: any[]): number {
  if (reviews.length === 0) return 0;
  const avgRating = reviews.reduce((sum: number, r: any) => sum + r.value.rating, 0) / reviews.length;
  return (avgRating / 5) * 100;
}

function calculateDailyRevenue(bookings: any[], startTime: Date): any[] {
  const dailyData: { [key: string]: number } = {};
  
  bookings.forEach((b: any) => {
    const date = new Date(b.value.createdAt).toISOString().split('T')[0];
    dailyData[date] = (dailyData[date] || 0) + (b.value.amount || b.value.price || 0);
  });

  return Object.entries(dailyData)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));
}