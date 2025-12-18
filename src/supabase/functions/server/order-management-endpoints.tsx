import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { broadcastOrderUpdate } from './websocket-server.tsx';

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

    // Store order
    await kv.set(`order:${orderId}`, order);
    
    // Clear Cart if customerId is present
    if (customerId) {
      await kv.del(`cart:${customerId}`);
      console.log(`[ORDER] Cleared cart for customer ${customerId}`);
    }
    
    // Add to customer's order list
    const customerOrdersKey = `customer_orders:${customerPhone}`;
    const existingOrders = await kv.get(customerOrdersKey);
    const orderList = existingOrders ? JSON.parse(existingOrders) : [];
    orderList.unshift(orderId);
    await kv.set(customerOrdersKey, JSON.stringify(orderList));

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
    
    const customerOrdersKey = `customer_orders:${phone}`;
    const ordersData = await kv.get(customerOrdersKey);
    
    if (!ordersData) {
      return c.json({ orders: [] });
    }

    const orderIds = JSON.parse(ordersData);
    const orders = [];

    for (const orderId of orderIds) {
      const orderData = await kv.get(`order:${orderId}`);
      if (orderData) {
        orders.push(JSON.parse(orderData));
      }
    }

    // Sort by date, newest first
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ orders });
  } catch (error) {
    console.error('[ORDER] Error fetching customer orders:', error);
    return c.json({ error: 'Failed to fetch orders', details: error.message }, 500);
  }
});

// Get order details
orderRoutes.get('/:orderId', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    
    const orderData = await kv.get(`order:${orderId}`);
    
    if (!orderData) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const order = JSON.parse(orderData);
    return c.json({ order });
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

    const orderData = await kv.get(`order:${orderId}`);
    
    if (!orderData) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const order = JSON.parse(orderData);
    order.status = status;
    order.updatedAt = new Date().toISOString();
    
    // Update tracking history
    if (!order.trackingHistory) {
      order.trackingHistory = [];
    }
    
    order.trackingHistory.push({
      status,
      message: message || `Order ${status}`,
      timestamp: new Date().toISOString()
    });

    order.tracking = {
      status,
      message: message || `Order ${status}`,
      timestamp: new Date().toISOString()
    };

    await kv.set(`order:${orderId}`, order);

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
          orderId: order.id,
          customerId: customerId || order.customerPhone, // Broadcast to phone as ID if needed, assuming client subscribes to customer:{phone}
          status: order.status,
          message: message || `Order status updated to ${status}`,
          updatedAt: order.updatedAt
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

    const orderData = await kv.get(`order:${orderId}`);
    
    if (!orderData) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const order = JSON.parse(orderData);
    
    // Check if order can be cancelled
    if (['delivered', 'cancelled'].includes(order.status)) {
      return c.json({ 
        error: 'Order cannot be cancelled', 
        message: `Order is already ${order.status}` 
      }, 400);
    }

    order.status = 'cancelled';
    order.cancellationReason = reason;
    order.cancelledAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    
    if (!order.trackingHistory) {
      order.trackingHistory = [];
    }
    
    order.trackingHistory.push({
      status: 'cancelled',
      message: `Order cancelled. Reason: ${reason || 'Customer request'}`,
      timestamp: new Date().toISOString()
    });

    order.tracking = {
      status: 'cancelled',
      message: 'Order has been cancelled',
      timestamp: new Date().toISOString()
    };

    await kv.set(`order:${orderId}`, order);

    console.log(`[ORDER] Cancelled order ${orderId}`);

    // BROADCAST CANCELLATION
     if (order.customerId || order.customerPhone) {
      try {
        broadcastOrderUpdate({
          orderId: order.id,
          customerId: order.customerId || order.customerPhone,
          status: 'cancelled',
          message: `Order cancelled: ${reason}`,
          updatedAt: order.updatedAt
        });
      } catch (wsError) {
        console.error('Failed to broadcast order cancellation:', wsError);
      }
    }

    return c.json({ success: true, order });
  } catch (error) {
    console.error('[ORDER] Error cancelling order:', error);
    return c.json({ error: 'Failed to cancel order', details: error.message }, 500);
  }
});

// Get order tracking
orderRoutes.get('/:orderId/tracking', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    
    const orderData = await kv.get(`order:${orderId}`);
    
    if (!orderData) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const order = JSON.parse(orderData);
    
    // Generate tracking timeline
    const timeline = order.trackingHistory || [
      {
        status: 'pending',
        message: 'Order placed successfully',
        timestamp: order.createdAt
      }
    ];

    // Mock estimated delivery based on order date
    const estimatedDeliveryDate = new Date(order.createdAt);
    estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3);

    return c.json({ 
      tracking: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        currentStatus: order.status,
        estimatedDelivery: estimatedDeliveryDate.toISOString(),
        timeline,
        shippingAddress: order.address
      }
    });
  } catch (error) {
    console.error('[ORDER] Error fetching tracking:', error);
    return c.json({ error: 'Failed to fetch tracking', details: error.message }, 500);
  }
});

export default orderRoutes;
