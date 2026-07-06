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
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, query } from '../database/rds-connection';
import { buildStructuredTracking } from '../utils/logistics/shipment-tracking';
import { notifyShopOrderStatusChange, type ShopOrderLifecycleStatus } from '../utils/shop-order-notifications';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { getRazorpayClient } from '../utils/payments/razorpay-client';

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

      if (status === 'confirmed' && order.order_status === 'pending') {
        const { triggerAutoShipment } = await import('../utils/logistics/trigger-auto-shipment');
        triggerAutoShipment(orderId, 'ecommerce').catch((e) =>
          console.error('[ORDER-MGMT] Auto-shipment trigger failed:', e)
        );
      }

      // ✅ Trigger webhooks
      try {
        const { triggerWebhook } = await import('./webhooks');
        const eventType = status === 'cancelled' ? 'order.cancelled' : 
                         status === 'delivered' ? 'order.completed' : 
                         'order.updated';
        await triggerWebhook(eventType, {
          orderId,
          status,
          previousStatus: order.order_status,
          customerId: order.customer_id,
          vendorId: order.vendor_id,
        });
      } catch (error) {
        console.error('Failed to trigger webhooks:', error);
      }

      // Unified shop notifications (inbox + FCM)
      void notifyShopOrderStatusChange({
        orderId,
        previousStatus: order.order_status,
        newStatus: status as ShopOrderLifecycleStatus,
        trackingNumber: trackingNumber || undefined,
        cancellationReason: status === 'cancelled' ? notes : undefined,
      }).catch((err) => console.warn('[ORDER-MGMT] Shop notification failed:', err));

      // Deferred loyalty award: insert pending row when delivered; awarded after return window expires
      if (status === 'delivered' && order.order_status !== 'delivered') {
        void (async () => {
          try {
            const { insertPendingLoyaltyAward } = await import('../utils/ecommerce-loyalty');
            const { resolveReturnWindowDays } = await import('../utils/return-window');
            const windowDays = await resolveReturnWindowDays(order.vendor_id ?? null);
            await insertPendingLoyaltyAward({
              orderId,
              customerId: String(order.customer_id),
              amount: parseFloat(String(order.total_amount || '0')),
              windowDays,
            });
          } catch (e: any) {
            console.warn('[ORDER-MGMT] Loyalty pending award trigger failed (non-fatal):', e?.message);
          }
        })();
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

      // Validate UUID format
      if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        return c.json({ error: 'Invalid order ID format' }, 400);
      }

      // Use query with error handling for table existence
      let orders: any[] = [];
      try {
        orders = await select('orders', { id: orderId });
      } catch (selectError: any) {
        // If table doesn't exist or other DB error, return 404 not 500
        console.error('Order lookup failed:', selectError.message);
        if (selectError.message?.includes('does not exist') || selectError.message?.includes('relation')) {
          return c.json({ error: 'Order not found', details: 'Orders table not configured' }, 404);
        }
        throw selectError;
      }

      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Get shipment info if exists
      const shipments = await query(
        'SELECT * FROM shipments WHERE order_id = $1 ORDER BY created_at DESC',
        [orderId]
      ).catch(() => ({ rows: [] }));

      const latestShipment = shipments.rows[0] || null;
      const tracking = buildStructuredTracking(order, latestShipment);

      return c.json({
        success: true,
        tracking,
        order: {
          id: order.id,
          orderNumber: order.order_number,
          status: order.order_status,
          trackingNumber: tracking?.trackingNumber || order.tracking_number,
          carrierId: tracking?.carrierId,
          carrierName: tracking?.carrierName,
          trackingUrl: tracking?.trackingUrl,
          identifierType: tracking?.identifierType,
          shippedAt: tracking?.shippedAt || order.shipped_at,
          deliveredAt: order.delivered_at,
          locked: tracking?.locked ?? false,
        },
        shipments: shipments.rows,
      });
    } catch (error: any) {
      console.error('Error fetching order tracking:', error);
      // Return 404 for not found-like errors, 500 for others
      if (error.message?.includes('not found') || error.message?.includes('invalid')) {
        return c.json({ error: error.message }, 404);
      }
      return c.json({ error: error.message || 'Failed to fetch order tracking' }, 500);
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
        const { insert: dbInsert } = await import('../database/rds-connection');
        const payments = await select('payments', { order_id: orderId, payment_status: 'completed' });
        if (payments.length > 0) {
          const payment = payments[0];
          const refundAmount = parseFloat(payment.amount || '0');
          const refundReason = `Order cancelled: ${reason || 'Customer request'}`;

          // Insert a refund tracking row (starts as 'pending')
          const refundRows = await query(
            `INSERT INTO refunds (
              payment_id,
              order_id,
              customer_id,
              vendor_id,
              refund_amount,
              refund_reason,
              refund_status,
              requested_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
            RETURNING id`,
            [
              payment.id,
              orderId,
              order.customer_id,
              order.vendor_id || null,
              refundAmount,
              refundReason,
            ]
          );
          const refundRowId = refundRows.rows[0]?.id;

          // Attempt Razorpay refund if a Razorpay payment ID is available
          const razorpayPaymentId: string | null = payment.razorpay_payment_id || null;
          if (razorpayPaymentId && refundAmount > 0) {
            try {
              const razorpayClient = await getRazorpayClient();
              const rzRefund = await razorpayClient.payments.refund({
                payment_id: razorpayPaymentId,
                amount: Math.round(refundAmount * 100), // paise
              });
              const rzRefundId: string = (rzRefund as any)?.id || '';

              // Update refund row with Razorpay refund ID and mark as initiated
              if (refundRowId) {
                await query(
                  `UPDATE refunds
                   SET refund_status = 'initiated',
                       razorpay_refund_id = $1,
                       updated_at = NOW()
                   WHERE id = $2`,
                  [rzRefundId, refundRowId]
                );
              }
              console.log(`[ORDER-MGMT] Razorpay refund initiated: ${rzRefundId} for order ${orderId}`);
            } catch (rzError: any) {
              // Razorpay call failed — leave row as 'pending' for manual/retry processing
              console.error(`[ORDER-MGMT] Razorpay refund call failed for order ${orderId}:`, rzError.message);
            }
          } else {
            console.log(`[ORDER-MGMT] Refund row created (no Razorpay payment ID) for order ${orderId}`);
          }
        }
      } catch (error: any) {
        console.error('Error processing refund for cancelled order:', error);
        // Cancellation succeeds even if refund processing fails
      }

      void notifyShopOrderStatusChange({
        orderId,
        previousStatus: order.order_status,
        newStatus: 'cancelled',
        cancellationReason: reason || undefined,
      }).catch((err) => console.warn('[ORDER-MGMT] Cancel notification failed:', err));

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

  /**
   * PUT /orders/:orderId
   * Update order (full update - shipping address, items, etc.)
   */
  app.put("/orders/:orderId", async (c) => {
    try {
      const { orderId } = c.req.param();
      const updates = await c.req.json();

      // Get order
      const orders = await select('orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Validate that order can be updated (only pending/confirmed orders)
      if (!['pending', 'confirmed'].includes(order.order_status)) {
        return c.json({
          error: `Order cannot be updated. Current status: ${order.order_status}`,
        }, 400);
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Update shipping address if provided
      if (updates.shippingAddress) {
        updateData.shipping_address = typeof updates.shippingAddress === 'string'
          ? updates.shippingAddress
          : JSON.stringify(updates.shippingAddress);
      }
      if (updates.shippingCity) updateData.shipping_city = updates.shippingCity;
      if (updates.shippingState) updateData.shipping_state = updates.shippingState;
      if (updates.shippingPincode) updateData.shipping_pincode = updates.shippingPincode;
      if (updates.shippingPhone) updateData.shipping_phone = updates.shippingPhone;

      // Update amounts if provided
      if (updates.subtotal !== undefined) updateData.subtotal = updates.subtotal;
      if (updates.taxAmount !== undefined) updateData.tax_amount = updates.taxAmount;
      if (updates.shippingAmount !== undefined) updateData.shipping_amount = updates.shippingAmount;
      if (updates.discountAmount !== undefined) updateData.discount_amount = updates.discountAmount;
      if (updates.totalAmount !== undefined) updateData.total_amount = updates.totalAmount;

      // Update order items if provided
      if (updates.items && Array.isArray(updates.items)) {
        // Delete existing items
        await query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

        // Insert new items
        const { insert } = require('../database/rds-connection');
        for (const item of updates.items) {
          await insert('order_items', {
            order_id: orderId,
            product_id: item.productId || null,
            service_id: item.serviceId || null,
            name: item.name,
            quantity: item.quantity || 1,
            unit_price: item.unitPrice || item.price || 0,
            total_price: (item.quantity || 1) * (item.unitPrice || item.price || 0),
            ...(item.category && { category: item.category }),
            ...(item.hsnCode && { hsn_code: item.hsnCode }),
          });
        }
      }

      // Update order
      const updated = await update('orders', { id: orderId }, updateData);

      return c.json({
        success: true,
        order: updated[0],
        message: 'Order updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating order:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

