"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCustomerOrdersEndpoints = registerCustomerOrdersEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
// ============================================================================
// GET /customer/orders - List all orders for customer
// ============================================================================
class GetCustomerOrdersHandler extends base_handler_1.BaseHandler {
    async handle(context) {
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
            const params = [customerId];
            let paramIndex = 2;
            if (status) {
                ordersQuery += ` AND o.status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }
            ordersQuery += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);
            const orders = await (0, rds_connection_1.query)(ordersQuery, params);
            // Get order items for each order
            const orderIds = orders.rows.map((o) => o.id);
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
            const items = orderIds.length > 0 ? await (0, rds_connection_1.query)(itemsQuery, [orderIds]) : { rows: [] };
            // Group items by order_id
            const itemsByOrder = {};
            items.rows.forEach((item) => {
                if (!itemsByOrder[item.order_id]) {
                    itemsByOrder[item.order_id] = [];
                }
                itemsByOrder[item.order_id].push(item);
            });
            // Attach items to orders
            const ordersWithItems = orders.rows.map((order) => ({
                ...order,
                items: itemsByOrder[order.id] || []
            }));
            // Get statistics
            const statsQuery = await (0, rds_connection_1.query)(`
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
        }
        catch (error) {
            console.error('Error fetching customer orders:', error);
            return this.error(error.message || 'Failed to fetch orders', 500);
        }
    }
}
// ============================================================================
// GET /customer/orders/:id - Get order details
// ============================================================================
class GetOrderDetailsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
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
            const order = await (0, rds_connection_1.query)(`
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
            const items = await (0, rds_connection_1.query)(`
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
            const history = await (0, rds_connection_1.query)(`
        SELECT * FROM order_status_history
        WHERE order_id = $1
        ORDER BY created_at ASC
      `, [orderId]);
            // Get delivery tracking if exists
            const tracking = await (0, rds_connection_1.query)(`
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
        }
        catch (error) {
            console.error('Error fetching order details:', error);
            return this.error(error.message || 'Failed to fetch order details', 500);
        }
    }
}
// ============================================================================
// GET /customer/orders/:id/invoice - Get order invoice
// ============================================================================
class GetOrderInvoiceHandler extends base_handler_1.BaseHandler {
    async handle(context) {
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
            const order = await (0, rds_connection_1.query)(`
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
            // Get order items
            const items = await (0, rds_connection_1.query)(`
        SELECT 
          oi.*,
          s.name as service_name,
          p.name as product_name
        FROM order_items oi
        LEFT JOIN services s ON oi.service_id = s.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
        ORDER BY oi.created_at ASC
      `, [orderId]);
            // Calculate totals
            const subtotal = items.rows.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
            const tax = order.rows[0].tax_amount || 0;
            const discount = order.rows[0].discount_amount || 0;
            const finalAmount = order.rows[0].final_amount;
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
                items: items.rows,
                totals: {
                    subtotal,
                    tax,
                    discount,
                    final_amount: finalAmount
                }
            };
            return this.success({ invoice });
        }
        catch (error) {
            console.error('Error fetching invoice:', error);
            return this.error(error.message || 'Failed to fetch invoice', 500);
        }
    }
}
// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================
function registerCustomerOrdersEndpoints(app) {
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
function createApiGatewayEvent(req) {
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
function createLambdaContext() {
    return {};
}
//# sourceMappingURL=customer-orders.js.map