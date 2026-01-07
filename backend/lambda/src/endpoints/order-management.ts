/**
 * ============================================================================
 * ORDER MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles order lifecycle management:
 * - Update order status
 * - Order tracking
 * - Order cancellation
 * 
 * Migrated from: supabase/functions/make-server-3dd53475/order-lifecycle-complete-sql.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, query } from '../database/rds-connection';
import { getSnsClient } from '../utils/sns-client';
import { PublishCommand } from '@aws-sdk/client-sns';

const validTransitions: Record<string, string[]> = {
  'pending': ['confirmed', 'cancelled'],
  'confirmed': ['processing', 'cancelled'],
  'processing': ['shipped', 'cancelled'],
  'shipped': ['delivered', 'returned'],
  'delivered': ['returned'],
  'cancelled': [],
  'returned': ['refunded'],
  'refunded': [],
};

export function registerOrderManagementEndpoints(app: Hono) {
  /**
   * PUT /orders/:orderId/status
   * Update order status
   */
  app.put("/orders/:orderId/status", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { status, trackingNumber, notes } = await c.req.json();

      if (!status) {
        return c.json({ error: 'status is required' }, 400);
      }

      // Get order
      const orders = await select('orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Validate status transition
      const allowed = validTransitions[order.order_status] || [];
      if (!allowed.includes(status)) {
        return c.json({
          error: `Invalid status transition: ${order.order_status} → ${status}`,
        }, 400);
      }

      // Prepare update data
      const updateData: any = {
        order_status: status,
      };

      if (trackingNumber) {
        updateData.tracking_number = trackingNumber;
      }

      if (status === 'shipped') {
        updateData.shipped_at = new Date().toISOString();
      }

      if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      }

      // Update order
      const updated = await update('orders',
        { id: orderId },
        updateData
      );

      // Get customer and vendor for notifications
      const customer = await select('customers', { id: order.customer_id });
      const vendor = order.vendor_id ? await select('vendors', { id: order.vendor_id }) : [];

      // Send notifications
      const snsClient = getSnsClient();
      if (customer.length > 0 && customer[0].phone) {
        await snsClient.send(new PublishCommand({
          PhoneNumber: customer[0].phone,
          Message: `Your order ${order.order_number} status updated to: ${status}`,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
          },
        })).catch(err => console.error('SNS notification failed:', err));
      }

      return c.json({
        success: true,
        order: updated[0],
        message: 'Order status updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating order status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /orders/:orderId/tracking
   * Get order tracking information
   */
  app.get("/orders/:orderId/tracking", async (c) => {
    try {
      const { orderId } = c.req.param();

      const orders = await select('orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Get shipment info if exists
      const shipments = await query(
        'SELECT * FROM shipments WHERE order_id = $1',
        [orderId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.order_number,
          status: order.order_status,
          trackingNumber: order.tracking_number,
          shippedAt: order.shipped_at,
          deliveredAt: order.delivered_at,
        },
        shipments: shipments.rows,
      });
    } catch (error: any) {
      console.error('Error fetching order tracking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /orders/:orderId/cancel
   * Cancel order
   */
  app.post("/orders/:orderId/cancel", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { reason } = await c.req.json();

      const orders = await select('orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Check if order can be cancelled
      if (!['pending', 'confirmed'].includes(order.order_status)) {
        return c.json({
          error: `Order cannot be cancelled. Current status: ${order.order_status}`,
        }, 400);
      }

      // Update order
      const updated = await update('orders',
        { id: orderId },
        {
          order_status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || null,
        }
      );

      // Process refund if payment was made
      try {
        const payments = await select('payments', { order_id: orderId, payment_status: 'completed' });
        if (payments.length > 0) {
          const payment = payments[0];
          
          // Create refund request
          const { insert } = require('../database/rds-connection');
          await insert('refunds', {
            payment_id: payment.id,
            order_id: orderId,
            amount: payment.amount,
            refund_reason: `Order cancelled: ${reason || 'Customer request'}`,
            refund_status: 'pending',
            requested_by: 'system',
            created_at: new Date().toISOString(),
          });
          
          console.log(`✅ Refund request created for cancelled order ${orderId}`);
        }
      } catch (error: any) {
        console.error('Error processing refund for cancelled order:', error);
        // Don't fail the cancellation if refund processing fails
      }

      return c.json({
        success: true,
        order: updated[0],
        message: 'Order cancelled successfully',
      });
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

