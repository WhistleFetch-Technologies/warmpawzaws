// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { broadcastOrderUpdate } from './websocket-server';
import { getOrdersRepository } from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

const orderRoutes = new Hono();

// Place a new order
orderRoutes.post('/place', async (c) => {
  try {
    const body = await c.req.json();
    const { customerId, customerPhone, items, address, paymentMethod, promoCode, pricing } = body;

    if (!customerPhone || !items || items.length === 0) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Generate order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const orderNumber = `#WP${Date.now().toString().substr(-8)}`;

    const order = {
      id: orderId,
      orderNumber,
      customerId: customerId || null, // Store customerId
      customerPhone,
      items,
      address,
      paymentMethod,
      promoCode,
      pricing,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tracking: {
        status: 'pending',
        message: 'Order placed successfully',
        timestamp: new Date().toISOString()
      }
    };

    // ✅ SQL: Store order
    const ordersRepo = getOrdersRepository();
    await ordersRepo.create({
      id: orderId,
      order_number: orderNumber,
      customer_id: customerId || customerPhone,
      order_status: 'pending',
      subtotal: pricing?.subtotal || 0,
      tax_amount: pricing?.tax || 0,
      shipping_amount: pricing?.shipping || 0,
      discount_amount: pricing?.discount || 0,
      total_amount: pricing?.total || 0,
      shipping_address: address?.address || address?.street || '',
      shipping_city: address?.city || '',
      shipping_state: address?.state || '',
      shipping_pincode: address?.pincode || address?.zip || '',
      shipping_phone: customerPhone,
      payment_id: null,
      payment_status: paymentMethod || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    // ✅ SQL: Store order items
    const db = getDbClient();
    for (const item of items) {
      await db.from('order_items').insert({
        id: `${orderId}_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order_id: orderId,
        product_id: item.productId || item.id,
        quantity: item.quantity || 1,
        unit_price: item.price || 0,
        total_price: (item.price || 0) * (item.quantity || 1),
        created_at: new Date().toISOString()
      });
    }
    
    // ✅ SQL: Clear Cart if customerId is present (if carts table exists)
    if (customerId) {
      try {
        await db.from('carts').delete().eq('customer_id', customerId);
        console.log(`[ORDER] Cleared cart for customer ${customerId}`);
      } catch (err) {
        console.warn('[ORDER] Cart clearing not available:', err);
      }
    }

    console.log(`[ORDER] Created order ${orderId} for customer ${customerPhone}`);

    return c.json({ 
      success: true, 
      orderId,
      orderNumber,
      message: 'Order placed successfully' 
    });
  } catch (error) {
    console.error('[ORDER] Error placing order:', error);
    return c.json({ error: 'Failed to place order', details: error.message }, 500);
  }
});

// Get customer orders
orderRoutes.get('/customer/:phone', async (c) => {
  try {
    const phone = c.req.param('phone');
    
    // ✅ SQL: Get customer orders
    const ordersRepo = getOrdersRepository();
    const orders = await ordersRepo.findByCustomer(phone);
    
    // Enrich with items
    const db = getDbClient();
    const enrichedOrders = await Promise.all(
      orders.map(async (order: any) => {
        const { data: items } = await db
          .from('order_items')
          .select('*')
          .eq('order_id', order.id);
        
        return {
          ...order,
          items: items || [],
          orderNumber: order.order_number,
          status: order.order_status,
          address: {
            address: order.shipping_address,
            city: order.shipping_city,
            state: order.shipping_state,
            pincode: order.shipping_pincode
          },
          customerPhone: order.shipping_phone,
          createdAt: order.created_at,
          updatedAt: order.updated_at
        };
      })
    );

    return c.json({ orders: enrichedOrders });
  } catch (error) {
    console.error('[ORDER] Error fetching customer orders:', error);
    return c.json({ error: 'Failed to fetch orders', details: error.message }, 500);
  }
});

// Get order details
orderRoutes.get('/:orderId', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    
    // ✅ SQL: Get order details
    const ordersRepo = getOrdersRepository();
    const order = await ordersRepo.findById(orderId);
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Enrich with items
    const db = getDbClient();
    const { data: items } = await db
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    return c.json({ 
      order: {
        ...order,
        items: items || [],
        orderNumber: order.order_number,
        status: order.order_status
      }
    });
  } catch (error) {
    console.error('[ORDER] Error fetching order:', error);
    return c.json({ error: 'Failed to fetch order', details: error.message }, 500);
  }
});

// Update order status
orderRoutes.patch('/:orderId/status', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const { status, message } = await c.req.json();

    // ✅ SQL: Get and update order
    const ordersRepo = getOrdersRepository();
    const order = await ordersRepo.findById(orderId);
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // ✅ SQL: Update order status
    await ordersRepo.update(orderId, {
      order_status: status,
      updated_at: new Date().toISOString()
    });
    
    // ✅ SQL: Store tracking history
    const db = getDbClient();
    await db.from('order_tracking').insert({
      id: `${orderId}_track_${Date.now()}`,
      order_id: orderId,
      status: status,
      message: message || `Order ${status}`,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    const updatedOrder = await ordersRepo.findById(orderId);

    console.log(`[ORDER] Updated order ${orderId} status to ${status}`);

    // BROADCAST REAL-TIME UPDATE
    // Try to resolve customerId from phone if not present (legacy orders might use phone)
    let customerId = order.customerId;
    if (!customerId && order.customerPhone) {
       // Try to find customer by phone if needed, or just broadcast to generic phone topic if we supported it
       // For now, just try to broadcast if customerId is present or if we can derive it.
       // Ideally order object should have customerId.
    }

    if (customerId || order.customerPhone) {
      try {
        broadcastOrderUpdate({
          orderId: updatedOrder.id,
          customerId: updatedOrder.customer_id || customerId || updatedOrder.shipping_phone,
          status: updatedOrder.order_status,
          message: message || `Order status updated to ${status}`,
          updatedAt: updatedOrder.updated_at
        });
      } catch (wsError) {
        console.error('Failed to broadcast order update:', wsError);
      }
    }

    return c.json({ success: true, order });
  } catch (error) {
    console.error('[ORDER] Error updating order status:', error);
    return c.json({ error: 'Failed to update order', details: error.message }, 500);
  }
});

// Cancel order
orderRoutes.post('/:orderId/cancel', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const { reason } = await c.req.json();

    // ✅ SQL: Get and cancel order
    const ordersRepo = getOrdersRepository();
    const order = await ordersRepo.findById(orderId);
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Check if order can be cancelled
    if (['delivered', 'cancelled'].includes(order.order_status)) {
      return c.json({ 
        error: 'Order cannot be cancelled', 
        message: `Order is already ${order.order_status}` 
      }, 400);
    }

    // ✅ SQL: Update order to cancelled
    await ordersRepo.update(orderId, {
      order_status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    // ✅ SQL: Store cancellation tracking
    const db = getDbClient();
    await db.from('order_tracking').insert({
      id: `${orderId}_track_${Date.now()}`,
      order_id: orderId,
      status: 'cancelled',
      message: `Order cancelled. Reason: ${reason || 'Customer request'}`,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    const cancelledOrder = await ordersRepo.findById(orderId);

    console.log(`[ORDER] Cancelled order ${orderId}`);

    // BROADCAST CANCELLATION
     if (cancelledOrder.customer_id || cancelledOrder.shipping_phone) {
      try {
        broadcastOrderUpdate({
          orderId: cancelledOrder.id,
          customerId: cancelledOrder.customer_id || cancelledOrder.shipping_phone,
          status: 'cancelled',
          message: `Order cancelled: ${reason}`,
          updatedAt: cancelledOrder.updated_at
        });
      } catch (wsError) {
        console.error('Failed to broadcast order cancellation:', wsError);
      }
    }

    return c.json({ success: true, order: cancelledOrder });
  } catch (error) {
    console.error('[ORDER] Error cancelling order:', error);
    return c.json({ error: 'Failed to cancel order', details: error.message }, 500);
  }
});

// Get order tracking
orderRoutes.get('/:orderId/tracking', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    
    // ✅ SQL: Get order and tracking history
    const ordersRepo = getOrdersRepository();
    const order = await ordersRepo.findById(orderId);
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // ✅ SQL: Get tracking timeline
    const db = getDbClient();
    const { data: trackingHistory } = await db
      .from('order_tracking')
      .select('*')
      .eq('order_id', orderId)
      .order('timestamp', { ascending: true });
    
    const timeline = trackingHistory && trackingHistory.length > 0
      ? trackingHistory.map((t: any) => ({
          status: t.status,
          message: t.message,
          timestamp: t.timestamp
        }))
      : [
          {
            status: 'pending',
            message: 'Order placed successfully',
            timestamp: order.created_at
          }
        ];

    // Mock estimated delivery based on order date
    const estimatedDeliveryDate = new Date(order.created_at);
    estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3);

    return c.json({ 
      tracking: {
        orderId: order.id,
        orderNumber: order.order_number,
        currentStatus: order.order_status,
        estimatedDelivery: estimatedDeliveryDate.toISOString(),
        timeline,
        shippingAddress: {
          address: order.shipping_address,
          city: order.shipping_city,
          state: order.shipping_state,
          pincode: order.shipping_pincode
        }
      }
    });
  } catch (error) {
    console.error('[ORDER] Error fetching tracking:', error);
    return c.json({ error: 'Failed to fetch tracking', details: error.message }, 500);
  }
});

export default orderRoutes;
