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
import { getRazorpayConfig, razorpayRequest } from '../utils/payments/razorpay-client';
import { getDiscoveryRules } from '../lib/rule-engine';
import { randomUUID } from 'crypto';
import { getFeeGlobalsMap } from '../utils/admin-fee-settings-db';
import { getMealPlanGstRates, computeMealGstBreakdown } from '../utils/meal-plan-gst';
import { presignMealPlanRowDisplayFields } from '../utils/s3-media-presign';
import {
  computePolicyDeliveryFeeForOrder,
  deriveDistanceKmFromLocations,
} from '../utils/customer-delivery-fee-quote';
import { fetchCustomerDeliveryFeePolicy } from '../utils/customer-delivery-fee-policy';
import {
  clampLeadTimeHours,
  evaluateMealBookingForPlan,
  requireMealPlanTiming,
  resolveSameDayAllowedForPlan,
} from '../utils/meal-booking-policy';
import { parseOrderCutoffHm } from '../utils/meal-product-timing';
import { resolvePackWeightGramsFromPlanRow } from '../utils/meal-pack-weight';
import { mergeMealPlanCatalogForApi } from '../utils/meal-product-persistence';
import { mealPlanUnitPriceInr, resolveMealLineSubtotalInr, resolveMealPurchaseSubtotalInr } from '../utils/meal-order-pricing';
import { generateMealOrderNumber } from '../utils/meal-order-number';
import { processMealOrderVendorCancelOriginalRefund } from '../utils/payments/meal-order-original-refund';
import {
  dedupeMealPlanCatalogRows,
  ensureMealPlanMirrorForProductCheckout,
  normalizeProductRowToMealPlanShape,
  resolveMealPlanOrProductById,
} from '../utils/meal-plan-resolve';
import {
  assertVendorAcceptingMealOrders,
  enrichMealPlanRowsWithKitchenAvailability,
  fetchMealKitchenAvailabilityForVendor,
  toPublicMealKitchenAvailability,
} from '../utils/meal-kitchen-availability';
import { resolveVendorId } from '../utils/vendor-resolve';
import { getMealOrderVendorLookupIds } from '../utils/meal-order-vendor-lookup';
import { fetchVendorMealOrdersForVendorIds } from '../utils/fetch-vendor-meal-orders';
import {
  mealPlanMatchesCustomerMealType,
  mealPlanMatchesCustomerPurpose,
} from '../utils/meal-plan-customer-filter';
import {
  normalizeCatalogDeliveryDaysArray,
  normalizePurchaseType,
  parseMealCatalogDiet,
} from '../utils/meal-purchase-metadata';
import {
  billingCyclesFromSessions,
  deliveriesPerBillingCycle,
} from '../utils/meal-subscription-schedule-utils';
import { computeMealSubscriptionCheckoutFees } from '../utils/meal-subscription-checkout-fees';
import { ensureMealOrderSettlementOnDelivered } from '../utils/meal-order-settlement';
import {
  assertMealOrderHasPidgeForPickup,
  dispatchMealLogistics,
  isMealDispatchStrict,
} from '../utils/meal-dispatch';
import {
  isPidgeMealLogistics,
  vendorBlockedMealStatusForPidge,
} from '../utils/meal-order-vendor-delivery-guard';
import { fireVendorMealOrderScheduledSms } from '../lib/vendor-appointment-sms';

async function mealBookingPolicyPreviewExtras(
  plan: Record<string, unknown>,
  _purchaseType: string,
  query: {
    scheduledDeliveryDate?: string;
    deliveryTime?: string;
    vendorId?: string;
    planId?: string;
  },
): Promise<Record<string, unknown>> {
  const timing = requireMealPlanTiming(plan);
  const now = new Date();
  const effectiveLeadTimeHours = timing.ok ? timing.leadTimeHours : 24;
  const orderCutoffTime = timing.ok ? timing.orderCutoffTime : '';
  const earliestDeliveryAt = new Date(
    now.getTime() + effectiveLeadTimeHours * 3600000,
  ).toISOString();
  const sameDayAllowed = timing.ok
    ? resolveSameDayAllowedForPlan(timing.leadTimeHours)
    : false;
  const extras: Record<string, unknown> = {
    leadTimeHours: effectiveLeadTimeHours,
    orderCutoffTime,
    bookingPolicy: {
      effectiveLeadTimeHours,
      earliestDeliveryAt,
      sameDayAllowed,
      orderCutoffTime,
      bounds: { minHours: 0, maxHours: 72 },
    },
  };
  if (!timing.ok) {
    extras.deliveryAllowed = false;
    extras.deliveryPolicyMessage = timing.error;
    return extras;
  }
  const dateRaw = query.scheduledDeliveryDate;
  const timeRaw = query.deliveryTime?.trim();
  if (dateRaw && timeRaw && /^\d{1,2}:\d{2}/.test(timeRaw)) {
    const requestedDeliveryAt = `${dateRaw}T${timeRaw.length === 5 ? `${timeRaw}:00` : timeRaw}`;
    const evaluation = evaluateMealBookingForPlan(
      {
        vendorId: query.vendorId || String(plan.vendor_id || ''),
        mealPlanId: query.planId || String(plan.id || ''),
        purchaseType: 'ONE_OFF',
        requestedDeliveryAt,
      },
      plan,
    );
    (extras.bookingPolicy as Record<string, unknown>).evaluation = evaluation;
    extras.deliveryAllowed = evaluation.allowed;
    if (!evaluation.allowed && evaluation.message) {
      extras.deliveryPolicyMessage = evaluation.message;
    }
  } else if (dateRaw) {
    extras.deliveryAllowed = undefined;
    extras.deliveryPolicyMessage =
      'Select a delivery time to check availability for this date.';
  }
  return extras;
}

async function mealOrdersTableColumns(): Promise<Set<string>> {
  try {
    const r = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meal_orders'`,
      []
    );
    return new Set((r.rows || []).map((row: { column_name: string }) => row.column_name));
  } catch {
    return new Set();
  }
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return undefined;
}

