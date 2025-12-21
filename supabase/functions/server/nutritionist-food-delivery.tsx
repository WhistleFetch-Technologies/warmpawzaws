import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🍱 NUTRITIONIST FOOD DELIVERY SYSTEM
 * 
 * Rule 8 Compliance: Hyperlocal Food Delivery for Nutritionists
 * 
 * Features:
 * - Meal/Menu Management (for Nutritionists selling food)
 * - Subscription Ordering (Weekly/Monthly)
 * - Hyperlocal Delivery Integration
 * - Real-time Order Tracking
 */

interface MealItem {
  itemId: string;
  nutritionistId: string;
  name: string;
  description: string;
  type: 'fresh' | 'frozen' | 'dry' | 'treat';
  dietaryTags: string[]; // "Grain Free", "High Protein"
  ingredients: string[];
  nutritionalInfo: {
    calories: number;
    protein: string;
    fat: string;
    fiber: string;
  };
  price: number;
  isAvailable: boolean;
  preparationTime: number; // minutes
  images: string[];
}

interface MealOrder {
  orderId: string;
  customerId: string;
  nutritionistId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    customization?: string;
  }>;
  type: 'one-time' | 'subscription';
  subscriptionDetails?: {
    frequency: 'daily' | 'weekly';
    startDate: string;
    endDate: string;
    deliverySlot: 'morning' | 'afternoon' | 'evening';
  };
  deliveryAddress: {
    street: string;
    city: string;
    zip: string;
    location: { lat: number; lng: number };
  };
  status: 'placed' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  deliveryPartner?: {
    partnerId: string;
    name: string;
    phone: string;
    currentLocation?: { lat: number; lng: number };
  };
  totalAmount: number;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export function nutritionistFoodDeliveryEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

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
      const { nutritionistId, name, price, type } = body;

      if (!nutritionistId || !name || !price) {
        return sendError(c, 'Missing required fields', 400);
      }

      const itemId = `MEAL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const mealItem: MealItem = {
        itemId,
        ...body,
        isAvailable: true,
        images: body.images || [],
        createdAt: new Date().toISOString()
      };

      await kv.set(`meal_item:${itemId}`, mealItem);

      // Add to nutritionist's menu
      const menu = await kv.get(`nutritionist:${nutritionistId}:menu`) || [];
      menu.push(itemId);
      await kv.set(`nutritionist:${nutritionistId}:menu`, menu);

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
      
      const menuIds = await kv.get(`nutritionist:${nutritionistId}:menu`) || [];
      const menu = [];
      
      for (const id of menuIds) {
        const item = await kv.get(`meal_item:${id}`);
        if (item) menu.push(item);
      }

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

      const orderId = `FOOD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const order: MealOrder = {
        orderId,
        customerId,
        nutritionistId,
        items,
        type: type || 'one-time',
        subscriptionDetails,
        deliveryAddress,
        status: 'placed',
        totalAmount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`meal_order:${orderId}`, order);

      // Indexing for customer and nutritionist
      const customerOrders = await kv.get(`customer:${customerId}:meal_orders`) || [];
      customerOrders.unshift(orderId);
      await kv.set(`customer:${customerId}:meal_orders`, customerOrders);

      const nutritionistOrders = await kv.get(`nutritionist:${nutritionistId}:meal_orders`) || [];
      nutritionistOrders.unshift(orderId);
      await kv.set(`nutritionist:${nutritionistId}:meal_orders`, nutritionistOrders);

      // Trigger "New Order" Notification (Mock)
      console.log(`🔔 New Meal Order ${orderId} for Nutritionist ${nutritionistId}`);

      return sendSuccess(c, { order }, 'Order placed successfully');
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
      
      const order = await kv.get(`meal_order:${orderId}`);
      if (!order) return sendError(c, 'Order not found', 404);

      // Simulate finding a nearby runner
      const mockRunner = {
        partnerId: `RUNNER-${Math.floor(Math.random() * 1000)}`,
        name: 'Speedy Delivery',
        phone: '+919876543210',
        currentLocation: {
          lat: order.deliveryAddress.location.lat - 0.01,
          lng: order.deliveryAddress.location.lng - 0.01
        }
      };

      order.deliveryPartner = mockRunner;
      order.status = 'preparing'; // Or 'out_for_delivery' depending on flow
      order.updatedAt = new Date().toISOString();

      await kv.set(`meal_order:${orderId}`, order);

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
      const order = await kv.get(`meal_order:${orderId}`);
      
      if (!order) return sendError(c, 'Order not found', 404);

      // Simulate moving location if out for delivery
      if (order.status === 'out_for_delivery' && order.deliveryPartner?.currentLocation) {
        // Move slightly closer to destination
        const dest = order.deliveryAddress.location;
        const current = order.deliveryPartner.currentLocation;
        
        const newLat = current.lat + (dest.lat - current.lat) * 0.1;
        const newLng = current.lng + (dest.lng - current.lng) * 0.1;
        
        order.deliveryPartner.currentLocation = { lat: newLat, lng: newLng };
        // Don't save every tick in KV for simulation to avoid write spam, but in real app we would
      }

      return sendSuccess(c, { 
        status: order.status,
        deliveryPartner: order.deliveryPartner,
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
      
      const order = await kv.get(`meal_order:${orderId}`);
      if (!order) return sendError(c, 'Order not found', 404);

      order.status = status;
      order.updatedAt = new Date().toISOString();
      
      await kv.set(`meal_order:${orderId}`, order);

      return sendSuccess(c, { order }, 'Status updated');
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Nutritionist Food Delivery Endpoints registered');
}
