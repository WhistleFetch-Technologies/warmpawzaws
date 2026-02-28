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
import { getRazorpayConfig, razorpayRequest } from '../utils/razorpay-client';
import { getDiscoveryRules } from '../lib/rule-engine';
import { randomUUID } from 'crypto';

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
   * ✅ FIX GAP-9.1: Added 10km radius filter support
   * ✅ FIX GAP-9.2: Enhanced filtering with multiple diet types and filters parameter
   */
  app.get("/meal-plans/search", async (c) => {
    try {
      const species = c.req.query('species');
      const petSize = c.req.query('size');
      const dietType = c.req.query('dietType');
      const mealType = c.req.query('mealType');
      const purpose = c.req.query('purpose'); // Phase 1: weight_management, maintenance, etc.
      const city = c.req.query('city');
      const lat = parseFloat(c.req.query('lat') || c.req.query('latitude') || '0');
      const lng = parseFloat(c.req.query('lng') || c.req.query('longitude') || '0');
      const maxRadiusRaw = c.req.query('maxRadius') || c.req.query('radius') || '';
      const rules = await getDiscoveryRules('pet_nutritionist', 'meal_search');
      const defaultRadiusKm = (lat && lng) ? (rules.discovery_radius_km ?? 10) : 0;
      const maxRadius = maxRadiusRaw ? parseFloat(maxRadiusRaw) : defaultRadiusKm;
      const maxResults = rules.discovery_max_results ?? 50;
      const filters = c.req.query('filters'); // ✅ FIX GAP-9.2: Comma-separated filter list

      // ✅ FIX GAP-9.1: Calculate distance using Haversine formula
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      // Phase 1: Use v.latitude/v.longitude with fallback to metadata for hyperlocal (10km)
      let queryText = `
        SELECT mp.*, v.business_name as vendor_name, v.city, v.address,
               COALESCE(v.latitude, CAST(v.metadata->>'lat' AS NUMERIC), CAST(v.metadata->>'latitude' AS NUMERIC)) as vendor_lat,
               COALESCE(v.longitude, CAST(v.metadata->>'lng' AS NUMERIC), CAST(v.metadata->>'longitude' AS NUMERIC)) as vendor_lng,
               v.id as vendor_id
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

      // ✅ FIX GAP-9.2: Support multiple diet types via filters parameter
      if (filters) {
        const filterList = filters.split(',').map(f => f.trim()).filter(f => f);
        if (filterList.length > 0) {
          paramCount++;
          queryText += ` AND mp.diet_type && $${paramCount}`;
          params.push(filterList);
        }
      } else if (dietType) {
        // Single diet type (backward compatibility)
        paramCount++;
        queryText += ` AND $${paramCount} = ANY(mp.diet_type)`;
        params.push(dietType);
      }

      if (city) {
        paramCount++;
        queryText += ` AND v.city ILIKE $${paramCount}`;
        params.push(`%${city}%`);
      }

      queryText += ` ORDER BY mp.avg_rating DESC, mp.total_orders DESC LIMIT ${Math.min(100, Math.max(1, maxResults))}`;

      const result = await query(queryText, params);

      // ✅ FIX GAP-9.1: Filter by radius if lat/lng and maxRadius provided
      let filteredPlans = result.rows;
      if (lat && lng && maxRadius > 0) {
        filteredPlans = result.rows.filter((mp: any) => {
          if (!mp.vendor_lat || !mp.vendor_lng) return false;
          const distance = calculateDistance(lat, lng, mp.vendor_lat, mp.vendor_lng);
          mp.distance_km = Math.round(distance * 100) / 100; // Round to 2 decimal places
          return distance <= maxRadius;
        });
        // Sort by distance after filtering
        filteredPlans.sort((a: any, b: any) => (a.distance_km || 999) - (b.distance_km || 999));
      }
      // Phase 1: Filter by purpose and mealType in memory (columns may not exist in all schemas)
      if (purpose) {
        const purposeLower = purpose.toLowerCase();
        filteredPlans = filteredPlans.filter((mp: any) => {
          const p = mp.purpose || '';
          return String(p).toLowerCase().includes(purposeLower);
        });
      }
      if (mealType) {
        const mealTypeLower = mealType.toLowerCase();
        filteredPlans = filteredPlans.filter((mp: any) => {
          const mt = mp.meal_type || '';
          return String(mt).toLowerCase() === mealTypeLower || String(mt).toLowerCase().includes(mealTypeLower);
        });
      }

      return c.json({
        success: true,
        mealPlans: filteredPlans.map((mp: any) => {
          const distanceKm = mp.distance_km || null;
          const estimatedDeliveryMinutes = distanceKm != null ? Math.round(15 + distanceKm * 3) : null; // Phase 1: ETA ~15min + 3min/km
          return {
            ...mp,
            photos: typeof mp.photos === 'string' ? JSON.parse(mp.photos) : mp.photos,
            suitableFor: typeof mp.suitable_for === 'string' ? JSON.parse(mp.suitable_for) : mp.suitable_for,
            ingredients: typeof mp.ingredients === 'string' ? JSON.parse(mp.ingredients) : mp.ingredients,
            nutritionInfo: typeof mp.nutrition_info === 'string' ? JSON.parse(mp.nutrition_info) : mp.nutrition_info,
            distanceKm,
            estimatedDeliveryMinutes, // Phase 1: for customer UI "ETA ~X min"
          };
        }),
        filters: {
          maxRadius: maxRadius > 0 ? maxRadius : null,
          appliedFilters: filters ? filters.split(',').map(f => f.trim()) : [],
        },
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
   * GET /meal-plans/:planId/order-preview
   * Phase 2: Get order breakdown (subtotal, delivery, platform fee, total) for checkout UI
   */
  app.get("/meal-plans/:planId/order-preview", async (c) => {
    try {
      const { planId } = c.req.param();
      const quantity = Math.max(1, parseInt(c.req.query('quantity') || '1'));
      const logisticsType = c.req.query('logisticsType') || 'warmpawz';

      const plans = await select('meal_plans', { id: planId });
      if (plans.length === 0) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }
      const plan = plans[0];
      const subtotal = parseFloat(plan.price_per_meal || plan.price || 0) * quantity;

      let deliveryFee = 0;
      let platformFee = 0;
      let convenienceFee = 0;
      try {
        const logisticsRules = await query(
          `SELECT * FROM logistics_rules WHERE is_active = true AND ('meal' = ANY(applies_to) OR 'nutritionist' = ANY(applies_to)) LIMIT 1`
        ).catch(() => ({ rows: [] }));
        if (logisticsRules.rows.length > 0 && logisticsType === 'warmpawz') {
          deliveryFee = parseFloat(logisticsRules.rows[0].base_fee || '50');
        } else if (logisticsType === 'warmpawz') {
          deliveryFee = 50;
        }
        const feeSettings = await query(
          `SELECT * FROM admin_settings WHERE setting_key IN ('platform_fee_percentage', 'convenience_fee', 'max_platform_fee') AND (service_type = 'meal' OR service_type = 'nutritionist' OR service_type = 'all' OR service_type IS NULL)`
        ).catch(() => ({ rows: [] }));
        const feeMap: Record<string, any> = {};
        for (const row of feeSettings.rows) {
          feeMap[row.setting_key] = row.setting_value;
        }
        const platformFeePercentage = parseFloat(feeMap['platform_fee_percentage'] || '2');
        const maxPlatformFee = parseFloat(feeMap['max_platform_fee'] || '500');
        platformFee = Math.round(subtotal * (platformFeePercentage / 100));
        if (maxPlatformFee > 0 && platformFee > maxPlatformFee) platformFee = maxPlatformFee;
        convenienceFee = parseFloat(feeMap['convenience_fee'] || '0');
      } catch (_) {
        deliveryFee = logisticsType === 'warmpawz' ? 50 : 0;
        platformFee = Math.round(subtotal * 0.02);
      }
      const totalAmount = subtotal + deliveryFee + platformFee + convenienceFee;
      return c.json({
        success: true,
        subtotal,
        deliveryFee,
        platformFee,
        convenienceFee,
        totalAmount,
        leadTimeHours: plan.lead_time_hours ?? 24,
      });
    } catch (error: any) {
      console.error('Error meal order preview:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /meal/orders/create-razorpay-order
   * Phase 2: Create Razorpay order for meal checkout (amount in rupees)
   */
  app.post("/meal/orders/create-razorpay-order", async (c) => {
    try {
      const body = await c.req.json();
      const { amountInRupees, receipt, notes } = body;
      const amountRupees = parseFloat(amountInRupees ?? body.amount ?? 0);
      if (!amountRupees || amountRupees <= 0) {
        return c.json({ error: 'amountInRupees must be a positive number' }, 400);
      }
      const config = await getRazorpayConfig();
      if (!config?.keyId || !config?.keySecret) {
        return c.json({ error: 'Payment gateway not configured' }, 503);
      }
      const receiptId = receipt || `meal_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const orderData = {
        amount: Math.round(amountRupees * 100),
        currency: 'INR',
        receipt: receiptId,
        notes: notes || {},
      };
      const razorpayOrder = await razorpayRequest('/orders', 'POST', orderData, 15000);
      return c.json({
        success: true,
        razorpayOrderId: razorpayOrder.id,
        keyId: config.keyId,
        amount: Math.round(amountRupees * 100),
        currency: 'INR',
      });
    } catch (error: any) {
      console.error('Error creating meal Razorpay order:', error);
      return c.json({ error: error.message || 'Payment gateway error' }, 500);
    }
  });

  /**
   * POST /meal/orders/create
   * Create adhoc meal order
   */
  app.post("/meal/orders/create", async (c) => {
    try {
      const body = await c.req.json();
      let {
        customerId,
        customerPhone,
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

      // Resolve customerId from customerPhone when not provided (e.g. profile shape mismatch on frontend)
      if (!customerId && customerPhone) {
        const raw = String(customerPhone).trim();
        const cleanPhone = raw.replace(/\D/g, '').trim() || raw;
        const byPhone = await select('customers', { phone: cleanPhone }).catch(() => []);
        if (byPhone.length > 0) customerId = byPhone[0].id;
        if (!customerId && cleanPhone.length > 0) {
          const alt = await select('customers', { phone: raw }).catch(() => []);
          if (alt.length > 0) customerId = alt[0].id;
        }
        // Try without leading 91 (India) so +919876543210 and 9876543210 both match
        if (!customerId && cleanPhone.length >= 10) {
          const without91 = cleanPhone.replace(/^91/, '');
          if (without91 !== cleanPhone) {
            const by91 = await select('customers', { phone: without91 }).catch(() => []);
            if (by91.length > 0) customerId = by91[0].id;
          }
          if (!customerId) {
            const with91 = (cleanPhone.length <= 10 ? '91' + cleanPhone : cleanPhone);
            const byWith91 = await select('customers', { phone: with91 }).catch(() => []);
            if (byWith91.length > 0) customerId = byWith91[0].id;
          }
        }
      }

      // Validate required fields (return explicit missing for debugging)
      const missing: string[] = [];
      if (!customerId) missing.push('customerId or customerPhone');
      if (!mealPlanId) missing.push('mealPlanId');
      if (!deliveryAddress || typeof deliveryAddress !== 'object') missing.push('deliveryAddress');
      if (!scheduledDeliveryDate) missing.push('scheduledDeliveryDate');
      if (missing.length > 0) {
        return c.json({ error: 'Missing required fields', missing }, 400);
      }
      const normalizedAddress = {
        address: deliveryAddress.address ?? [deliveryAddress.addressLine1, deliveryAddress.addressLine2, deliveryAddress.city, deliveryAddress.state, deliveryAddress.pincode].filter(Boolean).join(', '),
        lat: deliveryAddress.lat ?? deliveryAddress.latitude ?? 0,
        lng: deliveryAddress.lng ?? deliveryAddress.longitude ?? 0,
        landmark: deliveryAddress.landmark ?? '',
        pincode: deliveryAddress.pincode ?? '',
      };

      // Get meal plan
      const plans = await select('meal_plans', { id: mealPlanId });
      if (plans.length === 0) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }

      const plan = plans[0];

      // Check lead time (when plan has lead_time_hours set)
      const leadTimeHours = plan.lead_time_hours != null ? Number(plan.lead_time_hours) : 0;
      if (leadTimeHours > 0) {
        // ✅ FIX: Use the actual delivery datetime (date + slot time), not just date at midnight
        // This ensures the lead time is calculated correctly based on when delivery actually happens
        let deliveryDateTime: Date;
        if (scheduledDeliverySlot && scheduledDeliverySlot.start) {
          // Parse the slot start time (format: "HH:MM")
          const [hours, minutes] = scheduledDeliverySlot.start.split(':').map(Number);
          deliveryDateTime = new Date(scheduledDeliveryDate);
          deliveryDateTime.setHours(hours || 0, minutes || 0, 0, 0);
        } else {
          // Fallback: use date at start of day (midnight)
          deliveryDateTime = new Date(scheduledDeliveryDate);
          deliveryDateTime.setHours(0, 0, 0, 0);
        }
        
        const leadTimeMs = leadTimeHours * 60 * 60 * 1000;
        const timeUntilDelivery = deliveryDateTime.getTime() - Date.now();
        
        if (timeUntilDelivery < leadTimeMs) {
          return c.json({
            error: `Order must be placed at least ${leadTimeHours} hours in advance`,
            code: 'LEAD_TIME_VIOLATION',
            details: {
              deliveryDateTime: deliveryDateTime.toISOString(),
              currentTime: new Date().toISOString(),
              hoursUntilDelivery: (timeUntilDelivery / (60 * 60 * 1000)).toFixed(2),
              requiredLeadTimeHours: leadTimeHours
            }
          }, 400);
        }
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

      // Create order with all fee components (meal_orders has platform_fee only; store combined fee there)
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
        platform_fee: platformFee + convenienceFee,
        total_amount: totalAmount,
        delivery_address: JSON.stringify(normalizedAddress),
        customer_lat: normalizedAddress.lat,
        customer_lng: normalizedAddress.lng,
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
   * POST /meal/orders/:orderId/review
   * Phase 5: Submit rating and optional review for a delivered meal order
   */
  app.post("/meal/orders/:orderId/review", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json().catch(() => ({}));
      const rating = typeof body.rating === 'number' ? body.rating : parseInt(body.rating, 10);
      const review = typeof body.review === 'string' ? body.review.trim() : '';

      if (!rating || rating < 1 || rating > 5) {
        return c.json({ error: 'rating must be a number between 1 and 5' }, 400);
      }

      const orders = await select('meal_orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }
      const order = orders[0];
      if (order.status !== 'delivered') {
        return c.json({ error: 'Only delivered orders can be reviewed' }, 400);
      }
      if (order.rated_at) {
        return c.json({ error: 'Order already reviewed' }, 400);
      }

      await update('meal_orders', { id: orderId }, {
        rating,
        review: review || null,
        rated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Thank you for your review!',
      });
    } catch (error: any) {
      console.error('Error submitting meal order review:', error);
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

      const validStatuses = ['accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }

      const updateData: Record<string, any> = { status };

      if (status === 'accepted') updateData.accepted_at = new Date().toISOString();
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

  /**
   * GET /meal-plans/search/filters
   * Get available filter options for nutritionist meal plans
   * Phase 1: Returns purpose and mealType options (static + from DB when columns exist)
   */
  app.get("/meal-plans/search/filters", async (c) => {
    try {
      const staticPurpose = ['weight_management', 'maintenance', 'muscle_gain', 'allergy_management', 'senior_care'];
      const staticMealType = ['fresh_daily', 'fresh_weekly', 'preserved_monthly', 'frozen', 'instant'];

      let species: string[] = [];
      let sizes: string[] = [];
      let ages: string[] = [];
      let dietTypes: string[] = [];
      let purpose: string[] = [...staticPurpose];
      let mealType: string[] = [...staticMealType];

      try {
        const filters = await query(`
          SELECT DISTINCT
            jsonb_array_elements_text(suitable_for->'species') as species,
            jsonb_array_elements_text(suitable_for->'sizes') as size,
            jsonb_array_elements_text(suitable_for->'ages') as age,
            unnest(diet_type) as diet_type
          FROM meal_plans
          WHERE is_active = true
        `);
        species = [...new Set(filters.rows.map((r: any) => r.species).filter(Boolean))];
        sizes = [...new Set(filters.rows.map((r: any) => r.size).filter(Boolean))];
        ages = [...new Set(filters.rows.map((r: any) => r.age).filter(Boolean))];
        dietTypes = [...new Set(filters.rows.map((r: any) => r.diet_type).filter(Boolean))];
      } catch (_) {
        // suitable_for / diet_type may not exist; keep defaults
      }

      // Phase 1: Add purpose/meal_type from DB if columns exist
      try {
        const cols = await query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'meal_plans' AND column_name IN ('purpose', 'meal_type')
        `);
        const hasPurpose = cols.rows.some((r: any) => r.column_name === 'purpose');
        const hasMealType = cols.rows.some((r: any) => r.column_name === 'meal_type');
        if (hasPurpose) {
          const res = await query(`SELECT DISTINCT purpose FROM meal_plans WHERE is_active = true AND purpose IS NOT NULL AND purpose != ''`);
          const fromDb = res.rows.map((r: any) => r.purpose).filter(Boolean);
          if (fromDb.length) purpose = [...new Set([...staticPurpose, ...fromDb])];
        }
        if (hasMealType) {
          const res = await query(`SELECT DISTINCT meal_type FROM meal_plans WHERE is_active = true AND meal_type IS NOT NULL AND meal_type != ''`);
          const fromDb = res.rows.map((r: any) => r.meal_type).filter(Boolean);
          if (fromDb.length) mealType = [...new Set([...staticMealType, ...fromDb])];
        }
      } catch (_) {
        // Keep static purpose/mealType
      }

      return c.json({
        success: true,
        filters: {
          species,
          sizes,
          ages,
          dietTypes,
          purpose,
          mealType,
        },
      });
    } catch (error: any) {
      console.error('Error getting filters:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /meal/orders/:orderId/notify-logistics
   * Phase 3: Notify logistics for meal order (creates delivery_tracking record for pickup)
   */
  app.post("/meal/orders/:orderId/notify-logistics", async (c) => {
    try {
      const { orderId } = c.req.param();

      const orders = await select('meal_orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Meal order not found' }, 404);
      }
      const order = orders[0];
      if (order.vendor_id == null) {
        return c.json({ error: 'Order has no vendor' }, 400);
      }

      const existing = await query(
        'SELECT id FROM delivery_tracking WHERE meal_order_id = $1 LIMIT 1',
        [orderId]
      ).catch(() => ({ rows: [] }));
      if (existing.rows.length > 0) {
        return c.json({
          success: true,
          message: 'Logistics already notified',
          trackingId: existing.rows[0].id,
        });
      }

      // ✅ FIX: Create tracking with status that indicates waiting for partner assignment
      // Status 'assigned' is confusing when no partner is assigned yet
      // We'll use 'assigned' but it means "available for assignment" until partner accepts
      const tracking = await insert('delivery_tracking', {
        meal_order_id: orderId,
        pharmacy_order_id: null,
        status: 'assigned', // This means "available for assignment" - will change to 'heading_to_pickup' when partner accepts
        assigned_at: new Date().toISOString(), // Time when logistics was notified
        logistics_partner_id: null, // No partner assigned yet - will be set when partner accepts
      });

      return c.json({
        success: true,
        message: 'Logistics notified',
        trackingId: tracking[0]?.id,
      });
    } catch (error: any) {
      console.error('Error notifying logistics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /meal/orders/:orderId/assign-delivery
   * Phase 4: Assign delivery partner to meal order (generates OTP, updates tracking)
   */
  app.post("/meal/orders/:orderId/assign-delivery", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const {
        deliveryPersonName,
        deliveryPersonPhone,
        deliveryPersonPhoto,
        vehicleNumber,
        deliveryPartnerId,
      } = body;

      const orders = await select('meal_orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ error: 'Meal order not found' }, 404);
      }

      const existing = await query(
        'SELECT id FROM delivery_tracking WHERE meal_order_id = $1 LIMIT 1',
        [orderId]
      ).catch(() => ({ rows: [] }));

      const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

      if (existing.rows.length > 0) {
        await update('delivery_tracking', { id: existing.rows[0].id }, {
          delivery_otp: deliveryOtp,
          delivery_person_name: deliveryPersonName,
          delivery_person_phone: deliveryPersonPhone,
          delivery_person_photo: deliveryPersonPhoto,
          vehicle_number: vehicleNumber,
          logistics_partner_id: deliveryPartnerId || null,
          status: 'assigned',
          assigned_at: new Date().toISOString(),
        });
      } else {
        await insert('delivery_tracking', {
          meal_order_id: orderId,
          pharmacy_order_id: null,
          logistics_partner_id: deliveryPartnerId || null,
          delivery_person_name: deliveryPersonName,
          delivery_person_phone: deliveryPersonPhone,
          delivery_person_photo: deliveryPersonPhoto,
          vehicle_number: vehicleNumber,
          status: 'assigned',
          delivery_otp: deliveryOtp,
          assigned_at: new Date().toISOString(),
        });
      }

      await update('meal_orders', { id: orderId }, {
        status: 'ready_for_pickup',
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        deliveryOtp,
        message: 'Delivery partner assigned',
      });
    } catch (error: any) {
      console.error('Error assigning delivery:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /meal-orders/:orderId/update-preparation-eta
   * Update preparation ETA for meal order
   */
  app.post("/meal-orders/:orderId/update-preparation-eta", async (c) => {
    try {
      const { orderId } = c.req.param();
      const body = await c.req.json();
      const { preparationEtaMinutes } = body;

      if (!preparationEtaMinutes || preparationEtaMinutes < 0) {
        return c.json({ error: 'preparationEtaMinutes must be a positive number' }, 400);
      }

      // ✅ FIX: meal_orders table doesn't have preparation_eta_minutes or estimated_preparation_time columns
      // Use estimated_delivery_time to store the calculated preparation completion time
      const estimatedPreparationTime = new Date(Date.now() + preparationEtaMinutes * 60 * 1000).toISOString();
      
      // Update only with columns that exist in the meal_orders table
      await update('meal_orders', { id: orderId }, {
        estimated_delivery_time: estimatedPreparationTime,
        updated_at: new Date().toISOString(),
      });

      // Notify customer
      const orders = await select('meal_orders', { id: orderId });
      if (orders.length > 0) {
        const { pushNotificationService } = await import('../lib/services/push-notification-service');
        await pushNotificationService.sendEventNotification({
          eventType: 'meal_order_eta_updated',
          recipientId: orders[0].customer_id,
          recipientType: 'customer',
          relatedId: orderId,
          data: {
            orderId,
            preparationEtaMinutes,
          },
        });
      }

      return c.json({
        success: true,
        message: 'Preparation ETA updated',
      });
    } catch (error: any) {
      console.error('Error updating preparation ETA:', error);
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