function isWeekendInIndiaNow(): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
  return weekday === 'Sat' || weekday === 'Sun';
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function recommendedSignupWeeksFromDiet(diet: Record<string, unknown>): number {
  const sub = diet.subscriptionConfig;
  const raw =
    diet.recommendedPlanLengthWeeks ??
    (typeof sub === 'object' && sub != null && !Array.isArray(sub)
      ? (sub as Record<string, unknown>).recommendedPlanLengthWeeks
      : undefined);
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 4) return n;
  return 1;
}

function buildSubscriptionPreviewSchedule(
  diet: Record<string, unknown>,
  purchaseType: string,
  q: { weekdays?: string; weeklyPattern?: string; monthlyMode?: string },
): Record<string, unknown> {
  const pt = String(purchaseType || '').toUpperCase();
  const catalogDf = String(diet.deliveryFrequency || '').toUpperCase();
  const dfExtras =
    catalogDf && (catalogDf === 'TWICE_WEEKLY' || catalogDf === 'WEEKLY')
      ? { deliveryFrequency: catalogDf }
      : {};

  if (pt === 'WEEKLY_PLAN') {
    const vendor = normalizeCatalogDeliveryDaysArray(diet.deliveryDays);
    const wdRaw = String(q.weekdays || '')
      .split(',')
      .map((s) => s.trim().toLowerCase().slice(0, 3))
      .filter(Boolean);
    const pattern = String(q.weeklyPattern || 'weekly_default').trim();
    if (vendor.length > 0) {
      const weekdays = wdRaw.length ? wdRaw.filter((d) => vendor.includes(d)) : [...vendor];
      return {
        weeklyPattern: 'specific_weekdays',
        weekdays: weekdays.length ? weekdays : [...vendor],
        ...dfExtras,
      };
    }
    return {
      weeklyPattern: pattern,
      ...(wdRaw.length ? { weekdays: wdRaw } : {}),
      ...dfExtras,
    };
  }
  const mf = catalogDf;
  if (!mf) return {};
  const wdMonthly = String(q.weekdays || '')
    .split(',')
    .map((s) => s.trim().toLowerCase().slice(0, 3))
    .filter(Boolean);
  const mm = String(q.monthlyMode || '').trim().toLowerCase();
  const monthlyMode =
    mm === 'fixed_sessions' || mm === 'recurring_monthly' ? mm : undefined;
  const base = monthlyMode
    ? { monthlyDeliveryFrequency: mf, monthlyMode }
    : { monthlyDeliveryFrequency: mf };
  if ((mf === 'TWICE_WEEKLY' || mf === 'WEEKLY') && wdMonthly.length) {
    return { ...base, weekdays: wdMonthly };
  }
  return base;
}

function subscriptionCheckoutPreviewFields(
  plan: Record<string, unknown>,
  quantity: number,
  q: { weekdays?: string; weeklyPattern?: string; totalSessions?: string; monthlyMode?: string },
): {
  subtotal: number;
  deliveriesPerBillingCycle: number;
  suggestedTotalSessions: number;
  billingCycles: number;
  totalSessionsUsed: number;
} | null {
  const diet = parseMealCatalogDiet(plan);
  const pt = normalizePurchaseType(diet);
  if (pt !== 'WEEKLY_PLAN' && pt !== 'MONTHLY_PLAN') return null;
  const sched = buildSubscriptionPreviewSchedule(diet, pt, q);
  const dpc = deliveriesPerBillingCycle(pt, sched);
  const weeklyEff = pt === 'WEEKLY_PLAN' ? dpc : undefined;
  const subtotal = resolveMealPurchaseSubtotalInr(plan, quantity, {
    weeklyEffectiveDeliveryDays: weeklyEff,
  });
  const recWeeks = recommendedSignupWeeksFromDiet(diet);
  const suggested = pt === 'WEEKLY_PLAN' ? recWeeks * dpc : dpc;
  const tsp = parseInt(String(q.totalSessions || '').trim(), 10);
  const totalSessionsUsed =
    Number.isFinite(tsp) && tsp >= 1 ? Math.min(500, tsp) : suggested;
  const billingCycles = billingCyclesFromSessions(totalSessionsUsed, dpc);
  return {
    subtotal,
    deliveriesPerBillingCycle: dpc,
    suggestedTotalSessions: suggested,
    billingCycles,
    totalSessionsUsed,
  };
}

