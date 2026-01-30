/**
 * ============================================================================
 * MEAL SUBSCRIPTIONS ENDPOINTS
 * ============================================================================
 * 
 * Handles nutritionist meal subscription management
 * - Create meal subscriptions (daily, weekly, monthly)
 * - Auto-renewal for recurring subscriptions
 * - Subscription pause/resume/cancel
 * - Delivery scheduling
 * - Vendor order management
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update, withTransaction } from '../database/rds-connection';

// ============================================================================
// TYPES
// ============================================================================

type SubscriptionType = 'one_time' | 'daily' | 'weekly' | 'monthly';
type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'pending_payment';
type MealCategory = 'fresh' | 'frozen' | 'instant' | 'raw' | 'prescription';
type Purpose = 'weight_management' | 'allergies' | 'senior' | 'puppy' | 'digestive' | 'general';

interface MealPlan {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  description: string;
  category: MealCategory;
  purposes: Purpose[];
  price: number;
  discountedPrice?: number;
  servings: number;
  deliveryRadius: number;
  preparationTime: number;
  availableSubscriptionTypes: SubscriptionType[];
  image?: string;
  ingredients?: string[];
  nutritionInfo?: Record<string, any>;
  isAvailable: boolean;
}

interface MealSubscription {
  id: string;
  customerId: string;
  petId: string;
  vendorId: string;
  mealPlanId: string;
  subscriptionType: SubscriptionType;
  status: SubscriptionStatus;
  quantity: number;
  deliveryAddress: string;
  deliveryInstructions?: string;
  preferredDeliveryTime?: string;
  pricePerDelivery: number;
  nextDeliveryDate: string;
  lastDeliveryDate?: string;
  totalDeliveries: number;
  startDate: string;
  endDate?: string;
  pausedUntil?: string;
  autoRenew: boolean;
  paymentMethodId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// GET MEAL PLANS HANDLER
// ============================================================================

class GetMealPlansHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const params = context.event.queryStringParameters || {};
    const { lat, lng, category, purpose, maxRadius = '10' } = params;

    try {
      let queryStr = `
        SELECT 
          mp.*,
          v.business_name as vendor_name,
          v.address as vendor_address,
          v.lat as vendor_lat,
          v.lng as vendor_lng,
          COALESCE(
            ST_Distance(
              ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            ) / 1000,
            0
          ) as distance_km
        FROM meal_plans mp
        JOIN vendors v ON v.id = mp.vendor_id
        WHERE mp.is_available = true
          AND v.status = 'active'
      `;

      const values: any[] = [parseFloat(lng || '0'), parseFloat(lat || '0')];
      let paramIndex = 3;

      // Filter by category
      if (category) {
        queryStr += ` AND mp.category = $${paramIndex}`;
        values.push(category);
        paramIndex++;
      }

      // Filter by purpose
      if (purpose) {
        queryStr += ` AND $${paramIndex} = ANY(mp.purposes)`;
        values.push(purpose);
        paramIndex++;
      }

      // Filter by radius
      if (lat && lng) {
        queryStr += ` AND mp.delivery_radius >= COALESCE(
          ST_Distance(
            ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) / 1000,
          0
        )`;
      }

      queryStr += ` ORDER BY distance_km ASC, mp.created_at DESC LIMIT 50`;

      const { rows } = await query(queryStr, values);

      const mealPlans: MealPlan[] = rows.map(row => ({
        id: row.id,
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        name: row.name,
        description: row.description,
        category: row.category,
        purposes: row.purposes || [],
        price: parseFloat(row.price),
        discountedPrice: row.discounted_price ? parseFloat(row.discounted_price) : undefined,
        servings: row.servings,
        deliveryRadius: row.delivery_radius,
        preparationTime: row.preparation_time,
        availableSubscriptionTypes: row.available_subscription_types || ['one_time'],
        image: row.image,
        ingredients: row.ingredients,
        nutritionInfo: row.nutrition_info,
        isAvailable: row.is_available,
        distance: row.distance_km ? parseFloat(row.distance_km).toFixed(1) + ' km' : undefined,
        eta: row.preparation_time ? `${row.preparation_time + 30} min` : '45 min',
      }));

      return this.success({
        success: true,
        mealPlans,
        count: mealPlans.length,
        filters: {
          categories: ['fresh', 'frozen', 'instant', 'raw', 'prescription'],
          purposes: ['weight_management', 'allergies', 'senior', 'puppy', 'digestive', 'general'],
        },
      });
    } catch (error: any) {
      console.error('Error getting meal plans:', error);
      return this.error(error.message || 'Failed to get meal plans', 500);
    }
  }
}

// ============================================================================
// CREATE SUBSCRIPTION HANDLER
// ============================================================================

class CreateMealSubscriptionHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const {
      customerId,
      petId,
      vendorId,
      mealPlanId,
      subscriptionType,
      quantity = 1,
      deliveryAddress,
      deliveryInstructions,
      preferredDeliveryTime,
      autoRenew = true,
      paymentMethodId,
      startDate,
    } = body;

    if (!customerId || !vendorId || !mealPlanId || !subscriptionType || !deliveryAddress) {
      return this.error('Missing required fields', 400);
    }

    try {
      // Get meal plan details
      const plans = await select('meal_plans', { id: mealPlanId });
      if (plans.length === 0) {
        return this.error('Meal plan not found', 404);
      }
      const mealPlan = plans[0];

      // Calculate price
      const pricePerDelivery = (mealPlan.discounted_price || mealPlan.price) * quantity;

      // Calculate next delivery date
      const effectiveStartDate = startDate ? new Date(startDate) : new Date();
      const nextDeliveryDate = calculateNextDeliveryDate(effectiveStartDate, subscriptionType);

      // Create subscription
      const subscription = await withTransaction(async (client) => {
        const [sub] = await insert('meal_subscriptions', {
          customer_id: customerId,
          pet_id: petId,
          vendor_id: vendorId,
          meal_plan_id: mealPlanId,
          subscription_type: subscriptionType,
          status: subscriptionType === 'one_time' ? 'active' : 'pending_payment',
          quantity,
          delivery_address: deliveryAddress,
          delivery_instructions: deliveryInstructions || null,
          preferred_delivery_time: preferredDeliveryTime || null,
          price_per_delivery: pricePerDelivery,
          next_delivery_date: nextDeliveryDate,
          total_deliveries: 0,
          start_date: effectiveStartDate,
          auto_renew: autoRenew,
          payment_method_id: paymentMethodId || null,
          created_at: new Date(),
          updated_at: new Date(),
        });

        // Create first delivery order
        await insert('meal_orders', {
          subscription_id: sub.id,
          customer_id: customerId,
          vendor_id: vendorId,
          meal_plan_id: mealPlanId,
          quantity,
          price: pricePerDelivery,
          status: 'pending',
          delivery_date: nextDeliveryDate,
          delivery_address: deliveryAddress,
          delivery_instructions: deliveryInstructions || null,
          created_at: new Date(),
        });

        // Notify vendor
        await insert('notifications', {
          user_id: vendorId,
          user_type: 'vendor',
          type: 'new_meal_subscription',
          title: '🍽️ New Meal Subscription',
          message: `New ${subscriptionType} subscription for ${mealPlan.name}`,
          data: JSON.stringify({
            subscription_id: sub.id,
            meal_plan: mealPlan.name,
            subscription_type: subscriptionType,
            quantity,
          }),
          is_read: false,
          requires_action: true,
          created_at: new Date(),
        });

        return sub;
      });

      return this.success({
        success: true,
        subscriptionId: subscription.id,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          subscriptionType,
          pricePerDelivery,
          nextDeliveryDate: nextDeliveryDate.toISOString(),
          mealPlanName: mealPlan.name,
        },
        message: 'Subscription created successfully',
      });
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      return this.error(error.message || 'Failed to create subscription', 500);
    }
  }
}

// ============================================================================
// GET CUSTOMER SUBSCRIPTIONS HANDLER
// ============================================================================

class GetCustomerSubscriptionsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    try {
      const { rows } = await query(
        `SELECT 
          ms.*,
          mp.name as meal_plan_name,
          mp.category,
          mp.image as meal_plan_image,
          v.business_name as vendor_name
        FROM meal_subscriptions ms
        JOIN meal_plans mp ON mp.id = ms.meal_plan_id
        JOIN vendors v ON v.id = ms.vendor_id
        WHERE ms.customer_id = $1
        ORDER BY ms.created_at DESC`,
        [customerId]
      );

      const subscriptions = rows.map(row => ({
        id: row.id,
        mealPlanId: row.meal_plan_id,
        mealPlanName: row.meal_plan_name,
        mealPlanImage: row.meal_plan_image,
        category: row.category,
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        subscriptionType: row.subscription_type,
        status: row.status,
        quantity: row.quantity,
        pricePerDelivery: parseFloat(row.price_per_delivery),
        nextDeliveryDate: row.next_delivery_date,
        lastDeliveryDate: row.last_delivery_date,
        totalDeliveries: row.total_deliveries,
        autoRenew: row.auto_renew,
        pausedUntil: row.paused_until,
        createdAt: row.created_at,
      }));

      return this.success({
        success: true,
        subscriptions,
        activeCount: subscriptions.filter(s => s.status === 'active').length,
        totalCount: subscriptions.length,
      });
    } catch (error: any) {
      console.error('Error getting subscriptions:', error);
      return this.error(error.message || 'Failed to get subscriptions', 500);
    }
  }
}

// ============================================================================
// MANAGE SUBSCRIPTION HANDLER (Pause/Resume/Cancel)
// ============================================================================

class ManageSubscriptionHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const subscriptionId = context.event.pathParameters?.subscriptionId;
    const body = this.parseBody(context.event);
    const { action, pauseUntil, reason } = body;

    if (!subscriptionId || !action) {
      return this.error('Subscription ID and action are required', 400);
    }

    if (!['pause', 'resume', 'cancel'].includes(action)) {
      return this.error('Invalid action. Use: pause, resume, or cancel', 400);
    }

    try {
      const subscriptions = await select('meal_subscriptions', { id: subscriptionId });
      if (subscriptions.length === 0) {
        return this.error('Subscription not found', 404);
      }

      const subscription = subscriptions[0];
      let newStatus: SubscriptionStatus = subscription.status;
      let updates: any = { updated_at: new Date() };

      switch (action) {
        case 'pause':
          if (subscription.status !== 'active') {
            return this.error('Can only pause active subscriptions', 400);
          }
          newStatus = 'paused';
          updates.status = 'paused';
          if (pauseUntil) {
            updates.paused_until = new Date(pauseUntil);
          }
          break;

        case 'resume':
          if (subscription.status !== 'paused') {
            return this.error('Can only resume paused subscriptions', 400);
          }
          newStatus = 'active';
          updates.status = 'active';
          updates.paused_until = null;
          // Recalculate next delivery
          updates.next_delivery_date = calculateNextDeliveryDate(
            new Date(),
            subscription.subscription_type
          );
          break;

        case 'cancel':
          if (['cancelled', 'expired'].includes(subscription.status)) {
            return this.error('Subscription is already cancelled', 400);
          }
          newStatus = 'cancelled';
          updates.status = 'cancelled';
          updates.end_date = new Date();
          updates.cancellation_reason = reason || null;
          break;
      }

      await update('meal_subscriptions', { id: subscriptionId }, updates);

      // Notify vendor
      await insert('notifications', {
        user_id: subscription.vendor_id,
        user_type: 'vendor',
        type: 'subscription_update',
        title: `Subscription ${action.charAt(0).toUpperCase() + action.slice(1)}d`,
        message: `A customer has ${action}d their meal subscription`,
        data: JSON.stringify({
          subscription_id: subscriptionId,
          action,
          reason,
        }),
        is_read: false,
        created_at: new Date(),
      });

      return this.success({
        success: true,
        subscriptionId,
        newStatus,
        message: `Subscription ${action}d successfully`,
      });
    } catch (error: any) {
      console.error('Error managing subscription:', error);
      return this.error(error.message || 'Failed to manage subscription', 500);
    }
  }
}

// ============================================================================
// AUTO-RENEWAL JOB HANDLER
// ============================================================================

class ProcessSubscriptionRenewalsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      // Get subscriptions due for renewal
      const { rows: dueSubscriptions } = await query(
        `SELECT 
          ms.*,
          mp.name as meal_plan_name,
          mp.price as current_price,
          c.full_name as customer_name
        FROM meal_subscriptions ms
        JOIN meal_plans mp ON mp.id = ms.meal_plan_id
        JOIN customers c ON c.id = ms.customer_id
        WHERE ms.status = 'active'
          AND ms.auto_renew = true
          AND ms.subscription_type != 'one_time'
          AND ms.next_delivery_date <= NOW() + INTERVAL '1 day'
          AND (ms.paused_until IS NULL OR ms.paused_until < NOW())`
      );

      const processed: any[] = [];
      const failed: any[] = [];

      for (const sub of dueSubscriptions) {
        try {
          // Create new delivery order
          await insert('meal_orders', {
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            vendor_id: sub.vendor_id,
            meal_plan_id: sub.meal_plan_id,
            quantity: sub.quantity,
            price: sub.price_per_delivery,
            status: 'pending',
            delivery_date: sub.next_delivery_date,
            delivery_address: sub.delivery_address,
            delivery_instructions: sub.delivery_instructions,
            created_at: new Date(),
          });

          // Calculate next delivery date
          const nextDate = calculateNextDeliveryDate(
            new Date(sub.next_delivery_date),
            sub.subscription_type
          );

          // Update subscription
          await update('meal_subscriptions', { id: sub.id }, {
            last_delivery_date: sub.next_delivery_date,
            next_delivery_date: nextDate,
            total_deliveries: sub.total_deliveries + 1,
            updated_at: new Date(),
          });

          // Notify customer
          await insert('notifications', {
            user_id: sub.customer_id,
            user_type: 'customer',
            type: 'meal_delivery_scheduled',
            title: '🍽️ Meal Delivery Scheduled',
            message: `Your ${sub.meal_plan_name} is scheduled for delivery today.`,
            data: JSON.stringify({
              subscription_id: sub.id,
              meal_plan: sub.meal_plan_name,
            }),
            is_read: false,
            created_at: new Date(),
          });

          // Notify vendor
          await insert('notifications', {
            user_id: sub.vendor_id,
            user_type: 'vendor',
            type: 'meal_order_received',
            title: '🍽️ New Meal Order',
            message: `${sub.meal_plan_name} x${sub.quantity} for ${sub.customer_name}`,
            data: JSON.stringify({
              subscription_id: sub.id,
              customer_name: sub.customer_name,
              quantity: sub.quantity,
            }),
            is_read: false,
            requires_action: true,
            created_at: new Date(),
          });

          processed.push({
            subscriptionId: sub.id,
            mealPlan: sub.meal_plan_name,
            nextDelivery: nextDate,
          });
        } catch (err: any) {
          failed.push({
            subscriptionId: sub.id,
            error: err.message,
          });
        }
      }

      return this.success({
        success: true,
        message: `Processed ${processed.length} subscription renewals`,
        processed: processed.length,
        failed: failed.length,
        details: { processed, failed },
      });
    } catch (error: any) {
      console.error('Error processing renewals:', error);
      return this.error(error.message || 'Failed to process renewals', 500);
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateNextDeliveryDate(fromDate: Date, subscriptionType: SubscriptionType): Date {
  const date = new Date(fromDate);
  
  switch (subscriptionType) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'one_time':
    default:
      // For one-time, use the provided date or next day
      if (date <= new Date()) {
        date.setDate(date.getDate() + 1);
      }
      break;
  }

  return date;
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerMealSubscriptionEndpoints(app: Hono) {
  const getMealPlansHandler = new GetMealPlansHandler();
  const createSubHandler = new CreateMealSubscriptionHandler();
  const getCustomerSubsHandler = new GetCustomerSubscriptionsHandler();
  const manageSubHandler = new ManageSubscriptionHandler();
  const processRenewalsHandler = new ProcessSubscriptionRenewalsHandler();

  // Get meal plans
  app.get('/meals/plans', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: '/meals/plans',
      headers: {},
      body: '',
      pathParameters: {},
      queryStringParameters: Object.fromEntries(new URL(c.req.url).searchParams),
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'meal-subscriptions', functionVersion: '$LATEST' };
    const result = await getMealPlansHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Create subscription
  app.post('/meals/subscriptions', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: '/meals/subscriptions',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'meal-subscriptions', functionVersion: '$LATEST' };
    const result = await createSubHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get customer subscriptions
  app.get('/meals/subscriptions/customer/:customerId', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/meals/subscriptions/customer/${c.req.param('customerId')}`,
      headers: {},
      body: '',
      pathParameters: { customerId: c.req.param('customerId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'meal-subscriptions', functionVersion: '$LATEST' };
    const result = await getCustomerSubsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Manage subscription (pause/resume/cancel)
  app.post('/meals/subscriptions/:subscriptionId/manage', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: `/meals/subscriptions/${c.req.param('subscriptionId')}/manage`,
      headers: {},
      body: JSON.stringify(body),
      pathParameters: { subscriptionId: c.req.param('subscriptionId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'meal-subscriptions', functionVersion: '$LATEST' };
    const result = await manageSubHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Process renewals (scheduled job)
  app.post('/meals/subscriptions/process-renewals', async (c) => {
    const event = {
      httpMethod: 'POST',
      path: '/meals/subscriptions/process-renewals',
      headers: {},
      body: '',
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'meal-subscriptions', functionVersion: '$LATEST' };
    const result = await processRenewalsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
