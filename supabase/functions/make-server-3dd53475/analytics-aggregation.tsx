import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

export function analyticsAggregationEndpoints(app: Hono) {
  
  /**
   * GET /admin/analytics/kpi
   * Get real-time KPI metrics with enterprise-grade insights
   */
  app.get("/make-server-3dd53475/admin/analytics/kpi", async (c) => {
    try {
      const range = c.req.query('range') || '7d';
      
      // Skip cache to avoid timeout issues - calculate fresh each time
      // For production, implement Redis or similar fast cache
      
      // Calculate date range
      const { startDate, endDate } = getDateRange(range);
      
      // Aggregate KPIs in parallel for maximum performance
      const [
        totalGMV,
        totalRevenue,
        activeCustomers,
        activeVendors,
        totalBookings,
        totalOrders,
        avgOrderValue,
        commissionEarned,
        conversionRate,
        churnRate,
        customerLTV,
        customerCAC,
        retentionRate,
        repeatPurchaseRate
      ] = await Promise.all([
        calculateGMV(startDate, endDate),
        calculateRevenue(startDate, endDate),
        countActiveCustomers(startDate, endDate),
        countActiveVendors(startDate, endDate),
        countBookings(startDate, endDate),
        countOrders(startDate, endDate),
        calculateAOV(startDate, endDate),
        calculateCommission(startDate, endDate),
        calculateConversionRate(startDate, endDate),
        calculateChurnRate(startDate, endDate),
        calculateCustomerLTV(startDate, endDate),
        calculateCustomerCAC(startDate, endDate),
        calculateRetentionRate(startDate, endDate),
        calculateRepeatPurchaseRate(startDate, endDate)
      ]);
      
      const kpiData = {
        totalGMV,
        totalRevenue,
        activeCustomers,
        activeVendors,
        totalBookings,
        totalOrders,
        avgOrderValue,
        commissionEarned,
        conversionRate,
        churnRate,
        customerLTV,
        customerCAC,
        retentionRate,
        repeatPurchaseRate,
        profitMargin: totalRevenue > 0 ? ((commissionEarned / totalRevenue) * 100) : 0,
        timestamp: Date.now()
      };
      
      // Note: Cache disabled to prevent timeout - consider Redis for production
      
      return c.json({ success: true, data: kpiData });
      
    } catch (error) {
      console.error('Analytics KPI Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /admin/analytics/revenue
   * Get revenue analytics with multiple grouping options
   */
  app.get("/make-server-3dd53475/admin/analytics/revenue", async (c) => {
    try {
      const range = c.req.query('range') || '7d';
      const groupBy = c.req.query('groupBy') || 'day';
      
      const { startDate, endDate } = getDateRange(range);
      
      let revenueData;
      
      if (groupBy === 'day' || groupBy === 'week' || groupBy === 'month') {
        revenueData = await getRevenueByTimePeriod(startDate, endDate, groupBy);
      } else if (groupBy === 'category') {
        revenueData = await getRevenueByCategory(startDate, endDate);
      } else if (groupBy === 'vendor') {
        revenueData = await getRevenueByVendor(startDate, endDate);
      } else if (groupBy === 'service') {
        revenueData = await getRevenueByService(startDate, endDate);
      }
      
      return c.json({ success: true, data: revenueData });
      
    } catch (error) {
      console.error('Revenue Analytics Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/analytics/cohort
   * Get cohort analysis for customer retention
   */
  app.get("/make-server-3dd53475/admin/analytics/cohort", async (c) => {
    try {
      const period = c.req.query('period') || 'month';
      
      const cohortData = await getCohortAnalysis(period);
      
      return c.json({ success: true, data: cohortData });
      
    } catch (error) {
      console.error('Cohort Analysis Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/analytics/funnel
   * Get conversion funnel metrics
   */
  app.get("/make-server-3dd53475/admin/analytics/funnel", async (c) => {
    try {
      const range = c.req.query('range') || '7d';
      const { startDate, endDate } = getDateRange(range);
      
      const funnelData = await getFunnelMetrics(startDate, endDate);
      
      return c.json({ success: true, data: funnelData });
      
    } catch (error) {
      console.error('Funnel Analytics Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/analytics/vendor-performance
   * Get detailed vendor performance metrics
   */
  app.get("/make-server-3dd53475/admin/analytics/vendor-performance", async (c) => {
    try {
      const range = c.req.query('range') || '30d';
      const { startDate, endDate } = getDateRange(range);
      
      const vendorMetrics = await getVendorPerformanceMetrics(startDate, endDate);
      
      return c.json({ success: true, data: vendorMetrics });
      
    } catch (error) {
      console.error('Vendor Performance Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/analytics/category-insights
   * Get category-wise performance insights
   */
  app.get("/make-server-3dd53475/admin/analytics/category-insights", async (c) => {
    try {
      const range = c.req.query('range') || '30d';
      const { startDate, endDate } = getDateRange(range);
      
      const categoryInsights = await getCategoryInsights(startDate, endDate);
      
      return c.json({ success: true, data: categoryInsights });
      
    } catch (error) {
      console.error('Category Insights Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/analytics/geographic
   * Get geographic distribution of business
   */
  app.get("/make-server-3dd53475/admin/analytics/geographic", async (c) => {
    try {
      const range = c.req.query('range') || '30d';
      const { startDate, endDate } = getDateRange(range);
      
      const geoData = await getGeographicDistribution(startDate, endDate);
      
      return c.json({ success: true, data: geoData });
      
    } catch (error) {
      console.error('Geographic Analytics Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/analytics/predictions
   * Get AI-powered predictions and forecasts
   */
  app.get("/make-server-3dd53475/admin/analytics/predictions", async (c) => {
    try {
      const type = c.req.query('type') || 'revenue'; // revenue, bookings, churn
      
      const predictions = await generatePredictions(type);
      
      return c.json({ success: true, data: predictions });
      
    } catch (error) {
      console.error('Predictions Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  async function calculateGMV(startDate: string, endDate: string): Promise<number> {
    const bookings = await getBookingsInRange(startDate, endDate);
    const orders = await getOrdersInRange(startDate, endDate);
    
    const bookingGMV = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const orderGMV = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    
    return Math.round(bookingGMV + orderGMV);
  }
  
  async function calculateRevenue(startDate: string, endDate: string): Promise<number> {
    const transactions = await getTransactionsInRange(startDate, endDate);
    return Math.round(transactions.reduce((sum, t) => sum + (t.platformCommission || 0), 0));
  }
  
  async function countActiveCustomers(startDate: string, endDate: string): Promise<number> {
    try {
      // Optimized: Get bookings instead of all customers to find active ones
      const bookings = await getBookingsInRange(startDate, endDate);
      const uniqueCustomers = new Set(bookings.map((b: any) => b.customerId).filter(Boolean));
      return uniqueCustomers.size;
    } catch (error) {
      console.error('Error counting active customers:', error);
      return 0; // Return 0 instead of crashing
    }
  }
  
  async function countActiveVendors(startDate: string, endDate: string): Promise<number> {
    try {
      // Optimized: Get bookings instead of all vendors to find active ones
      const bookings = await getBookingsInRange(startDate, endDate);
      const uniqueVendors = new Set(bookings.map((b: any) => b.vendorId).filter(Boolean));
      return uniqueVendors.size;
    } catch (error) {
      console.error('Error counting active vendors:', error);
      return 0; // Return 0 instead of crashing
    }
  }

  async function countBookings(startDate: string, endDate: string): Promise<number> {
    const bookings = await getBookingsInRange(startDate, endDate);
    return bookings.length;
  }

  async function countOrders(startDate: string, endDate: string): Promise<number> {
    const orders = await getOrdersInRange(startDate, endDate);
    return orders.length;
  }
  
  async function calculateAOV(startDate: string, endDate: string): Promise<number> {
    const orders = await getOrdersInRange(startDate, endDate);
    if (orders.length === 0) return 0;
    const total = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return Math.round(total / orders.length);
  }
  
  async function calculateCommission(startDate: string, endDate: string): Promise<number> {
    const transactions = await getTransactionsInRange(startDate, endDate);
    return Math.round(transactions.reduce((sum, t) => sum + (t.platformCommission || 0), 0));
  }
  
  async function calculateConversionRate(startDate: string, endDate: string): Promise<number> {
    const visitors = await getVisitorsInRange(startDate, endDate);
    const conversions = await getConversionsInRange(startDate, endDate);
    if (visitors === 0) return 0;
    return Math.round((conversions / visitors) * 100 * 100) / 100;
  }
  
  async function calculateChurnRate(startDate: string, endDate: string): Promise<number> {
    const previousPeriod = getPreviousPeriod(startDate, endDate);
    const previousActive = await countActiveCustomers(previousPeriod.start, previousPeriod.end);
    const currentActive = await countActiveCustomers(startDate, endDate);
    const churned = previousActive - currentActive;
    if (previousActive === 0) return 0;
    return Math.round((churned / previousActive) * 100 * 100) / 100;
  }

  async function calculateCustomerLTV(startDate: string, endDate: string): Promise<number> {
    try {
      // Optimized: Calculate from recent bookings instead of all customers
      const bookings = await getBookingsInRange(startDate, endDate);
      const orders = await getOrdersInRange(startDate, endDate);
      
      if (bookings.length === 0 && orders.length === 0) return 0;
      
      const totalValue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0) +
                         orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      
      const uniqueCustomers = new Set([
        ...bookings.map(b => b.customerId).filter(Boolean),
        ...orders.map(o => o.customerId).filter(Boolean)
      ]);
      
      return uniqueCustomers.size > 0 ? Math.round(totalValue / uniqueCustomers.size) : 0;
    } catch (error) {
      console.error('Error calculating LTV:', error);
      return 0;
    }
  }

  async function calculateCustomerCAC(startDate: string, endDate: string): Promise<number> {
    // Simplified CAC - in production, pull from marketing spend
    const marketingSpend = 50000; // Mock value - should come from marketing budget
    const newCustomers = await countActiveCustomers(startDate, endDate);
    if (newCustomers === 0) return 0;
    return Math.round(marketingSpend / newCustomers);
  }

  async function calculateRetentionRate(startDate: string, endDate: string): Promise<number> {
    const previousPeriod = getPreviousPeriod(startDate, endDate);
    const previousActive = await countActiveCustomers(previousPeriod.start, previousPeriod.end);
    const currentActive = await countActiveCustomers(startDate, endDate);
    if (previousActive === 0) return 0;
    return Math.round((currentActive / previousActive) * 100 * 100) / 100;
  }

  async function calculateRepeatPurchaseRate(startDate: string, endDate: string): Promise<number> {
    const bookings = await getBookingsInRange(startDate, endDate);
    const orders = await getOrdersInRange(startDate, endDate);
    
    const customerPurchases = new Map<string, number>();
    
    bookings.forEach(b => {
      const count = customerPurchases.get(b.customerId) || 0;
      customerPurchases.set(b.customerId, count + 1);
    });
    
    orders.forEach(o => {
      const count = customerPurchases.get(o.customerId) || 0;
      customerPurchases.set(o.customerId, count + 1);
    });
    
    const repeatCustomers = Array.from(customerPurchases.values()).filter(count => count > 1).length;
    const totalCustomers = customerPurchases.size;
    
    if (totalCustomers === 0) return 0;
    return Math.round((repeatCustomers / totalCustomers) * 100 * 100) / 100;
  }
  
  function getDateRange(range: string): { startDate: string; endDate: string } {
    const endDate = new Date();
    let startDate = new Date();
    
    switch (range) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }
  
  async function getBookingsInRange(start: string, end: string): Promise<any[]> {
    const allBookings = await kv.getByPrefix('booking:');
    return allBookings.filter((b: any) => {
      if (!b.id || b.id.includes(':') || typeof b !== 'object') return false;
      const bookingDate = b.createdAt || b.bookingDate;
      return bookingDate >= start && bookingDate <= end;
    });
  }
  
  async function getOrdersInRange(start: string, end: string): Promise<any[]> {
    const allOrders = await kv.getByPrefix('order:');
    return allOrders.filter((o: any) => {
      if (!o.id || o.id.includes(':') || typeof o !== 'object') return false;
      const orderDate = o.createdAt || o.orderDate;
      return orderDate >= start && orderDate <= end;
    });
  }
  
  async function getTransactionsInRange(start: string, end: string): Promise<any[]> {
    const allPayments = await kv.getByPrefix('payment:');
    return allPayments.filter((p: any) => {
      if (!p.id || p.id.includes(':') || typeof p !== 'object') return false;
      const paymentDate = p.createdAt || p.paidAt;
      return paymentDate >= start && paymentDate <= end && p.status === 'completed';
    });
  }
  
  async function getVisitorsInRange(start: string, end: string): Promise<number> {
    // Mock implementation - in production, integrate with analytics service
    return 10000;
  }
  
  async function getConversionsInRange(start: string, end: string): Promise<number> {
    const bookings = await getBookingsInRange(start, end);
    const orders = await getOrdersInRange(start, end);
    return bookings.length + orders.length;
  }

  async function getCustomerBookings(customerId: string): Promise<any[]> {
    const allBookings = await kv.getByPrefix('booking:');
    return allBookings.filter((b: any) => b.customerId === customerId && !b.id.includes(':'));
  }

  async function getCustomerOrders(customerId: string): Promise<any[]> {
    const allOrders = await kv.getByPrefix('order:');
    return allOrders.filter((o: any) => o.customerId === customerId && !o.id.includes(':'));
  }
  
  function getPreviousPeriod(start: string, end: string): { start: string; end: string } {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = endDate.getTime() - startDate.getTime();
    
    return {
      start: new Date(startDate.getTime() - diff).toISOString(),
      end: startDate.toISOString()
    };
  }
  
  async function getRevenueByTimePeriod(start: string, end: string, period: string): Promise<any[]> {
    const transactions = await getTransactionsInRange(start, end);
    const grouped: Record<string, { revenue: number; commission: number; count: number }> = {};
    
    transactions.forEach((t: any) => {
      const date = new Date(t.createdAt || t.paidAt);
      let key: string;
      
      if (period === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (period === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = date.toISOString().split('T')[0];
      }
      
      if (!grouped[key]) {
        grouped[key] = { revenue: 0, commission: 0, count: 0 };
      }
      
      grouped[key].revenue += t.amount || 0;
      grouped[key].commission += t.platformCommission || 0;
      grouped[key].count += 1;
    });
    
    return Object.entries(grouped).map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue),
      commission: Math.round(data.commission),
      count: data.count
    })).sort((a, b) => a.date.localeCompare(b.date));
  }
  
  async function getRevenueByCategory(start: string, end: string): Promise<any[]> {
    const bookings = await getBookingsInRange(start, end);
    const orders = await getOrdersInRange(start, end);
    
    const categoryRevenue: Record<string, { revenue: number; bookings: number; commission: number }> = {};
    
    bookings.forEach((b: any) => {
      const category = b.serviceCategory || b.category || 'Other';
      if (!categoryRevenue[category]) {
        categoryRevenue[category] = { revenue: 0, bookings: 0, commission: 0 };
      }
      categoryRevenue[category].revenue += b.totalAmount || 0;
      categoryRevenue[category].bookings += 1;
      categoryRevenue[category].commission += b.platformFee || (b.totalAmount * 0.1) || 0;
    });
    
    orders.forEach((o: any) => {
      const category = o.category || 'E-Commerce';
      if (!categoryRevenue[category]) {
        categoryRevenue[category] = { revenue: 0, bookings: 0, commission: 0 };
      }
      categoryRevenue[category].revenue += o.totalAmount || 0;
      categoryRevenue[category].bookings += 1;
      categoryRevenue[category].commission += o.platformFee || (o.totalAmount * 0.1) || 0;
    });
    
    return Object.entries(categoryRevenue).map(([name, data]) => ({
      name,
      revenue: Math.round(data.revenue),
      bookings: data.bookings,
      commission: Math.round(data.commission)
    })).sort((a, b) => b.revenue - a.revenue);
  }
  
  async function getRevenueByVendor(start: string, end: string): Promise<any[]> {
    const bookings = await getBookingsInRange(start, end);
    const vendorRevenue: Record<string, { revenue: number; bookings: number; avgRating: number }> = {};
    
    bookings.forEach((b: any) => {
      const vendorId = b.vendorId;
      if (!vendorRevenue[vendorId]) {
        vendorRevenue[vendorId] = { revenue: 0, bookings: 0, avgRating: 0 };
      }
      vendorRevenue[vendorId].revenue += b.totalAmount || 0;
      vendorRevenue[vendorId].bookings += 1;
    });
    
    const result = await Promise.all(
      Object.entries(vendorRevenue).map(async ([vendorId, data]) => {
        const vendor = await kv.get(`vendor:${vendorId}`);
        return {
          vendorId,
          vendorName: vendor?.businessName || vendor?.fullName || 'Unknown',
          revenue: Math.round(data.revenue),
          bookings: data.bookings,
          avgRating: vendor?.averageRating || 0
        };
      })
    );
    
    return result.sort((a, b) => b.revenue - a.revenue);
  }

  async function getRevenueByService(start: string, end: string): Promise<any[]> {
    const bookings = await getBookingsInRange(start, end);
    
    const serviceRevenue: Record<string, { revenue: number; bookings: number }> = {};
    
    bookings.forEach((b: any) => {
      const service = b.serviceName || b.serviceType || 'Other';
      if (!serviceRevenue[service]) {
        serviceRevenue[service] = { revenue: 0, bookings: 0 };
      }
      serviceRevenue[service].revenue += b.totalAmount || 0;
      serviceRevenue[service].bookings += 1;
    });
    
    return Object.entries(serviceRevenue).map(([name, data]) => ({
      name,
      revenue: Math.round(data.revenue),
      bookings: data.bookings
    })).sort((a, b) => b.revenue - a.revenue);
  }

  async function getCohortAnalysis(period: string): Promise<any> {
    // Simplified cohort analysis
    const customers = await kv.getByPrefix('customer:');
    const validCustomers = customers.filter((c: any) => !c.id.includes(':'));
    
    const cohorts: Record<string, { total: number; retained: number }> = {};
    
    validCustomers.forEach((c: any) => {
      const joinDate = new Date(c.createdAt);
      const cohortKey = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!cohorts[cohortKey]) {
        cohorts[cohortKey] = { total: 0, retained: 0 };
      }
      cohorts[cohortKey].total += 1;
      
      // Check if customer is still active
      if (c.lastActivityAt && new Date(c.lastActivityAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
        cohorts[cohortKey].retained += 1;
      }
    });
    
    return Object.entries(cohorts).map(([cohort, data]) => ({
      cohort,
      total: data.total,
      retained: data.retained,
      retentionRate: Math.round((data.retained / data.total) * 100)
    })).sort((a, b) => a.cohort.localeCompare(b.cohort));
  }

  async function getFunnelMetrics(start: string, end: string): Promise<any> {
    const visitors = await getVisitorsInRange(start, end);
    const bookings = await getBookingsInRange(start, end);
    const orders = await getOrdersInRange(start, end);
    const payments = await getTransactionsInRange(start, end);
    
    const total = bookings.length + orders.length;
    const completed = payments.length;
    
    return {
      visitors,
      browsing: Math.round(visitors * 0.7), // Mock
      addedToCart: Math.round(visitors * 0.3), // Mock
      initiated: total,
      completed,
      conversionRate: visitors > 0 ? Math.round((completed / visitors) * 100 * 100) / 100 : 0
    };
  }

  async function getVendorPerformanceMetrics(start: string, end: string): Promise<any[]> {
    const vendors = await kv.getByPrefix('vendor:');
    const validVendors = vendors.filter((v: any) => v.id && !v.id.includes(':') && v.status === 'approved');
    
    const metrics = await Promise.all(
      validVendors.map(async (vendor: any) => {
        const vendorBookings = await getVendorBookings(vendor.id, start, end);
        const revenue = vendorBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const avgResponseTime = calculateAvgResponseTime(vendorBookings);
        
        return {
          vendorId: vendor.id,
          vendorName: vendor.businessName || vendor.fullName,
          category: vendor.serviceCategory,
          bookings: vendorBookings.length,
          revenue: Math.round(revenue),
          avgRating: vendor.averageRating || 0,
          avgResponseTime,
          completionRate: calculateCompletionRate(vendorBookings)
        };
      })
    );
    
    return metrics.sort((a, b) => b.revenue - a.revenue).slice(0, 50);
  }

  async function getCategoryInsights(start: string, end: string): Promise<any[]> {
    const categoryData = await getRevenueByCategory(start, end);
    
    // Enrich with growth and trend data
    const previousPeriod = getPreviousPeriod(start, end);
    const previousData = await getRevenueByCategory(previousPeriod.start, previousPeriod.end);
    
    return categoryData.map(current => {
      const previous = previousData.find(p => p.name === current.name);
      const growth = previous ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0;
      
      return {
        ...current,
        growth: Math.round(growth * 100) / 100,
        trend: growth > 0 ? 'up' : growth < 0 ? 'down' : 'stable'
      };
    });
  }

  async function getGeographicDistribution(start: string, end: string): Promise<any[]> {
    const bookings = await getBookingsInRange(start, end);
    const orders = await getOrdersInRange(start, end);
    
    const geoData: Record<string, { bookings: number; revenue: number; customers: Set<string> }> = {};
    
    bookings.forEach((b: any) => {
      const location = b.location || b.city || 'Unknown';
      if (!geoData[location]) {
        geoData[location] = { bookings: 0, revenue: 0, customers: new Set() };
      }
      geoData[location].bookings += 1;
      geoData[location].revenue += b.totalAmount || 0;
      if (b.customerId) geoData[location].customers.add(b.customerId);
    });
    
    return Object.entries(geoData).map(([location, data]) => ({
      location,
      bookings: data.bookings,
      revenue: Math.round(data.revenue),
      customers: data.customers.size
    })).sort((a, b) => b.revenue - a.revenue);
  }

  async function generatePredictions(type: string): Promise<any> {
    // Simple linear regression prediction
    const last30Days = getDateRange('30d');
    const revenue30d = await getRevenueByTimePeriod(last30Days.startDate, last30Days.endDate, 'day');
    
    if (revenue30d.length < 7) {
      return {
        prediction: 'Insufficient data',
        confidence: 0
      };
    }
    
    // Calculate trend
    const values = revenue30d.map(d => d.revenue);
    const avgGrowth = calculateAverageGrowth(values);
    const lastValue = values[values.length - 1];
    
    const predictions = [];
    for (let i = 1; i <= 7; i++) {
      predictions.push({
        day: i,
        predicted: Math.round(lastValue * Math.pow(1 + avgGrowth, i)),
        confidence: Math.max(50, 90 - i * 5)
      });
    }
    
    return {
      type,
      predictions,
      trend: avgGrowth > 0 ? 'growing' : avgGrowth < 0 ? 'declining' : 'stable',
      avgGrowthRate: Math.round(avgGrowth * 100 * 100) / 100
    };
  }

  async function getVendorBookings(vendorId: string, start: string, end: string): Promise<any[]> {
    const bookings = await getBookingsInRange(start, end);
    return bookings.filter(b => b.vendorId === vendorId);
  }

  function calculateAvgResponseTime(bookings: any[]): number {
    if (bookings.length === 0) return 0;
    const responseTimes = bookings
      .filter(b => b.responseTime)
      .map(b => b.responseTime);
    if (responseTimes.length === 0) return 0;
    return Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length);
  }

  function calculateCompletionRate(bookings: any[]): number {
    if (bookings.length === 0) return 0;
    const completed = bookings.filter(b => b.status === 'completed').length;
    return Math.round((completed / bookings.length) * 100);
  }

  function calculateAverageGrowth(values: number[]): number {
    if (values.length < 2) return 0;
    let totalGrowth = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0) {
        totalGrowth += (values[i] - values[i - 1]) / values[i - 1];
      }
    }
    return totalGrowth / (values.length - 1);
  }
}