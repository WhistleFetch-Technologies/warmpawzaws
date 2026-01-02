/**
 * Vendor Analytics & Reporting Endpoints
 * Comprehensive analytics for Vets, Groomers, and Trainers
 * Provides performance metrics, earnings, and business insights
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { getDbClient } from '../../../supabase/lib/db';
import {
  getVendorsRepository,
  getBookingsRepository,
  getStaffRepository,
  getReviewsRepository
} from '../../../supabase/lib/repositories/index';

const app = new Hono();

// ============================================================================
// VENDOR ANALYTICS
// ============================================================================

/**
 * GET /vendor/:vendorId/analytics
 * Get comprehensive analytics for vendor
 */
app.get("/vendor/:vendorId/analytics", async (c) => {
  try {
    const vendorId = c.req.param("vendorId");
    const period = c.req.query("period") || "month"; // day, week, month, year, all
    
    console.log(`📊 Fetching analytics for vendor: ${vendorId}, period: ${period}`);
    
    // ✅ SQL: Get vendor data
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      return c.json({ error: "Vendor not found" }, 404);
    }
    
    // ✅ SQL: Get all bookings for vendor
    const bookingsRepo = getBookingsRepository();
    const vendorBookings = await bookingsRepo.findByVendor(vendorId);
    
    // Calculate period start
    const now = new Date();
    let periodStart = new Date();
    
    switch (period) {
      case 'day':
        periodStart.setHours(0, 0, 0, 0);
        break;
      case 'week':
        periodStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        periodStart.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        periodStart.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        periodStart = new Date(0); // Beginning of time
        break;
    }
    
    // Filter bookings by period
    const periodBookings = period === 'all' 
      ? vendorBookings 
      : vendorBookings.filter((booking: any) => 
          new Date(booking.created_at || booking.createdAt) >= periodStart
        );
    
    // Calculate status breakdown
    const completed = periodBookings.filter((b: any) => b.status === 'completed');
    const cancelled = periodBookings.filter((b: any) => b.status === 'cancelled');
    const pending = periodBookings.filter((b: any) => b.status === 'pending');
    const confirmed = periodBookings.filter((b: any) => b.status === 'confirmed');
    const inProgress = periodBookings.filter((b: any) => b.status === 'in_progress' || b.status === 'customer_arrived');
    
    // Calculate earnings
    const totalEarnings = completed.reduce((sum: number, b: any) => sum + (b.total_amount || b.price || 0), 0);
    const pendingEarnings = confirmed.reduce((sum: number, b: any) => sum + (b.total_amount || b.price || 0), 0);
    
    // Calculate service breakdown
    const serviceBreakdown: Record<string, any> = {};
    periodBookings.forEach((booking: any) => {
      const serviceName = booking.serviceName || 'Unknown';
      if (!serviceBreakdown[serviceName]) {
        serviceBreakdown[serviceName] = {
          count: 0,
          revenue: 0,
          completed: 0
        };
      }
      serviceBreakdown[serviceName].count++;
      if (booking.status === 'completed') {
        serviceBreakdown[serviceName].completed++;
        serviceBreakdown[serviceName].revenue += booking.total_amount || booking.price || 0;
      }
    });
    
    // ✅ SQL: Get reviews for vendor
    const db = getDbClient();
    const { data: reviews } = await db
      .from('reviews')
      .select('*')
      .eq('vendor_id', vendorId);
    
    const periodReviews = period === 'all'
      ? (reviews || [])
      : (reviews || []).filter((r: any) => new Date(r.created_at || r.createdAt) >= periodStart);
    
    const avgRating = periodReviews.length > 0
      ? (periodReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / periodReviews.length).toFixed(1)
      : 0;
    
    // ✅ SQL: Get staff count
    const staffRepo = getStaffRepository();
    const staffList = await staffRepo.findByVendorId(vendorId);
    const activeStaff = staffList.filter((s: any) => s.status === 'active');
    const staffCount = activeStaff.length;
    
    // Calculate customer breakdown
    const uniqueCustomers = new Set(periodBookings.map((b: any) => b.customerId));
    const returningCustomers = periodBookings.reduce((acc: Set<string>, booking: any) => {
      const customerBookings = periodBookings.filter((b: any) => b.customerId === booking.customerId);
      if (customerBookings.length > 1) {
        acc.add(booking.customerId);
      }
      return acc;
    }, new Set());
    
    // Calculate daily earnings trend (last 7 days)
    const dailyEarnings = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayBookings = completed.filter((b: any) => {
        const bookingDate = new Date(b.completed_at || b.completedAt || b.created_at || b.createdAt);
        return bookingDate >= date && bookingDate < nextDate;
      });
      
      const dayEarnings = dayBookings.reduce((sum: number, b: any) => sum + (b.total_amount || b.price || 0), 0);
      
      dailyEarnings.push({
        date: date.toISOString().split('T')[0],
        earnings: dayEarnings,
        bookings: dayBookings.length
      });
    }
    
    const analytics = {
      period,
      overview: {
        totalBookings: periodBookings.length,
        completed: completed.length,
        cancelled: cancelled.length,
        pending: pending.length,
        confirmed: confirmed.length,
        inProgress: inProgress.length,
        
        totalEarnings,
        pendingEarnings,
        avgBookingValue: completed.length > 0 ? (totalEarnings / completed.length).toFixed(0) : 0,
        
        completionRate: periodBookings.length > 0 
          ? ((completed.length / periodBookings.length) * 100).toFixed(1)
          : 0,
        cancellationRate: periodBookings.length > 0
          ? ((cancelled.length / periodBookings.length) * 100).toFixed(1)
          : 0,
        
        avgRating,
        reviewCount: periodReviews.length,
        
        staffCount,
        uniqueCustomers: uniqueCustomers.size,
        returningCustomers: returningCustomers.size,
        customerRetentionRate: uniqueCustomers.size > 0
          ? ((returningCustomers.size / uniqueCustomers.size) * 100).toFixed(1)
          : 0
      },
      
      serviceBreakdown: Object.entries(serviceBreakdown)
        .map(([name, data]) => ({
          serviceName: name,
          ...data
        }))
        .sort((a, b) => b.revenue - a.revenue),
      
      dailyEarnings,
      
      topServices: Object.entries(serviceBreakdown)
        .map(([name, data]: [string, any]) => ({
          serviceName: name,
          count: data.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    };
    
    console.log(`✅ Analytics calculated for ${vendorId}`);
    
    return c.json({ analytics });
    
  } catch (error) {
    console.error("Error fetching vendor analytics:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /vendor/:vendorId/staff-performance
 * Get performance metrics for all staff members
 */
app.get("/vendor/:vendorId/staff-performance", async (c) => {
  try {
    const vendorId = c.req.param("vendorId");
    const period = c.req.query("period") || "month";
    
    console.log(`👥 Fetching staff performance for vendor: ${vendorId}`);
    
    // ✅ SQL: Get all staff for vendor
    const staffRepo = getStaffRepository();
    const staffList = await staffRepo.findByVendorId(vendorId);
    
    // Get performance for each staff
    const staffPerformance = await Promise.all(
      staffList.map(async (staff: any) => {
        if (!staff || staff.status !== 'active') {
          return null;
        }
        
        const staffId = staff.id;
        
        // ✅ SQL: Get bookings for this staff
        const bookingsRepo = getBookingsRepository();
        const allBookings = await bookingsRepo.findByVendor(vendorId);
        const staffBookings = allBookings.filter((booking: any) => 
          booking.staff_id === staffId || booking.doctor_id === staffId || booking.staffId === staffId || booking.doctorId === staffId
        );
        
        // Calculate period
        const now = new Date();
        let periodStart = new Date();
        
        switch (period) {
          case 'day':
            periodStart.setHours(0, 0, 0, 0);
            break;
          case 'week':
            periodStart.setDate(now.getDate() - 7);
            break;
          case 'month':
            periodStart.setMonth(now.getMonth() - 1);
            break;
          case 'year':
            periodStart.setFullYear(now.getFullYear() - 1);
            break;
        }
        
        const periodBookings = staffBookings.filter((booking: any) => 
          new Date(booking.created_at || booking.createdAt) >= periodStart
        );
        
        const completed = periodBookings.filter((b: any) => b.status === 'completed');
        const totalEarnings = completed.reduce((sum: number, b: any) => sum + (b.total_amount || b.price || 0), 0);
        
        return {
          staffId: staff.id,
          fullName: staff.fullName,
          role: staff.role,
          photo: staff.photo,
          specializations: staff.specializations,
          
          totalAppointments: periodBookings.length,
          completed: completed.length,
          completionRate: periodBookings.length > 0
            ? ((completed.length / periodBookings.length) * 100).toFixed(1)
            : 0,
          
          totalEarnings,
          avgBookingValue: completed.length > 0
            ? (totalEarnings / completed.length).toFixed(0)
            : 0,
          
          rating: staff.rating || 0,
          reviewCount: staff.reviewCount || 0
        };
      })
    );
    
    // Filter out null values and sort by earnings
    const activeStaffPerformance = staffPerformance
      .filter(s => s !== null)
      .sort((a: any, b: any) => b.totalEarnings - a.totalEarnings);
    
    return c.json({ staffPerformance: activeStaffPerformance });
    
  } catch (error) {
    console.error("Error fetching staff performance:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /vendor/:vendorId/customer-insights
 * Get customer behavior and retention insights
 */
app.get("/vendor/:vendorId/customer-insights", async (c) => {
  try {
    const vendorId = c.req.param("vendorId");
    
    console.log(`👥 Fetching customer insights for vendor: ${vendorId}`);
    
    // ✅ SQL: Get all bookings for vendor
    const bookingsRepo = getBookingsRepository();
    const vendorBookings = await bookingsRepo.findByVendor(vendorId);
    
    // Customer frequency map
    const customerFrequency: Record<string, number> = {};
    const customerSpending: Record<string, number> = {};
    const customerLastVisit: Record<string, string> = {};
    
    vendorBookings.forEach((booking: any) => {
      const customerId = booking.customerId;
      
      // Count visits
      customerFrequency[customerId] = (customerFrequency[customerId] || 0) + 1;
      
      // Sum spending (only completed)
      if (booking.status === 'completed') {
        customerSpending[customerId] = (customerSpending[customerId] || 0) + (booking.total_amount || booking.price || 0);
      }
      
      // Track last visit
      const bookingDate = booking.booking_date || booking.date || booking.created_at || booking.createdAt;
      if (!customerLastVisit[customerId] || 
          new Date(bookingDate) > new Date(customerLastVisit[customerId])) {
        customerLastVisit[customerId] = bookingDate;
      }
    });
    
    // Categorize customers
    const newCustomers = Object.keys(customerFrequency).filter(id => customerFrequency[id] === 1);
    const returningCustomers = Object.keys(customerFrequency).filter(id => customerFrequency[id] > 1 && customerFrequency[id] <= 5);
    const loyalCustomers = Object.keys(customerFrequency).filter(id => customerFrequency[id] > 5);
    
    // Top customers by spending
    const topCustomers = Object.entries(customerSpending)
      .map(([customerId, spending]) => ({
        customerId,
        spending,
        visits: customerFrequency[customerId],
        lastVisit: customerLastVisit[customerId]
      }))
      .sort((a, b) => b.spending - a.spending)
      .slice(0, 10);
    
    // Customer at risk (haven't visited in 30+ days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const atRiskCustomers = Object.entries(customerLastVisit)
      .filter(([_, lastVisit]) => new Date(lastVisit) < thirtyDaysAgo)
      .map(([customerId, lastVisit]) => ({
        customerId,
        lastVisit,
        visits: customerFrequency[customerId],
        spending: customerSpending[customerId] || 0
      }));
    
    const insights = {
      totalCustomers: Object.keys(customerFrequency).length,
      newCustomers: newCustomers.length,
      returningCustomers: returningCustomers.length,
      loyalCustomers: loyalCustomers.length,
      atRiskCustomers: atRiskCustomers.length,
      
      avgVisitsPerCustomer: Object.keys(customerFrequency).length > 0
        ? (Object.values(customerFrequency).reduce((a: number, b: number) => a + b, 0) / Object.keys(customerFrequency).length).toFixed(1)
        : 0,
      
      avgSpendingPerCustomer: Object.keys(customerSpending).length > 0
        ? (Object.values(customerSpending).reduce((a: number, b: number) => a + b, 0) / Object.keys(customerSpending).length).toFixed(0)
        : 0,
      
      topCustomers,
      atRiskCustomers: atRiskCustomers.slice(0, 10)
    };
    
    return c.json({ insights });
    
  } catch (error) {
    console.error("Error fetching customer insights:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /vendor/:vendorId/revenue-forecast
 * Get revenue forecast and trends
 */
app.get("/vendor/:vendorId/revenue-forecast", async (c) => {
  try {
    const vendorId = c.req.param("vendorId");
    
    console.log(`💰 Fetching revenue forecast for vendor: ${vendorId}`);
    
    // ✅ SQL: Get completed bookings for vendor
    const bookingsRepo = getBookingsRepository();
    const allBookings = await bookingsRepo.findByVendor(vendorId);
    const completedBookings = allBookings.filter((booking: any) => 
      booking.status === 'completed'
    );
    
    // Calculate monthly revenue for last 6 months
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthBookings = completedBookings.filter((b: any) => {
        const bookingDate = new Date(b.completed_at || b.completedAt || b.created_at || b.createdAt);
        return bookingDate >= monthStart && bookingDate <= monthEnd;
      });
      
      const revenue = monthBookings.reduce((sum: number, b: any) => sum + (b.total_amount || b.price || 0), 0);
      
      monthlyRevenue.push({
        month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        revenue,
        bookings: monthBookings.length
      });
    }
    
    // Calculate growth rate
    const lastMonth = monthlyRevenue[monthlyRevenue.length - 1];
    const previousMonth = monthlyRevenue[monthlyRevenue.length - 2];
    const growthRate = previousMonth && previousMonth.revenue > 0
      ? (((lastMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100).toFixed(1)
      : 0;
    
    // Simple forecast for next month (based on average growth)
    const avgRevenue = monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0) / monthlyRevenue.length;
    const forecastNextMonth = lastMonth.revenue * (1 + (parseFloat(growthRate as string) / 100));
    
    return c.json({
      monthlyRevenue,
      growthRate,
      avgMonthlyRevenue: avgRevenue.toFixed(0),
      forecastNextMonth: forecastNextMonth.toFixed(0)
    });
    
  } catch (error) {
    console.error("Error fetching revenue forecast:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;