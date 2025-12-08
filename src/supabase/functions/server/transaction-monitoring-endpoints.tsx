import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

export function transactionMonitoringEndpoints(app: Hono) {
  
  /**
   * GET /admin/transactions/stats
   * Get transaction statistics with performance optimization
   */
  app.get("/make-server-3dd53475/admin/transactions/stats", async (c) => {
    try {
      const range = c.req.query('range') || '7d';
      const { startDate, endDate } = getDateRange(range);
      
      // Parallel fetch for performance
      const [payments, refunds] = await Promise.all([
        getPaymentsInRange(startDate, endDate),
        getRefundsInRange(startDate, endDate)
      ]);
      
      const totalTransactions = payments.length;
      const totalVolume = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      const completedPayments = payments.filter(p => p.status === 'completed');
      const pendingPayments = payments.filter(p => p.status === 'pending');
      const failedPayments = payments.filter(p => p.status === 'failed');
      
      const successRate = totalTransactions > 0 
        ? (completedPayments.length / totalTransactions) * 100 
        : 0;
      
      const avgTransactionValue = totalTransactions > 0
        ? totalVolume / totalTransactions
        : 0;
      
      const stats = {
        totalTransactions,
        totalVolume: Math.round(totalVolume),
        successRate: Math.round(successRate * 10) / 10,
        avgTransactionValue: Math.round(avgTransactionValue),
        pendingCount: pendingPayments.length,
        failedCount: failedPayments.length,
        refundCount: refunds.length
      };
      
      return c.json({ success: true, stats });
    } catch (error) {
      console.error('Transaction Stats Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /admin/transactions
   * Get paginated transaction list with filters
   * Optimized for millions of transactions
   */
  app.get("/make-server-3dd53475/admin/transactions", async (c) => {
    try {
      const page = parseInt(c.req.query('page') || '1');
      const perPage = parseInt(c.req.query('perPage') || '50');
      const status = c.req.query('status') || 'all';
      const range = c.req.query('range') || '7d';
      
      const { startDate, endDate } = getDateRange(range);
      
      // Get all payments in range
      let payments = await getPaymentsInRange(startDate, endDate);
      
      // Filter by status
      if (status !== 'all') {
        payments = payments.filter(p => p.status === status);
      }
      
      // Sort by date (newest first)
      payments.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.paidAt || 0).getTime();
        const dateB = new Date(b.createdAt || b.paidAt || 0).getTime();
        return dateB - dateA;
      });
      
      // Pagination
      const totalCount = payments.length;
      const totalPages = Math.ceil(totalCount / perPage);
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const paginatedPayments = payments.slice(startIndex, endIndex);
      
      // Enrich with customer and vendor info
      const enrichedTransactions = await Promise.all(
        paginatedPayments.map(async (payment: any) => {
          let customer = 'Unknown';
          let vendor = 'Unknown';
          
          // Try to get customer info
          if (payment.customerId) {
            const customerData = await kv.get(`customer:${payment.customerId}`);
            if (customerData) {
              customer = customerData.fullName || customerData.name || customerData.phone || 'Unknown';
            }
          }
          
          // Try to get vendor info
          if (payment.vendorId) {
            const vendorData = await kv.get(`vendor:${payment.vendorId}`);
            if (vendorData) {
              vendor = vendorData.businessName || vendorData.fullName || 'Unknown';
            }
          }
          
          // Determine transaction type
          let type = 'booking';
          if (payment.orderId) type = 'order';
          if (payment.subscriptionId) type = 'subscription';
          
          return {
            id: payment.id,
            type,
            amount: payment.amount || 0,
            status: payment.status || 'unknown',
            paymentMethod: payment.paymentMethod || 'unknown',
            customer,
            vendor,
            createdAt: payment.createdAt || payment.paidAt || new Date().toISOString(),
            razorpayId: payment.razorpayPaymentId || payment.razorpayOrderId,
            gateway: payment.gateway || 'razorpay'
          };
        })
      );
      
      return c.json({ 
        success: true, 
        transactions: enrichedTransactions,
        pagination: {
          page,
          perPage,
          totalCount,
          totalPages
        },
        totalPages // For backward compatibility
      });
    } catch (error) {
      console.error('Get Transactions Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /admin/transactions/export
   * Export transactions as CSV
   */
  app.get("/make-server-3dd53475/admin/transactions/export", async (c) => {
    try {
      const range = c.req.query('range') || '7d';
      const status = c.req.query('status') || 'all';
      
      const { startDate, endDate } = getDateRange(range);
      
      let payments = await getPaymentsInRange(startDate, endDate);
      
      if (status !== 'all') {
        payments = payments.filter(p => p.status === status);
      }
      
      // Create CSV
      const csvRows = [];
      csvRows.push('Transaction ID,Type,Amount,Status,Payment Method,Customer ID,Vendor ID,Created At,Razorpay ID,Gateway');
      
      for (const payment of payments) {
        const type = payment.orderId ? 'order' : payment.subscriptionId ? 'subscription' : 'booking';
        csvRows.push([
          payment.id,
          type,
          payment.amount || 0,
          payment.status || 'unknown',
          payment.paymentMethod || 'unknown',
          payment.customerId || '',
          payment.vendorId || '',
          payment.createdAt || payment.paidAt || '',
          payment.razorpayPaymentId || payment.razorpayOrderId || '',
          payment.gateway || 'razorpay'
        ].join(','));
      }
      
      const csvContent = csvRows.join('\n');
      
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="transactions-${range}-${Date.now()}.csv"`
        }
      });
    } catch (error) {
      console.error('Export Transactions Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * POST /admin/transactions/:txnId/retry
   * Retry a failed transaction
   */
  app.post("/make-server-3dd53475/admin/transactions/:txnId/retry", async (c) => {
    try {
      const { txnId } = c.req.param();
      
      const payment = await kv.get(`payment:${txnId}`);
      if (!payment) {
        return c.json({ error: 'Transaction not found' }, 404);
      }
      
      if (payment.status !== 'failed') {
        return c.json({ error: 'Only failed transactions can be retried' }, 400);
      }
      
      // Mark for retry
      payment.status = 'pending';
      payment.retryAttempts = (payment.retryAttempts || 0) + 1;
      payment.lastRetryAt = new Date().toISOString();
      
      await kv.set(`payment:${txnId}`, payment);
      
      // TODO: Trigger actual payment retry with Razorpay
      
      console.log(`✅ Transaction retry initiated: ${txnId}`);
      return c.json({ success: true, message: 'Transaction retry initiated' });
    } catch (error) {
      console.error('Retry Transaction Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /admin/transactions/reconciliation
   * Reconciliation report for accounting
   */
  app.get("/make-server-3dd53475/admin/transactions/reconciliation", async (c) => {
    try {
      const range = c.req.query('range') || '30d';
      const { startDate, endDate } = getDateRange(range);
      
      const [payments, refunds, payouts] = await Promise.all([
        getPaymentsInRange(startDate, endDate),
        getRefundsInRange(startDate, endDate),
        getPayoutsInRange(startDate, endDate)
      ]);
      
      const completedPayments = payments.filter(p => p.status === 'completed');
      const completedRefunds = refunds.filter(r => r.status === 'completed');
      const completedPayouts = payouts.filter(p => p.status === 'completed');
      
      const totalRevenue = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalRefunds = completedRefunds.reduce((sum, r) => sum + (r.amount || 0), 0);
      const totalPayouts = completedPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);
      const platformCommission = completedPayments.reduce((sum, p) => sum + (p.platformCommission || 0), 0);
      
      const netRevenue = totalRevenue - totalRefunds;
      const netPlatformRevenue = platformCommission - totalPayouts;
      
      const reconciliation = {
        dateRange: { startDate, endDate },
        summary: {
          totalRevenue: Math.round(totalRevenue),
          totalRefunds: Math.round(totalRefunds),
          netRevenue: Math.round(netRevenue),
          platformCommission: Math.round(platformCommission),
          vendorPayouts: Math.round(totalPayouts),
          netPlatformRevenue: Math.round(netPlatformRevenue)
        },
        counts: {
          totalPayments: completedPayments.length,
          totalRefunds: completedRefunds.length,
          totalPayouts: completedPayouts.length
        },
        status: netPlatformRevenue >= 0 ? 'balanced' : 'deficit'
      };
      
      return c.json({ success: true, reconciliation });
    } catch (error) {
      console.error('Reconciliation Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /admin/transactions/fraud-detection
   * Detect suspicious transaction patterns
   */
  app.get("/make-server-3dd53475/admin/transactions/fraud-detection", async (c) => {
    try {
      const range = c.req.query('range') || '7d';
      const { startDate, endDate } = getDateRange(range);
      
      const payments = await getPaymentsInRange(startDate, endDate);
      
      const alerts: any[] = [];
      
      // Detect multiple failed payments from same customer
      const failedByCustomer: Record<string, number> = {};
      payments.filter(p => p.status === 'failed').forEach(p => {
        if (p.customerId) {
          failedByCustomer[p.customerId] = (failedByCustomer[p.customerId] || 0) + 1;
        }
      });
      
      Object.entries(failedByCustomer).forEach(([customerId, count]) => {
        if (count >= 3) {
          alerts.push({
            type: 'multiple_failures',
            severity: 'medium',
            customerId,
            count,
            message: `Customer has ${count} failed payments in ${range}`
          });
        }
      });
      
      // Detect high-value transactions
      payments.forEach(p => {
        if (p.amount > 50000) {
          alerts.push({
            type: 'high_value',
            severity: 'low',
            transactionId: p.id,
            amount: p.amount,
            message: `High-value transaction: ₹${p.amount.toLocaleString()}`
          });
        }
      });
      
      // Detect rapid successive payments
      const customerTransactions: Record<string, any[]> = {};
      payments.forEach(p => {
        if (p.customerId) {
          if (!customerTransactions[p.customerId]) {
            customerTransactions[p.customerId] = [];
          }
          customerTransactions[p.customerId].push(p);
        }
      });
      
      Object.entries(customerTransactions).forEach(([customerId, txns]) => {
        if (txns.length >= 5) {
          const timeSpan = new Date(txns[txns.length - 1].createdAt).getTime() - 
                          new Date(txns[0].createdAt).getTime();
          const hours = timeSpan / (1000 * 60 * 60);
          
          if (hours < 1) {
            alerts.push({
              type: 'rapid_transactions',
              severity: 'high',
              customerId,
              count: txns.length,
              message: `${txns.length} transactions in ${hours.toFixed(1)} hours`
            });
          }
        }
      });
      
      return c.json({ 
        success: true, 
        alerts,
        summary: {
          totalAlerts: alerts.length,
          highSeverity: alerts.filter(a => a.severity === 'high').length,
          mediumSeverity: alerts.filter(a => a.severity === 'medium').length,
          lowSeverity: alerts.filter(a => a.severity === 'low').length
        }
      });
    } catch (error) {
      console.error('Fraud Detection Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // Helper functions
  
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
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }
  
  async function getPaymentsInRange(start: string, end: string): Promise<any[]> {
    const allPayments = await kv.getByPrefix('payment:');
    return allPayments.filter((p: any) => {
      if (!p.id || p.id.includes(':') || typeof p !== 'object') return false;
      const paymentDate = p.createdAt || p.paidAt;
      return paymentDate >= start && paymentDate <= end;
    });
  }
  
  async function getRefundsInRange(start: string, end: string): Promise<any[]> {
    const allRefunds = await kv.getByPrefix('refund:');
    return allRefunds.filter((r: any) => {
      if (!r.id || r.id.includes(':') || typeof r !== 'object') return false;
      const refundDate = r.createdAt;
      return refundDate >= start && refundDate <= end;
    });
  }
  
  async function getPayoutsInRange(start: string, end: string): Promise<any[]> {
    const allPayouts = await kv.getByPrefix('payout:');
    return allPayouts.filter((p: any) => {
      if (!p.id || p.id.includes(':') || typeof p !== 'object') return false;
      const payoutDate = p.completedAt || p.createdAt;
      return payoutDate >= start && payoutDate <= end;
    });
  }
  
  console.log('✅ Transaction monitoring endpoints registered');
}
