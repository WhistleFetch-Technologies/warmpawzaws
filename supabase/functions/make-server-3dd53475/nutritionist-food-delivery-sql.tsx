/**
 * ============================================================================
 * NUTRITIONIST FOOD DELIVERY SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Rule 8 Compliance: Hyperlocal Food Delivery for Nutritionists
 * 
 * Features:
 * - Meal/Menu Management (for Nutritionists selling food)
 * - Subscription Ordering (Weekly/Monthly)
 * - Hyperlocal Delivery Integration
 * - Real-time Order Tracking
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `products` table for meal items
 * - Uses `orders` and `order_items` tables for meal orders
 * - Uses `deliveries` table for delivery tracking
 * 
 * Date: 2025-01-28
 * Migration: Batch 9 - 15 KV operations → 0
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';
import { getProductsRepository } from '../../lib/repositories/products.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';

export function nutritionistFoodDeliveryEndpointsSQL(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';
  const db = getDbClient();
  const productsRepo = getProductsRepository();
  const vendorsRepo = getVendorsRepository();

  // ==========================================
  // MENU MANAGEMENT (Nutritionist Side)
  // ==========================================

  /**
   * POST /nutritionist/meals/item
   * Add a meal item to the menu
   */
  app.post(`${BASE_PATH}/nutritionist/meals/item`, async (c) => {
    try {
      const body = await c.req.json();
      const { nutritionistId, name, price, type, description, dietaryTags, ingredients, nutritionalInfo, preparationTime, images } = body;

      if (!nutritionistId || !name || !price) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Verify nutritionist exists
      const vendor = await vendorsRepo.findById(nutritionistId);
      if (!vendor) {
        return sendError(c, 'Nutritionist not found', 404);
      }

      // ✅ SQL: Create meal item as product
      const mealItem = await productsRepo.create({
        vendor_id: nutritionistId,
        name,
        description: description || '',
        category: 'nutritionist_meal',
        subcategory: type || 'fresh',
        price: parseFloat(price),
        sku: `MEAL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        stock: 999999, // Unlimited for meals
        is_active: true,
        images: images || [],
        tags: dietaryTags || [],
        metadata: {
          type,
          dietaryTags,
          ingredients: ingredients || [],
          nutritionalInfo: nutritionalInfo || {},
          preparationTime: preparationTime || 30
        }
      });

      return sendSuccess(c, { mealItem }, 'Meal added to menu');
    } catch (error) {
      console.error('Error adding meal:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /nutritionist/:nutritionistId/menu
   * Get nutritionist's menu
   */
  app.get(`${BASE_PATH}/nutritionist/:nutritionistId/menu`, async (c) => {
    try {
      const { nutritionistId } = c.req.param();

      // ✅ SQL: Get all meal products for nutritionist
      const products = await productsRepo.findByVendor(nutritionistId, {
        category: 'nutritionist_meal',
        isActive: true
      });

      const menu = products.map((p: any) => ({
        itemId: p.id,
        nutritionistId: p.vendor_id,
        name: p.name,
        description: p.description,
        type: p.metadata?.type || 'fresh',
        dietaryTags: p.tags || [],
        ingredients: p.metadata?.ingredients || [],
        nutritionalInfo: p.metadata?.nutritionalInfo || {},
        price: parseFloat(p.price || 0),
        isAvailable: p.is_active && p.stock > 0,
        preparationTime: p.metadata?.preparationTime || 30,
        images: p.images || []
      }));

      return sendSuccess(c, { menu });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // ==========================================
  // ORDERING & SUBSCRIPTIONS (Customer Side)
  // ==========================================

  /**
   * POST /nutritionist/meals/order
   * Place a meal order (One-time or Subscription)
   */
  app.post(`${BASE_PATH}/nutritionist/meals/order`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        nutritionistId,
        items,
        type,
        subscriptionDetails,
        deliveryAddress,
        totalAmount
      } = body;

      if (!customerId || !nutritionistId || !items || !deliveryAddress) {
        return sendError(c, 'Missing required fields', 400);
      }

      const orderNumber = `FOOD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const now = new Date().toISOString();

      // ✅ SQL: Create order
      const { data: orderData, error: orderError } = await db
        .from('orders')
        .insert({
          customer_id: customerId,
          vendor_id: nutritionistId,
          order_number: orderNumber,
          order_status: 'pending',
          subtotal: totalAmount,
          total_amount: totalAmount,
          shipping_address: `${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.zip}`,
          shipping_city: deliveryAddress.city,
          shipping_state: deliveryAddress.state || '',
          shipping_pincode: deliveryAddress.zip,
          shipping_phone: deliveryAddress.phone || '',
          payment_status: 'pending',
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // ✅ SQL: Create order items
      for (const item of items) {
        await db
          .from('order_items')
          .insert({
            order_id: orderData.id,
            product_id: item.itemId,
            name: item.name || 'Meal Item',
            quantity: item.quantity || 1,
            unit_price: item.price || 0,
            total_price: (item.price || 0) * (item.quantity || 1)
          });
      }

      // ✅ SQL: Create delivery record if needed
      if (deliveryAddress.location) {
        await db
          .from('deliveries')
          .insert({
            order_id: orderNumber,
            order_type: 'meal_plan',
            customer_id: customerId,
            customer_name: deliveryAddress.name || '',
            customer_phone: deliveryAddress.phone || '',
            pickup_location: {
              vendor_id: nutritionistId,
              address: '', // Will be filled from vendor address
              lat: null,
              lng: null
            },
            drop_location: {
              address: deliveryAddress.street,
              city: deliveryAddress.city,
              zip: deliveryAddress.zip,
              lat: deliveryAddress.location.lat,
              lng: deliveryAddress.location.lng
            },
            status: 'pending',
            scheduled_date: new Date().toISOString().split('T')[0],
            scheduled_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
            created_at: now
          });
      }

      // Store subscription details in order metadata if subscription
      if (type === 'subscription' && subscriptionDetails) {
        await db
          .from('orders')
          .update({
            metadata: {
              type: 'subscription',
              subscriptionDetails
            }
          })
          .eq('id', orderData.id);
      }

      console.log(`🔔 New Meal Order ${orderNumber} for Nutritionist ${nutritionistId}`);

      return sendSuccess(c, { 
        order: {
          orderId: orderNumber,
          id: orderData.id,
          status: 'placed',
          totalAmount
        }
      }, 'Order placed successfully');
    } catch (error) {
      console.error('Error placing order:', error);
      return sendError(c, error, 500);
    }
  });

  // ==========================================
  // DELIVERY & TRACKING
  // ==========================================

  /**
   * POST /nutritionist/orders/:orderId/assign-delivery
   * Assign a delivery partner (Simulated Hyperlocal Integration)
   */
  app.post(`${BASE_PATH}/nutritionist/orders/:orderId/assign-delivery`, async (c) => {
    try {
      const { orderId } = c.req.param();

      // ✅ SQL: Get order
      const { data: order, error: orderError } = await db
        .from('orders')
        .select('*')
        .eq('order_number', orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      // ✅ SQL: Get delivery record
      const { data: delivery, error: deliveryError } = await db
        .from('deliveries')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (deliveryError) throw deliveryError;

      // Simulate finding a nearby runner
      const mockRunner = {
        partnerId: `RUNNER-${Math.floor(Math.random() * 1000)}`,
        name: 'Speedy Delivery',
        phone: '+919876543210',
        currentLocation: delivery?.drop_location?.lat ? {
          lat: delivery.drop_location.lat - 0.01,
          lng: delivery.drop_location.lng - 0.01
        } : null
      };

      // ✅ SQL: Update delivery with partner
      if (delivery) {
        await db
          .from('deliveries')
          .update({
            partner_id: mockRunner.partnerId,
            partner_name: mockRunner.name,
            partner_phone: mockRunner.phone,
            status: 'assigned',
            assigned_at: new Date().toISOString()
          })
          .eq('order_id', orderId);
      }

      // ✅ SQL: Update order status
      await db
        .from('orders')
        .update({
          order_status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      return sendSuccess(c, { order, partner: mockRunner }, 'Delivery partner assigned');
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /nutritionist/orders/:orderId/track
   * Track order status and location
   */
  app.get(`${BASE_PATH}/nutritionist/orders/:orderId/track`, async (c) => {
    try {
      const { orderId } = c.req.param();

      // ✅ SQL: Get order
      const { data: order, error: orderError } = await db
        .from('orders')
        .select('*')
        .eq('order_number', orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      // ✅ SQL: Get delivery record
      const { data: delivery, error: deliveryError } = await db
        .from('deliveries')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (deliveryError) throw deliveryError;

      let deliveryPartner = null;
      if (delivery?.partner_id) {
        deliveryPartner = {
          partnerId: delivery.partner_id,
          name: delivery.partner_name,
          phone: delivery.partner_phone,
          currentLocation: delivery.current_lat && delivery.current_lng ? {
            lat: delivery.current_lat,
            lng: delivery.current_lng
          } : null
        };
      }

      return sendSuccess(c, { 
        status: order.order_status,
        deliveryPartner,
        estimatedArrival: '15 mins' // Mock
      });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /nutritionist/orders/:orderId/status
   * Update order status
   */
  app.put(`${BASE_PATH}/nutritionist/orders/:orderId/status`, async (c) => {
    try {
      const { orderId } = c.req.param();
      const { status } = await c.req.json();

      // ✅ SQL: Get order
      const { data: order, error: orderError } = await db
        .from('orders')
        .select('*')
        .eq('order_number', orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      // ✅ SQL: Update order status
      const updateData: any = {
        order_status: status,
        updated_at: new Date().toISOString()
      };

      if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { data: updated, error } = await db
        .from('orders')
        .update(updateData)
        .eq('id', order.id)
        .select()
        .single();

      if (error) throw error;

      // ✅ SQL: Update delivery status if exists
      if (status === 'out_for_delivery' || status === 'delivered') {
        await db
          .from('deliveries')
          .update({
            status: status === 'delivered' ? 'delivered' : 'in_transit',
            delivered_at: status === 'delivered' ? new Date().toISOString() : null
          })
          .eq('order_id', orderId);
      }

      return sendSuccess(c, { order: updated }, 'Status updated');
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Nutritionist Food Delivery Endpoints registered (SQL-only)');
}