function parseRequiredPrepTimeMinutes(v: unknown): { ok: true; minutes: number } | { ok: false; message: string } {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < 1) {
    return { ok: false, message: 'prepTimeMinutes is required and must be at least 1' };
  }
  return { ok: true, minutes: Math.min(10080, Math.floor(n)) };
}

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

      const prepParsed = parseRequiredPrepTimeMinutes(prepTimeMinutes);
      if (!prepParsed.ok) {
        return c.json({ error: prepParsed.message }, 400);
      }

      if (leadTimeHours == null || leadTimeHours === '' || !Number.isFinite(Number(leadTimeHours))) {
        return c.json({ error: 'leadTimeHours is required (0–72)' }, 400);
      }
      const cutoffHm = parseOrderCutoffHm(orderCutoffTime);
      if (!cutoffHm) {
        return c.json({ error: 'orderCutoffTime is required (HH:mm, e.g. 18:00)' }, 400);
      }
      const resolvedLeadHours = clampLeadTimeHours(Number(leadTimeHours));

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
        prep_time_minutes: prepParsed.minutes,
        shelf_life_days: shelfLifeDays || (mealType === 'preserved_monthly' ? 30 : 1),
        storage_instructions: storageInstructions,
        serving_instructions: servingInstructions,
        available_days: availableDays || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        order_cutoff_time: cutoffHm,
        delivery_slots: JSON.stringify(deliverySlots || []),
        lead_time_hours: resolvedLeadHours,
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

      if (updateData.prep_time_minutes !== undefined) {
        const prepParsed = parseRequiredPrepTimeMinutes(updateData.prep_time_minutes);
        if (!prepParsed.ok) {
          return c.json({ error: prepParsed.message }, 400);
        }
        updateData.prep_time_minutes = prepParsed.minutes;
      }

      if (updateData.lead_time_hours !== undefined) {
        const h = Number(updateData.lead_time_hours);
        if (!Number.isFinite(h)) {
          return c.json({ error: 'leadTimeHours must be a number (0–72)' }, 400);
        }
        updateData.lead_time_hours = clampLeadTimeHours(h);
      }
      if (updateData.order_cutoff_time !== undefined) {
        const cutoff = parseOrderCutoffHm(updateData.order_cutoff_time);
        if (!cutoff) {
          return c.json({ error: 'orderCutoffTime must be HH:mm (e.g. 18:00)' }, 400);
        }
        updateData.order_cutoff_time = cutoff;
      }

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
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
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
      const fromMealPlans = result.rows || [];

      let productRows: any[] = [];
      try {
        let productsResult: any;
        try {
          productsResult = await query(
            `SELECT * FROM products 
             WHERE vendor_id = $1 AND (category = 'meal_plan' OR category = 'nutrition' OR category = 'food')
             ORDER BY created_at DESC`,
            [vendorId],
          );
        } catch (colErr: any) {
          if (colErr?.message?.includes('category') || colErr?.message?.includes('does not exist')) {
            productsResult = await query(`SELECT * FROM products WHERE vendor_id = $1 ORDER BY created_at DESC`, [
              vendorId,
            ]);
            if (productsResult?.rows?.length) {
              productsResult.rows = productsResult.rows.filter((p: any) =>
                ['meal_plan', 'nutrition', 'food'].includes(String(p.category || '').toLowerCase()),
              );
            }
          } else {
            throw colErr;
          }
        }
        productRows = productsResult?.rows || [];
      } catch (err: any) {
        console.warn('[meal-plans/vendor] products query failed:', err?.message);
      }

      const fromProducts: Record<string, unknown>[] = [];
      for (const p of productRows) {
        if (activeOnly && p.is_active === false) continue;
        const shaped = normalizeProductRowToMealPlanShape(p as Record<string, unknown>);
        if (shaped) fromProducts.push(shaped);
      }

      const merged = dedupeMealPlanCatalogRows(
        fromMealPlans as Record<string, unknown>[],
        fromProducts,
      );

      let mealPlans = await Promise.all(
        merged.map(async (mp: any) => {
          const { dietary_requirements, photos, mealImageUrl } = await presignMealPlanRowDisplayFields(
            mp as Record<string, unknown>,
          );
          let suitableFor = mp.suitable_for;
          let ingredients = mp.ingredients;
          let nutritionInfo = mp.nutrition_info;
          let deliverySlots = mp.delivery_slots;
          try {
            suitableFor = typeof mp.suitable_for === 'string' ? JSON.parse(mp.suitable_for) : mp.suitable_for;
          } catch {
            suitableFor = mp.suitable_for;
          }
          try {
            ingredients = typeof mp.ingredients === 'string' ? JSON.parse(mp.ingredients) : mp.ingredients;
          } catch {
            ingredients = mp.ingredients;
          }
          try {
            nutritionInfo = typeof mp.nutrition_info === 'string' ? JSON.parse(mp.nutrition_info) : mp.nutrition_info;
          } catch {
            nutritionInfo = mp.nutrition_info;
          }
          try {
            deliverySlots = typeof mp.delivery_slots === 'string' ? JSON.parse(mp.delivery_slots) : mp.delivery_slots;
          } catch {
            deliverySlots = mp.delivery_slots;
          }
          return {
            ...mp,
            photos,
            suitableFor,
            ingredients,
            nutritionInfo,
            deliverySlots,
            dietary_requirements,
            mealImageUrl,
          };
        }),
      );

      mealPlans = await enrichMealPlanRowsWithKitchenAvailability(mealPlans);
      const kitchenAvailability = toPublicMealKitchenAvailability(
        await fetchMealKitchenAvailabilityForVendor(vendorId),
      );

      return c.json({
        success: true,
        mealPlans,
        kitchenAvailability,
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
      // Purpose / mealType: legacy columns + vendor catalog JSON (dietary_requirements)
      if (purpose) {
        filteredPlans = filteredPlans.filter((mp: any) =>
          mealPlanMatchesCustomerPurpose(mp as Record<string, unknown>, purpose),
        );
      }
      if (mealType) {
        filteredPlans = filteredPlans.filter((mp: any) =>
          mealPlanMatchesCustomerMealType(mp as Record<string, unknown>, mealType),
        );
      }

      let mealPlans = await Promise.all(
        filteredPlans.map(async (mp: any) => {
          const distanceKm = mp.distance_km || null;
          const estimatedDeliveryMinutes = distanceKm != null ? Math.round(15 + distanceKm * 3) : null; // Phase 1: ETA ~15min + 3min/km
          const { dietary_requirements, photos, mealImageUrl } = await presignMealPlanRowDisplayFields(
            mp as Record<string, unknown>,
          );
          let suitableFor = mp.suitable_for;
          let ingredients = mp.ingredients;
          let nutritionInfo = mp.nutrition_info;
          try {
            suitableFor = typeof mp.suitable_for === 'string' ? JSON.parse(mp.suitable_for) : mp.suitable_for;
          } catch {
            suitableFor = mp.suitable_for;
          }
          try {
            ingredients = typeof mp.ingredients === 'string' ? JSON.parse(mp.ingredients) : mp.ingredients;
          } catch {
            ingredients = mp.ingredients;
          }
          try {
            nutritionInfo = typeof mp.nutrition_info === 'string' ? JSON.parse(mp.nutrition_info) : mp.nutrition_info;
          } catch {
            nutritionInfo = mp.nutrition_info;
          }

          return {
            ...mp,
            photos,
            suitableFor,
            ingredients,
            nutritionInfo,
            dietary_requirements,
            mealImageUrl,
            distanceKm,
            estimatedDeliveryMinutes, // Phase 1: for customer UI "ETA ~X min"
          };
        }),
      );

      mealPlans = await enrichMealPlanRowsWithKitchenAvailability(mealPlans);

      return c.json({
        success: true,
        mealPlans,
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

      const mpRow = await resolveMealPlanOrProductById(planId);
      if (!mpRow) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }

      const mp = mpRow as Record<string, unknown>;

      const { dietary_requirements, photos, mealImageUrl } = await presignMealPlanRowDisplayFields(
        mp as Record<string, unknown>,
      );

      const parseJsonish = (v: unknown, fallback: unknown) => {
        if (v == null || v === '') return fallback;
        if (typeof v === 'object') return v;
        if (typeof v === 'string') {
          try {
            return JSON.parse(v);
          } catch {
            return fallback;
          }
        }
        return fallback;
      };

      const vendorIdForKitchen = String(mp.vendor_id || '');
      const kitchenAvailability = vendorIdForKitchen
        ? toPublicMealKitchenAvailability(await fetchMealKitchenAvailabilityForVendor(vendorIdForKitchen))
        : { acceptingOrders: true, message: null };

      return c.json({
        success: true,
        mealPlan: {
          ...mp,
          photos,
          suitableFor: parseJsonish(mp.suitable_for, {}),
          ingredients: parseJsonish(mp.ingredients, []),
          nutritionInfo: parseJsonish(mp.nutrition_info, {}),
          deliverySlots: parseJsonish(mp.delivery_slots, []),
          dietary_requirements,
          mealImageUrl,
          acceptingMealOrders: kitchenAvailability.acceptingOrders,
          kitchenClosedMessage: kitchenAvailability.message,
        },
        kitchenAvailability,
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
      const policy = await fetchCustomerDeliveryFeePolicy();
      const weekend = parseOptionalBoolean(c.req.query('weekend')) ?? isWeekendInIndiaNow();
      const festival =
        parseOptionalBoolean(c.req.query('festival')) ??
        (policy.runtimeSignals?.festivalActive ?? false);
      const rain =
        parseOptionalBoolean(c.req.query('rain')) ??
        (policy.runtimeSignals?.rainActive ?? false);

      const planRow = await resolveMealPlanOrProductById(planId);
      if (!planRow) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }
      const plan = planRow as Record<string, unknown>;
      const kitchenGate = await assertVendorAcceptingMealOrders(String(plan.vendor_id || ''));
      if (!kitchenGate.allowed) {
        return c.json(
          {
            error: kitchenGate.message,
            code: kitchenGate.code,
            allowed: false,
            acceptingOrders: false,
          },
          403,
        );
      }
      const diet = parseMealCatalogDiet(plan);
      const purchaseTypeNorm = normalizePurchaseType(diet);
      const purchaseCadence =
        purchaseTypeNorm === 'ONE_TIME' ? 'one_time' : purchaseTypeNorm === 'WEEKLY_PLAN' ? 'weekly' : 'monthly';

      const policyExtras = await mealBookingPolicyPreviewExtras(plan, purchaseTypeNorm, {
        scheduledDeliveryDate:
          (c.req.query('scheduledDeliveryDate') as string) ||
          (c.req.query('deliveryDate') as string) ||
          undefined,
        deliveryTime:
          (c.req.query('deliveryTime') as string) ||
          (c.req.query('scheduledDeliverySlot') as string) ||
          undefined,
        vendorId: String(plan.vendor_id || ''),
        planId,
      });

      const previewQ = {
        weekdays: c.req.query('weekdays') || undefined,
        weeklyPattern: c.req.query('weeklyPattern') || undefined,
        totalSessions: c.req.query('totalSessions') || undefined,
        monthlyMode: c.req.query('monthlyMode') || undefined,
      };
      const subCheckout = subscriptionCheckoutPreviewFields(plan, quantity, previewQ);
      const subtotal = subCheckout?.subtotal ?? resolveMealPurchaseSubtotalInr(plan, quantity);
      const gstRates = await getMealPlanGstRates(plan);

      /** Weekly/monthly: delivery fee = (same per-session quote as one-time) × total sessions. */
      if (subCheckout) {
        const sched = buildSubscriptionPreviewSchedule(diet, purchaseTypeNorm, previewQ);
        const customerLat = parseOptionalNumber(c.req.query('customerLat') || c.req.query('lat'));
        const customerLng = parseOptionalNumber(c.req.query('customerLng') || c.req.query('lng'));
        const feeQuote = await computeMealSubscriptionCheckoutFees({
          plan,
          vendorId: String(plan.vendor_id || ''),
          quantity,
          purchaseType: purchaseTypeNorm as 'WEEKLY_PLAN' | 'MONTHLY_PLAN',
          schedule: sched,
          totalSessionsUsed: subCheckout.totalSessionsUsed,
          customerLat,
          customerLng,
          logisticsType,
          weekend,
          festival,
          rain,
        });
        const cycleDeliveryTotal =
          feeQuote.perSessionDeliveryFee != null
            ? Math.round(feeQuote.perSessionDeliveryFee * feeQuote.deliveriesPerBillingCycle * 100) /
              100
            : 0;
        const packageTotalAmount = feeQuote.nonDeliveryPackagePerCycle + cycleDeliveryTotal;
        const bc = feeQuote.billingCycles;
        const foodSubtotalUpfront =
          Math.round(feeQuote.subtotalPerCycle * bc * 100) / 100;
        const platformFeeUpfront =
          Math.round(feeQuote.platformFeePerCycle * bc * 100) / 100;
        const convenienceFeeUpfront =
          Math.round(feeQuote.convenienceFeePerCycle * bc * 100) / 100;
        const deliveryTotalUpfront =
          feeQuote.totalDeliveryFeeUpfront != null ? feeQuote.totalDeliveryFeeUpfront : 0;
        const mealGstPreview = computeMealGstBreakdown(
          foodSubtotalUpfront,
          deliveryTotalUpfront,
          gstRates.foodGstPct,
          gstRates.deliveryGstPct,
        );
        const upfrontTotalWithFoodGst =
          Math.round((feeQuote.upfrontTotalAmount + mealGstPreview.totalGstAmount) * 100) / 100;
        return c.json({
          success: true,
          subtotal: subCheckout.subtotal,
          purchaseType: purchaseTypeNorm,
          purchaseCadence,
          deliveryFee: feeQuote.deliveryFeePendingAddress ? null : feeQuote.totalDeliveryFeeUpfront,
          deliveryFeePendingAddress: feeQuote.deliveryFeePendingAddress,
          deliveryQuoteMessage: feeQuote.deliveryQuoteMessage,
          platformFee: feeQuote.platformFeePerCycle,
          convenienceFee: feeQuote.convenienceFeePerCycle,
          totalAmount: upfrontTotalWithFoodGst,
          ...policyExtras,
          gst: {
            ...gstRates,
            foodGstAmount: mealGstPreview.foodGstAmount,
            deliveryGstAmount: mealGstPreview.deliveryGstAmount,
            totalGstAmount: mealGstPreview.totalGstAmount,
          },
          subscriptionCheckout: {
            ...subCheckout,
            packageTotalAmount,
            upfrontTotalAmount: upfrontTotalWithFoodGst,
            perSessionDeliveryFee: feeQuote.perSessionDeliveryFee,
            totalDeliveryFeeUpfront: feeQuote.totalDeliveryFeeUpfront,
            nonDeliveryPackagePerCycle: feeQuote.nonDeliveryPackagePerCycle,
            perSessionFoodSubtotal: feeQuote.perSessionFoodSubtotal,
            foodSubtotalUpfront,
            foodGstAmount: mealGstPreview.foodGstAmount,
            deliveryGstAmount: mealGstPreview.deliveryGstAmount,
            totalGstAmount: mealGstPreview.totalGstAmount,
            platformFeeUpfront,
            convenienceFeeUpfront,
            subtotalPerCycle: feeQuote.subtotalPerCycle,
          },
        });
      }

      let deliveryFee: number | null = null;
      let platformFee = 0;
      let convenienceFee = 0;

      const feeMap = await getFeeGlobalsMap();
      const platformFeePercentage = parseFloat(feeMap['platform_fee_percentage'] || '2');
      const maxPlatformFee = parseFloat(feeMap['max_platform_fee'] || '500');
      platformFee = Math.round(subtotal * (platformFeePercentage / 100));
      if (maxPlatformFee > 0 && platformFee > maxPlatformFee) platformFee = maxPlatformFee;
      convenienceFee = parseFloat(
        feeMap['convenience_fee'] || feeMap['convenience_fee_booking'] || '0'
      );

      const vendors = await query(
        `SELECT latitude, longitude, metadata FROM vendors WHERE id = $1 LIMIT 1`,
        [plan.vendor_id]
      ).catch(() => ({ rows: [] }));
      const vendor = vendors.rows?.[0] || {};
      const customerLat = parseOptionalNumber(c.req.query('customerLat') || c.req.query('lat'));
      const customerLng = parseOptionalNumber(c.req.query('customerLng') || c.req.query('lng'));
      if (customerLat == null || customerLng == null) {
        const mealGstNoAddr = computeMealGstBreakdown(
          subtotal,
          0,
          gstRates.foodGstPct,
          gstRates.deliveryGstPct,
        );
        const packageTotalAmount =
          subtotal + platformFee + convenienceFee + mealGstNoAddr.totalGstAmount;
        return c.json(
          {
            success: true,
            subtotal,
            purchaseType: purchaseTypeNorm,
            purchaseCadence,
            deliveryFee: null,
            deliveryFeePendingAddress: true,
            platformFee,
            convenienceFee,
            totalAmount: packageTotalAmount,
            ...policyExtras,
            gst: {
              ...gstRates,
              foodGstAmount: mealGstNoAddr.foodGstAmount,
              deliveryGstAmount: mealGstNoAddr.deliveryGstAmount,
              totalGstAmount: mealGstNoAddr.totalGstAmount,
            },
          },
          200
        );
      }
      const vendorMeta = (typeof vendor.metadata === 'object' && vendor.metadata) || {};
      const distanceKm = deriveDistanceKmFromLocations({
        pickupLat: vendor.latitude ?? (vendorMeta as any).lat ?? (vendorMeta as any).latitude,
        pickupLng: vendor.longitude ?? (vendorMeta as any).lng ?? (vendorMeta as any).longitude,
        dropLat: customerLat,
        dropLng: customerLng,
      });
      if (distanceKm == null) {
        const mealGstNoVendorLoc = computeMealGstBreakdown(
          subtotal,
          0,
          gstRates.foodGstPct,
          gstRates.deliveryGstPct,
        );
        const packageTotalAmount =
          subtotal + platformFee + convenienceFee + mealGstNoVendorLoc.totalGstAmount;
        return c.json({
          success: true,
          subtotal,
          purchaseType: purchaseTypeNorm,
          purchaseCadence,
          deliveryFee: null,
          deliveryFeePendingAddress: false,
          deliveryQuoteMessage:
            'Vendor pickup coordinates are not configured. Distance-based delivery fee cannot be computed.',
          platformFee,
          convenienceFee,
          totalAmount: packageTotalAmount,
          ...policyExtras,
          gst: {
            ...gstRates,
            foodGstAmount: mealGstNoVendorLoc.foodGstAmount,
            deliveryGstAmount: mealGstNoVendorLoc.deliveryGstAmount,
            totalGstAmount: mealGstNoVendorLoc.totalGstAmount,
          },
        });
      }
      const deliveryQuote = await computePolicyDeliveryFeeForOrder({
        orderSubtotalInr: subtotal,
        distanceKm,
        logisticsType,
        weekend,
        festival,
        rain,
      });
      if (!deliveryQuote.success || deliveryQuote.deliveryFeeInr == null) {
        const mealGstNoDelivery = computeMealGstBreakdown(
          subtotal,
          0,
          gstRates.foodGstPct,
          gstRates.deliveryGstPct,
        );
        const packageTotalAmount =
          subtotal + platformFee + convenienceFee + mealGstNoDelivery.totalGstAmount;
        return c.json({
          success: true,
          subtotal,
          purchaseType: purchaseTypeNorm,
          purchaseCadence,
          deliveryFee: null,
          deliveryFeePendingAddress: false,
          deliveryQuoteMessage: deliveryQuote.message,
          platformFee,
          convenienceFee,
          totalAmount: packageTotalAmount,
          ...policyExtras,
          gst: {
            ...gstRates,
            foodGstAmount: mealGstNoDelivery.foodGstAmount,
            deliveryGstAmount: mealGstNoDelivery.deliveryGstAmount,
            totalGstAmount: mealGstNoDelivery.totalGstAmount,
          },
        });
      }
      deliveryFee = deliveryQuote.deliveryFeeInr;
      const mealGstOneTime = computeMealGstBreakdown(
        subtotal,
        deliveryFee,
        gstRates.foodGstPct,
        gstRates.deliveryGstPct,
      );
      const packageTotalAmount =
        subtotal + deliveryFee + platformFee + convenienceFee + mealGstOneTime.totalGstAmount;
      return c.json({
        success: true,
        subtotal,
        purchaseType: purchaseTypeNorm,
        purchaseCadence,
        deliveryFee,
        platformFee,
        convenienceFee,
        totalAmount: packageTotalAmount,
        ...policyExtras,
        gst: {
          ...gstRates,
          foodGstAmount: mealGstOneTime.foodGstAmount,
          deliveryGstAmount: mealGstOneTime.deliveryGstAmount,
          totalGstAmount: mealGstOneTime.totalGstAmount,
        },
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
        weekend,
        festival,
        rain,
        purchaseType: purchaseTypeFromBody,
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
        lat: parseOptionalNumber(deliveryAddress.lat ?? deliveryAddress.latitude),
        lng: parseOptionalNumber(deliveryAddress.lng ?? deliveryAddress.longitude),
        landmark: deliveryAddress.landmark ?? '',
        pincode: deliveryAddress.pincode ?? '',
      };
      if (normalizedAddress.lat == null || normalizedAddress.lng == null) {
        return c.json(
          {
            error: 'deliveryAddress latitude and longitude are required',
            code: 'DELIVERY_COORDINATES_REQUIRED',
          },
          400
        );
      }

      const resolvedPlan = await resolveMealPlanOrProductById(String(mealPlanId));
      if (!resolvedPlan) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }
      await ensureMealPlanMirrorForProductCheckout(resolvedPlan);

      const plans = await select('meal_plans', { id: mealPlanId });
      if (plans.length === 0) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }

      const plan = plans[0];

      const kitchenGate = await assertVendorAcceptingMealOrders(String(plan.vendor_id || ''));
      if (!kitchenGate.allowed) {
        return c.json(
          {
            error: kitchenGate.message,
            code: kitchenGate.code,
            acceptingOrders: false,
          },
          403,
        );
      }

      const dietFull = parseMealCatalogDiet(plan as Record<string, unknown>);
      const expectedPurchaseType = normalizePurchaseType(dietFull);
      const requestedPurchaseType =
        purchaseTypeFromBody != null && String(purchaseTypeFromBody).trim() !== ''
          ? String(purchaseTypeFromBody).trim().toUpperCase()
          : expectedPurchaseType;
      if (requestedPurchaseType !== expectedPurchaseType) {
        return c.json(
          {
            error: 'Selected purchase option does not match this meal product',
            code: 'PURCHASE_TYPE_MISMATCH',
            expectedPurchaseType,
          },
          400,
        );
      }

      if (requestedPurchaseType === 'WEEKLY_PLAN' || requestedPurchaseType === 'MONTHLY_PLAN') {
        return c.json(
          {
            error:
              'Recurring meal subscriptions must be created via POST /meal/subscriptions (canonical flow).',
            code: 'SUBSCRIPTION_REQUIRES_MEAL_SUBSCRIPTIONS_API',
            expectedPurchaseType: requestedPurchaseType,
          },
          400,
        );
      }

      const subscriptionConfigSnap =
        typeof dietFull.subscriptionConfig === 'object' &&
        dietFull.subscriptionConfig !== null &&
        !Array.isArray(dietFull.subscriptionConfig)
          ? (dietFull.subscriptionConfig as Record<string, unknown>)
          : {
              deliveryFrequency: dietFull.deliveryFrequency,
              deliveryDays: dietFull.deliveryDays,
              mealsPerDelivery: dietFull.mealsPerDelivery,
              subscriptionPrice: dietFull.subscriptionPrice,
              pauseAllowed: dietFull.pauseAllowed,
              cancelAnytime: dietFull.cancelAnytime,
              recommendedPlanLengthWeeks: dietFull.recommendedPlanLengthWeeks,
            };

      // Lead time / order cutoff (vendor-defined on meal_plans only)
      if (!scheduledDeliverySlot?.start) {
        return c.json(
          { error: 'Delivery time is required', code: 'DELIVERY_TIME_REQUIRED' },
          400,
        );
      }
      const datePart =
        typeof scheduledDeliveryDate === 'string'
          ? scheduledDeliveryDate.split('T')[0]
          : String(scheduledDeliveryDate);
      const slotStart = String(scheduledDeliverySlot.start).trim();
      const requestedDeliveryAt = `${datePart}T${slotStart.length === 5 ? `${slotStart}:00` : slotStart}`;
      const evaluation = evaluateMealBookingForPlan(
        {
          vendorId: String(plan.vendor_id || vendorId || ''),
          mealPlanId: String(plan.id || mealPlanId || ''),
          purchaseType: 'ONE_OFF',
          requestedDeliveryAt,
        },
        plan as Record<string, unknown>,
      );
      if (!evaluation.allowed) {
        return c.json(
          {
            error:
              evaluation.message ||
              `Order must be placed at least ${evaluation.effectiveLeadTimeHours} hours in advance`,
            code: evaluation.blockCode || 'LEAD_TIME_VIOLATION',
            details: {
              requiredLeadTimeHours: evaluation.effectiveLeadTimeHours,
              earliestDeliveryAt: evaluation.earliestDeliveryAt,
              sameDayAllowed: evaluation.sameDayAllowed,
              orderCutoffTime: evaluation.effectiveOrderCutoffTime,
            },
          },
          400,
        );
      }

      // Calculate totals (meal_plans may only have legacy `price` if `price_per_meal` was never set)
      const qty = quantity || 1;
      const subtotal = resolveMealLineSubtotalInr({ subtotal: 0, quantity: qty }, plan as Record<string, unknown>);
      if (subtotal <= 0) {
        return c.json(
          {
            error: 'Meal plan has no valid unit price. The vendor must set a meal price.',
            code: 'MEAL_PLAN_PRICE_MISSING',
          },
          400,
        );
      }
      const policyForSignals = await fetchCustomerDeliveryFeePolicy();

      let deliveryFee = 0;
      let platformFee = 0;
      let convenienceFee = 0;

      const vendors = await query(
        `SELECT latitude, longitude, metadata FROM vendors WHERE id = $1 LIMIT 1`,
        [plan.vendor_id],
      ).catch(() => ({ rows: [] }));
      const vendor = vendors.rows?.[0] || {};
      const vendorMeta = (typeof vendor.metadata === 'object' && vendor.metadata) || {};
      const distanceKm = deriveDistanceKmFromLocations({
        pickupLat: vendor.latitude ?? (vendorMeta as any).lat ?? (vendorMeta as any).latitude,
        pickupLng: vendor.longitude ?? (vendorMeta as any).lng ?? (vendorMeta as any).longitude,
        dropLat: normalizedAddress.lat,
        dropLng: normalizedAddress.lng,
      });

      const feeMap = await getFeeGlobalsMap();
      const platformFeePercentage = parseFloat(feeMap['platform_fee_percentage'] || '2');
      const maxPlatformFee = parseFloat(feeMap['max_platform_fee'] || '500');
      convenienceFee = parseFloat(
        feeMap['convenience_fee'] || feeMap['convenience_fee_booking'] || '0',
      );

      platformFee = Math.round(subtotal * (platformFeePercentage / 100));
      if (maxPlatformFee > 0 && platformFee > maxPlatformFee) {
        platformFee = maxPlatformFee;
      }

      if ((logisticsType || 'warmpawz') === 'warmpawz') {
        if (distanceKm == null) {
          return c.json(
            {
              error:
                'Vendor pickup coordinates are not configured. Distance-based delivery fee cannot be computed.',
              code: 'VENDOR_LOCATION_MISSING',
            },
            400,
          );
        }
        const deliveryQuote = await computePolicyDeliveryFeeForOrder({
          orderSubtotalInr: subtotal,
          distanceKm,
          logisticsType,
          weekend: parseOptionalBoolean(weekend) ?? isWeekendInIndiaNow(),
          festival:
            parseOptionalBoolean(festival) ??
            (policyForSignals.runtimeSignals?.festivalActive ?? false),
          rain:
            parseOptionalBoolean(rain) ??
            (policyForSignals.runtimeSignals?.rainActive ?? false),
        });
        if (!deliveryQuote.success || deliveryQuote.deliveryFeeInr == null) {
          return c.json(
            {
              error: deliveryQuote.message || 'Delivery fee could not be computed for this address.',
              code: 'DELIVERY_QUOTE_FAILED',
              zone: deliveryQuote.zone,
            },
            400,
          );
        }
        deliveryFee = deliveryQuote.deliveryFeeInr;
      }

      const totalAmountBeforeGst = subtotal + deliveryFee + platformFee + convenienceFee;
      const gstRatesOrder = await getMealPlanGstRates(plan as Record<string, unknown>);
      const mealGstOrder = computeMealGstBreakdown(
        subtotal,
        deliveryFee,
        gstRatesOrder.foodGstPct,
        gstRatesOrder.deliveryGstPct,
      );
      const totalAmount = Math.round((totalAmountBeforeGst + mealGstOrder.totalGstAmount) * 100) / 100;

      const catalogSnap = mergeMealPlanCatalogForApi(plan as Record<string, unknown>, plan.dietary_requirements);
      const packWeightGrams = resolvePackWeightGramsFromPlanRow(plan as Record<string, unknown>);

      const purchase_snapshot = {
        purchaseType: expectedPurchaseType,
        packWeightGrams: packWeightGrams ?? undefined,
        mealsPerDelivery: catalogSnap.mealsPerDelivery,
        deliveryDays: catalogSnap.deliveryDays,
        deliveryFrequency: catalogSnap.deliveryFrequency,
        mealsPerDay: catalogSnap.mealsPerDay,
        subscriptionConfig: subscriptionConfigSnap,
        deliveryAddress: {
          ...normalizedAddress,
          city: deliveryAddress.city ?? deliveryAddress.address_city,
          state: deliveryAddress.state ?? deliveryAddress.address_state,
        },
        checkoutPricing: {
          subtotal,
          deliveryFee,
          platformFee,
          convenienceFee,
          gst: mealGstOrder,
          totalAmount,
        },
      };

      const moCols = await mealOrdersTableColumns();
      const orderVendorId = await resolveVendorId(String(plan.vendor_id ?? ''));
      const mealOrderRow: Record<string, unknown> = {
        customer_id: customerId,
        vendor_id: orderVendorId || plan.vendor_id,
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
      };
      if (moCols.has('purchase_type')) mealOrderRow.purchase_type = expectedPurchaseType;
      if (moCols.has('purchase_snapshot')) mealOrderRow.purchase_snapshot = purchase_snapshot;
      if (moCols.has('order_number')) mealOrderRow.order_number = generateMealOrderNumber();
      // Snapshot meal_plans.prep_time_minutes so the vendor "Start Preparing" status update can
      // align Pidge promised_prep_time with the catalog declared prep time without a join.
      if (moCols.has('prep_minutes')) {
        const planPrep = (plan as { prep_time_minutes?: unknown }).prep_time_minutes;
        const planPrepNum = typeof planPrep === 'number' ? planPrep : Number(planPrep);
        if (Number.isFinite(planPrepNum) && planPrepNum > 0) {
          mealOrderRow.prep_minutes = Math.floor(planPrepNum);
        }
      }

      // Create order with all fee components (meal_orders has platform_fee only; store combined fee there)
      const result = await insert('meal_orders', mealOrderRow);

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

      const orders = await select('meal_orders', { id: orderId });
      if (orders[0]) {
        fireVendorMealOrderScheduledSms(orders[0] as Record<string, unknown>);
      }

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
      const { vendorId: paramVendorId } = c.req.param();
      const status = c.req.query('status');
      const date = c.req.query('date');

      const { allIds } = await getMealOrderVendorLookupIds(paramVendorId);
      const rows = await fetchVendorMealOrdersForVendorIds(allIds, {
        status: status || undefined,
        limit: 100,
      });

      const orders = [];
      for (const o of rows) {
        let mealName: string | undefined;
        let prepTime: number | undefined;
        if (o.meal_plan_id) {
          const mp = await query(
            `SELECT COALESCE(plan_name, name) AS meal_name, prep_time_minutes FROM meal_plans WHERE id = $1 LIMIT 1`,
            [o.meal_plan_id],
          ).catch(() => ({ rows: [] }));
          if (mp.rows?.[0]) {
            mealName = mp.rows[0].meal_name;
            prepTime = mp.rows[0].prep_time_minutes;
          }
        }
        let customerName: string | undefined;
        let customerPhone: string | undefined;
        if (o.customer_id) {
          const cr = await query(
            `SELECT full_name, phone FROM customers WHERE id = $1 LIMIT 1`,
            [o.customer_id],
          ).catch(() => ({ rows: [] }));
          if (cr.rows?.[0]) {
            customerName = cr.rows[0].full_name;
            customerPhone = cr.rows[0].phone;
          }
        }
        if (date && String(o.scheduled_delivery_date || '').slice(0, 10) !== String(date).slice(0, 10)) {
          continue;
        }
        orders.push({
          ...o,
          meal_name: mealName,
          prep_time_minutes: prepTime,
          customer_name: customerName,
          customer_phone: customerPhone,
          deliveryAddress:
            typeof o.delivery_address === 'string'
              ? (() => {
                  try {
                    return JSON.parse(o.delivery_address as string);
                  } catch {
                    return o.delivery_address;
                  }
                })()
              : o.delivery_address,
        });
      }

      return c.json({ success: true, orders });
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

      const existingRows = await select('meal_orders', { id: orderId });
      const existing = existingRows[0] as { status?: string; logistics_type?: string } | undefined;
      if (existing?.status === 'paused') {
        return c.json(
          { error: 'This order is paused until the customer resumes their meal subscription' },
          400,
        );
      }

      if (
        isPidgeMealLogistics(existing?.logistics_type) &&
        vendorBlockedMealStatusForPidge(status)
      ) {
        return c.json(
          {
            success: false,
            error:
              'This order uses Pidge delivery — pickup and delivery completion are updated from Pidge automatically.',
          },
          422,
        );
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

      if (status === 'preparing' && isMealDispatchStrict()) {
        const dispatchResult = await dispatchMealLogistics(orderId);
        if (!dispatchResult.ok) {
          return c.json(
            {
              success: false,
              error:
                dispatchResult.error ||
                'Could not schedule delivery partner. Fix the issue, then try Start preparing again.',
              dispatch: dispatchResult,
            },
            422
          );
        }
      }

      if (status === 'ready_for_pickup' && isMealDispatchStrict()) {
        const pidgeCheck = await assertMealOrderHasPidgeForPickup(orderId);
        if (!pidgeCheck.ok) {
          return c.json({ success: false, error: pidgeCheck.error }, 422);
        }
      }

      await update('meal_orders', { id: orderId }, updateData);

      let refundInfo: Record<string, unknown> | null = null;
      if (status === 'cancelled') {
        try {
          const refund = await processMealOrderVendorCancelOriginalRefund(
            orderId,
            notes || 'Vendor cancelled meal order',
            'vendor',
          );
          refundInfo = {
            amount: refund.totalAmount,
            method: 'original',
            status: refund.status,
            message: refund.message,
            refundId: refund.refundId,
            razorpayRefundId: refund.razorpayRefundId,
          };
        } catch (refundErr: unknown) {
          const msg = refundErr instanceof Error ? refundErr.message : 'Refund failed';
          console.error('[meal/orders/update-status] original refund failed:', msg, { orderId });
        }
      }

      // If delivered, create settlement
      if (status === 'delivered') {
        await ensureMealOrderSettlementOnDelivered(orderId);
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
      const pricePerDelivery = mealPlanUnitPriceInr(plan as Record<string, unknown>) * mealsPerDay;
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

      if (isPidgeMealLogistics((order as { logistics_type?: string }).logistics_type)) {
        return c.json(
          {
            success: false,
            error: 'This order uses Pidge — logistics notifications are automatic.',
          },
          422,
        );
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
        const { pushNotificationService } = await import('../aws/aws-sns-notification-service');
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
