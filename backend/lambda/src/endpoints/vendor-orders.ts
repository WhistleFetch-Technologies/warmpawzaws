/**
 * ============================================================================
 * VENDOR ORDER MANAGEMENT ENDPOINTS
 * ============================================================================
 * 
 * Handles vendor order management:
 * - List vendor orders
 * - Get order statistics
 * - Filter by status/date
 * 
 * Date: 2026-01-XX
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query } from '../database/rds-connection';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';

// ============================================================================
// GET /vendor/:vendorId/orders - List vendor orders
// ============================================================================

class GetVendorOrdersHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const status = context.event.queryStringParameters?.status;
      const dateFilter = context.event.queryStringParameters?.dateFilter || 'all';
      const search = context.event.queryStringParameters?.search;
      const limit = parseInt(context.event.queryStringParameters?.limit || '50', 10);
      const offset = parseInt(context.event.queryStringParameters?.offset || '0', 10);

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      // Verify vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return this.error('Vendor not found', 404);
      }

      // Build date filter
      let dateFilterClause = '';
      if (dateFilter === 'today') {
        dateFilterClause = `AND DATE(o.created_at) = CURRENT_DATE`;
      } else if (dateFilter === 'week') {
        dateFilterClause = `AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'`;
      } else if (dateFilter === 'month') {
        dateFilterClause = `AND o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
      }

      // Build status filter
      let statusFilter = '';
      if (status && status !== 'all') {
        statusFilter = `AND o.order_status = '${status}'`;
      }

      // Build search filter
      let searchFilter = '';
      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (search) {
        searchFilter = `AND (o.order_number ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Build query
      const ordersQuery = `
        SELECT 
          o.*,
          c.name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.vendor_id = $1
          ${dateFilterClause}
          ${statusFilter}
          ${searchFilter}
        ORDER BY o.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const orders = await query(ordersQuery, params);

      // Get order items for each order
      const ordersWithItems = await Promise.all(
        orders.rows.map(async (order: any) => {
          const items = await query(
            `SELECT 
               oi.*,
               p.name as product_name,
               p.images
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = $1`,
            [order.id]
          );
          return {
            ...order,
            items: items.rows,
          };
        })
      );

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM orders o
        WHERE o.vendor_id = $1
          ${dateFilterClause}
          ${statusFilter}
          ${searchFilter}
      `;
      const countParams = params.slice(0, -2); // Remove limit and offset
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      return this.success({
        orders: ordersWithItems,
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error fetching vendor orders:', error);
      return this.error(error.message || 'Failed to fetch orders', 500);
    }
  }
}

// ============================================================================
// GET /vendor/:vendorId/orders/stats - Get order statistics
// ============================================================================

class GetVendorOrderStatsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const dateFilter = context.event.queryStringParameters?.dateFilter || 'all';

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      // Build date filter
      let dateFilterClause = '';
      if (dateFilter === 'today') {
        dateFilterClause = `AND DATE(created_at) = CURRENT_DATE`;
      } else if (dateFilter === 'week') {
        dateFilterClause = `AND created_at >= CURRENT_DATE - INTERVAL '7 days'`;
      } else if (dateFilter === 'month') {
        dateFilterClause = `AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
      }

      // Get statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE order_status = 'pending') as pending,
          COUNT(*) FILTER (WHERE order_status = 'confirmed') as confirmed,
          COUNT(*) FILTER (WHERE order_status = 'processing') as processing,
          COUNT(*) FILTER (WHERE order_status = 'shipped') as shipped,
          COUNT(*) FILTER (WHERE order_status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE order_status = 'cancelled') as cancelled,
          COALESCE(SUM(total_amount) FILTER (WHERE order_status != 'cancelled'), 0) as total_revenue
        FROM orders
        WHERE vendor_id = $1
          ${dateFilterClause}
      `;

      const stats = await query(statsQuery, [vendorId]);

      return this.success({
        stats: stats.rows[0],
      });
    } catch (error: any) {
      console.error('Error fetching order statistics:', error);
      return this.error(error.message || 'Failed to fetch statistics', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerVendorOrdersEndpoints(app: Hono) {
  const getOrdersHandler = new GetVendorOrdersHandler();
  const getStatsHandler = new GetVendorOrderStatsHandler();

  app.get('/vendor/:vendorId/orders', async (c) => {
    const response = await getOrdersHandler.handle({
      event: {
        pathParameters: c.req.param(),
        queryStringParameters: Object.fromEntries(c.req.query()),
      } as any,
    } as HandlerContext);
    return c.json(response.body, response.statusCode);
  });

  app.get('/vendor/:vendorId/orders/stats', async (c) => {
    const response = await getStatsHandler.handle({
      event: {
        pathParameters: c.req.param(),
        queryStringParameters: Object.fromEntries(c.req.query()),
      } as any,
    } as HandlerContext);
    return c.json(response.body, response.statusCode);
  });
}

