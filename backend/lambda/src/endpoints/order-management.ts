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
import {
  cancelPaidShopOrder,
  VENDOR_ALLOWED_STATUSES,
  CUSTOMER_CANCEL_STATUSES,
} from '../utils/payments/shop-order-refund';

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

function resolveOrderActor(c: { get: (key: string) => unknown }) {
  const userId = String(c.get('userId') || '');
  const userRole = String(c.get('userRole') || '').toLowerCase();
  const isVendor = userRole === 'vendor';
  const isCustomer = userRole === 'customer' || userRole === 'user' || userRole === 'pet_parent';
  const isAdmin = userRole === 'admin' || userRole.startsWith('admin');
  return { userId, userRole, isVendor, isCustomer, isAdmin };
}

export function registerOrderManagementEndpoints(app: Hono) {
  /**
   * PUT /orders/:orderId/status
   * Update order status
   */
  app.put("/orders/:orderId/status", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const { status, trackingNumber, notes } = body;
      const cancellationReason =
        typeof body?.cancellation_reason === 'string' ? body.cancellation_reason : undefined;

      const { userId, isVendor, isCustomer, isAdmin } = resolveOrderActor(c);
      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      if (!status) {
        return c.json({ error: 'status is required' }, 400);
      }

      if (status === 'cancelled') {
        if (!isVendor && !isCustomer) {
          return c.json({ error: 'Forbidden' }, 403);
        }

        const cancelResult = await cancelPaidShopOrder({
          orderId,
          reason: notes || cancellationReason || (isVendor ? 'Vendor cancellation' : 'Customer request'),
          cancelledBy: isVendor ? 'provider' : 'pet_parent',
          customerId: isCustomer && !isVendor ? userId : undefined,
          vendorId: isVendor ? userId : undefined,
          allowedStatuses: isVendor
            ? [...VENDOR_ALLOWED_STATUSES]
            : [...CUSTOMER_CANCEL_STATUSES],
        });

        if (!cancelResult.success) {
          if (cancelResult.error === 'Order not found') {
            return c.json({ error: 'Order not found' }, 404);
          }
          return c.json({ error: cancelResult.error || 'Cancellation failed' }, 400);
        }

        return c.json({
          success: true,
          orderId: cancelResult.orderId,
          status: cancelResult.status,
          cancelledBy: cancelResult.cancelledBy,
          refundStatus: cancelResult.refundStatus,
          stockRestored: cancelResult.stockRestored,
          message: 'Order cancelled successfully',
        });
      }

      if (isCustomer && !isVendor && !isAdmin) {
        return c.json({ error: 'Forbidden' }, 403);
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
      const body = await c.req.json().catch(() => ({}));
      const reason = body?.reason as string | undefined;

      const userId = String(c.get('userId') || '');
      const userRole = String(c.get('userRole') || '').toLowerCase();
      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      const isVendor = userRole === 'vendor';
      const isCustomer = userRole === 'customer' || userRole === 'user' || userRole === 'pet_parent';

      if (!isVendor && !isCustomer) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      const result = await cancelPaidShopOrder({
        orderId,
        reason: reason || (isVendor ? 'Vendor cancellation' : 'Customer request'),
        cancelledBy: isVendor ? 'provider' : 'pet_parent',
        customerId: isCustomer && !isVendor ? userId : undefined,
        vendorId: isVendor ? userId : undefined,
        allowedStatuses: isVendor ? VENDOR_ALLOWED_STATUSES : [...CUSTOMER_CANCEL_STATUSES],
      });

      if (!result.success) {
        if (result.error === 'Order not found') {
          return c.json({ error: 'Order not found' }, 404);
        }
        return c.json({ error: result.error || 'Cancellation failed' }, 400);
      }

      return c.json({
        success: true,
        orderId: result.orderId,
        status: result.status,
        cancelledBy: result.cancelledBy,
        refundStatus: result.refundStatus,
        stockRestored: result.stockRestored,
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

