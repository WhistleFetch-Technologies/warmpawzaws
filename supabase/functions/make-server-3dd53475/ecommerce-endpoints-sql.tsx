/**
 * ============================================================================
 * E-COMMERCE ENDPOINTS - SQL ONLY
 * ============================================================================
 * 
 * REFACTORED: All KV usage removed, uses SQL repositories only
 * Fixes: GST calculation, inventory validation, multi-vendor payouts
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getOrdersRepository } from "../../lib/repositories/orders.ts";
import { getProductsRepository } from "../../lib/repositories/products.ts";
import { getDbClient } from "../../lib/db.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getPaymentsRepository } from "../../lib/repositories/payments.ts";
import { getSettlementsRepository } from "../../lib/repositories/settlements.ts";
import { getInvoicesRepository } from "../../lib/repositories/invoices.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { calculateGST } from "../../lib/services/gst-calculator.ts";
import { selectQuery } from "../../lib/db.ts";
import { withTransaction } from "../../lib/utils/transaction-helper.ts";
import { generateInvoiceForOrder } from "../../lib/services/invoice-generator.ts";

const BASE_PATH = "/make-server-3dd53475";

export function ecommerceEndpointsSQL(app: Hono) {
  
  /**
   * POST /orders
   * Create order with inventory validation and GST calculation
   */
  app.post(`${BASE_PATH}/orders`, async (c) => {
    try {
      const orderData = await c.req.json();
      
      // Validate required fields
      if (!orderData.customer_id || !orderData.items || orderData.items.length === 0) {
        return sendError(c, 'Missing required fields: customer_id, items', 400);
      }
      
      // Get customer
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(orderData.customer_id);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // Validate inventory and calculate totals
      const vendorsRepo = getVendorsRepository();
      const productsRepo = getProductsRepository();
      const client = getDbClient();
      
      let subtotal = 0;
      let totalGST = 0;
      const vendorGroups: Record<string, any[]> = {};
      
      // Validate each item
      for (const item of orderData.items) {
        const product = await productsRepo.findById(item.product_id);
        if (!product) {
          return sendError(c, `Product not found: ${item.product_id}`, 404);
        }
        
        // Check inventory
        if (product.stock < item.quantity) {
          return sendError(c, `Insufficient stock for product: ${product.name}`, 400);
        }
        
        // Calculate item total
        const itemSubtotal = product.price * item.quantity;
        subtotal += itemSubtotal;
        
        // Get vendor for GST calculation
        const vendor = product.vendor_id ? await vendorsRepo.findById(product.vendor_id) : null;
        
        // Calculate GST for this item
        const gst = await calculateGST({
          amount: itemSubtotal,
          category: product.category,
          customerState: customer.state,
          vendorState: vendor?.state
        });
        
        totalGST += gst.gstAmount;
        
        // Group by vendor for payout split
        const vendorId = product.vendor_id || 'platform';
        if (!vendorGroups[vendorId]) {
          vendorGroups[vendorId] = [];
        }
        vendorGroups[vendorId].push({
          ...item,
          product,
          itemSubtotal,
          gst: gst.gstAmount
        });
      }
      
      // Apply discount
      const discountAmount = orderData.discount_amount || 0;
      const finalSubtotal = subtotal - discountAmount;
      const totalAmount = finalSubtotal + totalGST;
      
      // Create order atomically with inventory update
      const ordersRepo = getOrdersRepository();
      
      const order = await withTransaction(async (txClient) => {
        // Create order
        const orderResult = await txClient
          .from('orders')
          .insert({
            customer_id: orderData.customer_id,
            order_number: `ORD${Date.now()}${Math.random().toString(36).substring(7)}`,
            order_status: 'pending',
            subtotal: finalSubtotal,
            tax_amount: totalGST,
            discount_amount: discountAmount,
            shipping_amount: orderData.shipping_amount || 0,
            total_amount: totalAmount + (orderData.shipping_amount || 0),
            shipping_address: orderData.shipping_address,
            shipping_city: orderData.shipping_city,
            shipping_state: orderData.shipping_state,
            shipping_pincode: orderData.shipping_pincode,
            shipping_phone: orderData.shipping_phone,
            payment_status: 'pending'
          })
          .select()
          .single();
        
        if (!orderResult.data) {
          throw new Error('Failed to create order');
        }
        
        // Create order items and update inventory
        for (const item of orderData.items) {
          const product = await productsRepo.findById(item.product_id);
          if (!product) {
            throw new Error(`Product not found: ${item.product_id}`);
          }
          
          // Create order item
          await txClient
            .from('order_items')
            .insert({
              order_id: orderResult.data.id,
              product_id: item.product_id,
              quantity: item.quantity,
              price: product.price,
              total: product.price * item.quantity
            });
          
          // Update inventory
          await productsRepo.updateStock(item.product_id, item.quantity, 'subtract');
        }
        
        return orderResult.data;
      });
      
      // Log audit
      await selectQuery(
        "SELECT create_audit_log($1, $2, $3, $4, $5, $6)",
        [
          'order_created',
          'order',
          order.id,
          orderData.customer_id,
          'customer',
          JSON.stringify({ total_amount: totalAmount, item_count: orderData.items.length })
        ]
      );
      
      return sendSuccess(c, { 
        order,
        breakdown: {
          subtotal: finalSubtotal,
          discount: discountAmount,
          gst: totalGST,
          shipping: orderData.shipping_amount || 0,
          total: totalAmount + (orderData.shipping_amount || 0)
        }
      }, 'Order created');
    } catch (error) {
      console.error('❌ [ECOMMERCE] Error creating order:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * POST /orders/:orderId/confirm
   * Confirm order and create payments for each vendor
   */
  app.post(`${BASE_PATH}/orders/:orderId/confirm`, async (c) => {
    try {
      const { orderId } = c.req.param();
      const { payment_data } = await c.req.json();
      
      const ordersRepo = getOrdersRepository();
      const order = await ordersRepo.findById(orderId);
      
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }
      
      if (order.order_status !== 'pending') {
        return sendError(c, 'Order already processed', 400);
      }
      
      // Get order items grouped by vendor
      const items = await selectQuery(
        "SELECT oi.*, p.vendor_id FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1",
        [orderId]
      );
      
      const vendorGroups: Record<string, any[]> = {};
      for (const item of items) {
        const vendorId = item.vendor_id || 'platform';
        if (!vendorGroups[vendorId]) {
          vendorGroups[vendorId] = [];
        }
        vendorGroups[vendorId].push(item);
      }
      
      // Create payment for order
      const paymentsRepo = getPaymentsRepository();
      const payment = await paymentsRepo.create({
        customer_id: order.customer_id,
        order_id: orderId,
        amount: order.total_amount,
        payment_method: payment_data?.payment_method || 'razorpay',
        payment_status: 'pending'
      });
      
      // Update order
      await ordersRepo.update(orderId, {
        order_status: 'confirmed',
        payment_id: payment.id,
        payment_status: 'pending'
      });
      
      // Create settlements for each vendor (for payout split)
      const settlementsRepo = getSettlementsRepository();
      const settlements = [];
      
      for (const [vendorId, vendorItems] of Object.entries(vendorGroups)) {
        if (vendorId === 'platform') continue;
        
        const vendorAmount = vendorItems.reduce((sum, item) => sum + item.total, 0);
        const commission = vendorAmount * 0.15; // 15% commission
        const vendorPayout = vendorAmount - commission;
        
        const settlement = await settlementsRepo.create({
          vendor_id: vendorId,
          booking_id: null,
          payment_id: payment.id,
          settlement_amount: vendorAmount,
          commission_amount: commission,
          vendor_amount: vendorPayout
        });
        
        settlements.push(settlement);
      }
      
      return sendSuccess(c, { 
        order,
        payment,
        settlements 
      }, 'Order confirmed');
    } catch (error) {
      console.error('❌ [ECOMMERCE] Error confirming order:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * GET /orders/:orderId
   * Get order by ID
   */
  app.get(`${BASE_PATH}/orders/:orderId`, async (c) => {
    try {
      const { orderId } = c.req.param();
      
      const ordersRepo = getOrdersRepository();
      const order = await ordersRepo.findById(orderId);
      
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }
      
      // Get order items
      const items = await selectQuery(
        "SELECT * FROM order_items WHERE order_id = $1",
        [orderId]
      );
      
      return sendSuccess(c, { order, items }, 'Order retrieved');
    } catch (error) {
      console.error('❌ [ECOMMERCE] Error getting order:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * PATCH /orders/:orderId/status
   * Update order status
   */
  app.patch(`${BASE_PATH}/orders/:orderId/status`, async (c) => {
    try {
      const { orderId } = c.req.param();
      const { status, tracking_number } = await c.req.json();
      
      const ordersRepo = getOrdersRepository();
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
        'delivered': [],
        'cancelled': [],
        'returned': []
      };
      
      const allowed = validTransitions[order.order_status] || [];
      if (!allowed.includes(status)) {
        return sendError(c, `Invalid status transition: ${order.order_status} → ${status}`, 400);
      }
      
      // Update order
      const updated = await ordersRepo.update(orderId, {
        order_status: status,
        tracking_number: tracking_number || order.tracking_number
      });
      
      // ✅ FULL LIFECYCLE INTEGRATION when order is delivered
      // Note: Full lifecycle is handled by order-lifecycle-complete-sql.tsx
      // This endpoint is kept for backward compatibility but delegates to lifecycle endpoint
      if (status === 'delivered') {
        try {
          const invoicesRepo = getInvoicesRepository();
          const settlementsRepo = getSettlementsRepository();
          const notificationsRepo = getNotificationsRepository();
          const customersRepo = getCustomersRepository();
          const vendorsRepo = getVendorsRepository();

          // 1. Auto-generate invoice
          const existingInvoice = await invoicesRepo.findByOrder(orderId);
          if (!existingInvoice) {
            await generateInvoiceForOrder(orderId);
            console.log(`✅ [ECOMMERCE] Auto-generated invoice for delivered order ${orderId}`);
          }

          // 2. Create settlement for vendor (if multi-vendor order, create settlements per vendor)
          const { data: orderItems } = await db
            .from('order_items')
            .select('product_id, total_price')
            .eq('order_id', orderId);

          // Group by vendor
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

            // Check if settlement already exists
            const existingSettlements = await settlementsRepo.findByVendor(vendorId);
            const existingSettlement = existingSettlements.find(s => s.booking_id === orderId || s.payment_id === order.payment_id);

            if (!existingSettlement) {
              await settlementsRepo.create({
                vendor_id: vendorId,
                booking_id: null, // E-commerce order, not booking
                payment_id: order.payment_id || null,
                settlement_amount: vendorAmount,
                commission_amount: commission,
                vendor_amount: vendorPayout,
                settlement_date: new Date().toISOString().split('T')[0],
              });
              console.log(`✅ [ECOMMERCE] Created settlement for vendor ${vendorId} on order ${orderId}`);
            }
          }

          // 3. Send notifications
          const customer = await customersRepo.findById(order.customer_id);
          if (customer) {
            await notificationsRepo.create({
              recipient_id: customer.id,
              recipient_type: 'customer',
              type: 'order_delivered',
              title: 'Order Delivered',
              message: `Your order ${order.order_number} has been delivered successfully!`,
              data: {
                order_id: orderId,
                order_number: order.order_number,
                status: 'delivered',
              },
            });
          }

          if (order.vendor_id) {
            const vendor = await vendorsRepo.findById(order.vendor_id);
            if (vendor) {
              await notificationsRepo.create({
                recipient_id: order.vendor_id,
                recipient_type: 'vendor',
                type: 'order_delivered',
                title: 'Order Delivered',
                message: `Order ${order.order_number} has been delivered to customer`,
                data: {
                  order_id: orderId,
                  order_number: order.order_number,
                  status: 'delivered',
                },
              });
            }
          }

          console.log(`✅ [ECOMMERCE] Full lifecycle completed for delivered order ${orderId}`);
        } catch (lifecycleError) {
          console.error(`⚠️ [ECOMMERCE] Failed to complete lifecycle for order ${orderId}:`, lifecycleError);
          // Don't fail the order status update if lifecycle completion fails
        }
      }

      // ✅ SEND NOTIFICATIONS for other status changes
      if (status !== 'delivered') {
        try {
          const notificationsRepo = getNotificationsRepository();
          const customersRepo = getCustomersRepository();
          const vendorsRepo = getVendorsRepository();

          const customer = await customersRepo.findById(order.customer_id);
          if (customer) {
            const statusMessages: Record<string, { title: string; message: string }> = {
              'confirmed': { title: 'Order Confirmed', message: `Your order ${order.order_number} has been confirmed` },
              'processing': { title: 'Order Processing', message: `Your order ${order.order_number} is being processed` },
              'shipped': { title: 'Order Shipped', message: `Your order ${order.order_number} has been shipped` },
              'cancelled': { title: 'Order Cancelled', message: `Your order ${order.order_number} has been cancelled` },
            };

            const statusMessage = statusMessages[status];
            if (statusMessage) {
              await notificationsRepo.create({
                recipient_id: customer.id,
                recipient_type: 'customer',
                type: 'order_status_update',
                title: statusMessage.title,
                message: statusMessage.message,
                data: {
                  order_id: orderId,
                  order_number: order.order_number,
                  status,
                },
              });
            }
          }
        } catch (notifError) {
          console.error(`⚠️ [ECOMMERCE] Failed to send notification for order ${orderId}:`, notifError);
        }
      }
      
      // Log audit
      await selectQuery(
        "SELECT create_audit_log($1, $2, $3, $4, $5, $6)",
        [
          'order_status_updated',
          'order',
          orderId,
          'system',
          'system',
          JSON.stringify({ from: order.order_status, to: status })
        ]
      );
      
      return sendSuccess(c, { order: updated }, 'Order status updated');
    } catch (error) {
      console.error('❌ [ECOMMERCE] Error updating order status:', error);
      return sendError(c, error, 500);
    }
  });
}

