/**
 * ============================================================================
 * PHARMACY ORDERS ENDPOINTS
 * ============================================================================
 * 
 * Uber-like pharmacy order flow:
 * - Order broadcast to nearby pharmacies
 * - Accept/Reject workflow
 * - Availability confirmation
 * - Invoice generation
 * - Delivery dispatch with ETA
 * - Real-time tracking
 * 
 * Date: 2026-01-15
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, insert, select } from '../database/rds-connection';
import crypto from 'crypto';

// Configuration
const DEFAULT_PHARMACY_RADIUS_KM = 20;
const ORDER_TIMEOUT_MINUTES = 5;
const BASE_DELIVERY_FEE = 30;
const PER_KM_RATE = 10;

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate delivery fee based on distance
 */
function calculateDeliveryFee(distanceKm: number): number {
  return Math.round(BASE_DELIVERY_FEE + (distanceKm * PER_KM_RATE));
}

/**
 * Calculate ETA based on distance (average 20 km/h in city)
 */
function calculateETA(distanceKm: number): { minutes: number; rangeMin: number; rangeMax: number } {
  const avgSpeedKmh = 20;
  const prepTimeMinutes = 10; // Pharmacy prep time
  const baseMinutes = Math.round((distanceKm / avgSpeedKmh) * 60) + prepTimeMinutes;
  return {
    minutes: baseMinutes,
    rangeMin: baseMinutes - 5,
    rangeMax: baseMinutes + 10,
  };
}

/**
 * Generate order number
 */
