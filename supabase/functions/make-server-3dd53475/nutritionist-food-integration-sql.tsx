/**
 * ============================================================================
 * NUTRITIONIST FOOD DELIVERY INTEGRATION - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Rule 8: Nutritionist Consultation + Food Delivery
 * 
 * Features:
 * - Convert Diet Plan to Food Order
 * - Auto-select items from Hyperlocal Delivery inventory
 * - Schedule recurring deliveries based on plan duration
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.getByPrefix()`, `kv.set()` with SQL queries
 * - Uses `OrdersRepository`, `ProductsRepository`, `CustomersRepository`
 * - Uses `orders`, `products`, `platform_settings` (for diet plans) tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 17 - KV to SQL (7 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getOrdersRepository } from '../../lib/repositories/orders.ts';
import { getProductsRepository } from '../../lib/repositories/products.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();
const ordersRepo = getOrdersRepository();
const productsRepo = getProductsRepository();
const customersRepo = getCustomersRepository();

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
        daysToOrder = 7,
        paymentMethod = 'razorpay'
      } = body;

      // ✅ SQL: Fetch Diet Plan from platform_settings
      const { data: planData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `diet_plan:${planId}`)
        .single();
      
      if (!planData?.setting_value) {
        return sendError(c, 'Diet plan not found', 404);
      }
      
      const plan = planData.setting_value;

      // ✅ SQL: Fetch Customer
      const customer = await customersRepo.findById(customerId);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // Analyze Ingredients needed for the requested duration
      const weeklyItems = plan.weeklySchedule?.flatMap((day: any) => 
        day.meals?.flatMap((meal: any) => meal.items || []) || []
      ) || [];

      // ✅ SQL: Find matching products in Food Delivery Inventory
      const { data: products } = await db
        .from('products')
        .select('*')
        .eq('category', 'fresh_food')
        .eq('is_active', true);
      
      const cartItems: any[] = [];
      let totalAmount = 0;

      // Match plan items to products (Basic string matching)
      for (const planItem of weeklyItems) {
        const match = products?.find((p: any) => 
          (p.name || '').toLowerCase().includes((planItem || '').toLowerCase())
        );

        if (match) {
          cartItems.push({
            productId: match.id,
            name: match.name,
            price: match.price,
            quantity: 1,
            vendorId: match.vendor_id
          });
          totalAmount += parseFloat(match.price || 0);
        }
      }

      if (cartItems.length === 0) {
        return sendError(c, 'No matching fresh food products found for this diet plan', 404);
      }

      // ✅ SQL: Create Order
      const orderNumber = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const order = await ordersRepo.create({
        customer_id: customerId,
        vendor_id: cartItems[0].vendorId,
        order_number: orderNumber,
        subtotal: totalAmount,
        tax_amount: 0,
        shipping_amount: 0,
        discount_amount: 0,
        total_amount: totalAmount,
        shipping_address: body.address || 'N/A',
        shipping_city: body.city || 'N/A',
        shipping_state: body.state || 'N/A',
        shipping_pincode: body.pincode || 'N/A',
        payment_status: 'pending',
        order_status: 'created',
        items: cartItems.map(item => ({
          product_id: item.productId,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price
        })),
        metadata: {
          type: 'diet_plan_fulfillment',
          planId,
          addressId,
          deliverySchedule: {
            startDate: startDate || new Date().toISOString(),
            frequency: 'weekly'
          }
        }
      });

      // ✅ SQL: Link to Plan (update diet plan with order ID)
      const updatedPlan = {
        ...plan,
        fulfillmentOrders: [...(plan.fulfillmentOrders || []), order.id]
      };
      
      await db
        .from('platform_settings')
        .update({
          setting_value: updatedPlan,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', `diet_plan:${planId}`);

      console.log(`🥗 Diet plan converted to order: ${order.id}`);

      return sendSuccess(c, { 
        orderId: order.id,
        orderNumber: order.order_number,
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
      
      // ✅ SQL: Get diet plan
      const { data: planData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `diet_plan:${planId}`)
        .single();
      
      if (!planData?.setting_value) {
        return sendError(c, 'Diet plan not found', 404);
      }
      
      const plan = planData.setting_value;
      const orderIds = plan.fulfillmentOrders || [];
      
      // ✅ SQL: Get all orders
      const orders = [];
      for (const orderId of orderIds) {
        const order = await ordersRepo.findById(orderId);
        if (order) {
          orders.push(order);
        }
      }

      return sendSuccess(c, { orders });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Nutritionist Food Integration endpoints (SQL-only) registered');
}

