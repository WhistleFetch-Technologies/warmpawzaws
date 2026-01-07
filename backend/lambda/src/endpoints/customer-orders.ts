/**
 * ============================================================================
 * CUSTOMER ORDERS ENDPOINTS
 * ============================================================================
 * 
 * Handles customer order management:
 * - List orders
 * - Get order details
 * - Get order invoice
 * 
 * Date: 2026-01-07
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query } from '../database/rds-connection';

// ============================================================================
// GET /customer/orders - List all orders for customer
// ============================================================================

class GetCustomerOrdersHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const customerId = context.event.pathParameters?.customerId || 
                        context.event.queryStringParameters?.customerId ||
                        context.userId;
      
      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      const status = context.event.queryStringParameters?.status;
      const limit = parseInt(context.event.queryStringParameters?.limit || '50', 10);
      const offset = parseInt(context.event.queryStringParameters?.offset || '0', 10);

      let ordersQuery = `
        SELECT 
          o.id,
          o.order_number,
          o.customer_id,
          o.vendor_id,
          o.total_amount,
          o.discount_amount,
          o.final_amount,
          o.status,
          o.payment_status,
          o.payment_method,
          o.delivery_address,
          o.delivery_status,
          o.tracking_number,
          o.created_at,
          o.updated_at,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.address as vendor_address
        FROM orders o
        LEFT JOIN vendors v ON o.vendor_id = v.id
        WHERE o.customer_id = $1
      `;

      const params: any[] = [customerId];
      let paramIndex = 2;

      if (status) {
        ordersQuery += ` AND o.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      ordersQuery += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const orders = await query(ordersQuery, params);

      // Get order items for each order
      const orderIds = orders.rows.map((o: any) => o.id);
      let itemsQuery = `
        SELECT 
          oi.*,
          s.name as service_name,
          p.name as product_name
        FROM order_items oi
        LEFT JOIN services s ON oi.service_id = s.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ANY($1)
      `;
      const items = orderIds.length > 0 ? await query(itemsQuery, [orderIds]) : { rows: [] };

      // Group items by order_id
      const itemsByOrder: Record<string, any[]> = {};
      items.rows.forEach((item: any) => {
        if (!itemsByOrder[item.order_id]) {
          itemsByOrder[item.order_id] = [];
        }
        itemsByOrder[item.order_id].push(item);
      });

      // Attach items to orders
      const ordersWithItems = orders.rows.map((order: any) => ({
        ...order,
        items: itemsByOrder[order.id] || []
      }));

      // Get statistics
      const statsQuery = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
          COUNT(*) FILTER (WHERE status = 'processing') as processing,
          COUNT(*) FILTER (WHERE status = 'shipped') as shipped,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          SUM(final_amount) FILTER (WHERE status != 'cancelled') as total_spent
        FROM orders
        WHERE customer_id = $1
      `, [customerId]);

      return this.success({
        orders: ordersWithItems,
        stats: statsQuery.rows[0],
        pagination: {
          limit,
          offset,
          total: orders.rows.length
        }
      });
    } catch (error: any) {
      console.error('Error fetching customer orders:', error);
      return this.error(error.message || 'Failed to fetch orders', 500);
    }
  }
}

// ============================================================================
// GET /customer/orders/:id - Get order details
// ============================================================================

class GetOrderDetailsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const orderId = context.event.pathParameters?.id;
      const customerId = context.event.pathParameters?.customerId || 
                        context.event.queryStringParameters?.customerId ||
                        context.userId;

      if (!orderId) {
        return this.error('Order ID is required', 400);
      }

      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      // Get order details
      const order = await query(`
        SELECT 
          o.*,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.email as vendor_email,
          v.address as vendor_address,
          c.name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email
        FROM orders o
        LEFT JOIN vendors v ON o.vendor_id = v.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = $1 AND o.customer_id = $2
      `, [orderId, customerId]);

      if (order.rows.length === 0) {
        return this.error('Order not found', 404);
      }

      // Get order items
      const items = await query(`
        SELECT 
          oi.*,
          s.name as service_name,
          s.description as service_description,
          p.name as product_name,
          p.description as product_description,
          p.image_url as product_image
        FROM order_items oi
        LEFT JOIN services s ON oi.service_id = s.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
        ORDER BY oi.created_at ASC
      `, [orderId]);

      // Get order status history
      const history = await query(`
        SELECT * FROM order_status_history
        WHERE order_id = $1
        ORDER BY created_at ASC
      `, [orderId]);

      // Get delivery tracking if exists
      const tracking = await query(`
        SELECT * FROM delivery_tracking
        WHERE order_id = $1
        ORDER BY created_at DESC
      `, [orderId]);

      return this.success({
        order: order.rows[0],
        items: items.rows,
        history: history.rows,
        tracking: tracking.rows
      });
    } catch (error: any) {
      console.error('Error fetching order details:', error);
      return this.error(error.message || 'Failed to fetch order details', 500);
    }
  }
}

// ============================================================================
// GET /customer/orders/:id/invoice - Get order invoice
// ============================================================================

class GetOrderInvoiceHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const orderId = context.event.pathParameters?.id;
      const customerId = context.event.pathParameters?.customerId || 
                        context.event.queryStringParameters?.customerId ||
                        context.userId;

      if (!orderId) {
        return this.error('Order ID is required', 400);
      }

      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      // Get order with all details
      const order = await query(`
        SELECT 
          o.*,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.email as vendor_email,
          v.address as vendor_address,
          v.gst_number as vendor_gst,
          c.name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email,
          c.address as customer_address
        FROM orders o
        LEFT JOIN vendors v ON o.vendor_id = v.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = $1 AND o.customer_id = $2
      `, [orderId, customerId]);

      if (order.rows.length === 0) {
        return this.error('Order not found', 404);
      }

      // Get order items with HSN codes
      const items = await query(`
        SELECT 
          oi.*,
          s.name as service_name,
          s.hsn_code as service_hsn_code,
          p.name as product_name,
          p.hsn_code as product_hsn_code
        FROM order_items oi
        LEFT JOIN services s ON oi.service_id = s.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
        ORDER BY oi.created_at ASC
      `, [orderId]);

      // Get tax breakdown from order or recalculate
      let taxBreakdown = null;
      let hsnSummary = [];
      
      if (order.rows[0].tax_breakdown) {
        try {
          taxBreakdown = typeof order.rows[0].tax_breakdown === 'string'
            ? JSON.parse(order.rows[0].tax_breakdown)
            : order.rows[0].tax_breakdown;
          hsnSummary = taxBreakdown?.hsnSummary || [];
        } catch (e) {
          console.error('Error parsing tax breakdown:', e);
        }
      }

      // If no tax breakdown, try to reconstruct from order data
      if (!taxBreakdown && items.rows.length > 0) {
        try {
          const { taxCalculationService } = await import('../lib/services/tax-calculation-service');
          
          // Get customer and vendor locations
          let customerLocation = null;
          let vendorLocation = null;
          
          if (order.rows[0].customer_address) {
            const addr = typeof order.rows[0].customer_address === 'string'
              ? JSON.parse(order.rows[0].customer_address)
              : order.rows[0].customer_address;
            customerLocation = {
              state: addr?.state,
              city: addr?.city,
              pincode: addr?.pincode,
            };
          }

          if (order.rows[0].vendor_address) {
            const addr = typeof order.rows[0].vendor_address === 'string'
              ? JSON.parse(order.rows[0].vendor_address)
              : order.rows[0].vendor_address;
            vendorLocation = {
              state: addr?.state,
              city: addr?.city,
            };
          }

          // Build tax calculation items
          const taxItems = items.rows.map((item: any) => ({
            id: item.product_id || item.service_id || item.id,
            type: item.product_id ? 'product' as const : 'service' as const,
            hsnCode: item.product_hsn_code || item.service_hsn_code,
            amount: parseFloat(item.unit_price || 0),
            quantity: item.quantity || 1,
            category: item.category,
          }));

          if (taxItems.length > 0) {
            taxBreakdown = await taxCalculationService.calculateTax({
              items: taxItems,
              customerLocation,
              vendorLocation,
              vendorId: order.rows[0].vendor_id || undefined,
            });
            hsnSummary = taxBreakdown.hsnSummary || [];
          }
        } catch (taxError) {
          console.error('Error recalculating tax for invoice:', taxError);
        }
      }

      // Calculate totals
      const subtotal = items.rows.reduce((sum: number, item: any) => 
        sum + (item.quantity * item.unit_price), 0);
      const tax = order.rows[0].tax_amount || taxBreakdown?.totalTax || 0;
      const cgst = order.rows[0].cgst_amount || taxBreakdown?.totalCGST || 0;
      const sgst = order.rows[0].sgst_amount || taxBreakdown?.totalSGST || 0;
      const igst = order.rows[0].igst_amount || taxBreakdown?.totalIGST || 0;
      const discount = order.rows[0].discount_amount || 0;
      const finalAmount = order.rows[0].total_amount || order.rows[0].final_amount;

      // Enhance items with HSN codes
      const enhancedItems = items.rows.map((item: any) => ({
        ...item,
        hsn_code: item.product_hsn_code || item.service_hsn_code,
      }));

      const invoice = {
        invoice_number: `INV-${order.rows[0].order_number}`,
        invoice_date: order.rows[0].created_at,
        order: order.rows[0],
        vendor: {
          name: order.rows[0].vendor_name,
          phone: order.rows[0].vendor_phone,
          email: order.rows[0].vendor_email,
          address: order.rows[0].vendor_address,
          gst: order.rows[0].vendor_gst
        },
        customer: {
          name: order.rows[0].customer_name,
          phone: order.rows[0].customer_phone,
          email: order.rows[0].customer_email,
          address: order.rows[0].customer_address || order.rows[0].delivery_address
        },
        items: enhancedItems,
        totals: {
          subtotal,
          tax,
          cgst,
          sgst,
          igst,
          discount,
          final_amount: finalAmount
        },
        tax_breakdown: taxBreakdown ? {
          items: taxBreakdown.items,
          summary: taxBreakdown.hsnSummary,
          isInterstate: taxBreakdown.isInterstate,
        } : null,
        hsn_codes: hsnSummary.map((hsn: any) => ({
          hsnCode: hsn.hsnCode,
          description: hsn.description,
          taxableAmount: hsn.taxableAmount,
          gstRate: hsn.gstRate,
          cgstAmount: hsn.cgstAmount,
          sgstAmount: hsn.sgstAmount,
          igstAmount: hsn.igstAmount,
          totalTax: hsn.totalTax,
        })),
      };

      return this.success({ invoice });
    } catch (error: any) {
      console.error('Error fetching invoice:', error);
      return this.error(error.message || 'Failed to fetch invoice', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerCustomerOrdersEndpoints(app: Hono) {
  const getOrdersHandler = new GetCustomerOrdersHandler();
  const getDetailsHandler = new GetOrderDetailsHandler();
  const getInvoiceHandler = new GetOrderInvoiceHandler();

  app.get('/customer/orders', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getOrdersHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/customer/orders/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getDetailsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/customer/orders/:id/invoice', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getInvoiceHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

// Helper to convert Hono request to API Gateway event (for compatibility)
function createApiGatewayEvent(req: any): any {
  return {
    pathParameters: req.param ? Object.fromEntries(Object.entries(req.param())) : {},
    queryStringParameters: req.query ? Object.fromEntries(Object.entries(req.query())) : {},
    body: req.body ? JSON.stringify(req.body) : null,
    headers: req.header ? Object.fromEntries(Object.entries(req.header())) : {},
    requestContext: {
      authorizer: {
        claims: {
          sub: req.header?.('x-user-id') || 'test-user'
        }
      }
    }
  };
}

function createLambdaContext(): any {
  return {};
}

