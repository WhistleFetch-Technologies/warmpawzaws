/**
 * Complete Nutritionist Service
 * Meal plans and hyperlocal delivery
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

export function registerNutritionistMealPlanComplete(app: Hono) {
  /**
   * Create meal plan
   * POST /make-server-3dd53475/nutritionist/meal-plan/create
   */
  app.post('/make-server-3dd53475/nutritionist/meal-plan/create', async (c) => {
    try {
      const {
        vendorId,
        customerId,
        petId,
        planName,
        duration, // days
        meals, // [{ mealType: 'breakfast'|'lunch'|'dinner'|'snack', items: [], calories, nutrients }]
        totalCalories,
        specialRequirements,
        price,
      } = await c.req.json();

      if (!vendorId || !customerId || !petId || !meals || meals.length === 0) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const mealPlanId = `meal_plan_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const mealPlan = {
        id: mealPlanId,
        vendorId,
        customerId,
        petId,
        planName: planName || 'Custom Meal Plan',
        duration,
        meals,
        totalCalories,
        specialRequirements: specialRequirements || [],
        price: price || 0,
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`meal_plan:${mealPlanId}`, mealPlan);

      // Add to customer meal plans
      const customerMealPlansKey = `customer:${customerId}:meal_plans`;
      const customerMealPlans = await kv.get(customerMealPlansKey) || [];
      customerMealPlans.unshift(mealPlanId);
      await kv.set(customerMealPlansKey, customerMealPlans);

      return c.json({
        success: true,
        mealPlan,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Order meal from meal plan
   * POST /make-server-3dd53475/nutritionist/meal-plan/:mealPlanId/order
   */
  app.post('/make-server-3dd53475/nutritionist/meal-plan/:mealPlanId/order', async (c) => {
    try {
      const { mealPlanId } = c.req.param();
      const {
        mealType,
        deliveryDate,
        deliveryTime,
        deliveryAddress,
      } = await c.req.json();

      const mealPlan = await kv.get(`meal_plan:${mealPlanId}`);
      if (!mealPlan) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }

      const meal = mealPlan.meals.find((m: any) => m.mealType === mealType);
      if (!meal) {
        return c.json({ error: 'Meal type not found in plan' }, 404);
      }

      // Create delivery order
      const orderId = `meal_delivery_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const order = {
        id: orderId,
        mealPlanId,
        vendorId: mealPlan.vendorId,
        customerId: mealPlan.customerId,
        petId: mealPlan.petId,
        mealType,
        items: meal.items,
        deliveryDate,
        deliveryTime,
        deliveryAddress,
        status: 'pending',
        paymentStatus: 'pending',
        amount: meal.price || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`meal_delivery:${orderId}`, order);

      // Auto-assign delivery partner (hyperlocal)
      try {
        const vendor = await kv.get(`vendor:${mealPlan.vendorId}`);
        if (vendor && vendor.latitude && vendor.longitude) {
          const pickupLocation = {
            lat: vendor.latitude,
            lng: vendor.longitude,
            address: vendor.address || vendor.businessAddress,
          };

          const deliveryLocation = deliveryAddress.lat && deliveryAddress.lng
            ? { lat: deliveryAddress.lat, lng: deliveryAddress.lng, address: deliveryAddress.address }
            : undefined;

          const assignedPartner = await autoAssignDeliveryPartner(
            orderId,
            'meal_delivery',
            pickupLocation,
            deliveryLocation
          );

          if (assignedPartner) {
            order.deliveryPartnerId = assignedPartner.partnerId;
            order.deliveryPartnerName = assignedPartner.partnerName;
            order.deliveryPartnerPhone = assignedPartner.partnerPhone;
            await kv.set(`meal_delivery:${orderId}`, order);
          }
        }
      } catch (assignError) {
        console.error('Error assigning delivery partner:', assignError);
        // Non-blocking
      }

      return c.json({
        success: true,
        order,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get meal plan
   * GET /make-server-3dd53475/nutritionist/meal-plan/:mealPlanId
   */
  app.get('/make-server-3dd53475/nutritionist/meal-plan/:mealPlanId', async (c) => {
    try {
      const { mealPlanId } = c.req.param();
      const mealPlan = await kv.get(`meal_plan:${mealPlanId}`);

      if (!mealPlan) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }

      return c.json({
        success: true,
        mealPlan,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get customer meal plans
   * GET /make-server-3dd53475/nutritionist/meal-plans/customer/:customerId
   */
  app.get('/make-server-3dd53475/nutritionist/meal-plans/customer/:customerId', async (c) => {
    try {
      const { customerId } = c.req.param();
      const mealPlanIds = await kv.get(`customer:${customerId}:meal_plans`) || [];

      const mealPlans = await Promise.all(
        mealPlanIds.map(async (id: string) => {
          return await kv.get(`meal_plan:${id}`);
        })
      );

      return c.json({
        success: true,
        mealPlans: mealPlans.filter(p => p),
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
}

