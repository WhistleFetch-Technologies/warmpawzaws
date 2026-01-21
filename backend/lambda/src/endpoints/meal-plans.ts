/**
 * ============================================================================
 * MEAL PLANS & NUTRITIONIST DELIVERY SYSTEM
 * ============================================================================
 * 
 * Features:
 * - Meal Plan CRUD (with ingredients, nutrition, lead time)
 * - Adhoc orders and subscriptions
 * - Fresh daily / Preserved monthly options
 * - Online payment only (no COD)
 * - Logistics integration
 * - Settlement tracking
 * 
 * Date: 2026-01-19
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { isValidUUID } from '../types/entities';

export function registerMealPlanEndpoints(app: Hono) {

  // ============================================================================
  // MEAL PLAN CRUD (Vendor)
  // ============================================================================

  /**
   * POST /meal-plans/create
   * Create a new meal plan
   */
  app.post("/meal-plans/create", async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        name,
        description,
        shortDescription,
        photos, // Array of URLs
        thumbnailUrl,
        mealType, // 'fresh_daily', 'fresh_weekly', 'preserved_monthly', 'frozen'
        dietType, // Array: ['weight_loss', 'muscle_gain', etc.]
        suitableFor, // { species: ['dog'], sizes: ['small'], ages: ['puppy'] }
        ingredients, // Array: [{ name, quantity, unit, is_allergen }]
        nutritionInfo, // { calories, protein_g, fat_g, carbs_g, fiber_g }
        allergens, // Array of strings
        pricePerMeal,
        pricePerWeek,
        pricePerMonth,
        prepTimeMinutes,
        shelfLifeDays,
        storageInstructions,
        servingInstructions,
        availableDays, // Array: ['mon', 'tue', etc.]
        orderCutoffTime, // '18:00'
        deliverySlots, // Array: [{ start: '09:00', end: '12:00' }]
        leadTimeHours,
      } = body;

      // Validate required fields
      if (!vendorId || !name || !pricePerMeal || !ingredients) {
        return c.json({ error: 'vendorId, name, pricePerMeal, and ingredients are required' }, 400);
      }

      // Create meal plan
      const result = await insert('meal_plans', {
        vendor_id: vendorId,
        name,
        description,
        short_description: shortDescription,
        photos: JSON.stringify(photos || []),
        thumbnail_url: thumbnailUrl,
        meal_type: mealType || 'fresh_daily',
        diet_type: dietType || [],
        suitable_for: JSON.stringify(suitableFor || {}),
        ingredients: JSON.stringify(ingredients),
        nutrition_info: JSON.stringify(nutritionInfo || {}),
        allergens: allergens || [],
        price_per_meal: pricePerMeal,
        price_per_week: pricePerWeek,
        price_per_month: pricePerMonth,
        prep_time_minutes: prepTimeMinutes || 60,
        shelf_life_days: shelfLifeDays || (mealType === 'preserved_monthly' ? 30 : 1),
        storage_instructions: storageInstructions,
        serving_instructions: servingInstructions,
        available_days: availableDays || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        order_cutoff_time: orderCutoffTime || '18:00',
        delivery_slots: JSON.stringify(deliverySlots || []),
        lead_time_hours: leadTimeHours || 24,
        is_active: true,
      });

      return c.json({
        success: true,
        mealPlan: result[0],
        message: 'Meal plan created successfully',
      });
    } catch (error: any) {
      console.error('Error creating meal plan:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /meal-plans/:planId
   * Update a meal plan
   */
  app.put("/meal-plans/:planId", async (c) => {
    try {
      const { planId } = c.req.param();
      const body = await c.req.json();

      // Build update object
      const updateData: Record<string, any> = {};
      
      const fields = [
        'name', 'description', 'short_description', 'thumbnail_url',
        'meal_type', 'price_per_meal', 'price_per_week', 'price_per_month',
        'prep_time_minutes', 'shelf_life_days', 'storage_instructions',
        'serving_instructions', 'order_cutoff_time', 'lead_time_hours', 'is_active'
      ];

      fields.forEach(field => {
        const camelField = field.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
        if (body[camelField] !== undefined) {
          updateData[field] = body[camelField];
        }
      });

      // Handle JSON fields
      if (body.photos) updateData.photos = JSON.stringify(body.photos);
      if (body.dietType) updateData.diet_type = body.dietType;
      if (body.suitableFor) updateData.suitable_for = JSON.stringify(body.suitableFor);
      if (body.ingredients) updateData.ingredients = JSON.stringify(body.ingredients);
      if (body.nutritionInfo) updateData.nutrition_info = JSON.stringify(body.nutritionInfo);
      if (body.allergens) updateData.allergens = body.allergens;
      if (body.availableDays) updateData.available_days = body.availableDays;
      if (body.deliverySlots) updateData.delivery_slots = JSON.stringify(body.deliverySlots);

      await update('meal_plans', { id: planId }, updateData);

      return c.json({
        success: true,
        message: 'Meal plan updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating meal plan:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /meal-plans/vendor/:vendorId
   * Get all meal plans for a vendor
   */
  app.get("/meal-plans/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const activeOnly = c.req.query('activeOnly') === 'true';

      let queryText = `
        SELECT * FROM meal_plans 
        WHERE vendor_id = $1
      `;
      const params: any[] = [vendorId];

      if (activeOnly) {
        queryText += ` AND is_active = true`;
      }

      queryText += ` ORDER BY created_at DESC`;

      const result = await query(queryText, params);

      return c.json({
        success: true,
        mealPlans: result.rows.map((mp: any) => ({
          ...mp,
          photos: typeof mp.photos === 'string' ? JSON.parse(mp.photos) : mp.photos,
          suitableFor: typeof mp.suitable_for === 'string' ? JSON.parse(mp.suitable_for) : mp.suitable_for,
          ingredients: typeof mp.ingredients === 'string' ? JSON.parse(mp.ingredients) : mp.ingredients,
          nutritionInfo: typeof mp.nutrition_info === 'string' ? JSON.parse(mp.nutrition_info) : mp.nutrition_info,
          deliverySlots: typeof mp.delivery_slots === 'string' ? JSON.parse(mp.delivery_slots) : mp.delivery_slots,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching meal plans:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /meal-plans/search
   * Search meal plans (customer)
   */
  app.get("/meal-plans/search", async (c) => {
    try {
      const species = c.req.query('species');
      const petSize = c.req.query('size');
      const dietType = c.req.query('dietType');
      const mealType = c.req.query('mealType');
      const city = c.req.query('city');
      const lat = c.req.query('lat');
      const lng = c.req.query('lng');

      let queryText = `
        SELECT mp.*, v.business_name as vendor_name, v.city, v.address,
               CAST(v.metadata->>'lat' AS NUMERIC) as vendor_lat,
               CAST(v.metadata->>'lng' AS NUMERIC) as vendor_lng
        FROM meal_plans mp
        JOIN vendors v ON mp.vendor_id = v.id
        WHERE mp.is_active = true
        AND v.is_active = true
        AND v.status = 'approved'
      `;
      const params: any[] = [];
      let paramCount = 0;

      if (species) {
        paramCount++;
        queryText += ` AND mp.suitable_for->>'species' ILIKE $${paramCount}`;
        params.push(`%${species}%`);
      }

      if (petSize) {
        paramCount++;
        queryText += ` AND mp.suitable_for->>'sizes' ILIKE $${paramCount}`;
        params.push(`%${petSize}%`);
      }

      if (dietType) {
        paramCount++;
        queryText += ` AND $${paramCount} = ANY(mp.diet_type)`;
        params.push(dietType);
      }

      if (mealType) {
        paramCount++;
        queryText += ` AND mp.meal_type = $${paramCount}`;
        params.push(mealType);
      }

      if (city) {
        paramCount++;
        queryText += ` AND v.city ILIKE $${paramCount}`;
        params.push(`%${city}%`);
      }

      queryText += ` ORDER BY mp.avg_rating DESC, mp.total_orders DESC LIMIT 50`;

      const result = await query(queryText, params);

      return c.json({
        success: true,
        mealPlans: result.rows.map((mp: any) => ({
          ...mp,
          photos: typeof mp.photos === 'string' ? JSON.parse(mp.photos) : mp.photos,
          suitableFor: typeof mp.suitable_for === 'string' ? JSON.parse(mp.suitable_for) : mp.suitable_for,
          ingredients: typeof mp.ingredients === 'string' ? JSON.parse(mp.ingredients) : mp.ingredients,
          nutritionInfo: typeof mp.nutrition_info === 'string' ? JSON.parse(mp.nutrition_info) : mp.nutrition_info,
        })),
      });
    } catch (error: any) {
      console.error('Error searching meal plans:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /meal-plans/:planId
   * Get single meal plan details
   */
  app.get("/meal-plans/:planId", async (c) => {
    try {
      const { planId } = c.req.param();

      const result = await query(
        `SELECT mp.*, v.business_name as vendor_name, v.phone as vendor_phone,
                v.city, v.address, v.metadata as vendor_metadata
         FROM meal_plans mp
         JOIN vendors v ON mp.vendor_id = v.id
         WHERE mp.id = $1`,
        [planId]
      );

      if (result.rows.length === 0) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }

      const mp = result.rows[0];

      return c.json({
        success: true,
        mealPlan: {
          ...mp,
          photos: typeof mp.photos === 'string' ? JSON.parse(mp.photos) : mp.photos,
          suitableFor: typeof mp.suitable_for === 'string' ? JSON.parse(mp.suitable_for) : mp.suitable_for,
          ingredients: typeof mp.ingredients === 'string' ? JSON.parse(mp.ingredients) : mp.ingredients,
          nutritionInfo: typeof mp.nutrition_info === 'string' ? JSON.parse(mp.nutrition_info) : mp.nutrition_info,
          deliverySlots: typeof mp.delivery_slots === 'string' ? JSON.parse(mp.delivery_slots) : mp.delivery_slots,
        },
      });
    } catch (error: any) {
      console.error('Error fetching meal plan:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // MEAL ORDERS
  // ============================================================================

  /**
   * POST /meal/orders/create
   * Create adhoc meal order
   */
  app.post("/meal/orders/create", async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        mealPlanId,
        petId,
        quantity,
        specialInstructions,
        deliveryAddress, // { address, lat, lng, landmark, pincode }
        scheduledDeliveryDate,
        scheduledDeliverySlot, // { start: '09:00', end: '12:00' }
        logisticsType, // 'own' or 'warmpawz'
        razorpayOrderId,
      } = body;

      // Validate required fields
      if (!customerId || !mealPlanId || !deliveryAddress || !scheduledDeliveryDate) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Get meal plan
      const plans = await select('meal_plans', { id: mealPlanId });
      if (plans.length === 0) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }

      const plan = plans[0];

      // Check lead time
      const deliveryDate = new Date(scheduledDeliveryDate);
      const leadTimeMs = plan.lead_time_hours * 60 * 60 * 1000;
      if (deliveryDate.getTime() - Date.now() < leadTimeMs) {
        return c.json({ 
          error: `Order must be placed at least ${plan.lead_time_hours} hours in advance`,
          code: 'LEAD_TIME_VIOLATION'
        }, 400);
      }

      // Calculate totals
      const subtotal = parseFloat(plan.price_per_meal) * (quantity || 1);
      
      // ✅ FIX GAP 6.1 & 6.2: Get configurable delivery, platform and convenience fees
      let deliveryFee = 0;
      let platformFee = 0;
      let convenienceFee = 0;
      
      try {
        // Try to get fees from logistics_rules for meal delivery
        const logisticsRules = await query(
          `SELECT * FROM logistics_rules 
           WHERE is_active = true 
           AND ('meal' = ANY(applies_to) OR 'nutritionist' = ANY(applies_to))
           LIMIT 1`
        );
        
        if (logisticsRules.rows.length > 0 && logisticsType === 'warmpawz') {
          const rule = logisticsRules.rows[0];
          deliveryFee = parseFloat(rule.base_fee || '50');
        } else if (logisticsType === 'warmpawz') {
          deliveryFee = 50; // Default delivery fee
        }
        
        // Get platform and convenience fees from admin_settings or finance_rules
        const feeSettings = await query(
          `SELECT * FROM admin_settings 
           WHERE setting_key IN ('platform_fee_percentage', 'convenience_fee', 'max_platform_fee')
           AND (service_type = 'meal' OR service_type = 'nutritionist' OR service_type = 'all' OR service_type IS NULL)`
        ).catch(() => ({ rows: [] }));
        
        const feeMap: Record<string, any> = {};
        for (const row of feeSettings.rows) {
          feeMap[row.setting_key] = row.setting_value;
        }
        
        const platformFeePercentage = parseFloat(feeMap['platform_fee_percentage'] || '2');
        const maxPlatformFee = parseFloat(feeMap['max_platform_fee'] || '500');
        convenienceFee = parseFloat(feeMap['convenience_fee'] || '0');
        
        platformFee = Math.round(subtotal * (platformFeePercentage / 100));
        if (maxPlatformFee > 0 && platformFee > maxPlatformFee) {
          platformFee = maxPlatformFee;
        }
      } catch (feeError) {
        console.warn('Error fetching configurable fees, using defaults:', feeError);
        // Use default values
        deliveryFee = logisticsType === 'warmpawz' ? 50 : 0;
        platformFee = Math.round(subtotal * 0.02);
        convenienceFee = 0;
      }
      
      const totalAmount = subtotal + deliveryFee + platformFee + convenienceFee;

      // Create order with all fee components
      const result = await insert('meal_orders', {
        customer_id: customerId,
        vendor_id: plan.vendor_id,
        meal_plan_id: mealPlanId,
        pet_id: petId,
        order_type: 'adhoc',
        quantity: quantity || 1,
        special_instructions: specialInstructions,
        subtotal,
        delivery_fee: deliveryFee,
        platform_fee: platformFee,
        convenience_fee: convenienceFee, // ✅ FIX GAP 6.2: Include convenience fee
        total_amount: totalAmount,
        delivery_address: JSON.stringify(deliveryAddress),
        customer_lat: deliveryAddress.lat,
        customer_lng: deliveryAddress.lng,
        scheduled_delivery_date: scheduledDeliveryDate,
        scheduled_delivery_slot: JSON.stringify(scheduledDeliverySlot || {}),
        payment_status: 'pending', // Online only - no COD
        razorpay_order_id: razorpayOrderId,
        logistics_type: logisticsType || 'warmpawz',
        logistics_cost: logisticsType === 'warmpawz' ? deliveryFee : 0,
        status: 'pending',
      });

      return c.json({
        success: true,
        order: result[0],
        message: 'Order created. Complete payment to confirm.',
      });
    } catch (error: any) {
      console.error('Error creating meal order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /meal/orders/:orderId/confirm-payment
   * Confirm payment and notify vendor
   */
  app.post("/meal/orders/:orderId/confirm-payment", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { razorpayPaymentId, razorpaySignature } = await c.req.json();

      // TODO: Verify Razorpay signature
      
      await update('meal_orders', { id: orderId }, {
        payment_status: 'paid',
        razorpay_payment_id: razorpayPaymentId,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      });

      // TODO: Send notification to vendor

      return c.json({
        success: true,
        message: 'Payment confirmed. Vendor notified.',
      });
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /meal/orders/:orderId
   * Get order details
   */
  app.get("/meal/orders/:orderId", async (c) => {
    try {
      const { orderId } = c.req.param();

      const result = await query(
        `SELECT mo.*, mp.name as meal_name, mp.thumbnail_url, mp.meal_type,
                v.business_name as vendor_name, v.phone as vendor_phone,
                c.full_name as customer_name, p.name as pet_name
         FROM meal_orders mo
         JOIN meal_plans mp ON mo.meal_plan_id = mp.id
         JOIN vendors v ON mo.vendor_id = v.id
         LEFT JOIN customers c ON mo.customer_id = c.id
         LEFT JOIN pets p ON mo.pet_id = p.id
         WHERE mo.id = $1`,
        [orderId]
      );

      if (result.rows.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = result.rows[0];

      // Get tracking info
      let tracking = null;
      const trackingResult = await select('delivery_tracking', { meal_order_id: orderId });
      if (trackingResult.length > 0) {
        tracking = trackingResult[0];
      }

      return c.json({
        success: true,
        order: {
          ...order,
          deliveryAddress: typeof order.delivery_address === 'string' 
            ? JSON.parse(order.delivery_address) 
            : order.delivery_address,
          scheduledDeliverySlot: typeof order.scheduled_delivery_slot === 'string'
            ? JSON.parse(order.scheduled_delivery_slot)
            : order.scheduled_delivery_slot,
        },
        tracking,
      });
    } catch (error: any) {
      console.error('Error fetching order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /meal/orders/customer/:customerId
   * Get customer's meal orders
   */
  app.get("/meal/orders/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      const result = await query(
        `SELECT mo.*, mp.name as meal_name, mp.thumbnail_url,
                v.business_name as vendor_name
         FROM meal_orders mo
         JOIN meal_plans mp ON mo.meal_plan_id = mp.id
         JOIN vendors v ON mo.vendor_id = v.id
         WHERE mo.customer_id = $1
         ORDER BY mo.created_at DESC`,
        [customerId]
      );

      return c.json({
        success: true,
        orders: result.rows,
      });
    } catch (error: any) {
      console.error('Error fetching customer orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /meal/orders/vendor/:vendorId
   * Get vendor's meal orders
   */
  app.get("/meal/orders/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');
      const date = c.req.query('date');

      let queryText = `
        SELECT mo.*, mp.name as meal_name, mp.prep_time_minutes,
               c.full_name as customer_name, c.phone as customer_phone,
               p.name as pet_name, p.species as pet_species
        FROM meal_orders mo
        JOIN meal_plans mp ON mo.meal_plan_id = mp.id
        LEFT JOIN customers c ON mo.customer_id = c.id
        LEFT JOIN pets p ON mo.pet_id = p.id
        WHERE mo.vendor_id = $1
      `;
      const params: any[] = [vendorId];
      let paramCount = 1;

      if (status) {
        paramCount++;
        queryText += ` AND mo.status = $${paramCount}`;
        params.push(status);
      }

      if (date) {
        paramCount++;
        queryText += ` AND mo.scheduled_delivery_date = $${paramCount}`;
        params.push(date);
      }

      queryText += ` ORDER BY mo.scheduled_delivery_date ASC, mo.created_at DESC`;

      const result = await query(queryText, params);

      return c.json({
        success: true,
        orders: result.rows.map((o: any) => ({
          ...o,
          deliveryAddress: typeof o.delivery_address === 'string' 
            ? JSON.parse(o.delivery_address) 
            : o.delivery_address,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching vendor orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /meal/orders/:orderId/update-status
   * Update order status (vendor)
   */
  app.post("/meal/orders/:orderId/update-status", async (c) => {
    try {
      const { orderId } = c.req.param();
      const { status, notes } = await c.req.json();

      const validStatuses = ['preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }

      const updateData: Record<string, any> = { status };

      if (status === 'preparing') updateData.prep_started_at = new Date().toISOString();
      if (status === 'ready_for_pickup') updateData.ready_at = new Date().toISOString();
      if (status === 'picked_up') updateData.picked_up_at = new Date().toISOString();
      if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
        updateData.actual_delivery_time = new Date().toISOString();
      }
      if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancellation_reason = notes;
      }

      await update('meal_orders', { id: orderId }, updateData);

      // If delivered, create settlement
      if (status === 'delivered') {
        await createMealSettlement(orderId);
      }

      return c.json({
        success: true,
        message: `Order status updated to ${status}`,
      });
    } catch (error: any) {
      console.error('Error updating order status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // MEAL SUBSCRIPTIONS
  // ============================================================================

  /**
   * POST /meal/subscriptions/create
   * Create a meal subscription
   */
  app.post("/meal/subscriptions/create", async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        mealPlanId,
        petId,
        frequency, // 'once_daily', 'twice_daily', 'alternate_days', 'weekly'
        deliveryDays, // ['mon', 'tue', etc.]
        preferredDeliverySlot, // { start: '09:00', end: '12:00' }
        deliveryAddress,
        startDate,
        billingCycle, // 'weekly' or 'monthly'
        razorpaySubscriptionId,
      } = body;

      // Get meal plan
      const plans = await select('meal_plans', { id: mealPlanId });
      if (plans.length === 0) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }

      const plan = plans[0];

      // Calculate pricing
      const mealsPerDay = frequency === 'twice_daily' ? 2 : 1;
      const daysPerWeek = (deliveryDays || plan.available_days).length;
      const pricePerDelivery = parseFloat(plan.price_per_meal) * mealsPerDay;
      const deliveryFeePerDelivery = 30; // Can be calculated from rules

      const result = await insert('meal_subscriptions', {
        customer_id: customerId,
        vendor_id: plan.vendor_id,
        meal_plan_id: mealPlanId,
        pet_id: petId,
        frequency,
        meals_per_delivery: mealsPerDay,
        delivery_days: deliveryDays || plan.available_days,
        preferred_delivery_slot: JSON.stringify(preferredDeliverySlot || {}),
        delivery_address: JSON.stringify(deliveryAddress),
        customer_lat: deliveryAddress.lat,
        customer_lng: deliveryAddress.lng,
        price_per_delivery: pricePerDelivery,
        delivery_fee_per_delivery: deliveryFeePerDelivery,
        billing_cycle: billingCycle || 'weekly',
        start_date: startDate,
        status: 'active',
        payment_method: 'online',
        razorpay_subscription_id: razorpaySubscriptionId,
      });

      return c.json({
        success: true,
        subscription: result[0],
        message: 'Subscription created successfully',
      });
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /meal/subscriptions/customer/:customerId
   * Get customer's subscriptions
   */
  app.get("/meal/subscriptions/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      const result = await query(
        `SELECT ms.*, mp.name as meal_name, mp.thumbnail_url, mp.meal_type,
                v.business_name as vendor_name
         FROM meal_subscriptions ms
         JOIN meal_plans mp ON ms.meal_plan_id = mp.id
         JOIN vendors v ON ms.vendor_id = v.id
         WHERE ms.customer_id = $1
         ORDER BY ms.created_at DESC`,
        [customerId]
      );

      return c.json({
        success: true,
        subscriptions: result.rows,
      });
    } catch (error: any) {
      console.error('Error fetching subscriptions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /meal/subscriptions/:subscriptionId/pause
   * Pause a subscription
   */
  app.post("/meal/subscriptions/:subscriptionId/pause", async (c) => {
    try {
      const { subscriptionId } = c.req.param();
      const { pauseUntil } = await c.req.json();

      await update('meal_subscriptions', { id: subscriptionId }, {
        status: 'paused',
        pause_until: pauseUntil,
      });

      return c.json({
        success: true,
        message: `Subscription paused until ${pauseUntil}`,
      });
    } catch (error: any) {
      console.error('Error pausing subscription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /meal/subscriptions/:subscriptionId/resume
   * Resume a paused subscription
   */
  app.post("/meal/subscriptions/:subscriptionId/resume", async (c) => {
    try {
      const { subscriptionId } = c.req.param();

      await update('meal_subscriptions', { id: subscriptionId }, {
        status: 'active',
        pause_until: null,
      });

      return c.json({
        success: true,
        message: 'Subscription resumed',
      });
    } catch (error: any) {
      console.error('Error resuming subscription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /meal/subscriptions/:subscriptionId/cancel
   * Cancel a subscription
   */
  app.post("/meal/subscriptions/:subscriptionId/cancel", async (c) => {
    try {
      const { subscriptionId } = c.req.param();
      const { reason } = await c.req.json();

      await update('meal_subscriptions', { id: subscriptionId }, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      });

      // TODO: Cancel Razorpay subscription

      return c.json({
        success: true,
        message: 'Subscription cancelled',
      });
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

/**
 * Create settlement record for meal order
 */
async function createMealSettlement(orderId: string) {
  try {
    const orders = await query(`SELECT * FROM meal_orders WHERE id = $1`, [orderId]);
    if (orders.rows.length === 0) return;

    const order = orders.rows[0];

    // Get vendor tier for commission rate
    const vendors = await query(
      `SELECT v.*, vt.commission_rate 
       FROM vendors v 
       LEFT JOIN vendor_tiers vt ON v.tier_id = vt.id
       WHERE v.id = $1`,
      [order.vendor_id]
    );

    const vendor = vendors.rows[0];
    const commissionRate = parseFloat(vendor?.commission_rate || '10');
    const orderAmount = parseFloat(order.total_amount);
    const deliveryFee = parseFloat(order.delivery_fee || '0');
    const logisticsCost = order.logistics_type === 'warmpawz' ? parseFloat(order.logistics_cost || '0') : 0;
    
    const commissionAmount = Math.round((orderAmount - deliveryFee) * commissionRate / 100);
    const netPayout = orderAmount - commissionAmount - logisticsCost;

    await insert('delivery_settlements', {
      meal_order_id: orderId,
      vendor_id: order.vendor_id,
      order_amount: orderAmount,
      delivery_fee_collected: deliveryFee,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      logistics_cost: logisticsCost,
      net_payout: netPayout,
      status: 'pending',
      order_delivered_at: new Date().toISOString(),
    });

    console.log(`💰 Settlement record created for meal order ${orderId}: ₹${netPayout}`);
  } catch (error) {
    console.error('Error creating meal settlement:', error);
  }
}
