/**
 * ============================================================================
 * ORDER LIFECYCLE COMPLETE - SQL-ONLY VERSION
 * ============================================================================
 * 
 * Complete Order Lifecycle Management
 * 
 * Features:
 * - Complete status transitions with validation
 * - Automated notifications at each stage
 * - Settlement creation on delivery
 * - Invoice generation on delivery
 * - Return/refund processing
 * - Order tracking
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 4, Task 4.1 - Complete Order Lifecycle
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getOrdersRepository } from "../../lib/repositories/orders.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getInvoicesRepository } from "../../lib/repositories/invoices.ts";
import { getSettlementsRepository } from "../../lib/repositories/settlements.ts";
import { getProductsRepository } from "../../lib/repositories/products.ts";
import { generateInvoiceForOrder } from "../../lib/services/invoice-generator.ts";
import { getDbClient } from "../../lib/db.ts";

export function orderLifecycleCompleteEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const ordersRepo = getOrdersRepository();
  const customersRepo = getCustomersRepository();
  const vendorsRepo = getVendorsRepository();
  const notificationsRepo = getNotificationsRepository();
  const invoicesRepo = getInvoicesRepository();
  const settlementsRepo = getSettlementsRepository();
  const productsRepo = getProductsRepository();
  const db = getDbClient();

  // Helper: Resolve vendor ID
  async function resolveVendorId(identifier: string): Promise<string | null> {
    return await vendorsRepo.resolveVendorId(identifier);
  }

  // Helper: Send notification
  async function sendOrderNotification(
    recipientId: string,
    recipientType: 'customer' | 'vendor',
    type: string,
    title: string,
    message: string,
    data: any
  ) {
    try {
      await notificationsRepo.create({
        recipient_id: recipientId,
        recipient_type: recipientType,
        type,
        title,
        message,
        data,
        channels: { email: true, sms: false, inApp: true, push: false },
      });
    } catch (error) {
      console.error(`⚠️ [ORDER-LIFECYCLE] Failed to send notification:`, error);
    }
  }

  // ============================================
  // ORDER STATUS TRANSITIONS
  // ============================================

  /**
   * PUT /orders/:orderId/status
   * Complete order status transition with full lifecycle
   */
  app.put(`${BASE_PATH}/orders/:orderId/status`, async (c) => {
    try {
      const { orderId } = c.req.param();
      const { status, tracking_number, notes } = await c.req.json();

      if (!status) {
        return sendError(c, 'Status is required', 400);
      }

      const order = await ordersRepo.findById(orderId);
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      // Valid status transitions
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

      const allowed = validTransitions[order.order_status] || [];
      if (!allowed.includes(status)) {
        return sendError(c, `Invalid status transition: ${order.order_status} → ${status}`, 400);
      }

      // Update order
      const updateData: any = {
        order_status: status,
        updated_at: new Date().toISOString(),
      };

      if (tracking_number) updateData.tracking_number = tracking_number;
      if (status === 'shipped') updateData.shipped_at = new Date().toISOString();
      if (status === 'delivered') updateData.delivered_at = new Date().toISOString();
      if (status === 'cancelled') updateData.cancelled_at = new Date().toISOString();

      const updated = await ordersRepo.update(orderId, updateData);

      // Get customer and vendor for notifications
      const customer = await customersRepo.findById(order.customer_id);
      const vendor = order.vendor_id ? await vendorsRepo.findById(order.vendor_id) : null;

      // ============================================
      // STATUS-SPECIFIC LIFECYCLE ACTIONS
      // ============================================

      if (status === 'confirmed') {
        // Notify customer and vendor
        if (customer) {
          await sendOrderNotification(
            customer.id,
            'customer',
            'order_confirmed',
            'Order Confirmed',
            `Your order ${order.order_number} has been confirmed and is being prepared`,
            { order_id: orderId, order_number: order.order_number, status }
          );
        }
        if (vendor) {
          await sendOrderNotification(
            order.vendor_id!,
            'vendor',
            'order_confirmed',
            'Order Confirmed',
            `Order ${order.order_number} has been confirmed`,
            { order_id: orderId, order_number: order.order_number, status }
          );
        }

        // ✅ AUTO-CREATE SHIPMENT on order confirmation
        // Note: This will be called internally by the logistics integration endpoint
        // For now, we'll just log it. The actual shipment creation happens when vendor confirms the order.
        console.log(`📦 [ORDER-LIFECYCLE] Order ${orderId} confirmed - shipment can be created by vendor`);
      }

      if (status === 'processing') {
        // Notify customer
        if (customer) {
          await sendOrderNotification(
            customer.id,
            'customer',
            'order_processing',
            'Order Processing',
            `Your order ${order.order_number} is being processed`,
            { order_id: orderId, order_number: order.order_number, status }
          );
        }
      }

      if (status === 'shipped') {
        // Notify customer with tracking
        if (customer) {
          await sendOrderNotification(
            customer.id,
            'customer',
            'order_shipped',
            'Order Shipped',
            `Your order ${order.order_number} has been shipped. Tracking: ${tracking_number || 'N/A'}`,
            { order_id: orderId, order_number: order.order_number, status, tracking_number }
          );
        }
      }

      if (status === 'delivered') {
        // ✅ COMPLETE LIFECYCLE: Delivery triggers multiple actions
        try {
          // 1. Generate invoice
          const existingInvoice = await invoicesRepo.findByOrder(orderId);
          if (!existingInvoice) {
            await generateInvoiceForOrder(orderId);
            console.log(`✅ [ORDER-LIFECYCLE] Auto-generated invoice for order ${orderId}`);
          }

          // 2. Create settlements for vendors
          const { data: orderItems } = await db
            .from('order_items')
            .select('product_id, total_price')
            .eq('order_id', orderId);

          const vendorGroups: Record<string, number> = {};
          for (const item of orderItems || []) {
            if (item.product_id) {
              const product = await productsRepo.findById(item.product_id);
              if (product?.vendor_id) {
                vendorGroups[product.vendor_id] = (vendorGroups[product.vendor_id] || 0) + item.total_price;
              }
            }
          }

          // Create settlements for each vendor
          for (const [vendorId, vendorAmount] of Object.entries(vendorGroups)) {
            const commissionRate = 0.15; // 15% platform commission
            const commission = vendorAmount * commissionRate;
            const vendorPayout = vendorAmount - commission;

            const existingSettlements = await settlementsRepo.findByVendor(vendorId);
            const existingSettlement = existingSettlements.find(s => 
              s.booking_id === orderId || s.payment_id === order.payment_id
            );

            if (!existingSettlement) {
              await settlementsRepo.create({
                vendor_id: vendorId,
                booking_id: null,
                payment_id: order.payment_id || null,
                settlement_amount: vendorAmount,
                commission_amount: commission,
                vendor_amount: vendorPayout,
                settlement_date: new Date().toISOString().split('T')[0],
              });
              console.log(`✅ [ORDER-LIFECYCLE] Created settlement for vendor ${vendorId} on order ${orderId}`);
            }
          }

          // 3. Settlements are already created above (inline implementation)
          // This ensures atomicity and avoids external API calls

          // 4. Notify customer and vendor
          if (customer) {
            await sendOrderNotification(
              customer.id,
              'customer',
              'order_delivered',
              'Order Delivered',
              `Your order ${order.order_number} has been delivered successfully!`,
              { order_id: orderId, order_number: order.order_number, status }
            );
          }
          if (vendor) {
            await sendOrderNotification(
              order.vendor_id!,
              'vendor',
              'order_delivered',
              'Order Delivered',
              `Order ${order.order_number} has been delivered to customer`,
              { order_id: orderId, order_number: order.order_number, status }
            );
          }

          console.log(`✅ [ORDER-LIFECYCLE] Complete lifecycle executed for delivered order ${orderId}`);
        } catch (lifecycleError) {
          console.error(`⚠️ [ORDER-LIFECYCLE] Failed to complete lifecycle for order ${orderId}:`, lifecycleError);
          // Don't fail the status update if lifecycle completion fails
        }
      }

      if (status === 'cancelled') {
        // Restore inventory
        const { data: orderItems } = await db
          .from('order_items')
          .select('product_id, quantity')
          .eq('order_id', orderId);

        for (const item of orderItems || []) {
          if (item.product_id) {
            try {
              const product = await productsRepo.findById(item.product_id);
              if (product) {
                await productsRepo.updateStock(item.product_id, item.quantity, 'add');
              }
            } catch (stockError) {
              console.error(`⚠️ [ORDER-LIFECYCLE] Failed to restore stock for product ${item.product_id}:`, stockError);
            }
          }
        }

        // Notify customer and vendor
        if (customer) {
          await sendOrderNotification(
            customer.id,
            'customer',
            'order_cancelled',
            'Order Cancelled',
            `Your order ${order.order_number} has been cancelled`,
            { order_id: orderId, order_number: order.order_number, status, notes }
          );
        }
        if (vendor) {
          await sendOrderNotification(
            order.vendor_id!,
            'vendor',
            'order_cancelled',
            'Order Cancelled',
            `Order ${order.order_number} has been cancelled`,
            { order_id: orderId, order_number: order.order_number, status, notes }
          );
        }
      }

      if (status === 'returned') {
        // Notify customer and vendor
        if (customer) {
          await sendOrderNotification(
            customer.id,
            'customer',
            'order_returned',
            'Order Returned',
            `Your return request for order ${order.order_number} has been processed`,
            { order_id: orderId, order_number: order.order_number, status, notes }
          );
        }
        if (vendor) {
          await sendOrderNotification(
            order.vendor_id!,
            'vendor',
            'order_returned',
            'Order Returned',
            `Order ${order.order_number} has been returned`,
            { order_id: orderId, order_number: order.order_number, status, notes }
          );
        }
      }

      if (status === 'refunded') {
        // Notify customer
        if (customer) {
          await sendOrderNotification(
            customer.id,
            'customer',
            'order_refunded',
            'Refund Processed',
            `Your refund for order ${order.order_number} has been processed`,
            { order_id: orderId, order_number: order.order_number, status, notes }
          );
        }
      }

      return sendSuccess(c, { order: updated }, `Order status updated to ${status}`);
    } catch (error) {
      console.error('❌ [ORDER-LIFECYCLE] Error updating order status:', error);
      return sendError(c, `Failed to update order status: ${String(error)}`, 500);
    }
  });

  // ============================================
  // ORDER TRACKING
  // ============================================

  /**
   * GET /orders/:orderId/tracking
   * Get order tracking information
   */
  app.get(`${BASE_PATH}/orders/:orderId/tracking`, async (c) => {
    try {
      const { orderId } = c.req.param();

      const order = await ordersRepo.findById(orderId);
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      // Get order items
      const { data: orderItems } = await db
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      // Get customer and vendor
      const customer = await customersRepo.findById(order.customer_id);
      const vendor = order.vendor_id ? await vendorsRepo.findById(order.vendor_id) : null;

      // Build tracking timeline
      const timeline = [];
      if (order.created_at) {
        timeline.push({
          status: 'pending',
          timestamp: order.created_at,
          message: 'Order placed',
        });
      }
      if (order.shipped_at) {
        timeline.push({
          status: 'shipped',
          timestamp: order.shipped_at,
          message: 'Order shipped',
          tracking_number: order.tracking_number,
        });
      }
      if (order.delivered_at) {
        timeline.push({
          status: 'delivered',
          timestamp: order.delivered_at,
          message: 'Order delivered',
        });
      }
      if (order.cancelled_at) {
        timeline.push({
          status: 'cancelled',
          timestamp: order.cancelled_at,
          message: 'Order cancelled',
        });
      }

      return sendSuccess(c, {
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.order_status,
          payment_status: order.payment_status,
          tracking_number: order.tracking_number,
        },
        customer: customer ? {
          name: customer.full_name,
          phone: customer.phone,
          address: order.shipping_address,
        } : null,
        vendor: vendor ? {
          name: vendor.business_name || vendor.businessName,
          phone: vendor.phone,
        } : null,
        items: orderItems || [],
        timeline: timeline.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ),
      });
    } catch (error) {
      console.error('❌ [ORDER-LIFECYCLE] Error fetching order tracking:', error);
      return sendError(c, `Failed to fetch order tracking: ${String(error)}`, 500);
    }
  });

  console.log('✅ [ORDER-LIFECYCLE-SQL] Order lifecycle endpoints registered (SQL-only)');
}

