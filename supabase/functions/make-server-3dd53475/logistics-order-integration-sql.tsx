/**
 * ============================================================================
 * LOGISTICS ORDER INTEGRATION - SQL-ONLY VERSION
 * ============================================================================
 * 
 * Complete Logistics Integration with Orders
 * 
 * Features:
 * - Auto-create shipment on order confirmation
 * - Auto-assign logistics partner
 * - Auto-generate shipping label
 * - Auto-update order status
 * - Real-time tracking updates
 * - Delivery confirmation
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 4, Task 4.3 - Logistics Integration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getOrdersRepository } from "../../lib/repositories/orders.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getDbClient } from "../../lib/db.ts";
import { createShiprocketOrder, generateShiprocketAWB, trackShiprocketShipment } from "./shiprocket-integration.tsx";

export function logisticsOrderIntegrationEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const ordersRepo = getOrdersRepository();
  const vendorsRepo = getVendorsRepository();
  const customersRepo = getCustomersRepository();
  const notificationsRepo = getNotificationsRepository();
  const db = getDbClient();

  // Helper: Resolve vendor ID
  async function resolveVendorId(identifier: string): Promise<string | null> {
    return await vendorsRepo.resolveVendorId(identifier);
  }

  // Helper: Send notification
  async function sendNotification(
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
      console.error(`⚠️ [LOGISTICS] Failed to send notification:`, error);
    }
  }

  // ============================================
  // AUTO-CREATE SHIPMENT ON ORDER CONFIRMATION
  // ============================================

  /**
   * POST /logistics/auto-create-shipment
   * Automatically create shipment when order is confirmed
   * (Called from order lifecycle)
   */
  app.post(`${BASE_PATH}/logistics/auto-create-shipment`, async (c) => {
    try {
      const { order_id } = await c.req.json();

      if (!order_id) {
        return sendError(c, 'Missing required field: order_id', 400);
      }

      const order = await ordersRepo.findById(order_id);
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      if (order.order_status !== 'confirmed') {
        return sendError(c, 'Order must be confirmed to create shipment', 400);
      }

      // Get customer and vendor
      const customer = await customersRepo.findById(order.customer_id);
      const vendor = order.vendor_id ? await vendorsRepo.findById(order.vendor_id) : null;

      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // Get order items
      const { data: orderItems } = await db
        .from('order_items')
        .select('product_id, quantity, name, unit_price')
        .eq('order_id', order_id);

      // Calculate total weight (estimate: 0.5kg per item)
      const totalWeight = (orderItems?.length || 0) * 0.5;

      // Prepare Shiprocket order data
      const shiprocketOrderData = {
        order_id: order.order_number,
        order_date: order.created_at.split('T')[0],
        pickup_location: {
          name: vendor?.business_name || vendor?.businessName || 'Vendor',
          phone: vendor?.phone || '',
          address: vendor?.address || '',
          city: vendor?.city || '',
          state: vendor?.state || '',
          pincode: vendor?.pincode || '',
        },
        delivery_location: {
          name: customer.full_name,
          phone: order.shipping_phone,
          address: order.shipping_address,
          city: order.shipping_city,
          state: order.shipping_state,
          pincode: order.shipping_pincode,
        },
        order_items: orderItems?.map(item => ({
          name: item.name,
          sku: item.product_id,
          units: item.quantity,
          selling_price: item.unit_price,
        })) || [],
        payment_method: order.payment_status === 'paid' ? 'Prepaid' : 'COD',
        sub_total: order.subtotal,
        length: 10,
        breadth: 10,
        height: 10,
        weight: totalWeight,
      };

      // Create Shiprocket order
      let shipmentId: string | null = null;
      let trackingNumber: string | null = null;

      try {
        const shiprocketResult = await createShiprocketOrder(shiprocketOrderData);
        shipmentId = shiprocketResult.order_id || null;
        trackingNumber = shiprocketResult.shipment_id || null;

        // Generate AWB
        if (shipmentId) {
          try {
            const awbResult = await generateShiprocketAWB(shipmentId);
            trackingNumber = awbResult.awb_code || trackingNumber;
          } catch (awbError) {
            console.error(`⚠️ [LOGISTICS] Failed to generate AWB:`, awbError);
          }
        }

        // Update order with tracking info
        await ordersRepo.update(order_id, {
          tracking_number: trackingNumber,
          order_status: 'processing', // Move to processing when shipment created
        });

        // Notify customer
        await sendNotification(
          customer.id,
          'customer',
          'order_shipped',
          'Order Shipped',
          `Your order ${order.order_number} has been shipped. Tracking: ${trackingNumber || 'N/A'}`,
          { order_id, order_number: order.order_number, tracking_number: trackingNumber }
        );

        // Notify vendor
        if (vendor) {
          await sendNotification(
            order.vendor_id!,
            'vendor',
            'shipment_created',
            'Shipment Created',
            `Shipment created for order ${order.order_number}. Tracking: ${trackingNumber || 'N/A'}`,
            { order_id, order_number: order.order_number, tracking_number: trackingNumber }
          );
        }

        console.log(`✅ [LOGISTICS] Auto-created shipment for order ${order_id}`);

        return sendSuccess(c, {
          shipment_id: shipmentId,
          tracking_number: trackingNumber,
          order: await ordersRepo.findById(order_id),
        }, 'Shipment created successfully');
      } catch (shiprocketError) {
        console.error(`❌ [LOGISTICS] Shiprocket order creation failed:`, shiprocketError);
        // Don't fail the order, just log the error
        return sendError(c, `Failed to create shipment: ${String(shiprocketError)}`, 500);
      }
    } catch (error) {
      console.error('❌ [LOGISTICS] Error creating shipment:', error);
      return sendError(c, `Failed to create shipment: ${String(error)}`, 500);
    }
  });

  // ============================================
  // TRACKING UPDATES
  // ============================================

  /**
   * POST /logistics/webhook/tracking
   * Handle tracking webhook from logistics partner
   */
  app.post(`${BASE_PATH}/logistics/webhook/tracking`, async (c) => {
    try {
      const webhookData = await c.req.json();

      // Extract tracking info (format depends on logistics partner)
      const trackingNumber = webhookData.awb_code || webhookData.tracking_number || webhookData.shipment_id;
      const status = webhookData.status || webhookData.current_status;
      const location = webhookData.location || webhookData.current_location;

      if (!trackingNumber) {
        return sendError(c, 'Missing tracking number in webhook', 400);
      }

      // Find order by tracking number
      const { data: orders } = await db
        .from('orders')
        .select('*')
        .eq('tracking_number', trackingNumber)
        .limit(1);

      if (!orders || orders.length === 0) {
        return sendError(c, 'Order not found for tracking number', 404);
      }

      const order = orders[0];

      // Update order status based on tracking status
      let orderStatus = order.order_status;
      if (status === 'in_transit' || status === 'out_for_delivery') {
        orderStatus = 'shipped';
      } else if (status === 'delivered') {
        orderStatus = 'delivered';
      } else if (status === 'returned' || status === 'rto') {
        orderStatus = 'returned';
      }

      if (orderStatus !== order.order_status) {
        await ordersRepo.update(order.id, {
          order_status: orderStatus,
        });

        // Notify customer
        const customer = await customersRepo.findById(order.customer_id);
        if (customer) {
          await sendNotification(
            customer.id,
            'customer',
            'order_tracking_update',
            'Order Tracking Update',
            `Your order ${order.order_number} status: ${status}${location ? ` at ${location}` : ''}`,
            { order_id: order.id, order_number: order.order_number, status, location, tracking_number }
          );
        }
      }

      return sendSuccess(c, {
        order_id: order.id,
        tracking_number,
        status,
        location,
      }, 'Tracking update processed');
    } catch (error) {
      console.error('❌ [LOGISTICS] Error processing tracking webhook:', error);
      return sendError(c, `Failed to process tracking webhook: ${String(error)}`, 500);
    }
  });

  /**
   * GET /logistics/track/:trackingNumber
   * Get tracking information
   */
  app.get(`${BASE_PATH}/logistics/track/:trackingNumber`, async (c) => {
    try {
      const { trackingNumber } = c.req.param();

      // Find order
      const { data: orders } = await db
        .from('orders')
        .select('*')
        .eq('tracking_number', trackingNumber)
        .limit(1);

      if (!orders || orders.length === 0) {
        return sendError(c, 'Order not found for tracking number', 404);
      }

      const order = orders[0];

      // Get tracking from Shiprocket
      try {
        const trackingInfo = await trackShiprocketShipment(trackingNumber);
        return sendSuccess(c, {
          order_id: order.id,
          order_number: order.order_number,
          tracking_number: trackingNumber,
          tracking_info: trackingInfo,
        });
      } catch (trackingError) {
        // Return basic order info even if tracking API fails
        return sendSuccess(c, {
          order_id: order.id,
          order_number: order.order_number,
          tracking_number: trackingNumber,
          order_status: order.order_status,
          message: 'Detailed tracking unavailable',
        });
      }
    } catch (error) {
      console.error('❌ [LOGISTICS] Error fetching tracking:', error);
      return sendError(c, `Failed to fetch tracking: ${String(error)}`, 500);
    }
  });

  // ============================================
  // DELIVERY CONFIRMATION
  // ============================================

  /**
   * POST /logistics/delivery-confirm
   * Confirm delivery and update order status
   */
  app.post(`${BASE_PATH}/logistics/delivery-confirm`, async (c) => {
    try {
      const { order_id, delivery_signature, delivery_photo, delivery_notes } = await c.req.json();

      if (!order_id) {
        return sendError(c, 'Missing required field: order_id', 400);
      }

      const order = await ordersRepo.findById(order_id);
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      // Update order to delivered
      await ordersRepo.update(order_id, {
        order_status: 'delivered',
        delivered_at: new Date().toISOString(),
      });

      // Notify customer
      const customer = await customersRepo.findById(order.customer_id);
      if (customer) {
        await sendNotification(
          customer.id,
          'customer',
          'order_delivered',
          'Order Delivered',
          `Your order ${order.order_number} has been delivered successfully!`,
          { order_id, order_number: order.order_number }
        );
      }

      // Trigger invoice generation and settlement (handled by order lifecycle)
      // This will be called automatically by the order lifecycle endpoint

      return sendSuccess(c, {
        order: await ordersRepo.findById(order_id),
      }, 'Delivery confirmed');
    } catch (error) {
      console.error('❌ [LOGISTICS] Error confirming delivery:', error);
      return sendError(c, `Failed to confirm delivery: ${String(error)}`, 500);
    }
  });

  console.log('✅ [LOGISTICS-INTEGRATION-SQL] Logistics order integration endpoints registered (SQL-only)');
}

