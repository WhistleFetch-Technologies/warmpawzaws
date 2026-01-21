/**
 * ============================================================================
 * DELIVERY OTP & TRACKING ENDPOINTS
 * ============================================================================
 * 
 * Handles delivery tracking and OTP verification
 * - Get delivery status
 * - Update delivery status
 * - Verify delivery OTP
 * - Track delivery partner location
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';

// ============================================================================
// GET DELIVERY STATUS HANDLER
// ============================================================================

class GetDeliveryStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const orderId = context.event.pathParameters?.orderId;

    if (!orderId) {
      return this.error('Order ID is required', 400);
    }

    try {
      // Get order with delivery info
      const { rows: orders } = await query(
        `SELECT 
          o.id,
          o.status,
          o.delivery_status,
          o.delivery_otp,
          o.otp_verified,
          o.delivery_partner_id,
          o.estimated_delivery_time,
          o.actual_delivery_time,
          o.delivery_address,
          o.delivery_latitude,
          o.delivery_longitude,
          dp.name as partner_name,
          dp.phone as partner_phone,
          dp.photo_url as partner_photo_url,
          dp.vehicle_number,
          dp.current_latitude,
          dp.current_longitude,
          dp.last_location_update
        FROM orders o
        LEFT JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
        WHERE o.id = $1`,
        [orderId]
      );

      // Also check pharmacy_orders if not found
      if (orders.length === 0) {
        const { rows: pharmacyOrders } = await query(
          `SELECT 
            po.id,
            po.status,
            po.status as delivery_status,
            po.delivery_otp,
            po.otp_verified,
            po.delivery_partner_id,
            po.delivery_address,
            po.delivery_latitude,
            po.delivery_longitude,
            dp.name as partner_name,
            dp.phone as partner_phone,
            dp.photo_url as partner_photo_url,
            dp.vehicle_number,
            dp.current_latitude,
            dp.current_longitude,
            dp.last_location_update
          FROM pharmacy_orders po
          LEFT JOIN delivery_partners dp ON dp.id = po.delivery_partner_id
          WHERE po.id = $1`,
          [orderId]
        );

        if (pharmacyOrders.length === 0) {
          return this.error('Order not found', 404);
        }

        return this.formatDeliveryResponse(pharmacyOrders[0], orderId);
      }

      return this.formatDeliveryResponse(orders[0], orderId);
    } catch (error: any) {
      console.error('Error getting delivery status:', error);
      return this.error(error.message || 'Failed to get delivery status', 500);
    }
  }

  private async formatDeliveryResponse(order: any, orderId: string): Promise<HandlerResponse> {
    // Get status history
    const { rows: statusHistory } = await query(
      `SELECT status, created_at as timestamp, message
       FROM order_status_history 
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [orderId]
    ).catch(() => ({ rows: [] }));

    // Calculate ETA if partner has location
    let etaMinutes = null;
    let distanceKm = null;

    if (order.current_latitude && order.current_longitude && 
        order.delivery_latitude && order.delivery_longitude) {
      // Calculate distance using Haversine
      distanceKm = this.calculateDistance(
        order.current_latitude,
        order.current_longitude,
        order.delivery_latitude,
        order.delivery_longitude
      );
      // Estimate 30 km/h average speed
      etaMinutes = Math.ceil((distanceKm / 30) * 60);
    }

    // Determine status
    let deliveryStatus = order.delivery_status || order.status || 'placed';
    if (deliveryStatus === 'paid' || deliveryStatus === 'confirmed') deliveryStatus = 'confirmed';
    if (deliveryStatus === 'processing' || deliveryStatus === 'preparing') deliveryStatus = 'preparing';
    if (deliveryStatus === 'out_for_delivery' || deliveryStatus === 'in_transit') deliveryStatus = 'on_way';

    return this.success({
      success: true,
      orderId,
      status: deliveryStatus,
      delivery_status: deliveryStatus,
      partner_name: order.partner_name,
      partner_phone: order.partner_phone,
      partner_photo_url: order.partner_photo_url,
      vehicle_number: order.vehicle_number,
      current_location: order.current_latitude ? {
        latitude: order.current_latitude,
        longitude: order.current_longitude,
        timestamp: order.last_location_update,
      } : null,
      destination: {
        latitude: order.delivery_latitude,
        longitude: order.delivery_longitude,
        address: order.delivery_address,
      },
      eta_minutes: etaMinutes,
      distance_km: distanceKm,
      delivery_otp: order.delivery_otp,
      otp_verified: order.otp_verified || false,
      estimated_delivery_time: order.estimated_delivery_time,
      actual_delivery_time: order.actual_delivery_time,
      status_history: statusHistory.map((h: any) => ({
        status: h.status,
        timestamp: h.timestamp,
        message: h.message,
      })),
    });
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

// ============================================================================
// VERIFY DELIVERY OTP HANDLER
// ============================================================================

class VerifyDeliveryOtpHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const orderId = context.event.pathParameters?.orderId;
    const body = this.parseBody(context.event);
    const { otp } = body;

    if (!orderId || !otp) {
      return this.error('Order ID and OTP are required', 400);
    }

    try {
      // Try orders table first
      let order = await select('orders', { id: orderId });
      let tableName = 'orders';

      if (order.length === 0) {
        // Try pharmacy_orders
        order = await select('pharmacy_orders', { id: orderId });
        tableName = 'pharmacy_orders';
      }

      if (order.length === 0) {
        return this.error('Order not found', 404);
      }

      const orderData = order[0];

      // Check if already verified
      if (orderData.otp_verified) {
        return this.success({
          success: true,
          message: 'Delivery already confirmed',
          already_verified: true,
        });
      }

      // Verify OTP
      const expectedOtp = String(orderData.delivery_otp || '').trim();
      const providedOtp = String(otp).trim();

      if (expectedOtp !== providedOtp) {
        return this.error('Invalid OTP', 400);
      }

      // Mark as delivered
      await update(tableName, { id: orderId }, {
        otp_verified: true,
        status: 'delivered',
        delivery_status: 'delivered',
        actual_delivery_time: new Date(),
        updated_at: new Date(),
      });

      // Add to status history
      await insert('order_status_history', {
        order_id: orderId,
        status: 'delivered',
        message: 'Order delivered successfully',
        created_at: new Date(),
      }).catch(() => {});

      // Notify customer
      await insert('notifications', {
        user_id: orderData.customer_id,
        user_type: 'customer',
        type: 'order_delivered',
        title: '📦 Order Delivered!',
        message: 'Your order has been delivered successfully. Thank you for ordering!',
        data: JSON.stringify({ order_id: orderId }),
        is_read: false,
        created_at: new Date(),
      }).catch(() => {});

      return this.success({
        success: true,
        message: 'Delivery confirmed successfully',
        delivered_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error verifying delivery OTP:', error);
      return this.error(error.message || 'Failed to verify OTP', 500);
    }
  }
}

// ============================================================================
// UPDATE DELIVERY PARTNER LOCATION HANDLER
// ============================================================================

class UpdatePartnerLocationHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const partnerId = context.event.pathParameters?.partnerId;
    const body = this.parseBody(context.event);
    const { latitude, longitude, orderId, accuracy, speed, heading } = body;

    if (!partnerId || latitude === undefined || longitude === undefined) {
      return this.error('Partner ID, latitude, and longitude are required', 400);
    }

    try {
      // Update partner's current location
      await update('delivery_partners', { id: partnerId }, {
        current_latitude: latitude,
        current_longitude: longitude,
        last_location_update: new Date(),
      });

      // If order ID provided, store in delivery tracking
      if (orderId) {
        await insert('delivery_tracking_points', {
          order_id: orderId,
          partner_id: partnerId,
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          timestamp: new Date(),
        }).catch(() => {
          // Table might not exist
        });
      }

      return this.success({
        success: true,
        message: 'Location updated',
      });
    } catch (error: any) {
      console.error('Error updating partner location:', error);
      return this.error(error.message || 'Failed to update location', 500);
    }
  }
}

// ============================================================================
// UPDATE ORDER DELIVERY STATUS HANDLER
// ============================================================================

class UpdateDeliveryStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const orderId = context.event.pathParameters?.orderId;
    const body = this.parseBody(context.event);
    const { status, message, partnerId } = body;

    if (!orderId || !status) {
      return this.error('Order ID and status are required', 400);
    }

    const validStatuses = [
      'placed', 'confirmed', 'preparing', 'ready', 
      'picked_up', 'on_way', 'arriving', 'delivered', 'cancelled'
    ];

    if (!validStatuses.includes(status)) {
      return this.error('Invalid status', 400);
    }

    try {
      // Try orders table first
      let tableName = 'orders';
      let order = await select('orders', { id: orderId });
      
      if (order.length === 0) {
        order = await select('pharmacy_orders', { id: orderId });
        tableName = 'pharmacy_orders';
      }

      if (order.length === 0) {
        return this.error('Order not found', 404);
      }

      // Update order status
      const updateData: any = {
        delivery_status: status,
        updated_at: new Date(),
      };

      if (status === 'delivered') {
        updateData.status = 'delivered';
        updateData.actual_delivery_time = new Date();
      } else if (status === 'picked_up' || status === 'on_way') {
        updateData.status = 'out_for_delivery';
      }

      if (partnerId) {
        updateData.delivery_partner_id = partnerId;
      }

      await update(tableName, { id: orderId }, updateData);

      // Add to status history
      await insert('order_status_history', {
        order_id: orderId,
        status,
        message: message || null,
        created_at: new Date(),
      }).catch(() => {});

      // Notify customer of status change
      const statusMessages: Record<string, string> = {
        confirmed: 'Your order has been confirmed',
        preparing: 'Your order is being prepared',
        ready: 'Your order is ready for pickup',
        picked_up: 'Your order has been picked up by delivery partner',
        on_way: 'Your order is on the way',
        arriving: 'Your delivery partner is arriving',
        delivered: 'Your order has been delivered',
      };

      if (statusMessages[status]) {
        await insert('notifications', {
          user_id: order[0].customer_id,
          user_type: 'customer',
          type: 'delivery_update',
          title: '📦 Delivery Update',
          message: statusMessages[status],
          data: JSON.stringify({ order_id: orderId, status }),
          is_read: false,
          created_at: new Date(),
        }).catch(() => {});
      }

      return this.success({
        success: true,
        message: 'Status updated',
        status,
      });
    } catch (error: any) {
      console.error('Error updating delivery status:', error);
      return this.error(error.message || 'Failed to update status', 500);
    }
  }
}

// ============================================================================
// GENERATE DELIVERY OTP HANDLER
// ============================================================================

class GenerateDeliveryOtpHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const orderId = context.event.pathParameters?.orderId;

    if (!orderId) {
      return this.error('Order ID is required', 400);
    }

    try {
      // Generate 4-digit OTP
      const otp = Math.floor(1000 + Math.random() * 9000).toString();

      // Try orders table first
      let tableName = 'orders';
      let order = await select('orders', { id: orderId });
      
      if (order.length === 0) {
        order = await select('pharmacy_orders', { id: orderId });
        tableName = 'pharmacy_orders';
      }

      if (order.length === 0) {
        return this.error('Order not found', 404);
      }

      // If OTP already exists and not verified, return existing
      if (order[0].delivery_otp && !order[0].otp_verified) {
        return this.success({
          success: true,
          otp: order[0].delivery_otp,
          message: 'Existing OTP returned',
        });
      }

      // Update order with new OTP
      await update(tableName, { id: orderId }, {
        delivery_otp: otp,
        otp_verified: false,
        updated_at: new Date(),
      });

      return this.success({
        success: true,
        otp,
        message: 'Delivery OTP generated',
      });
    } catch (error: any) {
      console.error('Error generating delivery OTP:', error);
      return this.error(error.message || 'Failed to generate OTP', 500);
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerDeliveryOtpEndpoints(app: Hono) {
  const getStatusHandler = new GetDeliveryStatusHandler();
  const verifyOtpHandler = new VerifyDeliveryOtpHandler();
  const updateLocationHandler = new UpdatePartnerLocationHandler();
  const updateStatusHandler = new UpdateDeliveryStatusHandler();
  const generateOtpHandler = new GenerateDeliveryOtpHandler();

  // Get delivery status
  app.get('/delivery/:orderId/status', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/delivery/${c.req.param('orderId')}/status`,
      headers: {},
      body: '',
      pathParameters: { orderId: c.req.param('orderId') },
      queryStringParameters: {},
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'delivery-otp', functionVersion: '$LATEST' };
    const result = await getStatusHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Verify delivery OTP
  app.post('/delivery/:orderId/verify-otp', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: `/delivery/${c.req.param('orderId')}/verify-otp`,
      headers: {},
      body: JSON.stringify(body),
      pathParameters: { orderId: c.req.param('orderId') },
      queryStringParameters: {},
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'delivery-otp', functionVersion: '$LATEST' };
    const result = await verifyOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Generate delivery OTP
  app.post('/delivery/:orderId/generate-otp', async (c) => {
    const event = {
      httpMethod: 'POST',
      path: `/delivery/${c.req.param('orderId')}/generate-otp`,
      headers: {},
      body: '',
      pathParameters: { orderId: c.req.param('orderId') },
      queryStringParameters: {},
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'delivery-otp', functionVersion: '$LATEST' };
    const result = await generateOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Update delivery status
  app.post('/delivery/:orderId/update-status', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: `/delivery/${c.req.param('orderId')}/update-status`,
      headers: {},
      body: JSON.stringify(body),
      pathParameters: { orderId: c.req.param('orderId') },
      queryStringParameters: {},
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'delivery-otp', functionVersion: '$LATEST' };
    const result = await updateStatusHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Update partner location
  app.post('/delivery/partner/:partnerId/location', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: `/delivery/partner/${c.req.param('partnerId')}/location`,
      headers: {},
      body: JSON.stringify(body),
      pathParameters: { partnerId: c.req.param('partnerId') },
      queryStringParameters: {},
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'delivery-otp', functionVersion: '$LATEST' };
    const result = await updateLocationHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
