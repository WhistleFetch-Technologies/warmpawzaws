// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { 
  getMealPlansRepository,
  getCustomersRepository,
  getProductsRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

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

export function nutritionistFoodIntegrationEndpoints(app: Hono) {
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

      // ✅ SQL: Fetch Diet Plan from meal_plans table
      const mealPlansRepo = getMealPlansRepository();
      const planData = await mealPlansRepo.findById(planId);
      if (!planData) return sendError(c, 'Diet plan not found', 404);
      
      const plan = {
        ...planData.metadata,
        id: planData.id,
        weeklySchedule: planData.weekly_schedule || []
      };

      // ✅ SQL: Fetch Customer from customers table
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(customerId);
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
      
      // ✅ SQL: Find matching products in Food Delivery Inventory from products table
      const productsRepo = getProductsRepository();
      const allProducts = await productsRepo.findByCategory('food');
      const cartItems: any[] = [];
      let totalAmount = 0;

      // Match plan items to products (Basic string matching for demo)
      for (const planItem of weeklyItems) {
        // Search for product matching planItem name
        const match = allProducts.find((p: any) => 
          (p.name || '').toLowerCase().includes(planItem.toLowerCase()) &&
          p.category === 'fresh_food'
        );

        if (match) {
          cartItems.push({
            productId: match.id,
            name: match.name,
            price: match.sale_price || match.base_price,
            quantity: 1, // Default quantity
            vendorId: match.vendor_id
          });
          totalAmount += (match.sale_price || match.base_price);
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

      // ✅ SQL: Create order in orders table
      const db = getDbClient();
      await db
        .from('orders')
        .insert({
          id: orderId,
          customer_id: customerId,
          type: 'diet_plan_fulfillment',
          items: cartItems,
          total_amount: totalAmount,
          status: 'created',
          address_id: addressId,
          metadata: {
            planId,
            deliverySchedule: order.deliverySchedule
          },
          created_at: new Date().toISOString()
        });

      // ✅ SQL: Link to Plan - update meal_plan metadata
      const fulfillmentOrders = (planData.metadata?.fulfillmentOrders || []);
      fulfillmentOrders.push(orderId);
      await mealPlansRepo.update(planId, {
        metadata: {
          ...planData.metadata,
          fulfillmentOrders
        }
      });

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
      // ✅ SQL: Get plan and associated orders
      const mealPlansRepo = getMealPlansRepository();
      const planData = await mealPlansRepo.findById(planId);
      
      if (!planData) return sendError(c, 'Diet plan not found', 404);

      const orderIds = planData.metadata?.fulfillmentOrders || [];
      const db = getDbClient();
      const { data: ordersData } = await db
        .from('orders')
        .select('*')
        .in('id', orderIds);
      
      const orders = ordersData || [];

      return sendSuccess(c, { orders: orders.filter(Boolean) });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}
