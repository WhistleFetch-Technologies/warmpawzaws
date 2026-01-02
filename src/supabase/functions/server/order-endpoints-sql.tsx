/**
 * ============================================================================
 * SQL-BASED ORDER ENDPOINTS
 * ============================================================================
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All operations wrapped in transactions
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { getDbClient, withTransaction } from "../../lib/db";
import { getPaymentsRepository } from "../../lib/repositories/payments";

export function orderEndpointsSQL(app: Hono) {
  const client = getDbClient();
  const paymentsRepo = getPaymentsRepository();

  /**
   * Create order - SQL-BASED
   * POST /make-server-3dd53475/orders/create
   */
  app.post("/make-server-3dd53475/orders/create", async (c) => {
    try {
      const orderData = await c.req.json();
      const { customerId, items, shippingAddress, paymentMethod } = orderData;

      if (!customerId || !items || items.length === 0) {
        return sendError(c, 'Missing required fields', 400);
      }

      return await withTransaction(async (txClient) => {
        // Calculate totals
        let subtotal = 0;
        let taxAmount = 0;
        let discountAmount = 0;

        for (const item of items) {
          subtotal += (item.price || 0) * (item.quantity || 1);
        }

        // Calculate GST using centralized service
        const { calculateGST } = await import("../../lib/services/gst-service.ts");
        const gstCalculation = await calculateGST(subtotal);
        taxAmount = gstCalculation.gstAmount;
        const totalAmount = subtotal + taxAmount - discountAmount;

        // Create order
        const { data: order, error: orderError } = await txClient
          .from('orders')
          .insert({
            customer_id: customerId,
            order_status: 'pending',
            subtotal,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            total_amount: totalAmount,
            shipping_address: shippingAddress ? JSON.stringify(shippingAddress) : null,
            payment_method: paymentMethod || 'razorpay',
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Create order items
        const orderItems = items.map((item: any) => ({
          order_id: order.id,
          product_id: item.productId,
          name: item.name || item.productName || 'Product',
          quantity: item.quantity || 1,
          unit_price: item.price,
          total_price: (item.price || 0) * (item.quantity || 1),
        }));

        const { error: itemsError } = await txClient
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;

        return sendSuccess(c, { order });
      });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to create order', 500);
    }
  });

  /**
   * Get order by ID - SQL-BASED
   * GET /make-server-3dd53475/orders/:orderId
   */
  app.get("/make-server-3dd53475/orders/:orderId", async (c) => {
    try {
      const { orderId } = c.req.param();

      const { data: order, error } = await client
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('id', orderId)
        .single();

      if (error || !order) {
        return sendError(c, 'Order not found', 404);
      }

      return sendSuccess(c, { order });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to get order', 500);
    }
  });

  /**
   * Update order status - SQL-BASED
   * PUT /make-server-3dd53475/orders/:orderId/status
   */
  app.put("/make-server-3dd53475/orders/:orderId/status", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { status, notes } = await c.req.json();

      if (!status) {
        return sendError(c, 'Status is required', 400);
      }

      const { data: order, error } = await client
        .from('orders')
        .update({
          order_status: status,
          updated_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error || !order) {
        return sendError(c, 'Order not found', 404);
      }

      return sendSuccess(c, { order });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to update order', 500);
    }
  });

  /**
   * Get customer orders - SQL-BASED
   * GET /make-server-3dd53475/orders/customer/:customerId
   */
  app.get("/make-server-3dd53475/orders/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      let query = client
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('order_status', status);
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      return sendSuccess(c, { 
        orders: orders || [],
        count: orders?.length || 0
      });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to get orders', 500);
    }
  });
}

