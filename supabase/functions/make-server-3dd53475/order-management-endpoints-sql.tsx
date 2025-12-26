/**
 * 📦 ORDER MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * E-commerce order management: place orders, track status, cancel orders
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (11 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getOrdersRepository } from '../../lib/repositories/orders.ts';
import { getCartsRepository } from '../../lib/repositories/carts.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getDbClient } from '../../lib/db.ts';
import { withTransaction } from '../../lib/utils/transaction-helper.ts';
import { broadcastOrderUpdate } from './websocket-server.tsx';

const app = new Hono();
const ordersRepo = getOrdersRepository();
const cartsRepo = getCartsRepository();
const customersRepo = getCustomersRepository();
const db = getDbClient();

/**
 * POST /make-server-3dd53475/orders/place
 * Place a new order
 */
app.post('/make-server-3dd53475/orders/place', async (c) => {
  try {
    const body = await c.req.json();
    const { customerId, customerPhone, items, address, paymentMethod, promoCode, pricing } = body;

    if (!customerPhone || !items || items.length === 0) {
      return sendError(c, 'Missing required fields', 400);
    }

    return await withTransaction(async (txClient) => {
      // ✅ SQL: Find or create customer by phone
      let customer = customerId 
        ? await customersRepo.findById(customerId)
        : await customersRepo.findByPhone(customerPhone);
      
      if (!customer && customerPhone) {
        // Create customer if doesn't exist
        customer = await customersRepo.create({
          phone: customerPhone,
          name: address?.name || 'Customer',
          email: address?.email
        });
      }

      if (!customer) {
        return sendError(c, 'Failed to create or find customer', 500);
      }

      // Generate order number
      const orderNumber = `#WP${Date.now().toString().substr(-8)}`;

      // Calculate totals
      const subtotal = pricing?.subtotal || items.reduce((sum: number, item: any) => 
        sum + (item.price * item.quantity), 0
      );
      const taxAmount = pricing?.tax || 0;
      const shippingAmount = pricing?.shipping || 0;
      const discountAmount = pricing?.discount || 0;
      const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

      // ✅ SQL: Create order
      const order = await ordersRepo.create({
        customer_id: customer.id,
        vendor_id: items[0]?.vendorId || null,
        order_number: orderNumber,
        order_status: 'pending',
        subtotal,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        shipping_address: address?.address || address || '',
        shipping_city: address?.city || '',
        shipping_state: address?.state || '',
        shipping_pincode: address?.pincode || address?.pinCode || '',
        shipping_phone: customerPhone,
        payment_status: 'pending'
      });

      // ✅ SQL: Create order items
      for (const item of items) {
        await db.from('order_items').insert({
          order_id: order.id,
          product_id: item.productId || null,
          service_id: item.serviceId || null,
          name: item.name,
          quantity: item.quantity || 1,
          unit_price: item.price,
          total_price: (item.price * (item.quantity || 1))
        });
      }

      // ✅ SQL: Clear cart if customerId is present
      if (customer.id) {
        const cart = await cartsRepo.findByCustomer(customer.id);
        if (cart) {
          await cartsRepo.clear(cart.id);
          console.log(`[ORDER] Cleared cart for customer ${customer.id}`);
        }
      }

      // ✅ SQL: Store tracking history in order metadata
      await db
        .from('orders')
        .update({
          metadata: {
            tracking: {
              status: 'pending',
              message: 'Order placed successfully',
              timestamp: new Date().toISOString()
            },
            trackingHistory: [{
              status: 'pending',
              message: 'Order placed successfully',
              timestamp: new Date().toISOString()
            }],
            paymentMethod,
            promoCode
          }
        })
        .eq('id', order.id);

      console.log(`[ORDER] Created order ${order.id} for customer ${customerPhone}`);

      return sendSuccess(c, {
        orderId: order.id,
        orderNumber: order.order_number,
        message: 'Order placed successfully'
      });
    });
  } catch (error) {
    console.error('[ORDER] Error placing order:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/orders/customer/:phone
 * Get customer orders
 */
app.get('/make-server-3dd53475/orders/customer/:phone', async (c) => {
  try {
    const phone = c.req.param('phone');
    
    // ✅ SQL: Find customer by phone
    const customer = await customersRepo.findByPhone(phone);
    if (!customer) {
      return sendSuccess(c, { orders: [] });
    }

    // ✅ SQL: Get customer orders
    const orders = await ordersRepo.findByCustomer(customer.id);

    return sendSuccess(c, { orders });
  } catch (error) {
    console.error('[ORDER] Error fetching customer orders:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/orders/:orderId
 * Get order details
 */
app.get('/make-server-3dd53475/orders/:orderId', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    
    // ✅ SQL: Get order
    const order = await ordersRepo.findById(orderId);
    if (!order) {
      return sendError(c, 'Order not found', 404);
    }

    // ✅ SQL: Get order items
    const { data: items } = await db
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    // ✅ SQL: Get order metadata (tracking, etc.)
    const { data: orderData } = await db
      .from('orders')
      .select('metadata')
      .eq('id', orderId)
      .single();

    return sendSuccess(c, {
      order: {
        ...order,
        items: items || [],
        tracking: orderData?.metadata?.tracking,
        trackingHistory: orderData?.metadata?.trackingHistory || []
      }
    });
  } catch (error) {
    console.error('[ORDER] Error fetching order:', error);
    return sendError(c, error, 500);
  }
});

/**
 * PATCH /make-server-3dd53475/orders/:orderId/status
 * Update order status
 */
app.patch('/make-server-3dd53475/orders/:orderId/status', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const { status, message } = await c.req.json();

    // ✅ SQL: Get order
    const order = await ordersRepo.findById(orderId);
    if (!order) {
      return sendError(c, 'Order not found', 404);
    }

    // ✅ SQL: Update order status
    const updateData: any = {
      order_status: status,
      updated_at: new Date().toISOString()
    };

    if (status === 'shipped') {
      updateData.shipped_at = new Date().toISOString();
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    } else if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    await ordersRepo.update(orderId, updateData);

    // ✅ SQL: Update tracking history in metadata
    const { data: orderData } = await db
      .from('orders')
      .select('metadata')
      .eq('id', orderId)
      .single();

    const metadata = orderData?.metadata || {};
    const trackingHistory = metadata.trackingHistory || [];
    
    trackingHistory.push({
      status,
      message: message || `Order ${status}`,
      timestamp: new Date().toISOString()
    });

    await db
      .from('orders')
      .update({
        metadata: {
          ...metadata,
          tracking: {
            status,
            message: message || `Order ${status}`,
            timestamp: new Date().toISOString()
          },
          trackingHistory
        }
      })
      .eq('id', orderId);

    console.log(`[ORDER] Updated order ${orderId} status to ${status}`);

    // BROADCAST REAL-TIME UPDATE
    if (order.customer_id) {
      try {
        broadcastOrderUpdate({
          orderId: order.id,
          customerId: order.customer_id,
          status,
          message: message || `Order status updated to ${status}`,
          updatedAt: new Date().toISOString()
        });
      } catch (wsError) {
        console.error('Failed to broadcast order update:', wsError);
      }
    }

    return sendSuccess(c, { order: { ...order, ...updateData } });
  } catch (error) {
    console.error('[ORDER] Error updating order status:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/orders/:orderId/cancel
 * Cancel order
 */
app.post('/make-server-3dd53475/orders/:orderId/cancel', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const { reason } = await c.req.json();

    // ✅ SQL: Get order
    const order = await ordersRepo.findById(orderId);
    if (!order) {
      return sendError(c, 'Order not found', 404);
    }

    // Check if order can be cancelled
    if (['delivered', 'cancelled'].includes(order.order_status)) {
      return sendError(c, `Order cannot be cancelled. Order is already ${order.order_status}`, 400);
    }

    // ✅ SQL: Update order status
    await ordersRepo.update(orderId, {
      order_status: 'cancelled',
      cancelled_at: new Date().toISOString()
    });

    // ✅ SQL: Update tracking history
    const { data: orderData } = await db
      .from('orders')
      .select('metadata')
      .eq('id', orderId)
      .single();

    const metadata = orderData?.metadata || {};
    const trackingHistory = metadata.trackingHistory || [];
    
    trackingHistory.push({
      status: 'cancelled',
      message: `Order cancelled. Reason: ${reason || 'Customer request'}`,
      timestamp: new Date().toISOString()
    });

    await db
      .from('orders')
      .update({
        metadata: {
          ...metadata,
          tracking: {
            status: 'cancelled',
            message: 'Order has been cancelled',
            timestamp: new Date().toISOString()
          },
          trackingHistory,
          cancellationReason: reason
        }
      })
      .eq('id', orderId);

    console.log(`[ORDER] Cancelled order ${orderId}`);

    // BROADCAST CANCELLATION
    if (order.customer_id) {
      try {
        broadcastOrderUpdate({
          orderId: order.id,
          customerId: order.customer_id,
          status: 'cancelled',
          message: `Order cancelled: ${reason}`,
          updatedAt: new Date().toISOString()
        });
      } catch (wsError) {
        console.error('Failed to broadcast order cancellation:', wsError);
      }
    }

    return sendSuccess(c, { order: { ...order, order_status: 'cancelled' } });
  } catch (error) {
    console.error('[ORDER] Error cancelling order:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/orders/:orderId/tracking
 * Get order tracking
 */
app.get('/make-server-3dd53475/orders/:orderId/tracking', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    
    // ✅ SQL: Get order
    const order = await ordersRepo.findById(orderId);
    if (!order) {
      return sendError(c, 'Order not found', 404);
    }

    // ✅ SQL: Get order metadata (tracking history)
    const { data: orderData } = await db
      .from('orders')
      .select('metadata, shipping_address, shipping_city, shipping_state, shipping_pincode')
      .eq('id', orderId)
      .single();

    const metadata = orderData?.metadata || {};
    const timeline = metadata.trackingHistory || [
      {
        status: 'pending',
        message: 'Order placed successfully',
        timestamp: order.created_at
      }
    ];

    // Mock estimated delivery based on order date
    const estimatedDeliveryDate = new Date(order.created_at);
    estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3);

    return sendSuccess(c, {
      tracking: {
        orderId: order.id,
        orderNumber: order.order_number,
        currentStatus: order.order_status,
        estimatedDelivery: estimatedDeliveryDate.toISOString(),
        timeline,
        shippingAddress: `${orderData?.shipping_address || ''}, ${orderData?.shipping_city || ''}, ${orderData?.shipping_state || ''} - ${orderData?.shipping_pincode || ''}`
      }
    });
  } catch (error) {
    console.error('[ORDER] Error fetching tracking:', error);
    return sendError(c, error, 500);
  }
});

export default app;

