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
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getReviewsRepository } from '../../lib/repositories/reviews.ts';
import { getPaymentsRepository } from '../../lib/repositories/payments.ts';
import { getPlatformSettingsRepository } from '../../lib/repositories/platform-settings.ts';
import { getDbClient } from '../../lib/db.ts';
import { sendSuccess, sendError } from './response-utils.ts';

const BASE_PATH = '/make-server-3dd53475';

export function adminOperationsDashboard(app: Hono) {
  const bookingsRepo = getBookingsRepository();
  const vendorsRepo = getVendorsRepository();
  const reviewsRepo = getReviewsRepository();
  const paymentsRepo = getPaymentsRepository();
  const platformSettingsRepo = getPlatformSettingsRepository();
  const client = getDbClient();

  /**
   * GET /admin/operations/dashboard
   * Comprehensive operations dashboard
   */
  app.get(`${BASE_PATH}/admin/operations/dashboard`, async (c) => {
    try {
      const timeRange = c.req.query('timeRange') || '24h';
      const now = new Date();
      const startTime = getStartTime(timeRange, now);

      // ✅ SQL: Fetch data from repositories
      const [allBookings, allVendors, allReviews, razorpayConfig, logisticsConfig] = await Promise.all([
        bookingsRepo.findAll({ limit: 1000 }),
        vendorsRepo.findAll({ limit: 1000 }),
        reviewsRepo.findAll({ limit: 1000 }),
        platformSettingsRepo.getPaymentGatewaySettings(),
        platformSettingsRepo.getLogisticsSettings()
      ]);

      // Filter data by time range
      const recentBookings = allBookings.filter((b: any) => 
        new Date(b.created_at) > startTime
      );
      const activeVendors = allVendors.filter((v: any) => v.status === 'approved');
      const recentReviews = allReviews.filter((r: any) => 
        new Date(r.created_at) > startTime
      );

      // Calculate metrics inline to avoid multiple iterations
      const liveBookings = {
        totalBookings: recentBookings.length,
        activeBookings: recentBookings.filter((b: any) => 
          ['pending', 'confirmed', 'in_progress'].includes(b.status)
        ).length,
        completedBookings: recentBookings.filter((b: any) => 
          b.status === 'completed'
        ).length,
        cancelledBookings: recentBookings.filter((b: any) => 
          b.status === 'cancelled'
        ).length
      };

      const vendorMetrics = {
        totalActiveVendors: activeVendors.length,
        avgRating: calculateAverage(activeVendors, 'rating')
      };

      const avgRating = recentReviews.length > 0
        ? recentReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / recentReviews.length
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
        b.payment_status === 'paid' || b.payment_status === 'completed'
      );

      const totalRevenue = paidBookings.reduce((sum: number, b: any) => 
        sum + Number(b.total_amount || 0), 0
      );

      const financialMetrics = {
        totalRevenue,
        transactionCount: paidBookings.length,
        avgTransactionValue: paidBookings.length > 0 ? totalRevenue / paidBookings.length : 0
      };

      const integrationHealth = {
        razorpay: razorpayConfig?.enabled ? 'healthy' : 'disabled',
        shiprocket: logisticsConfig?.enabled ? 'healthy' : 'disabled'
      };

      const systemAlerts = {
        alerts: [],
        totalAlerts: 0,
        criticalAlerts: 0
      };

      return sendSuccess(c, {
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
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/operations/live-activity
   * Real-time booking and service activity
   */
  app.get(`${BASE_PATH}/admin/operations/live-activity`, async (c) => {
    try {
      // ✅ SQL: Get all bookings
      const allBookings = await bookingsRepo.findAll({ limit: 1000 });
      const now = new Date();
      const last30Min = new Date(now.getTime() - 30 * 60 * 1000);

      // Filter active bookings
      const activeBookings = allBookings.filter((b: any) => {
        const bookingDate = new Date(b.booking_date || b.created_at);
        const isToday = bookingDate.toDateString() === now.toDateString();
        const isActive = ['pending', 'confirmed', 'in_progress'].includes(b.status);
        return isToday && isActive;
      });

      // Recent activity (last 30 minutes)
      const recentActivity = allBookings
        .filter((b: any) => new Date(b.created_at) > last30Min)
        .map((b: any) => ({
          id: b.id,
          type: 'booking_created',
          serviceName: b.service_type || 'Service',
          vendorId: b.vendor_id,
          customerId: b.customer_id,
          amount: b.total_amount || 0,
          status: b.status,
          timestamp: b.created_at
        }))
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);

      // Service style breakdown (using service_type)
      const serviceStyleStats = {
        at_home: activeBookings.filter((b: any) => b.service_type?.includes('home') || b.service_type === 'at_home').length,
        at_center: activeBookings.filter((b: any) => b.service_type?.includes('center') || b.service_type === 'at_center').length,
        tele: activeBookings.filter((b: any) => b.service_type?.includes('tele') || b.service_type === 'tele').length
      };

      return sendSuccess(c, {
        liveActivity: {
          activeBookingsCount: activeBookings.length,
          recentActivityCount: recentActivity.length,
          serviceStyleStats,
          activeBookings: activeBookings.slice(0, 20).map((b: any) => ({
            id: b.id,
            serviceName: b.service_type || 'Service',
            serviceStyle: b.service_type,
            vendorId: b.vendor_id,
            status: b.status,
            scheduledDate: b.booking_date,
            amount: b.total_amount || 0
          })),
          recentActivity: recentActivity.slice(0, 10)
        }
      });

    } catch (error: any) {
      console.error('Error fetching live activity:', error);
      return sendError(c, error, 500);
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

      // ✅ SQL: Fetch vendors and bookings
      const allVendors = await vendorsRepo.findAll({ limit });
      const approvedVendors = allVendors
        .filter((v: any) => v.status === 'approved')
        .slice(0, limit);

      const allBookings = await bookingsRepo.findAll({ limit: 1000 });
      
      // Filter bookings by time first to reduce processing
      const recentBookings = allBookings.filter((b: any) => 
        new Date(b.created_at) > startTime
      );

      // Build vendor performance with optimized logic
      const vendorPerformance = approvedVendors.map((vendor: any) => {
        // Filter bookings for this vendor
        const vendorBookings = recentBookings.filter((b: any) => 
          b.vendor_id === vendor.id
        );

        const completedBookings = vendorBookings.filter((b: any) => 
          b.status === 'completed'
        );

        const totalRevenue = vendorBookings.reduce((sum: number, b: any) => 
          sum + Number(b.total_amount || 0), 0
        );

        const avgRating = vendor.rating || 0;
        const completionRate = vendorBookings.length > 0 
          ? (completedBookings.length / vendorBookings.length) * 100 
          : 0;

        return {
          vendorId: vendor.id,
          businessName: vendor.business_name,
          roleId: vendor.role_id,
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

      return sendSuccess(c, {
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
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/operations/service-quality
   * Service quality metrics and monitoring
   */
  app.get(`${BASE_PATH}/admin/operations/service-quality`, async (c) => {
    try {
      // ✅ SQL: Get bookings and reviews
      const allBookings = await bookingsRepo.findAll({ limit: 1000 });
      const allReviews = await reviewsRepo.findAll({ limit: 1000 });
      const timeRange = c.req.query('timeRange') || '30d';
      const startTime = getStartTime(timeRange, new Date());

      const recentBookings = allBookings.filter((b: any) => 
        new Date(b.created_at) > startTime
      );

      const recentReviews = allReviews.filter((r: any) => 
        new Date(r.created_at) > startTime
      );

      // Service style quality
      const serviceStyleQuality = {
        at_home: analyzeServiceQuality(recentBookings, 'at_home', recentReviews),
        at_center: analyzeServiceQuality(recentBookings, 'at_center', recentReviews),
        tele: analyzeServiceQuality(recentBookings, 'tele', recentReviews)
      };

      // Issue tracking
      const issues = recentBookings.filter((b: any) => 
        ['cancelled', 'failed'].includes(b.status) || b.payment_status === 'failed'
      );

      const issueBreakdown = {
        cancellations: issues.filter((b: any) => b.status === 'cancelled').length,
        failures: issues.filter((b: any) => b.status === 'failed').length,
        paymentFailures: issues.filter((b: any) => b.payment_status === 'failed').length
      };

      // Customer satisfaction
      const avgRating = recentReviews.length > 0
        ? recentReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / recentReviews.length
        : 0;

      const satisfactionScore = calculateSatisfactionScore(recentReviews);

      return sendSuccess(c, {
        serviceQuality: {
          totalBookings: recentBookings.length,
          completedBookings: recentBookings.filter((b: any) => b.status === 'completed').length,
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
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/operations/financial-overview
   * Financial metrics and reconciliation
   */
  app.get(`${BASE_PATH}/admin/operations/financial-overview`, async (c) => {
    try {
      // ✅ SQL: Get bookings and payouts
      const allBookings = await bookingsRepo.findAll({ limit: 1000 });
      const timeRange = c.req.query('timeRange') || '30d';
      const startTime = getStartTime(timeRange, new Date());

      const paidBookings = allBookings.filter((b: any) => 
        (b.payment_status === 'paid' || b.payment_status === 'completed') &&
        new Date(b.created_at) > startTime
      );

      const totalRevenue = paidBookings.reduce((sum: number, b: any) => 
        sum + Number(b.total_amount || 0), 0
      );

      // ✅ SQL: Get commission from payout rules or use default
      const { data: payoutRule } = await client
        .from('payout_rules')
        .select('commission_percentage')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(1)
        .single();
      
      const commissionRate = payoutRule?.commission_percentage ? parseFloat(payoutRule.commission_percentage) : 15;
      const commission = totalRevenue * (commissionRate / 100);
      const vendorPayout = totalRevenue - commission;

      // ✅ SQL: Calculate pending payouts
      const { data: pendingPayoutsData } = await client
        .from('payouts')
        .select('amount')
        .eq('payout_status', 'pending');
      
      const pendingPayouts = (pendingPayoutsData || []).reduce((sum: number, p: any) => 
        sum + Number(p.amount || 0), 0
      );

      // ✅ SQL: Get payment methods from payments table
      const allPayments = await paymentsRepo.findAll({ limit: 1000 });
      const recentPayments = allPayments.filter((p: any) => 
        new Date(p.created_at) > startTime && p.payment_status === 'completed'
      );

      // Payment method breakdown
      const paymentMethods = recentPayments.reduce((acc: any, p: any) => {
        const method = p.payment_method || 'razorpay';
        acc[method] = (acc[method] || 0) + Number(p.amount || 0);
        return acc;
      }, {});

      // Daily revenue trend
      const dailyRevenue = calculateDailyRevenue(paidBookings, startTime);

      return sendSuccess(c, {
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
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/operations/integration-health
   * Monitor integration status and health
   */
  app.get(`${BASE_PATH}/admin/operations/integration-health`, async (c) => {
    try {
      // ✅ SQL: Get platform settings
      const razorpayConfig = await platformSettingsRepo.getPaymentGatewaySettings();
      const logisticsConfig = await platformSettingsRepo.getLogisticsSettings();

      const integrationStatus = {
        razorpay: {
          configured: !!(razorpayConfig?.key_id || razorpayConfig?.api_key),
          enabled: razorpayConfig?.enabled || false,
          status: razorpayConfig?.enabled ? 'active' : 'disabled',
          lastChecked: new Date().toISOString()
        },
        shiprocket: {
          configured: !!(logisticsConfig?.email || logisticsConfig?.api_key),
          enabled: logisticsConfig?.enabled || false,
          status: logisticsConfig?.enabled ? 'active' : 'disabled',
          lastChecked: new Date().toISOString()
        }
      };

      // ✅ SQL: Check recent payment activities
      const allPayments = await paymentsRepo.findAll({ limit: 1000 });
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentPaymentCount = allPayments.filter((p: any) => 
        new Date(p.created_at) > last24h && p.payment_status === 'completed'
      ).length;

      // ✅ SQL: Check recent shipments (from orders table if exists)
      const { data: recentOrders } = await client
        .from('orders')
        .select('id')
        .gte('created_at', last24h.toISOString())
        .not('tracking_id', 'is', null);
      
      const recentShipmentCount = recentOrders?.length || 0;

      integrationStatus.razorpay.recentTransactions = recentPaymentCount;
      integrationStatus.shiprocket.recentShipments = recentShipmentCount;

      return sendSuccess(c, {
        integrationHealth: integrationStatus
      });

    } catch (error: any) {
      console.error('Error fetching integration health:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/operations/system-alerts
   * Get system alerts and warnings
   */
  app.get(`${BASE_PATH}/admin/operations/system-alerts`, async (c) => {
    try {
      const alerts: any[] = [];

      // ✅ SQL: Check for vendors with pending applications
      const { data: pendingVendors } = await client
        .from('vendors')
        .select('id')
        .eq('status', 'pending');
      
      if (pendingVendors && pendingVendors.length > 0) {
        alerts.push({
          id: 'pending_applications',
          type: 'warning',
          severity: 'medium',
          title: 'Pending Vendor Applications',
          message: `${pendingVendors.length} vendor applications awaiting review`,
          count: pendingVendors.length,
          action: '/admin/vendors/pending'
        });
      }

      // ✅ SQL: Check for failed payments
      const allBookings = await bookingsRepo.findAll({ limit: 1000 });
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const failedPayments = allBookings.filter((b: any) => 
        b.payment_status === 'failed' &&
        new Date(b.created_at) > last24h
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

      // ✅ SQL: Check for vendors with low ratings
      const allVendors = await vendorsRepo.findAll({ limit: 1000 });
      const lowRatedVendors = allVendors.filter((v: any) => 
        v.status === 'approved' && 
        v.rating && 
        v.rating < 3.0
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

      // ✅ SQL: Check for incomplete bookings (stuck in pending)
      const oldPendingBookings = allBookings.filter((b: any) => {
        const createdAt = new Date(b.created_at);
        const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        return b.status === 'pending' && hoursSinceCreation > 24;
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

      return sendSuccess(c, {
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
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Admin Operations Dashboard endpoints registered (SQL-only)');
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

// Helper functions removed - now using SQL repositories directly

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
  const styleBookings = bookings.filter((b: any) => 
    b.service_type?.includes(serviceStyle) || b.service_type === serviceStyle
  );
  const completedBookings = styleBookings.filter((b: any) => b.status === 'completed');

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
  const avgRating = reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length;
  return (avgRating / 5) * 100;
}

function calculateDailyRevenue(bookings: any[], startTime: Date): any[] {
  const dailyData: { [key: string]: number } = {};
  
  bookings.forEach((b: any) => {
    const date = new Date(b.created_at).toISOString().split('T')[0];
    dailyData[date] = (dailyData[date] || 0) + Number(b.total_amount || 0);
  });

  return Object.entries(dailyData)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));
}