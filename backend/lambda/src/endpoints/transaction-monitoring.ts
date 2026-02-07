/**
 * ============================================================================
 * TRANSACTION MONITORING ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles transaction monitoring and analytics:
 * - Transaction statistics
 * - Transaction listing with filters
 * - Transaction export
 * - Performance metrics
 * 
 * Migrated from: supabase/functions/server/transaction-monitoring-endpoints.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

function getDateRange(range: string): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();

  switch (range) {
    case '1d':
      startDate.setDate(endDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(endDate.getDate() - 7);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export function registerTransactionMonitoringEndpoints(app: Hono) {
  /**
   * GET /admin/transactions/stats
   * Get transaction statistics
   */
  app.get("/admin/transactions/stats", async (c) => {
    try {
      const range = c.req.query('range') || '7d';
      const { startDate, endDate } = getDateRange(range);

      // Get payments in range
      const payments = await query(
        `SELECT * FROM payments 
         WHERE created_at >= $1 AND created_at <= $2`,
        [startDate, endDate]
      ).catch(() => ({ rows: [] }));

      // Get refunds in range
      const refunds = await query(
        `SELECT * FROM refunds 
         WHERE created_at >= $1 AND created_at <= $2`,
        [startDate, endDate]
      ).catch(() => ({ rows: [] }));

      const totalTransactions = payments.rows.length;
      const totalVolume = payments.rows.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);

      const completedPayments = payments.rows.filter((p: any) => p.payment_status === 'paid');
      const pendingPayments = payments.rows.filter((p: any) => p.payment_status === 'pending');
      const failedPayments = payments.rows.filter((p: any) => p.payment_status === 'failed');

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
        refundCount: refunds.rows.length,
        range,
      };

      return c.json({ success: true, stats });
    } catch (error: any) {
      console.error('Transaction Stats Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/transactions
   * Get paginated transaction list with filters
   */
  app.get("/admin/transactions", async (c) => {
    try {
      const page = parseInt(c.req.query('page') || '1', 10);
      const perPage = parseInt(c.req.query('perPage') || '50', 10);
      const status = c.req.query('status') || 'all';
      const range = c.req.query('range') || '7d';

      const { startDate, endDate } = getDateRange(range);

      let queryText = `SELECT * FROM payments 
                       WHERE created_at >= $1 AND created_at <= $2`;
      const params: any[] = [startDate, endDate];
      let paramIndex = 3;

      if (status !== 'all') {
        queryText += ` AND payment_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(perPage, (page - 1) * perPage);

      const result = await query(queryText, params).catch(() => ({ rows: [] }));

      // Get total count
      let countQuery = `SELECT COUNT(*) as count FROM payments 
                        WHERE created_at >= $1 AND created_at <= $2`;
      const countParams: any[] = [startDate, endDate];
      if (status !== 'all') {
        countQuery += ` AND payment_status = $3`;
        countParams.push(status);
      }
      const countResult = await query(countQuery, countParams).catch(() => ({ rows: [{ count: '0' }] }));
      const totalCount = parseInt(countResult.rows[0]?.count || '0', 10);

      // Enrich with customer and vendor info
      const enrichedTransactions = await Promise.all(
        result.rows.map(async (payment: any) => {
          let customer = 'Unknown';
          let vendor = 'Unknown';

          if (payment.customer_id) {
            const customers = await select('customers', { id: payment.customer_id }).catch(() => []);
            if (customers.length > 0) {
              customer = customers[0].full_name || customers[0].phone || 'Unknown';
            }
          }

          if (payment.vendor_id) {
            const vendors = await select('vendors', { id: payment.vendor_id }).catch(() => []);
            if (vendors.length > 0) {
              vendor = vendors[0].business_name || vendors[0].owner_name || 'Unknown';
            }
          }

          let type = 'booking';
          if (payment.order_id) type = 'order';
          if (payment.subscription_id) type = 'subscription';

          return {
            id: payment.id,
            type,
            amount: parseFloat(payment.amount || '0'),
            status: payment.payment_status || 'unknown',
            paymentMethod: payment.payment_method || 'unknown',
            customer,
            vendor,
            createdAt: payment.created_at || new Date().toISOString(),
            razorpayId: payment.razorpay_payment_id || payment.razorpay_order_id,
            gateway: payment.payment_method || 'razorpay',
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
          totalPages: Math.ceil(totalCount / perPage),
        },
      });
    } catch (error: any) {
      console.error('Get Transactions Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/transactions/export
   * Export transactions as CSV
   */
  app.get("/admin/transactions/export", async (c) => {
    try {
      const range = c.req.query('range') || '7d';
      const { startDate, endDate } = getDateRange(range);

      const payments = await query(
        `SELECT * FROM payments 
         WHERE created_at >= $1 AND created_at <= $2 
         ORDER BY created_at DESC`,
        [startDate, endDate]
      ).catch(() => ({ rows: [] }));

      // Generate CSV
      const headers = ['ID', 'Amount', 'Status', 'Payment Method', 'Customer ID', 'Vendor ID', 'Created At'];
      const rows = payments.rows.map((p: any) => [
        p.id,
        p.amount,
        p.payment_status,
        p.payment_method,
        p.customer_id,
        p.vendor_id,
        p.created_at,
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      return c.text(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="transactions-${startDate}-${endDate}.csv"`,
      });
    } catch (error: any) {
      console.error('Export Transactions Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

