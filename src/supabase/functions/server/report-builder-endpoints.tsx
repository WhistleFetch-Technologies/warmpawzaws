import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

export function reportBuilderEndpoints(app: Hono) {
  
  /**
   * GET /admin/reports
   * Get all saved reports
   */
  app.get("/make-server-3dd53475/admin/reports", async (c) => {
    try {
      const reports = await kv.getByPrefix('report:');
      const validReports = reports.filter((r: any) => r.id && !r.id.includes(':template'));
      
      return c.json({ success: true, reports: validReports });
    } catch (error) {
      console.error('Get Reports Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/reports/saved
   * Get all saved reports (alias for compatibility)
   */
  app.get("/make-server-3dd53475/admin/reports/saved", async (c) => {
    try {
      const reports = await kv.getByPrefix('report:');
      const validReports = reports.filter((r: any) => r.id && !r.id.includes(':template'));
      
      return c.json({ success: true, reports: validReports });
    } catch (error) {
      console.error('Get Saved Reports Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /admin/reports/save
   * Save a report configuration
   */
  app.post("/make-server-3dd53475/admin/reports/save", async (c) => {
    try {
      const reportConfig = await c.req.json();
      
      if (!reportConfig.name) {
        return c.json({ error: 'Report name is required' }, 400);
      }
      
      const reportId = reportConfig.id || `report_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const report = {
        ...reportConfig,
        id: reportId,
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`report:${reportId}`, report);
      
      console.log(`✅ Report saved: ${reportId} - ${reportConfig.name}`);
      return c.json({ success: true, report });
    } catch (error) {
      console.error('Save Report Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /admin/reports/generate
   * Generate report data based on configuration
   */
  app.post("/make-server-3dd53475/admin/reports/generate", async (c) => {
    try {
      const reportConfig = await c.req.json();
      
      const { reportType, dateRange, groupBy, filters, metrics } = reportConfig;
      
      // Calculate date range
      const { startDate, endDate } = getDateRange(dateRange || '30d');
      
      let data: any[] = [];
      
      // Generate data based on report type
      switch (reportType) {
        case 'revenue':
          data = await generateRevenueReport(startDate, endDate, groupBy, filters, metrics);
          break;
        case 'bookings':
          data = await generateBookingsReport(startDate, endDate, groupBy, filters, metrics);
          break;
        case 'vendors':
          data = await generateVendorsReport(startDate, endDate, groupBy, filters, metrics);
          break;
        case 'customers':
          data = await generateCustomersReport(startDate, endDate, groupBy, filters, metrics);
          break;
        case 'custom':
          data = await generateCustomReport(startDate, endDate, groupBy, filters, metrics);
          break;
        default:
          data = await generateRevenueReport(startDate, endDate, groupBy, filters, metrics);
      }
      
      console.log(`✅ Report generated: ${reportType} with ${data.length} rows`);
      return c.json({ success: true, data });
    } catch (error) {
      console.error('Generate Report Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/reports/templates
   * Get report templates
   */
  app.get("/make-server-3dd53475/admin/reports/templates", async (c) => {
    try {
      const templates = getReportTemplates();
      return c.json({ success: true, templates });
    } catch (error) {
      console.error('Get Templates Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /admin/reports/:reportId/share
   * Share a report
   */
  app.post("/make-server-3dd53475/admin/reports/:reportId/share", async (c) => {
    try {
      const { reportId } = c.req.param();
      const { emails, message, expiresIn } = await c.req.json();
      
      const report = await kv.get(`report:${reportId}`);
      if (!report) {
        return c.json({ error: 'Report not found' }, 404);
      }
      
      const shareId = `share_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const expiresAt = new Date(Date.now() + (expiresIn || 7 * 24 * 60 * 60 * 1000));
      
      const shareLink = {
        id: shareId,
        reportId,
        emails: emails || [],
        message: message || '',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        accessCount: 0
      };
      
      await kv.set(`report:share:${shareId}`, shareLink);
      
      console.log(`✅ Report shared: ${reportId}`);
      return c.json({ 
        success: true, 
        shareId,
        shareUrl: `/admin/reports/shared/${shareId}`
      });
    } catch (error) {
      console.error('Share Report Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/reports/shared/:shareId
   * Access a shared report
   */
  app.get("/make-server-3dd53475/admin/reports/shared/:shareId", async (c) => {
    try {
      const { shareId } = c.req.param();
      
      const shareLink = await kv.get(`report:share:${shareId}`);
      if (!shareLink) {
        return c.json({ error: 'Share link not found or expired' }, 404);
      }
      
      // Check expiration
      if (new Date(shareLink.expiresAt) < new Date()) {
        return c.json({ error: 'Share link has expired' }, 403);
      }
      
      // Get report
      const report = await kv.get(`report:${shareLink.reportId}`);
      if (!report) {
        return c.json({ error: 'Report not found' }, 404);
      }
      
      // Generate fresh data
      const reportData = await generateReportData(report);
      
      // Update access count
      shareLink.accessCount = (shareLink.accessCount || 0) + 1;
      shareLink.lastAccessedAt = new Date().toISOString();
      await kv.set(`report:share:${shareId}`, shareLink);
      
      return c.json({ 
        success: true, 
        report,
        data: reportData
      });
    } catch (error) {
      console.error('Access Shared Report Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /admin/reports/:reportId/schedule
   * Schedule automatic report generation
   */
  app.post("/make-server-3dd53475/admin/reports/:reportId/schedule", async (c) => {
    try {
      const { reportId } = c.req.param();
      const { frequency, recipients, time } = await c.req.json();
      
      const report = await kv.get(`report:${reportId}`);
      if (!report) {
        return c.json({ error: 'Report not found' }, 404);
      }
      
      report.schedule = {
        enabled: true,
        frequency, // daily, weekly, monthly
        recipients: recipients || [],
        time: time || '09:00',
        lastRun: null,
        nextRun: calculateNextRun(frequency, time)
      };
      
      await kv.set(`report:${reportId}`, report);
      
      console.log(`✅ Report scheduled: ${reportId}`);
      return c.json({ success: true, schedule: report.schedule });
    } catch (error) {
      console.error('Schedule Report Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  async function generateReportData(report: any): Promise<any> {
    const { type, dateRange, filters, metrics, groupBy } = report;
    
    // Calculate date range
    const { startDate, endDate } = getDateRange(dateRange);
    
    let data: any = {};
    
    switch (type) {
      case 'financial':
        data = await generateFinancialReport(startDate, endDate, filters, metrics, groupBy);
        break;
      case 'operational':
        data = await generateOperationalReport(startDate, endDate, filters, metrics, groupBy);
        break;
      case 'marketing':
        data = await generateMarketingReport(startDate, endDate, filters, metrics, groupBy);
        break;
      case 'vendor':
        data = await generateVendorReport(startDate, endDate, filters, metrics, groupBy);
        break;
      case 'customer':
        data = await generateCustomerReport(startDate, endDate, filters, metrics, groupBy);
        break;
      default:
        data = { error: 'Unknown report type' };
    }
    
    return {
      reportType: type,
      dateRange: { startDate, endDate },
      generatedAt: new Date().toISOString(),
      ...data
    };
  }

  async function generateRevenueReport(
    start: string, 
    end: string, 
    groupBy: string, 
    filters: any, 
    metrics: string[]
  ): Promise<any> {
    const bookings = await getBookingsInRange(start, end);
    const orders = await getOrdersInRange(start, end);
    const payments = await getPaymentsInRange(start, end);
    
    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const platformCommission = payments.reduce((sum, p) => sum + (p.platformCommission || 0), 0);
    const vendorPayouts = totalRevenue - platformCommission;
    
    const refunds = await getRefundsInRange(start, end);
    const totalRefunds = refunds.reduce((sum, r) => sum + (r.amount || 0), 0);
    
    return {
      summary: {
        totalRevenue: Math.round(totalRevenue),
        platformCommission: Math.round(platformCommission),
        vendorPayouts: Math.round(vendorPayouts),
        totalRefunds: Math.round(totalRefunds),
        netRevenue: Math.round(totalRevenue - totalRefunds),
        transactionCount: payments.length,
        avgTransactionValue: payments.length > 0 ? Math.round(totalRevenue / payments.length) : 0
      },
      breakdown: await getRevenueBreakdown(bookings, orders, groupBy),
      topVendorsByRevenue: await getTopVendorsByRevenue(bookings, 10),
      paymentMethods: await getPaymentMethodBreakdown(payments)
    };
  }

  async function generateBookingsReport(
    start: string, 
    end: string, 
    groupBy: string, 
    filters: any, 
    metrics: string[]
  ): Promise<any> {
    const bookings = await getBookingsInRange(start, end);
    const vendors = await kv.getByPrefix('vendor:');
    const activeVendors = vendors.filter((v: any) => 
      v.id && !v.id.includes(':') && v.status === 'approved'
    );
    
    const completedBookings = bookings.filter(b => b.status === 'completed');
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled');
    
    return {
      summary: {
        totalBookings: bookings.length,
        completedBookings: completedBookings.length,
        cancelledBookings: cancelledBookings.length,
        completionRate: bookings.length > 0 ? Math.round((completedBookings.length / bookings.length) * 100) : 0,
        activeVendors: activeVendors.length,
        avgBookingsPerVendor: activeVendors.length > 0 ? Math.round(bookings.length / activeVendors.length) : 0
      },
      categoryPerformance: await getCategoryPerformance(bookings),
      vendorUtilization: await getVendorUtilization(bookings, activeVendors),
      timeSeriesData: await getBookingTimeSeries(bookings, groupBy)
    };
  }

  async function generateVendorsReport(
    start: string, 
    end: string, 
    groupBy: string, 
    filters: any, 
    metrics: string[]
  ): Promise<any> {
    const vendors = await kv.getByPrefix('vendor:');
    const activeVendors = vendors.filter((v: any) => 
      v.id && !v.id.includes(':') && v.status === 'approved'
    );
    
    const vendorMetrics = await Promise.all(
      activeVendors.map(async (vendor: any) => {
        const vendorBookings = await getVendorBookings(vendor.id, start, end);
        const revenue = vendorBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        
        return {
          vendorId: vendor.id,
          vendorName: vendor.businessName || vendor.fullName,
          category: vendor.serviceCategory,
          bookings: vendorBookings.length,
          revenue: Math.round(revenue),
          avgRating: vendor.averageRating || 0,
          totalReviews: vendor.totalReviews || 0,
          completionRate: calculateVendorCompletionRate(vendorBookings)
        };
      })
    );
    
    return {
      summary: {
        totalVendors: activeVendors.length,
        topPerformers: vendorMetrics.sort((a, b) => b.revenue - a.revenue).slice(0, 10),
        avgBookingsPerVendor: vendorMetrics.length > 0 ? 
          Math.round(vendorMetrics.reduce((sum, v) => sum + v.bookings, 0) / vendorMetrics.length) : 0,
        avgRevenuePerVendor: vendorMetrics.length > 0 ?
          Math.round(vendorMetrics.reduce((sum, v) => sum + v.revenue, 0) / vendorMetrics.length) : 0
      },
      vendorMetrics: vendorMetrics.sort((a, b) => b.revenue - a.revenue)
    };
  }

  async function generateCustomersReport(
    start: string, 
    end: string, 
    groupBy: string, 
    filters: any, 
    metrics: string[]
  ): Promise<any> {
    const customers = await kv.getByPrefix('customer:');
    const validCustomers = customers.filter((c: any) => !c.id.includes(':'));
    
    const customerMetrics = await Promise.all(
      validCustomers.map(async (customer: any) => {
        const bookings = await getCustomerBookings(customer.id);
        const orders = await getCustomerOrders(customer.id);
        const totalSpend = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0) +
                          orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        
        return {
          customerId: customer.id,
          name: customer.fullName || customer.name || 'Unknown',
          phone: customer.phone,
          totalBookings: bookings.length,
          totalOrders: orders.length,
          totalSpend: Math.round(totalSpend),
          avgOrderValue: (bookings.length + orders.length) > 0 ? 
            Math.round(totalSpend / (bookings.length + orders.length)) : 0,
          lastActivity: customer.lastActivityAt || customer.createdAt
        };
      })
    );
    
    return {
      summary: {
        totalCustomers: validCustomers.length,
        activeCustomers: customerMetrics.filter(c => {
          const lastActivity = new Date(c.lastActivity);
          return lastActivity >= new Date(start);
        }).length,
        avgLifetimeValue: customerMetrics.length > 0 ?
          Math.round(customerMetrics.reduce((sum, c) => sum + c.totalSpend, 0) / customerMetrics.length) : 0,
        repeatCustomerRate: calculateRepeatCustomerRate(customerMetrics)
      },
      topCustomers: customerMetrics.sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 20),
      customerSegments: segmentCustomers(customerMetrics)
    };
  }

  async function generateCustomReport(
    start: string, 
    end: string, 
    groupBy: string, 
    filters: any, 
    metrics: string[]
  ): Promise<any> {
    // Custom report generation logic
    return {};
  }

  function convertToCSV(data: any): string {
    if (!data || typeof data !== 'object') {
      return '';
    }
    
    // Extract summary if exists
    const rows: string[][] = [];
    
    if (data.summary) {
      rows.push(['Summary']);
      Object.entries(data.summary).forEach(([key, value]) => {
        rows.push([key, String(value)]);
      });
      rows.push([]);
    }
    
    // Add other data sections
    Object.entries(data).forEach(([section, value]) => {
      if (section === 'summary' || section === 'reportType' || section === 'dateRange' || section === 'generatedAt') {
        return;
      }
      
      if (Array.isArray(value) && value.length > 0) {
        rows.push([section]);
        const headers = Object.keys(value[0]);
        rows.push(headers);
        value.forEach(item => {
          rows.push(headers.map(h => String(item[h] || '')));
        });
        rows.push([]);
      }
    });
    
    return rows.map(row => row.join(',')).join('\n');
  }

  function getReportTemplates() {
    return [
      {
        id: 'revenue-summary',
        name: 'Revenue Summary',
        type: 'financial',
        description: 'Comprehensive revenue analysis with breakdowns',
        metrics: ['totalRevenue', 'commission', 'payouts', 'refunds'],
        groupBy: 'day'
      },
      {
        id: 'vendor-performance',
        name: 'Vendor Performance',
        type: 'vendor',
        description: 'Detailed vendor performance metrics',
        metrics: ['bookings', 'revenue', 'rating', 'completionRate'],
        groupBy: 'vendor'
      },
      {
        id: 'customer-analytics',
        name: 'Customer Analytics',
        type: 'customer',
        description: 'Customer behavior and lifetime value analysis',
        metrics: ['ltv', 'frequency', 'recency'],
        groupBy: 'segment'
      },
      {
        id: 'operational-overview',
        name: 'Operational Overview',
        type: 'operational',
        description: 'Key operational metrics and efficiency',
        metrics: ['bookings', 'completionRate', 'utilization'],
        groupBy: 'category'
      },
      {
        id: 'marketing-roi',
        name: 'Marketing ROI',
        type: 'marketing',
        description: 'Marketing campaign performance and ROI',
        metrics: ['spend', 'conversions', 'roi', 'cac'],
        groupBy: 'campaign'
      }
    ];
  }

  function getDateRange(range: string): { startDate: string; endDate: string } {
    const endDate = new Date();
    let startDate = new Date();
    
    switch (range) {
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
        startDate.setDate(startDate.getDate() - 30);
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  function calculateNextRun(frequency: string, time: string): string {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    
    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);
    
    if (frequency === 'daily') {
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    } else if (frequency === 'weekly') {
      nextRun.setDate(nextRun.getDate() + ((7 - nextRun.getDay()) % 7 || 7));
    } else if (frequency === 'monthly') {
      nextRun.setMonth(nextRun.getMonth() + 1, 1);
    }
    
    return nextRun.toISOString();
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

  async function getPaymentsInRange(start: string, end: string): Promise<any[]> {
    const allPayments = await kv.getByPrefix('payment:');
    return allPayments.filter((p: any) => {
      if (!p.id || p.id.includes(':') || typeof p !== 'object') return false;
      const paymentDate = p.createdAt || p.paidAt;
      return paymentDate >= start && paymentDate <= end && p.status === 'completed';
    });
  }

  async function getRefundsInRange(start: string, end: string): Promise<any[]> {
    const allRefunds = await kv.getByPrefix('refund:');
    return allRefunds.filter((r: any) => {
      if (!r.id || r.id.includes(':') || typeof r !== 'object') return false;
      const refundDate = r.createdAt;
      return refundDate >= start && refundDate <= end && r.status === 'completed';
    });
  }

  async function getCampaignsInRange(start: string, end: string): Promise<any[]> {
    const allCampaigns = await kv.getByPrefix('campaign:');
    return allCampaigns.filter((c: any) => {
      if (!c.id || c.id.includes(':') || typeof c !== 'object') return false;
      const startDate = c.startDate || c.createdAt;
      return startDate >= start && startDate <= end;
    });
  }

  async function getVendorBookings(vendorId: string, start: string, end: string): Promise<any[]> {
    const bookings = await getBookingsInRange(start, end);
    return bookings.filter(b => b.vendorId === vendorId);
  }

  async function getCustomerBookings(customerId: string): Promise<any[]> {
    const allBookings = await kv.getByPrefix('booking:');
    return allBookings.filter((b: any) => b.customerId === customerId && !b.id.includes(':'));
  }

  async function getCustomerOrders(customerId: string): Promise<any[]> {
    const allOrders = await kv.getByPrefix('order:');
    return allOrders.filter((o: any) => o.customerId === customerId && !o.id.includes(':'));
  }

  async function getRevenueBreakdown(bookings: any[], orders: any[], groupBy: string): Promise<any[]> {
    // Implementation similar to analytics-aggregation
    return [];
  }

  async function getTopVendorsByRevenue(bookings: any[], limit: number): Promise<any[]> {
    const vendorRevenue: Record<string, number> = {};
    
    bookings.forEach(b => {
      vendorRevenue[b.vendorId] = (vendorRevenue[b.vendorId] || 0) + (b.totalAmount || 0);
    });
    
    return Object.entries(vendorRevenue)
      .map(([vendorId, revenue]) => ({ vendorId, revenue: Math.round(revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  async function getPaymentMethodBreakdown(payments: any[]): Promise<any[]> {
    const methodCount: Record<string, number> = {};
    
    payments.forEach(p => {
      const method = p.paymentMethod || 'unknown';
      methodCount[method] = (methodCount[method] || 0) + 1;
    });
    
    return Object.entries(methodCount).map(([method, count]) => ({ method, count }));
  }

  async function getCategoryPerformance(bookings: any[]): Promise<any[]> {
    const categoryMetrics: Record<string, { bookings: number; revenue: number }> = {};
    
    bookings.forEach(b => {
      const category = b.serviceCategory || 'Other';
      if (!categoryMetrics[category]) {
        categoryMetrics[category] = { bookings: 0, revenue: 0 };
      }
      categoryMetrics[category].bookings += 1;
      categoryMetrics[category].revenue += b.totalAmount || 0;
    });
    
    return Object.entries(categoryMetrics).map(([category, metrics]) => ({
      category,
      bookings: metrics.bookings,
      revenue: Math.round(metrics.revenue)
    }));
  }

  async function getVendorUtilization(bookings: any[], vendors: any[]): Promise<any> {
    const vendorBookingCount: Record<string, number> = {};
    
    bookings.forEach(b => {
      vendorBookingCount[b.vendorId] = (vendorBookingCount[b.vendorId] || 0) + 1;
    });
    
    const utilizationData = vendors.map(v => ({
      vendorId: v.id,
      vendorName: v.businessName || v.fullName,
      bookingCount: vendorBookingCount[v.id] || 0
    }));
    
    return utilizationData;
  }

  async function getBookingTimeSeries(bookings: any[], groupBy: string): Promise<any[]> {
    // Group bookings by time period
    return [];
  }

  async function getChannelPerformance(campaigns: any[]): Promise<any[]> {
    const channelMetrics: Record<string, any> = {};
    
    campaigns.forEach(c => {
      const channel = c.channel || 'unknown';
      if (!channelMetrics[channel]) {
        channelMetrics[channel] = { campaigns: 0, spend: 0, conversions: 0 };
      }
      channelMetrics[channel].campaigns += 1;
      channelMetrics[channel].spend += c.spend || 0;
      channelMetrics[channel].conversions += c.conversions || 0;
    });
    
    return Object.entries(channelMetrics).map(([channel, metrics]) => ({
      channel,
      ...metrics
    }));
  }

  async function calculateCAC(start: string, end: string): Promise<number> {
    // Simplified CAC calculation
    const campaigns = await getCampaignsInRange(start, end);
    const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
    
    return totalConversions > 0 ? Math.round(totalSpend / totalConversions) : 0;
  }

  function calculateVendorCompletionRate(bookings: any[]): number {
    if (bookings.length === 0) return 0;
    const completed = bookings.filter(b => b.status === 'completed').length;
    return Math.round((completed / bookings.length) * 100);
  }

  function calculateRepeatCustomerRate(customerMetrics: any[]): number {
    if (customerMetrics.length === 0) return 0;
    const repeatCustomers = customerMetrics.filter(c => (c.totalBookings + c.totalOrders) > 1).length;
    return Math.round((repeatCustomers / customerMetrics.length) * 100);
  }

  function segmentCustomers(customerMetrics: any[]): any[] {
    const segments = {
      vip: customerMetrics.filter(c => c.totalSpend > 50000),
      loyal: customerMetrics.filter(c => c.totalSpend > 20000 && c.totalSpend <= 50000),
      regular: customerMetrics.filter(c => c.totalSpend > 5000 && c.totalSpend <= 20000),
      new: customerMetrics.filter(c => c.totalSpend <= 5000)
    };
    
    return Object.entries(segments).map(([segment, customers]) => ({
      segment,
      count: customers.length,
      avgSpend: customers.length > 0 ? 
        Math.round(customers.reduce((sum, c) => sum + c.totalSpend, 0) / customers.length) : 0
    }));
  }
}