function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PH-${year}-${random}`;
}

export function registerPharmacyOrderEndpoints(app: Hono) {
  
  /**
   * POST /pharmacy/orders/from-prescription
   * Create order from prescription and broadcast to nearby pharmacies
   */
  app.post("/pharmacy/orders/from-prescription", async (c) => {
    try {
      const body = await c.req.json();
      const { prescriptionId, customerId, customerLocation, deliveryAddress } = body;

      if (!prescriptionId || !customerId) {
        return c.json({ error: 'prescriptionId and customerId are required' }, 400);
      }

      // Get prescription details
      const prescriptions = await query(
        `SELECT p.*, b.vendor_id as vet_vendor_id, v.business_name as vet_name
         FROM prescriptions p
         LEFT JOIN bookings b ON p.booking_id = b.id
         LEFT JOIN vendors v ON b.vendor_id = v.id
         WHERE p.id = $1 OR p.booking_id = $1`,
        [prescriptionId]
      );

      if (prescriptions.rows.length === 0) {
        return c.json({ error: 'Prescription not found' }, 404);
      }

      const prescription = prescriptions.rows[0];

      // Get customer location (from body or customer profile)
      let customerLat = customerLocation?.latitude;
      let customerLon = customerLocation?.longitude;

      if (!customerLat || !customerLon) {
        const customer = await select('customers', { id: customerId });
        if (customer.length > 0 && customer[0].latitude && customer[0].longitude) {
          customerLat = customer[0].latitude;
          customerLon = customer[0].longitude;
        }
      }

      // Find nearby pharmacies within radius
      const pharmaciesResult = await query(`
        SELECT v.*, r.name as role_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE r.name = 'pet_pharmacy'
          AND v.status = 'approved'
          AND v.is_active = true
      `);

      const nearbyPharmacies = pharmaciesResult.rows.filter((pharmacy: any) => {
        if (!pharmacy.latitude || !pharmacy.longitude) return true; // Include if no location (for testing)
        if (!customerLat || !customerLon) return true; // Include all if customer has no location
        
        const distance = calculateDistance(
          customerLat, customerLon,
          pharmacy.latitude, pharmacy.longitude
        );
        return distance <= DEFAULT_PHARMACY_RADIUS_KM;
      }).map((pharmacy: any) => {
        const distance = (customerLat && customerLon && pharmacy.latitude && pharmacy.longitude)
          ? calculateDistance(customerLat, customerLon, pharmacy.latitude, pharmacy.longitude)
          : 5; // Default 5km if no location
        return {
          ...pharmacy,
          distance: Math.round(distance * 10) / 10,
          deliveryFee: calculateDeliveryFee(distance),
          eta: calculateETA(distance),
        };
      }).sort((a: any, b: any) => a.distance - b.distance);

      if (nearbyPharmacies.length === 0) {
        return c.json({ 
          error: 'No pharmacies available in your area',
          suggestion: 'Try again later or expand your search area'
        }, 404);
      }

      // Create the order
      const orderNumber = generateOrderNumber();
      const responseDeadline = new Date(Date.now() + ORDER_TIMEOUT_MINUTES * 60 * 1000);

      const orderResult = await query(`
        INSERT INTO orders (
          id, order_number, customer_id, status, payment_status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING *
      `, [
        crypto.randomUUID(),
        orderNumber,
        customerId,
        'broadcast', // New status for Uber-like flow
        'pending',
      ]);

      const order = orderResult.rows[0];

      // Create order items from prescription medications
      const medications = prescriptions.rows.map((p: any) => ({
        name: p.medication_name,
        dosage: p.dosage,
        frequency: p.frequency,
        duration: p.duration,
        instructions: p.instructions,
      }));

      for (const med of medications) {
        await query(`
          INSERT INTO order_items (id, order_id, product_name, quantity, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [crypto.randomUUID(), order.id, med.name, 1]);
      }

      // Create broadcast records for each pharmacy
      for (const pharmacy of nearbyPharmacies) {
        await query(`
          INSERT INTO pharmacy_order_broadcasts (
            id, order_id, pharmacy_id, status, broadcast_time, 
            distance_km, delivery_fee, eta_minutes, created_at
          ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, NOW())
        `, [
          crypto.randomUUID(),
          order.id,
          pharmacy.id,
          'pending',
          pharmacy.distance,
          pharmacy.deliveryFee,
          pharmacy.eta.minutes,
        ]);

        // TODO: Send push notification to pharmacy
        // await sendPushNotification(pharmacy.id, {
        //   title: '🔔 New Prescription Order',
        //   body: `New order ${orderNumber} - ${pharmacy.distance} km away`,
        //   data: { orderId: order.id, type: 'pharmacy_order' }
        // });
      }

      return c.json({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.order_number,
          status: 'broadcast',
          prescription: {
            id: prescription.id,
            vetName: prescription.vet_name,
            medications,
          },
        },
        broadcastedTo: nearbyPharmacies.length,
        pharmacies: nearbyPharmacies.map((p: any) => ({
          id: p.id,
          name: p.business_name,
          distance: p.distance,
          deliveryFee: p.deliveryFee,
          eta: p.eta,
        })),
        responseDeadline: responseDeadline.toISOString(),
        message: `Order broadcast to ${nearbyPharmacies.length} nearby pharmacies`,
      });
    } catch (error: any) {
      console.error('Error creating pharmacy order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /pharmacy/orders/incoming/:pharmacyId
   * Get incoming order broadcasts for a pharmacy
   */
  app.get("/pharmacy/orders/incoming/:pharmacyId", async (c) => {
    try {
      const { pharmacyId } = c.req.param();

      const broadcasts = await query(`
        SELECT 
          pob.*,
          o.order_number,
          o.customer_id,
          o.created_at as order_created_at,
          c.full_name as customer_name,
          c.phone as customer_phone
        FROM pharmacy_order_broadcasts pob
        INNER JOIN orders o ON pob.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE pob.pharmacy_id = $1
          AND pob.status = 'pending'
          AND o.status = 'broadcast'
        ORDER BY pob.broadcast_time DESC
      `, [pharmacyId]);

      // Get order items for each order
      const ordersWithItems = await Promise.all(broadcasts.rows.map(async (broadcast: any) => {
        const items = await query(`
          SELECT * FROM order_items WHERE order_id = $1
        `, [broadcast.order_id]);

        // Get prescription details
        const prescriptions = await query(`
          SELECT p.*, v.business_name as vet_name
          FROM prescriptions p
          LEFT JOIN bookings b ON p.booking_id = b.id
          LEFT JOIN vendors v ON b.vendor_id = v.id
          WHERE p.booking_id IN (
            SELECT id FROM bookings WHERE customer_id = $1 
            ORDER BY created_at DESC LIMIT 1
          )
        `, [broadcast.customer_id]);

        return {
          ...broadcast,
          items: items.rows,
          prescription: prescriptions.rows[0] || null,
          expiresIn: Math.max(0, Math.round((new Date(broadcast.broadcast_time).getTime() + ORDER_TIMEOUT_MINUTES * 60 * 1000 - Date.now()) / 1000)),
        };
      }));

      return c.json({
        success: true,
        incomingOrders: ordersWithItems,
        count: ordersWithItems.length,
      });
    } catch (error: any) {
      console.error('Error fetching incoming orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/accept
   * Pharmacy accepts an order
   */
  app.post("/pharmacy/orders/:orderId/accept", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const { pharmacyId, availableItems, unavailableItems, alternatives } = body;

      if (!pharmacyId) {
        return c.json({ error: 'pharmacyId is required' }, 400);
      }

      // Update broadcast status
      await query(`
        UPDATE pharmacy_order_broadcasts 
        SET status = 'accepted', response_time = NOW()
        WHERE order_id = $1 AND pharmacy_id = $2
      `, [orderId, pharmacyId]);

      // Reject all other pharmacies for this order
      await query(`
        UPDATE pharmacy_order_broadcasts 
        SET status = 'auto_rejected', response_time = NOW()
        WHERE order_id = $1 AND pharmacy_id != $2 AND status = 'pending'
      `, [orderId, pharmacyId]);

      // Update order with pharmacy
      await query(`
        UPDATE orders 
        SET vendor_id = $1, status = 'confirmed', updated_at = NOW()
        WHERE id = $2
      `, [pharmacyId, orderId]);

      // Get pharmacy details
      const pharmacy = await select('vendors', { id: pharmacyId });
      const broadcast = await query(`
        SELECT * FROM pharmacy_order_broadcasts 
        WHERE order_id = $1 AND pharmacy_id = $2
      `, [orderId, pharmacyId]);

      return c.json({
        success: true,
        message: 'Order accepted successfully',
        order: {
          id: orderId,
          status: 'confirmed',
          pharmacy: {
            id: pharmacyId,
            name: pharmacy[0]?.business_name,
            phone: pharmacy[0]?.phone,
          },
          deliveryFee: broadcast.rows[0]?.delivery_fee,
          eta: broadcast.rows[0]?.eta_minutes,
          availableItems,
          unavailableItems,
          alternatives,
        },
        nextStep: 'generate_invoice',
      });
    } catch (error: any) {
      console.error('Error accepting order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/reject
   * Pharmacy rejects an order
   */
  app.post("/pharmacy/orders/:orderId/reject", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const { pharmacyId, reason } = body;

      if (!pharmacyId) {
        return c.json({ error: 'pharmacyId is required' }, 400);
      }

      await query(`
        UPDATE pharmacy_order_broadcasts 
        SET status = 'rejected', response_time = NOW(), rejection_reason = $3
        WHERE order_id = $1 AND pharmacy_id = $2
      `, [orderId, pharmacyId, reason || 'Items unavailable']);

      // Check if all pharmacies rejected
      const pendingBroadcasts = await query(`
        SELECT COUNT(*) as count FROM pharmacy_order_broadcasts 
        WHERE order_id = $1 AND status = 'pending'
      `, [orderId]);

      if (parseInt(pendingBroadcasts.rows[0].count) === 0) {
        await query(`
          UPDATE orders SET status = 'no_pharmacy_available', updated_at = NOW()
          WHERE id = $1
        `, [orderId]);
      }

      return c.json({
        success: true,
        message: 'Order rejected',
        remainingPharmacies: parseInt(pendingBroadcasts.rows[0].count),
      });
    } catch (error: any) {
      console.error('Error rejecting order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/invoice
   * Generate invoice for order
   */
  app.post("/pharmacy/orders/:orderId/invoice", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const { items, deliveryFee, taxRate = 5 } = body;

      if (!items || items.length === 0) {
        return c.json({ error: 'items are required' }, 400);
      }

      // Calculate totals
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const taxAmount = Math.round(subtotal * taxRate / 100);
      const total = subtotal + taxAmount + (deliveryFee || 0);

      const invoiceData = {
        items,
        subtotal,
        taxRate,
        taxAmount,
        deliveryFee: deliveryFee || 0,
        total,
        generatedAt: new Date().toISOString(),
      };

      // Update order with invoice
      await query(`
        UPDATE orders 
        SET 
          total_amount = $2,
          discount_amount = 0,
          final_amount = $2,
          status = 'invoice_generated',
          updated_at = NOW()
        WHERE id = $1
      `, [orderId, total]);

      // Store invoice details (in a real system, store in separate table)
      // For now, we'll return the invoice

      return c.json({
        success: true,
        invoice: {
          orderId,
          ...invoiceData,
        },
        message: 'Invoice generated and sent to customer',
        nextStep: 'await_payment',
      });
    } catch (error: any) {
      console.error('Error generating invoice:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/payment
   * Process payment for order
   */
  app.post("/pharmacy/orders/:orderId/payment", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const { paymentMethod, paymentId } = body; // 'online' or 'cod'

      if (!paymentMethod) {
        return c.json({ error: 'paymentMethod is required (online or cod)' }, 400);
      }

      const newStatus = paymentMethod === 'cod' ? 'pending' : 'paid';
      const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

      await query(`
        UPDATE orders 
        SET 
          payment_method = $2,
          payment_status = $3,
          status = 'payment_confirmed',
          updated_at = NOW()
        WHERE id = $1
      `, [orderId, paymentMethod, newStatus]);

      return c.json({
        success: true,
        payment: {
          method: paymentMethod,
          status: newStatus,
        },
        deliveryOtp,
        message: paymentMethod === 'cod' 
          ? 'Order confirmed! Pay on delivery' 
          : 'Payment successful! Order confirmed',
        nextStep: 'prepare_order',
      });
    } catch (error: any) {
      console.error('Error processing payment:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/dispatch
   * Dispatch order for delivery
   */
  app.post("/pharmacy/orders/:orderId/dispatch", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const { deliveryPartner, deliveryPartnerId, deliveryPartnerName, deliveryPartnerPhone } = body;

      // Calculate ETA
      const broadcast = await query(`
        SELECT * FROM pharmacy_order_broadcasts 
        WHERE order_id = $1 AND status = 'accepted'
      `, [orderId]);

      const etaMinutes = broadcast.rows[0]?.eta_minutes || 30;
      const etaTime = new Date(Date.now() + etaMinutes * 60 * 1000);

      await query(`
        UPDATE orders 
        SET 
          status = 'dispatched',
          delivery_status = 'out_for_delivery',
          updated_at = NOW()
        WHERE id = $1
      `, [orderId]);

      return c.json({
        success: true,
        dispatch: {
          orderId,
          status: 'dispatched',
          deliveryPartner: deliveryPartner || 'Own Fleet',
          deliveryPartnerId,
          deliveryPartnerName,
          deliveryPartnerPhone,
          eta: {
            minutes: etaMinutes,
            time: etaTime.toISOString(),
          },
        },
        message: 'Order dispatched for delivery',
      });
    } catch (error: any) {
      console.error('Error dispatching order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /pharmacy/orders/:orderId/track
   * Get real-time tracking for order
   */
  app.get("/pharmacy/orders/:orderId/track", async (c) => {
    try {
      const { orderId } = c.req.param();

      const order = await query(`
        SELECT 
          o.*,
          v.business_name as pharmacy_name,
          v.phone as pharmacy_phone,
          v.address as pharmacy_address,
          v.latitude as pharmacy_lat,
          v.longitude as pharmacy_lon,
          c.full_name as customer_name,
          c.phone as customer_phone
        FROM orders o
        LEFT JOIN vendors v ON o.vendor_id = v.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = $1
      `, [orderId]);

      if (order.rows.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const orderData = order.rows[0];

      // Build tracking timeline
      const timeline = [
        { status: 'order_placed', label: 'Order Placed', completed: true, time: orderData.created_at },
        { status: 'pharmacy_confirmed', label: 'Pharmacy Confirmed', completed: ['confirmed', 'invoice_generated', 'payment_confirmed', 'preparing', 'dispatched', 'delivered'].includes(orderData.status), time: null },
        { status: 'invoice_generated', label: 'Invoice Generated', completed: ['invoice_generated', 'payment_confirmed', 'preparing', 'dispatched', 'delivered'].includes(orderData.status), time: null },
        { status: 'payment_confirmed', label: 'Payment Confirmed', completed: ['payment_confirmed', 'preparing', 'dispatched', 'delivered'].includes(orderData.status), time: null },
        { status: 'preparing', label: 'Preparing Order', completed: ['preparing', 'dispatched', 'delivered'].includes(orderData.status), time: null },
        { status: 'dispatched', label: 'Out for Delivery', completed: ['dispatched', 'delivered'].includes(orderData.status), time: null },
        { status: 'delivered', label: 'Delivered', completed: orderData.status === 'delivered', time: null },
      ];

      return c.json({
        success: true,
        order: {
          id: orderData.id,
          orderNumber: orderData.order_number,
          status: orderData.status,
          deliveryStatus: orderData.delivery_status,
          paymentStatus: orderData.payment_status,
          paymentMethod: orderData.payment_method,
          totalAmount: orderData.total_amount,
          pharmacy: {
            name: orderData.pharmacy_name,
            phone: orderData.pharmacy_phone,
            address: orderData.pharmacy_address,
            location: {
              lat: orderData.pharmacy_lat,
              lon: orderData.pharmacy_lon,
            },
          },
          customer: {
            name: orderData.customer_name,
            phone: orderData.customer_phone,
          },
          deliveryAddress: orderData.delivery_address,
        },
        timeline,
        liveTracking: {
          available: orderData.status === 'dispatched',
          // In production, get from delivery partner API
          currentLocation: null,
          etaMinutes: null,
        },
      });
    } catch (error: any) {
      console.error('Error tracking order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /pharmacy/:pharmacyId/orders
   * Get all orders for a pharmacy
   */
  app.get("/pharmacy/:pharmacyId/orders", async (c) => {
    try {
      const { pharmacyId } = c.req.param();
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50');

      let ordersQuery = `
        SELECT 
          o.*,
          c.full_name as customer_name,
          c.phone as customer_phone,
          pob.distance_km,
          pob.delivery_fee,
          pob.eta_minutes
        FROM orders o
        INNER JOIN pharmacy_order_broadcasts pob ON o.id = pob.order_id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.vendor_id = $1
      `;

      const params: any[] = [pharmacyId];
      if (status) {
        ordersQuery += ` AND o.status = $2`;
        params.push(status);
      }

      ordersQuery += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const orders = await query(ordersQuery, params);

      // Get items for each order
      const ordersWithItems = await Promise.all(orders.rows.map(async (order: any) => {
        const items = await query(`SELECT * FROM order_items WHERE order_id = $1`, [order.id]);
        return {
          ...order,
          items: items.rows,
        };
      }));

      return c.json({
        success: true,
        orders: ordersWithItems,
        count: ordersWithItems.length,
      });
    } catch (error: any) {
      console.error('Error fetching pharmacy orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/orders/:orderId/complete
   * Mark order as delivered
   */
  app.post("/pharmacy/orders/:orderId/complete", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const { otp, signature } = body;

      // In production, verify OTP
      // For now, just complete the order

      await query(`
        UPDATE orders 
        SET 
          status = 'delivered',
          delivery_status = 'delivered',
          payment_status = 'paid',
          updated_at = NOW()
        WHERE id = $1
      `, [orderId]);

      return c.json({
        success: true,
        message: 'Order delivered successfully',
        order: { id: orderId, status: 'delivered' },
      });
    } catch (error: any) {
      console.error('Error completing order:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
