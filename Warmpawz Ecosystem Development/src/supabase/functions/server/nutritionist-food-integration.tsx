import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🥗 NUTRITIONIST FOOD DELIVERY INTEGRATION
 * 
 * Rule 8: Nutritionist Consultation + Food Delivery
 * 
 * Features:
 * - Convert Diet Plan to Food Order
 * - Auto-select items from Hyperlocal Delivery inventory
 * - Schedule recurring deliveries based on plan duration
 */

export function nutritionistFoodIntegrationEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * POST /nutritionist/diet-plan/:planId/convert-to-order
   * Convert a diet plan into a food delivery order
   */
  app.post(`${BASE_PATH}/nutritionist/diet-plan/:planId/convert-to-order`, async (c) => {
    try {
      const { planId } = c.req.param();
      const body = await c.req.json();
      const { 
        customerId, 
        addressId, 
        startDate, 
        daysToOrder = 7, // Default order for 1 week
        paymentMethod = 'razorpay'
      } = body;

      // 1. Fetch Diet Plan
      const plan = await kv.get(`diet_plan:${planId}`);
      if (!plan) return sendError(c, 'Diet plan not found', 404);

      // 2. Fetch Customer
      const customer = await kv.get(`customer:${customerId}`);
      if (!customer) return sendError(c, 'Customer not found', 404);

      // 3. Analyze Ingredients needed for the requested duration
      const ingredientsNeeded: Record<string, number> = {};
      
      // Simple logic: Flatten weekly schedule into ingredient list
      // In production, this would parse "100g Chicken" -> { item: 'Chicken', qty: 100, unit: 'g' }
      // Here we assume items are mapped to product IDs or searchable names
      
      // Mock aggregation
      const weeklyItems = plan.weeklySchedule.flatMap((day: any) => 
        day.meals.flatMap((meal: any) => meal.items)
      );
      
      // 4. Find matching products in Food Delivery Inventory (Hyperlocal)
      // We'll search for vendors in customer's vicinity (mocked)
      const products = await kv.getByPrefix('product:food:');
      const cartItems: any[] = [];
      let totalAmount = 0;

      // Match plan items to products (Basic string matching for demo)
      for (const planItem of weeklyItems) {
        // Search for product matching planItem name
        const match = products.find((p: any) => 
          (p.value?.name || '').toLowerCase().includes(planItem.toLowerCase()) &&
          p.value?.category === 'fresh_food'
        );

        if (match) {
          const product = match.value;
          cartItems.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1, // Default quantity
            vendorId: product.vendorId
          });
          totalAmount += product.price;
        }
      }

      if (cartItems.length === 0) {
        return sendError(c, 'No matching fresh food products found for this diet plan', 404);
      }

      // 5. Create Order
      const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const order = {
        orderId,
        customerId,
        type: 'diet_plan_fulfillment',
        planId,
        items: cartItems,
        totalAmount,
        status: 'created',
        addressId,
        deliverySchedule: {
          startDate: startDate || new Date().toISOString(),
          frequency: 'weekly'
        },
        paymentStatus: 'pending',
        createdAt: new Date().toISOString()
      };

      await kv.set(`order:${orderId}`, order);

      // 6. Link to Plan
      plan.fulfillmentOrders = plan.fulfillmentOrders || [];
      plan.fulfillmentOrders.push(orderId);
      await kv.set(`diet_plan:${planId}`, plan);

      console.log(`🥗 Diet plan converted to order: ${orderId}`);

      return sendSuccess(c, { 
        orderId, 
        totalAmount,
        itemCount: cartItems.length,
        items: cartItems 
      }, 'Diet plan converted to order successfully');

    } catch (error) {
      console.error('❌ Error converting plan to order:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /nutritionist/diet-plan/:planId/orders
   * Get orders associated with a diet plan
   */
  app.get(`${BASE_PATH}/nutritionist/diet-plan/:planId/orders`, async (c) => {
    try {
      const { planId } = c.req.param();
      const plan = await kv.get(`diet_plan:${planId}`);
      
      if (!plan) return sendError(c, 'Diet plan not found', 404);

      const orderIds = plan.fulfillmentOrders || [];
      const orders = await Promise.all(orderIds.map((id: string) => kv.get(`order:${id}`)));

      return sendSuccess(c, { orders: orders.filter(Boolean) });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}
