/**
 * ============================================================================
 * SPECIALIZED SERVICES ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles special configuration requirements for different vendor types:
 * - Ambulance: Vehicle fleet, drivers
 * - Diagnostics: Test catalog, equipment
 * - Pharmacy: Medicine inventory
 * - Nutritionist: Meal plans
 * - Cafe: Tables, PAX capacity
 * - Breeder/Adoption: Puppy/Pet profiles
 * - Pet Resort/Boarding: Room configuration, pricing
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query, deleteRows } from '../database/rds-connection';
import { checkVendorCapability } from '../middleware/capability-enforcement';
import { resolveVendorById, getVendorIdsForAvailabilityLookup } from './vendor/endpoints/vendorProfile.vendor';
import { resolveVendorId } from '../utils/vendor-resolve';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { getDiscoveryRules } from '../lib/rule-engine';
import {
  fetchVendorProgressRowsFromBookings,
  mergeTrainingProgressWithBookingDerived,
} from '../lib/vendor-progress-from-bookings';
import {
  presignMealImageUrlInRecord,
  presignMealPlanRowDisplayFields,
  stripS3PresignQueryFromUrl,
} from '../utils/s3-media-presign';
import { resolveMealLineSubtotalInr } from '../utils/meal-order-pricing';
import {
  isMealDispatchStrict,
  isMealLogisticsDispatchStatus,
  mealPidgeDispatchOn,
  runMealDispatchBestEffort,
  runMealDispatchStrictGate,
} from '../utils/meal-dispatch';
import {
  isPidgeMealLogistics,
  vendorBlockedMealStatusForPidge,
} from '../utils/meal-order-vendor-delivery-guard';
import { ensureMealOrderSettlementOnDelivered } from '../utils/meal-order-settlement';
import { getMealOrderVendorLookupIds } from '../utils/meal-order-vendor-lookup';
import { fetchVendorMealOrdersForVendorIds } from '../utils/fetch-vendor-meal-orders';
import {
  processMealOrderVendorCancelOriginalRefund,
  processMealSubscriptionParentVendorCancelOriginalRefund,
} from '../utils/payments/meal-order-original-refund';
import {
  mealKitchenNotifyStageForStatus,
  notifyMealDeliveryStage,
  notifyMealOrderCancelledByVendor,
  notifyVendorMealDispatchFailed,
} from '../utils/meal-delivery-notifications';
import {
  mealProductParsedToDietaryJson,
  type MealProductDietaryInput,
} from '../utils/meal-product-dietary';
import {
  buildMealPlanRowFromProduct,
  mealPlanDietTypeColumnIsArray,
  mergeMealPlanCatalogForApi,
  pushMealPlanStructuredUpdates,
  resolveMealsPerDayColumn,
  type MealProductParsedCore,
} from '../utils/meal-product-persistence';
import { formatMealProductZodError, parseMealProductRequest } from '../zodContracts/meal-product.contract';
import { resolveEffectiveMealDeliveryState, parseDeliveryTrackingReassignPending } from '../utils/meal-delivery-effective-state';
import { resolveMealCatalogDisplayName } from '../utils/meal-plan-resolve';
import {
  deleteOrDeactivateMealPlanForVendor,
  isMealPlanFkViolation,
} from '../utils/meal-plan-vendor-delete';
import { clampLeadTimeHours } from '../utils/meal-booking-policy';
import { parseOrderCutoffHm } from '../utils/meal-product-timing';
import { buildVendorPrepScheduling } from '@warmpawz/shared-types';

function mealOrderDeliveryTimeDisplay(o: Record<string, unknown>): string | null {
  const raw = o.scheduled_delivery_slot;
  if (raw == null || raw === '') return null;
  try {
    const slot =
      typeof raw === 'string'
        ? (JSON.parse(raw) as { start?: string })
        : (raw as { start?: string });
    const start = slot?.start;
    return typeof start === 'string' && start.trim() ? start.trim() : null;
  } catch {
    return null;
  }
}
import {
  buildMealKitchenAvailabilityPayload,
  fetchMealKitchenAvailabilityForVendor,
  resolveCustomerKitchenMessage,
} from '../utils/meal-kitchen-availability';
import {
  backfillMissingMealDeliverySettlementsForVendorIds,
  syncDeliveredMealOrdersFromTracking,
  syncCancelledMealOrdersFromTracking,
} from '../utils/meal-order-settlement';

/** Coerce DB/API money fields so vendor UI never receives NaN or bogus strings. */
/** Require vendor lead time + order cutoff before persisting meal catalog rows. */
function validateVendorMealTimingFromParsed<
  T extends { leadTimeHours?: number; orderCutoffTime?: string; preparationLeadTime: number },
>(p: T): { ok: true; data: T & { leadTimeHours: number; orderCutoffTime: string } } | { ok: false; error: string } {
  if (p.leadTimeHours == null || !Number.isFinite(Number(p.leadTimeHours))) {
    return { ok: false, error: 'leadTimeHours is required (0–72)' };
  }
  const orderCutoffTime = parseOrderCutoffHm(p.orderCutoffTime);
  if (!orderCutoffTime) {
    return { ok: false, error: 'orderCutoffTime is required (HH:mm, e.g. 18:00)' };
  }
  return {
    ok: true,
    data: {
      ...p,
      leadTimeHours: clampLeadTimeHours(Number(p.leadTimeHours)),
      orderCutoffTime,
    },
  };
}

function safeMoney(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseMealOrderPurchaseSnapshotForVendor(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o)
        ? (o as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

/** Vendor-facing meal list: meal line total only (quantity × listed price). Strip checkout fees & platform economics. */
const VENDOR_MEAL_ORDER_OMIT_PRICE_KEYS = new Set([
  'total_amount',
  'delivery_fee',
  'platform_fee',
  'logistics_cost',
  'commission_amount',
  'logistics_deduction',
  'vendor_payout',
  'tax_amount',
  'gst_amount',
  'cgst_amount',
  'sgst_amount',
  'igst_amount',
  'convenience_fee',
  'service_fee',
]);

function sanitizeVendorMealOrderRow(row: Record<string, unknown>): Record<string, unknown> {
  const snap = parseMealOrderPurchaseSnapshotForVendor(row.purchase_snapshot);
  let mealOnly = safeMoney(row.subtotal);
  const next: Record<string, unknown> = { ...row };

  if (snap.subscriptionVendorBookingRole === 'parent') {
    next.subscription_vendor_parent_booking = true;
    const ts = Number(snap.subscriptionTotalSessions);
    next.subscription_booking_session_count = Number.isFinite(ts) ? ts : null;
    const sn = Number(snap.sessionNumber);
    next.subscription_session_number =
      Number.isFinite(sn) && sn > 0 ? Math.floor(sn) : 1;
    /** Parent row DB subtotal = full-cycle vendor food — vendor UI shows per-session line like session rows */
    mealOnly = Math.round(mealOnly * 100) / 100;
    const splitN =
      Number.isFinite(Number(next.subscription_booking_session_count)) &&
      Number(next.subscription_booking_session_count) >= 1
        ? Math.floor(Number(next.subscription_booking_session_count))
        : 1;
    mealOnly = Math.round((mealOnly / splitN) * 100) / 100;
    const paid =
      Number(snap.subscriptionCustomerPaidTotalInr) > 0.009
        ? Number(snap.subscriptionCustomerPaidTotalInr)
        : safeMoney(row.total_amount);
    next.subscription_customer_paid_total_inr = Math.round(paid * 100) / 100;
    const pk = String(snap.subscriptionPurchaseType || row.purchase_type || '').trim();
    next.subscription_booking_plan_kind = pk.replace(/_PLAN$/i, '').toLowerCase();
    next.subscription_booking_delivery_type = String(
      snap.subscriptionLogisticsType || row.logistics_type || 'warmpawz',
    );
    const mf = String(snap.subscriptionMonthlyDeliveryFrequency || '').trim().toUpperCase();
    if (mf) next.subscription_monthly_delivery_frequency = mf;
  }

  if (snap.subscriptionVendorBookingRole === 'session') {
    next.subscription_vendor_session_booking = true;
    const sn = Number(snap.sessionNumber);
    next.subscription_session_number = Number.isFinite(sn) ? sn : null;
    const ts = Number(snap.subscriptionTotalSessions);
    next.subscription_booking_session_count = Number.isFinite(ts) ? ts : null;
    const pk = String(snap.subscriptionPurchaseType || row.purchase_type || '').trim();
    next.subscription_booking_plan_kind = pk.replace(/_PLAN$/i, '').toLowerCase();
    next.subscription_booking_delivery_type = String(
      snap.subscriptionLogisticsType || row.logistics_type || 'warmpawz',
    );
    const mf = String(snap.subscriptionMonthlyDeliveryFrequency || '').trim().toUpperCase();
    if (mf) next.subscription_monthly_delivery_frequency = mf;
    const paid =
      Number(snap.subscriptionCustomerPaidTotalInr) > 0.009 ? Number(snap.subscriptionCustomerPaidTotalInr) : null;
    if (paid != null && Number.isFinite(paid)) {
      next.subscription_customer_paid_total_inr = Math.round(paid * 100) / 100;
    }
    mealOnly = Math.round(safeMoney(row.subtotal) * 100) / 100;
  }

  for (const k of VENDOR_MEAL_ORDER_OMIT_PRICE_KEYS) {
    delete next[k];
  }
  delete next.subtotal;
  next.vendor_meal_total = mealOnly;
  return next;
}

/** Lowercased column set for `public.<table>` — avoids 42703 when optional migrations (e.g. products.metadata) are not applied. */
async function getPublicTableColumns(tableName: string): Promise<Set<string>> {
  const r = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName.toLowerCase()],
  );
  return new Set(
    (r.rows || []).map((row: { column_name: string }) => String(row.column_name).toLowerCase()),
  );
}

export function registerSpecializedServicesEndpoints(app: Hono) {
  // ============================================
  // CUSTOMER-FACING DISCOVERY ENDPOINTS (PUBLIC)
  // ============================================

  /**
   * GET /discover/meal-plans
   * Customer-facing: Discover available meal plans
   * Public endpoint - no capability check
   */
  app.get("/discover/meal-plans", async (c) => {
    try {
      const city = c.req.query('city');
      const petType = c.req.query('petType');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let mealPlanQuery = `
        SELECT mp.*, v.business_name as vendor_name, v.city as vendor_city, v.rating as vendor_rating
        FROM meal_plans mp
        INNER JOIN vendors v ON mp.vendor_id = v.id
        WHERE mp.is_active = true
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (city) {
        mealPlanQuery += ` AND v.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      mealPlanQuery += ` ORDER BY v.rating DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const mealPlans = await query(mealPlanQuery, params).catch(() => ({ rows: [] }));
      const rawRows = mealPlans.rows || [];
      const enriched = await Promise.all(
        rawRows.map(async (mp: Record<string, unknown>) => {
          const { dietary_requirements, photos, mealImageUrl } = await presignMealPlanRowDisplayFields(mp);
          return { ...mp, dietary_requirements, photos, mealImageUrl };
        }),
      );

      return c.json({
        success: true,
        mealPlans: enriched,
        total: enriched.length,
      });
    } catch (error: any) {
      console.error('Error discovering meal plans:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /discover/training-programs
   * Customer-facing: Discover available training programs
   * Public endpoint - no capability check
   */
  /**
   * GET /public/diagnostics/categories
   * Diagnostic test categories/specializations for vendor test creation and customer filter.
   * Sourced from service_catalog (diagnostics) + "Other". Admin Catalog & Service updates flow here.
   */
  app.get("/public/diagnostics/categories", async (c) => {
    try {
      const rows = await query(`
        SELECT DISTINCT COALESCE(sc.category_name, sc.category_id, '') AS id,
               COALESCE(sc.category_name, sc.category_id, 'Other') AS name
        FROM service_catalog sc
        WHERE (sc.status = 'active' OR sc.status IS NULL)
          AND (sc.category_id = 'diagnostic'
               OR 'diagnostics_center' = ANY(COALESCE(sc.applicable_roles, ARRAY[]::text[]))
               OR 'diagnostic_center' = ANY(COALESCE(sc.applicable_roles, ARRAY[]::text[]))
               OR LOWER(COALESCE(sc.category_name, '')) LIKE '%diagnostic%'
               OR LOWER(COALESCE(sc.category_name, '')) LIKE '%lab%'
               OR LOWER(COALESCE(sc.category_name, '')) IN ('blood tests', 'imaging', 'allergy', 'hormone', 'urine', 'stool', 'biopsy'))
        ORDER BY name
      `).catch(() => ({ rows: [] }));
      // service_catalog sometimes has NULL category_name; COALESCE then surfaces category_id (UUID) as the label — drop those for customer UI.
      const looksLikeUuid = (s: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '').trim());
      const list = (rows.rows || [])
        .map((r: any) => {
          const idRaw = (r.id || '').toString();
          const nameRaw = (r.name || r.id || '').toString();
          if (looksLikeUuid(nameRaw) || looksLikeUuid(idRaw)) return null;
          return { id: idRaw.toLowerCase().replace(/\s+/g, '_'), name: nameRaw || idRaw };
        })
        .filter((x: any) => x != null) as { id: string; name: string }[];
      const seen = new Set(list.map((x: any) => x.id));
      if (!seen.has('blood') && !seen.has('blood_test')) {
        list.unshift({ id: 'blood', name: 'Blood Test' });
      }
      if (!seen.has('other')) {
        list.push({ id: 'other', name: 'Other' });
      }
      return c.json({ success: true, categories: list });
    } catch (error: any) {
      console.error('Error fetching diagnostics categories:', error);
      return c.json({
        success: true,
        categories: [
          { id: 'blood', name: 'Blood Test' },
          { id: 'urine', name: 'Urine Test' },
          { id: 'stool', name: 'Stool Test' },
          { id: 'imaging', name: 'Imaging' },
          { id: 'biopsy', name: 'Biopsy' },
          { id: 'allergy', name: 'Allergy Tests' },
          { id: 'hormone', name: 'Hormone Tests' },
          { id: 'other', name: 'Other' },
        ],
      });
    }
  });

  app.get("/discover/training-programs", async (c) => {
    try {
      const city = c.req.query('city');
      const skillLevel = c.req.query('skillLevel');
      const category = c.req.query('category');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let programQuery = `
        SELECT tp.*, v.business_name as vendor_name, v.city as vendor_city, v.rating as vendor_rating
        FROM training_programs tp
        INNER JOIN vendors v ON tp.vendor_id = v.id
        WHERE tp.is_active = true
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (city) {
        programQuery += ` AND v.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      if (skillLevel) {
        programQuery += ` AND tp.skill_level = $${paramIndex}`;
        params.push(skillLevel);
        paramIndex++;
      }

      if (category) {
        programQuery += ` AND tp.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      programQuery += ` ORDER BY v.rating DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const programs = await query(programQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        programs: programs.rows,
        total: programs.rows.length,
      });
    } catch (error: any) {
      console.error('Error discovering training programs:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /discover/holiday-packages
   * Customer-facing: Discover available holiday packages
   * Public endpoint - no capability check
   */
  app.get("/discover/holiday-packages", async (c) => {
    try {
      const destination = c.req.query('destination');
      const maxDays = c.req.query('maxDays');
      const maxPrice = c.req.query('maxPrice');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let packageQuery = `
        SELECT hp.*, v.business_name as vendor_name, v.city as vendor_city, v.rating as vendor_rating
        FROM holiday_packages hp
        INNER JOIN vendors v ON hp.vendor_id = v.id
        WHERE hp.is_active = true
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (destination) {
        packageQuery += ` AND hp.destination ILIKE $${paramIndex}`;
        params.push(`%${destination}%`);
        paramIndex++;
      }

      if (maxDays) {
        packageQuery += ` AND hp.duration_days <= $${paramIndex}`;
        params.push(parseInt(maxDays, 10));
        paramIndex++;
      }

      if (maxPrice) {
        packageQuery += ` AND hp.price <= $${paramIndex}`;
        params.push(parseFloat(maxPrice));
        paramIndex++;
      }

      packageQuery += ` ORDER BY hp.next_departure ASC NULLS LAST, v.rating DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const packages = await query(packageQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        packages: packages.rows,
        total: packages.rows.length,
      });
    } catch (error: any) {
      console.error('Error discovering holiday packages:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /discover/adoption-pets
   * Customer-facing: Discover pets available for adoption
   * Public endpoint - no capability check
   */
  app.get("/discover/adoption-pets", async (c) => {
    try {
      const city = c.req.query('city');
      const petType = c.req.query('petType');
      const breed = c.req.query('breed');
      const gender = c.req.query('gender');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let petQuery = `
        SELECT p.*, v.business_name as vendor_name, v.city as vendor_city
        FROM pets p
        INNER JOIN vendors v ON p.vendor_id = v.id
        WHERE p.listing_type IN ('adoption', 'breeding')
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (city) {
        petQuery += ` AND (v.city ILIKE $${paramIndex} OR p.location_city ILIKE $${paramIndex})`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      if (petType) {
        petQuery += ` AND p.pet_type = $${paramIndex}`;
        params.push(petType);
        paramIndex++;
      }

      if (breed) {
        petQuery += ` AND p.breed ILIKE $${paramIndex}`;
        params.push(`%${breed}%`);
        paramIndex++;
      }

      if (gender) {
        petQuery += ` AND p.gender = $${paramIndex}`;
        params.push(gender);
        paramIndex++;
      }

      petQuery += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const pets = await query(petQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        pets: pets.rows,
        total: pets.rows.length,
      });
    } catch (error: any) {
      console.error('Error discovering adoption pets:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /discover/boarding-rooms
   * Customer-facing: Discover available boarding rooms
   * Public endpoint - no capability check
   */
  app.get("/discover/boarding-rooms", async (c) => {
    try {
      const city = c.req.query('city');
      const roomType = c.req.query('roomType');
      const checkInDate = c.req.query('checkInDate');
      const checkOutDate = c.req.query('checkOutDate');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let roomQuery = `
        SELECT br.*, v.business_name as vendor_name, v.city as vendor_city, v.rating as vendor_rating
        FROM boarding_rooms br
        INNER JOIN vendors v ON br.vendor_id = v.id
        WHERE br.is_available = true
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (city) {
        roomQuery += ` AND v.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      if (roomType) {
        roomQuery += ` AND br.room_type = $${paramIndex}`;
        params.push(roomType);
        paramIndex++;
      }

      roomQuery += ` ORDER BY v.rating DESC NULLS LAST, br.price_per_night ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const rooms = await query(roomQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        rooms: rooms.rows,
        total: rooms.rows.length,
      });
    } catch (error: any) {
      console.error('Error discovering boarding rooms:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // AMBULANCE: VEHICLE FLEET MANAGEMENT
  // ============================================

  /**
   * GET /vendor/:vendorId/ambulance/vehicles
   * Get all vehicles for an ambulance service
   * Requires 'ambulance' capability
   */
  app.get("/vendor/:vendorId/ambulance/vehicles", async (c) => {
    try {
      const vendorId = await resolveVendorId(c.req.param('vendorId'));
      
      // Check if vendor has ambulance capability
      const hasAmbulanceCapability = await checkVendorCapability(vendorId, 'ambulance');
      if (!hasAmbulanceCapability) {
        return c.json({ error: 'Vendor does not have ambulance capability' }, 403);
      }
      
      const vehicles = await select('ambulance_vehicles', 
        { vendor_id: vendorId },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );
      
      return c.json({ success: true, vehicles, total: vehicles.length });
    } catch (error: any) {
      console.error('Error fetching ambulance vehicles:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/ambulance/vehicles
   * Add a new vehicle
   * Requires 'ambulance' capability
   */
  app.post("/vendor/:vendorId/ambulance/vehicles", async (c) => {
    try {
      const vendorId = await resolveVendorId(c.req.param('vendorId'));
      
      // Check if vendor has ambulance capability
      const hasAmbulanceCapability = await checkVendorCapability(vendorId, 'ambulance');
      if (!hasAmbulanceCapability) {
        return c.json({ error: 'Vendor does not have ambulance capability' }, 403);
      }
      
      const vehicleData = await c.req.json();
      
      const vehicle = await insert('ambulance_vehicles', {
        vendor_id: vendorId,
        vehicle_number: vehicleData.vehicleNumber || vehicleData.vehicle_number || `VEH-${Date.now()}`,
        vehicle_type: vehicleData.vehicleType || vehicleData.vehicle_type || 'basic',
        capacity: vehicleData.capacity || 2,
        equipment: vehicleData.equipment || [],
        current_location: vehicleData.currentLocation || vehicleData.current_location || null,
        is_available: vehicleData.isAvailable !== false,
        rating: 5.0,
        total_trips: 0,
      });
      
      return c.json({ success: true, vehicle: vehicle[0], message: 'Vehicle added successfully' });
    } catch (error: any) {
      console.error('Error adding ambulance vehicle:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/ambulance/vehicles/:vehicleId
   * Update vehicle details
   * Requires 'ambulance' capability
   */
  app.put("/vendor/:vendorId/ambulance/vehicles/:vehicleId", async (c) => {
    try {
      const p = c.req.param();
      const vendorId = await resolveVendorId(p.vendorId);
      const vehicleId = p.vehicleId;
      
      // Check if vendor has ambulance capability
      const hasAmbulanceCapability = await checkVendorCapability(vendorId, 'ambulance');
      if (!hasAmbulanceCapability) {
        return c.json({ error: 'Vendor does not have ambulance capability' }, 403);
      }
      
      const vehicleData = await c.req.json();
      
      const updated = await update('ambulance_vehicles', 
        { id: vehicleId },
        {
          vehicle_type: vehicleData.vehicleType || vehicleData.vehicle_type,
          capacity: vehicleData.capacity,
          equipment: vehicleData.equipment,
          current_location: vehicleData.currentLocation || vehicleData.current_location,
          is_available: vehicleData.isAvailable,
          rating: vehicleData.rating,
          total_trips: vehicleData.totalTrips || vehicleData.total_trips,
        }
      );
      
      if (updated.length === 0) {
        return c.json({ error: 'Vehicle not found' }, 404);
      }
      
      return c.json({ success: true, vehicle: updated[0], message: 'Vehicle updated successfully' });
    } catch (error: any) {
      console.error('Error updating ambulance vehicle:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // DIAGNOSTICS: TEST CATALOG
  // ============================================

  /**
   * GET /vendor/:vendorId/diagnostics/tests
   * Get all diagnostic tests offered by this center.
   * Requires diagnostics capability (diagnostics, diagnostic_results, test_catalog, or diagnostic_lab).
   * Optional query publishedOnly=true returns only is_available=true (for customer booking flow).
   */
  app.get("/vendor/:vendorId/diagnostics/tests", async (c) => {
    try {
      const vendorId = await resolveVendorId(c.req.param('vendorId'));
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) return c.json({ error: 'Vendor not found' }, 404);
      const actualVendorId = vendor.id;
      const publishedOnly = c.req.query('publishedOnly') === 'true';

      // Check if vendor has diagnostics capability (include diagnostic_lab for vet clinics; 'diagnostic lab' with space for admin-stored display name)
      const hasDiagnosticsCapability = await checkVendorCapability(vendorId, 'diagnostic_results') ||
                                       await checkVendorCapability(vendorId, 'diagnostics') ||
                                       await checkVendorCapability(vendorId, 'test_catalog') ||
                                       await checkVendorCapability(vendorId, 'diagnostic_lab') ||
                                       await checkVendorCapability(vendorId, 'diagnostic lab');
      if (!hasDiagnosticsCapability) {
        return c.json({ error: 'Vendor does not have diagnostics capability' }, 403);
      }

      // ✅ FIX: Use actualVendorId (resolved vendors.id) - POST saves with actualVendorId, so GET must query same.
      // Raw vendorId can be vendor_identity.id for old vendors; diagnostic_tests.vendor_id = vendors.id.
      const filter: Record<string, any> = { vendor_id: actualVendorId };
      if (publishedOnly) {
        filter.is_available = true;
      }
      const rows = await select('diagnostic_tests',
        filter,
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );
      // Normalize: some DBs use test_category (migration 057), frontend expects category
      const tests = rows.map((r: any) => ({
        ...r,
        category: r.category ?? r.test_category,
      }));

      return c.json({ success: true, tests, total: tests.length });
    } catch (error: any) {
      console.error('Error fetching diagnostic tests:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/diagnostics/vendors-with-tests
   * Discovery: vendors with published diagnostic tests (diagnostics centers + vet clinics with lab tests enabled).
   * Includes: diagnostics_center, diagnostic_center, and vet_clinic/veterinary_clinic/vet with diagnostics capability.
   * Only vendors that have at least one published (is_available = true) test are returned.
   * When lat/lng + maxDistance are sent: vendors within range are returned first; vendors missing latitude/longitude
   * still appear (distance null) so labs can be discovered before they set coordinates on their profile.
   */
  app.get("/customer/diagnostics/vendors-with-tests", async (c) => {
    try {
      const category = c.req.query('category');
      const serviceStyle = c.req.query('serviceStyle');
      const lat = c.req.query('lat') ? parseFloat(c.req.query('lat')!) : null;
      const lng = c.req.query('lng') ? parseFloat(c.req.query('lng')!) : null;
      const maxDistance = c.req.query('maxDistance') ? parseFloat(c.req.query('maxDistance')!) : 50;

      const testCategoryCol = await query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'diagnostic_tests' AND column_name = 'test_category' LIMIT 1`
      );
      const hasTestCategoryColumn = ((testCategoryCol as any).rows?.length || 0) > 0;
      const categorySelectSql = hasTestCategoryColumn
        ? 'COALESCE(category, test_category) AS category'
        : 'category AS category';
      const categoryFilterExpr = hasTestCategoryColumn
        ? "COALESCE(category, test_category, '')"
        : "COALESCE(category, '')";

      let vendorQuery = `
        SELECT v.id, v.business_name, v.city, v.state, v.address, v.latitude, v.longitude, v.rating
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
          AND (
            /* Lab roles: canonical + legacy aliases (see db/migrations/522_consolidate_legacy_role_vendors.sql) + service_catalog roleMappings. Normalized spaces → underscores for "diagnostic center" style names. */
            (LOWER(REPLACE(TRIM(r.name), ' ', '_')) IN (
              'diagnostics_center', 'diagnostic_center', 'diagnostics', 'diagnostics_provider', 'diagnostics_solo',
              'laboratory', 'lab_center'
            ))
            OR (
              (
                LOWER(r.name) IN ('vet_clinic', 'veterinary_clinic', 'vet', 'veterinarian', 'vet_solo')
                OR (LOWER(TRIM(r.name)) LIKE '%vet%' AND LOWER(TRIM(r.name)) LIKE '%clinic%')
                OR LOWER(REPLACE(TRIM(r.name), ' ', '_')) IN ('vet_clinic', 'veterinary_clinic')
              )
              AND EXISTS (
                SELECT 1 FROM role_permissions rp
                WHERE rp.role_id = v.role_id
                AND (
                  LOWER(rp.permission_name) IN ('diagnostics', 'diagnostic_results', 'test_catalog', 'diagnostic_lab')
                  OR REPLACE(LOWER(TRIM(rp.permission_name)), ' ', '_') = 'diagnostic_lab'
                )
              )
            )
          )
          AND EXISTS (
            SELECT 1 FROM diagnostic_tests dt
            WHERE dt.vendor_id = v.id AND dt.is_available = true
          )
      `;
      const vendorParams: any[] = [];
      let pi = 1;
      if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
        vendorQuery += `
          AND (
            (
              v.latitude IS NOT NULL AND v.longitude IS NOT NULL
              AND (6371 * acos(cos(radians($${pi})) * cos(radians(CAST(v.latitude AS FLOAT))) * cos(radians(CAST(v.longitude AS FLOAT)) - radians($${pi + 1})) + sin(radians($${pi})) * sin(radians(CAST(v.latitude AS FLOAT))))) <= $${pi + 2}
            )
            OR (v.latitude IS NULL OR v.longitude IS NULL)
          )
        `;
        vendorParams.push(lat, lng, maxDistance);
        pi += 3;
      }
      vendorQuery += ` ORDER BY CASE WHEN v.latitude IS NULL OR v.longitude IS NULL THEN 1 ELSE 0 END, v.business_name`;
      const vendorsResult = await query(vendorQuery, vendorParams);
      const vendors = vendorsResult.rows || [];

      const out: any[] = [];
      for (const v of vendors) {
        let testQuery = `
          SELECT id, test_name, price, duration_minutes,
                 ${categorySelectSql},
                 COALESCE(service_style, 'at_center') AS service_style,
                 is_free_home_collection, home_collection_fee
          FROM diagnostic_tests
          WHERE vendor_id = $1 AND is_available = true
        `;
        const testParams: any[] = [v.id];
        let ti = 2;
        if (category) {
          testQuery += ` AND (LOWER(${categoryFilterExpr}) = LOWER($${ti}) OR ${categoryFilterExpr} ILIKE $${ti + 1})`;
          testParams.push(category, `%${category}%`);
          ti += 2;
        }
        if (serviceStyle) {
          testQuery += ` AND COALESCE(service_style, 'at_center') = $${ti}`;
          testParams.push(serviceStyle);
        }
        testQuery += ` ORDER BY test_name`;
        const testsResult = await query(testQuery, testParams);
        const tests = (testsResult.rows || []).map((t: any) => ({
          id: t.id,
          test_name: t.test_name,
          price: parseFloat(t.price) || 0,
          duration_minutes: t.duration_minutes,
          category: t.category,
          service_style: t.service_style,
          is_free_home_collection: t.is_free_home_collection,
          home_collection_fee: t.home_collection_fee,
        }));
        if (tests.length === 0 && (category || serviceStyle)) continue;
        const distanceKm = (v.latitude != null && v.longitude != null && lat != null && lng != null)
          ? (6371 * Math.acos(
              Math.cos(lat * Math.PI / 180) * Math.cos(Number(v.latitude) * Math.PI / 180) *
              Math.cos(Number(v.longitude) * Math.PI / 180 - lng * Math.PI / 180) +
              Math.sin(lat * Math.PI / 180) * Math.sin(Number(v.latitude) * Math.PI / 180)
            ))
          : null;
        out.push({
          id: v.id,
          businessName: v.business_name,
          city: v.city,
          state: v.state,
          address: v.address,
          latitude: v.latitude,
          longitude: v.longitude,
          rating: v.rating,
          distance: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
          homeCollectionAvailable: tests.some((t: any) => t.service_style === 'at_home'),
          tests,
        });
      }

      return c.json({ success: true, vendors: out });
    } catch (error: any) {
      console.error('Error fetching diagnostics vendors-with-tests:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/diagnostics/tests
   * Add a new diagnostic test
   * Requires diagnostics capability (diagnostics, diagnostic_results, test_catalog, or diagnostic_lab)
   */
  app.post("/vendor/:vendorId/diagnostics/tests", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) return c.json({ error: 'Vendor not found' }, 404);
      const actualVendorId = vendor.id;

      const hasDiagnosticsCapability = await checkVendorCapability(vendorId, 'diagnostic_results') ||
                                       await checkVendorCapability(vendorId, 'diagnostics') ||
                                       await checkVendorCapability(vendorId, 'test_catalog') ||
                                       await checkVendorCapability(vendorId, 'diagnostic_lab') ||
                                       await checkVendorCapability(vendorId, 'diagnostic lab');
      if (!hasDiagnosticsCapability) {
        return c.json({ error: 'Vendor does not have diagnostics capability' }, 403);
      }

      const testData = await c.req.json();

      // ✅ FIX: Use raw SQL with only guaranteed columns first, then try with extended columns
      // This handles the case where migration 503 hasn't been run yet
      try {
        // First try with all columns (if migration has been applied)
        const categoryVal = testData.category === 'other' && (testData.otherCategoryName || testData.other_category_name)
          ? (testData.otherCategoryName || testData.other_category_name)
          : (testData.category || testData.test_category);
        const test = await insert('diagnostic_tests', {
          vendor_id: actualVendorId,
          test_name: testData.testName || testData.test_name || testData.name,
          test_code: testData.testCode || testData.test_code,
          category: categoryVal,
          description: testData.description,
          price: testData.price,
          duration_minutes: testData.durationMinutes || testData.duration_minutes,
          sample_type: testData.sampleType || testData.sample_type,
          preparation_instructions: testData.preparationInstructions || testData.preparation_instructions,
          is_available: testData.isAvailable !== false,
          service_style: testData.serviceStyle || testData.service_style || 'at_center',
          // Extended fields (may not exist if migration not applied)
          is_free_home_collection: testData.isFreeHomeCollection || testData.is_free_home_collection || false,
          home_collection_fee: testData.homeCollectionFee || testData.home_collection_fee || 0,
          terms_conditions: testData.termsConditions || testData.terms_conditions,
          turnaround_time_hours: testData.turnaroundTimeHours || testData.turnaround_time_hours,
          is_package_available: testData.isPackageAvailable || testData.is_package_available || false,
          package_price: testData.packagePrice || testData.package_price,
          package_test_count: testData.packageTestCount || testData.package_test_count,
        });
        
        return c.json({ success: true, test: test[0], message: 'Diagnostic test added successfully' });
      } catch (insertError: any) {
        // ✅ FIX: If column doesn't exist error, retry with schema-aware fallback
        // Migration 057 uses test_category; 021 uses category. Some DBs have 057 schema.
        if (insertError.message?.includes('column') && insertError.message?.includes('does not exist')) {
          console.warn('⚠️ Column mismatch, retrying with schema-aware insert. Error:', insertError.message);
          
          // Try with test_category (057 schema) - minimal columns that exist in 057
          try {
            const categoryVal = testData.category === 'other' && (testData.otherCategoryName || testData.other_category_name)
              ? (testData.otherCategoryName || testData.other_category_name)
              : (testData.category || testData.test_category);
            const testCore = await insert('diagnostic_tests', {
              vendor_id: actualVendorId,
              test_name: testData.testName || testData.test_name || testData.name,
              test_category: categoryVal,
              description: testData.description,
              price: testData.price,
              duration_minutes: testData.durationMinutes || testData.duration_minutes,
              is_available: testData.isAvailable !== false,
            });
            const row = testCore[0] as any;
            // Normalize response to use category for frontend
            if (row && row.test_category != null && row.category == null) {
              row.category = row.test_category;
            }
            return c.json({ 
              success: true, 
              test: row, 
              message: 'Diagnostic test added successfully'
            });
          } catch (fallbackError: any) {
            // Last resort: absolute minimal insert (vendor_id, test_name, price required)
            if (fallbackError.message?.includes('column') && fallbackError.message?.includes('does not exist')) {
              const catVal = testData.category === 'other' && (testData.otherCategoryName || testData.other_category_name)
                ? (testData.otherCategoryName || testData.other_category_name)
                : (testData.category || testData.test_category);
              const testMin = await insert('diagnostic_tests', {
                vendor_id: actualVendorId,
                test_name: testData.testName || testData.test_name || testData.name,
                test_category: catVal,
                price: testData.price ?? 0,
                is_available: testData.isAvailable !== false,
              });
              const row = testMin[0] as any;
              if (row && row.test_category != null) row.category = row.test_category;
              return c.json({ success: true, test: row, message: 'Diagnostic test added successfully' });
            }
            throw fallbackError;
          }
        }
        
        throw insertError;
      }
    } catch (error: any) {
      console.error('Error adding diagnostic test:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/diagnostics/tests/:testId
   * Update diagnostic test
   * Requires 'diagnostics' or 'test_catalog' capability
   */
  app.put("/vendor/:vendorId/diagnostics/tests/:testId", async (c) => {
    try {
      const { vendorId, testId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) return c.json({ error: 'Vendor not found' }, 404);
      const actualVendorId = vendor.id;
      
      // Check if vendor has diagnostics capability (try multiple capability names)
      const hasDiagnosticsCapability = await checkVendorCapability(vendorId, 'diagnostic_results') ||
                                       await checkVendorCapability(vendorId, 'diagnostics') ||
                                       await checkVendorCapability(vendorId, 'test_catalog') ||
                                       await checkVendorCapability(vendorId, 'diagnostic_lab') ||
                                       await checkVendorCapability(vendorId, 'diagnostic lab');
      if (!hasDiagnosticsCapability) {
        return c.json({ error: 'Vendor does not have diagnostics capability' }, 403);
      }

      const testData = await c.req.json();

      // Build update object with only provided fields - core fields first
      const coreUpdateFields: any = {};
      const extendedUpdateFields: any = {};
      
      // Core fields (guaranteed to exist)
      if (testData.testName !== undefined || testData.test_name !== undefined) {
        coreUpdateFields.test_name = testData.testName || testData.test_name;
      }
      if (testData.category !== undefined) {
        coreUpdateFields.category = testData.category === 'other' && (testData.otherCategoryName || testData.other_category_name)
          ? (testData.otherCategoryName || testData.other_category_name)
          : testData.category;
      }
      if (testData.serviceStyle !== undefined || testData.service_style !== undefined) {
        extendedUpdateFields.service_style = testData.serviceStyle ?? testData.service_style;
      }
      if (testData.description !== undefined) {
        coreUpdateFields.description = testData.description;
      }
      if (testData.price !== undefined) {
        coreUpdateFields.price = testData.price;
      }
      if (testData.durationMinutes !== undefined || testData.duration_minutes !== undefined) {
        coreUpdateFields.duration_minutes = testData.durationMinutes || testData.duration_minutes;
      }
      if (testData.sampleType !== undefined || testData.sample_type !== undefined) {
        coreUpdateFields.sample_type = testData.sampleType || testData.sample_type;
      }
      if (testData.preparationInstructions !== undefined || testData.preparation_instructions !== undefined) {
        coreUpdateFields.preparation_instructions = testData.preparationInstructions || testData.preparation_instructions;
      }
      if (testData.isAvailable !== undefined) {
        coreUpdateFields.is_available = testData.isAvailable;
      }
      
      // Extended fields (may not exist - added in migration 503)
      if (testData.testCode !== undefined || testData.test_code !== undefined) {
        extendedUpdateFields.test_code = testData.testCode || testData.test_code;
      }
      if (testData.isFreeHomeCollection !== undefined || testData.is_free_home_collection !== undefined) {
        extendedUpdateFields.is_free_home_collection = testData.isFreeHomeCollection || testData.is_free_home_collection;
      }
      if (testData.homeCollectionFee !== undefined || testData.home_collection_fee !== undefined) {
        extendedUpdateFields.home_collection_fee = testData.homeCollectionFee || testData.home_collection_fee;
      }
      if (testData.termsConditions !== undefined || testData.terms_conditions !== undefined) {
        extendedUpdateFields.terms_conditions = testData.termsConditions || testData.terms_conditions;
      }
      if (testData.turnaroundTimeHours !== undefined || testData.turnaround_time_hours !== undefined) {
        extendedUpdateFields.turnaround_time_hours = testData.turnaroundTimeHours || testData.turnaround_time_hours;
      }
      if (testData.isPackageAvailable !== undefined || testData.is_package_available !== undefined) {
        extendedUpdateFields.is_package_available = testData.isPackageAvailable || testData.is_package_available;
      }
      if (testData.packagePrice !== undefined || testData.package_price !== undefined) {
        extendedUpdateFields.package_price = testData.packagePrice || testData.package_price;
      }
      if (testData.packageTestCount !== undefined || testData.package_test_count !== undefined) {
        extendedUpdateFields.package_test_count = testData.packageTestCount || testData.package_test_count;
      }
      
      // ✅ FIX: Try with all fields first, fallback to core fields only
      try {
        const updateFields = { ...coreUpdateFields, ...extendedUpdateFields };
        const updated = await update('diagnostic_tests',
          { id: testId, vendor_id: actualVendorId },
          updateFields
        );
        
        if (updated.length === 0) {
          return c.json({ error: 'Test not found or access denied' }, 404);
        }
        
        return c.json({ success: true, test: updated[0], message: 'Test updated successfully' });
      } catch (updateError: any) {
        // ✅ FIX: If column doesn't exist error, retry with only core columns
        if (updateError.message?.includes('column') && updateError.message?.includes('does not exist')) {
          console.warn('⚠️ Extended columns not found, retrying with core columns only. Run migration 503 to add missing columns.');
          
          const updatedCore = await update('diagnostic_tests',
            { id: testId, vendor_id: actualVendorId },
            coreUpdateFields
          );
          
          if (updatedCore.length === 0) {
            return c.json({ error: 'Test not found or access denied' }, 404);
          }
          
          return c.json({ 
            success: true, 
            test: updatedCore[0], 
            message: 'Test updated successfully (some fields may be unavailable)',
            warning: 'Extended columns not available. Please run migration 503 to enable all features.'
          });
        }
        
        throw updateError;
      }
    } catch (error: any) {
      console.error('Error updating diagnostic test:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/diagnostics/tests/:testId
   * Permanently remove a catalog row (vendor UI "delete" — not the same as unpublish/draft).
   */
  app.delete('/vendor/:vendorId/diagnostics/tests/:testId', async (c) => {
    try {
      const { vendorId, testId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) return c.json({ error: 'Vendor not found' }, 404);
      const actualVendorId = vendor.id;

      const hasDiagnosticsCapability = await checkVendorCapability(vendorId, 'diagnostic_results') ||
        await checkVendorCapability(vendorId, 'diagnostics') ||
        await checkVendorCapability(vendorId, 'test_catalog') ||
        await checkVendorCapability(vendorId, 'diagnostic_lab') ||
        await checkVendorCapability(vendorId, 'diagnostic lab');
      if (!hasDiagnosticsCapability) {
        return c.json({ error: 'Vendor does not have diagnostics capability' }, 403);
      }

      const removed = await deleteRows('diagnostic_tests', { id: testId, vendor_id: actualVendorId });
      if (removed === 0) {
        return c.json({ error: 'Test not found or access denied' }, 404);
      }
      return c.json({ success: true, message: 'Diagnostic test deleted' });
    } catch (error: any) {
      console.error('Error deleting diagnostic test:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/diagnostics/bookings
   * Get all diagnostics bookings for a vendor
   * Requires 'diagnostics' or 'diagnostic_results' capability
   */
  app.get("/vendor/:vendorId/diagnostics/bookings", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { status, date } = c.req.query();

      const hasDiagnosticsCapability = await checkVendorCapability(vendorId, 'diagnostic_results') ||
                                       await checkVendorCapability(vendorId, 'diagnostics') ||
                                       await checkVendorCapability(vendorId, 'test_catalog') ||
                                       await checkVendorCapability(vendorId, 'diagnostic_lab') ||
                                       await checkVendorCapability(vendorId, 'diagnostic lab');
      if (!hasDiagnosticsCapability) {
        return c.json({ error: 'Vendor does not have diagnostics capability' }, 403);
      }

      // Build query conditions: diagnostics bookings have notes with "tests" array (from DiagnosticsBookingFlow)
      // or may use service_id from diagnostics vendor_services; service_id is UUID so we match by notes
      let conditions = `b.vendor_id = $1 AND (b.notes IS NOT NULL AND (b.notes::text LIKE '%"tests"%' OR b.notes::text LIKE '%"test_name"%'))`;
      const params: any[] = [vendorId];
      let paramIndex = 2;
      
      if (status) {
        conditions += ` AND b.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
      
      if (date) {
        conditions += ` AND b.booking_date = $${paramIndex}`;
        params.push(date);
        paramIndex++;
      }
      
      const { rows: bookings } = await query(`
        SELECT 
          b.*,
          c.full_name as customer_name,
          c.phone as customer_phone,
          p.name as pet_name,
          p.species as pet_type,
          sca.staff_id as assigned_staff_id,
          COALESCE(sca.staff_name, sca.agent_name) as assigned_staff_name,
          COALESCE(sca.staff_phone, sca.agent_phone) as assigned_staff_phone,
          sca.agent_name as assigned_agent_name,
          sca.agent_phone as assigned_agent_phone,
          sca.collection_otp,
          sca.status as collection_status
        FROM bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN pets p ON p.id = b.pet_id
        LEFT JOIN sample_collection_assignments sca ON sca.booking_id = b.id
        WHERE ${conditions}
        ORDER BY b.booking_date DESC, b.booking_time DESC
      `, params);
      
      // Get reports for each booking (schema-aware: booking_id or diagnostic_booking_id)
      const bookingIds = bookings.map(b => b.id);
      let reports: any[] = [];
      
      if (bookingIds.length > 0) {
        try {
          const { rows: reportRows } = await query(`
            SELECT * FROM diagnostic_reports 
            WHERE booking_id = ANY($1)
          `, [bookingIds]);
          reports = reportRows;
        } catch (drErr: any) {
          if (drErr?.message?.includes('booking_id')) {
            try {
              const { rows: reportRows } = await query(`
                SELECT *, diagnostic_booking_id as booking_id FROM diagnostic_reports 
                WHERE diagnostic_booking_id = ANY($1)
              `, [bookingIds]);
              reports = reportRows;
            } catch {
              // diagnostic_reports may not exist or have different schema
            }
          }
        }
      }
      
      // Format response - enrich pet/patient from notes when pet_id is null (e.g. diagnostics patientName/patientAge)
      const formattedBookings = bookings.map((b: any) => {
        let pet_name = b.pet_name;
        let pet_type = b.pet_type;
        let pet_age: string | undefined;
        if ((!pet_name || pet_name === 'Unknown Pet') && b.notes) {
          try {
            const notesObj = typeof b.notes === 'string' ? JSON.parse(b.notes) : b.notes;
            if (notesObj && typeof notesObj === 'object') {
              if (notesObj.patientName) pet_name = notesObj.patientName;
              if (notesObj.petType || notesObj.pet_type) pet_type = notesObj.petType || notesObj.pet_type;
              if (notesObj.patientAge != null || notesObj.petAge != null) pet_age = String(notesObj.patientAge ?? notesObj.petAge ?? '');
            }
          } catch {
            // notes not JSON
          }
        }
        return {
          ...b,
          pet_name: pet_name || 'Patient',
          pet_type: pet_type || '',
          pet_age: pet_age ?? b.pet_age ?? undefined,
          reports: reports.filter((r: any) => (r.booking_id || r.diagnostic_booking_id) === b.id),
          assigned_staff: (b.assigned_staff_id || b.assigned_staff_name || b.assigned_agent_name) ? {
            id: b.assigned_staff_id,
            name: b.assigned_staff_name || b.assigned_agent_name,
            phone: b.assigned_staff_phone || b.assigned_agent_phone
          } : null,
          collection_otp: b.collection_otp,
          collection_status: b.collection_status
        };
      });
      
      return c.json({ 
        success: true, 
        bookings: formattedBookings,
        count: formattedBookings.length 
      });
    } catch (error: any) {
      console.error('Error getting diagnostics bookings:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // PHARMACY: MEDICINE INVENTORY
  // ============================================

  /**
   * GET /vendor/:vendorId/pharmacy/medicines
   * Get pharmacy inventory
   * Requires 'pharmacy' or 'inventory' capability
   */
  app.get("/vendor/:vendorId/pharmacy/medicines", async (c) => {
    try {
      const vendorId = await resolveVendorId(c.req.param('vendorId'));
      
      // Handle test IDs - return empty medicines
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({ success: true, medicines: [], total: 0 });
      }
      
      // Check if vendor has pharmacy capability
      const hasPharmacyCapability = await checkVendorCapability(vendorId, 'pharmacy');
      const hasInventoryCapability = await checkVendorCapability(vendorId, 'inventory');
      if (!hasPharmacyCapability && !hasInventoryCapability) {
        return c.json({ error: 'Vendor does not have pharmacy capability' }, 403);
      }
      
      // Get products filtered by category (medicine/pharmacy)
      let medicines;
      try {
        medicines = await query(`
          SELECT * FROM products 
          WHERE vendor_id = $1 
          AND (category = 'medicine' OR category = 'pharmacy' OR category ILIKE '%medicine%')
          ORDER BY created_at DESC
        `, [vendorId]);
      } catch (error: any) {
        // If UUID validation fails, return empty medicines
        if (error.message?.includes('invalid input syntax for type uuid')) {
          return c.json({ success: true, medicines: [], total: 0 });
        }
        throw error;
      }
      
      return c.json({ success: true, medicines: medicines.rows, total: medicines.rows.length });
    } catch (error: any) {
      console.error('Error fetching pharmacy inventory:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/pharmacy/medicines
   * Add medicine to inventory
   * Requires 'pharmacy' or 'inventory' capability
   */
  app.post("/vendor/:vendorId/pharmacy/medicines", async (c) => {
    try {
      const vendorId = await resolveVendorId(c.req.param('vendorId'));
      
      // Check if vendor has pharmacy capability
      const hasPharmacyCapability = await checkVendorCapability(vendorId, 'pharmacy');
      const hasInventoryCapability = await checkVendorCapability(vendorId, 'inventory');
      if (!hasPharmacyCapability && !hasInventoryCapability) {
        return c.json({ error: 'Vendor does not have pharmacy capability' }, 403);
      }
      
      const medicineData = await c.req.json();
      
      const medicine = await insert('products', {
        vendor_id: vendorId,
        name: medicineData.name,
        description: medicineData.description,
        category: 'medicine',
        subcategory: medicineData.subcategory,
        price: medicineData.price,
        stock: medicineData.stock || 0,
        images: medicineData.images || [],
        hsn_code: medicineData.hsnCode || medicineData.hsn_code,
        gst_rate: medicineData.gstRate || medicineData.gst_rate,
      });
      
      return c.json({ success: true, medicine: medicine[0], message: 'Medicine added to inventory' });
    } catch (error: any) {
      console.error('Error adding medicine:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // NUTRITIONIST: MEAL PLANS
  // ============================================

  /**
   * GET /vendor/:vendorId/nutritionist/meal-plans
   * Get all meal plans
   * Requires 'meal_plans' capability
   */
  app.get("/vendor/:vendorId/nutritionist/meal-plans", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      
      // Check if vendor has meal_plans capability
      const hasMealPlansCapability = await checkVendorCapability(vendorId, 'meal_plans');
      if (!hasMealPlansCapability) {
        return c.json({ error: 'Vendor does not have meal plans capability' }, 403);
      }
      
      const rows = await select('meal_plans',
        { vendor_id: vendorId },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );
      const mealPlans = (rows || []).map((r: any) => ({
        ...r,
        name: r.plan_name || r.name,
        price: r.price_per_meal ?? r.price,
        pet_types: (() => {
          try {
            const d = typeof r.dietary_requirements === 'string' ? JSON.parse(r.dietary_requirements) : r.dietary_requirements;
            return d?.pet_types || d?.petTypes || ['Dog', 'Cat'];
          } catch { return ['Dog', 'Cat']; }
        })(),
      }));
      return c.json({ success: true, mealPlans, plans: mealPlans, total: mealPlans.length });
    } catch (error: any) {
      console.error('Error fetching meal plans:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/nutritionist/meal-plans
   * Create a new meal plan
   * Requires 'meal_plans' capability
   * Resolves vendorId to fix meal_plans_vendor_id_fkey FK violation
   */
  app.post("/vendor/:vendorId/nutritionist/meal-plans", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({
          error: 'Vendor not found',
          hint: 'The vendor ID may be invalid. Please ensure you are logged in with a valid vendor account.',
        }, 404);
      }
      
      // Check if vendor has meal_plans capability
      const hasMealPlansCapability = await checkVendorCapability(vendorId, 'meal_plans');
      if (!hasMealPlansCapability) {
        return c.json({ error: 'Vendor does not have meal plans capability' }, 403);
      }
      
      const mealPlanData = await c.req.json();
      const planName = mealPlanData.planName || mealPlanData.plan_name || mealPlanData.name || 'Meal Plan';
      const durationDays = mealPlanData.duration_days ?? mealPlanData.durationDays ?? 7;
      const price = mealPlanData.price ?? mealPlanData.pricePerWeek ?? 0;
      
      const mealPlan = await insert('meal_plans', {
        vendor_id: vendorId,
        plan_name: planName,
        description: mealPlanData.description || null,
        duration_days: durationDays,
        price_per_meal: price,
        price,
        meals_per_day: mealPlanData.meals_per_day ?? mealPlanData.mealsPerDay ?? 2,
        dietary_requirements: JSON.stringify({
          pet_types: mealPlanData.pet_types || mealPlanData.petTypes || ['Dog', 'Cat'],
          meals: mealPlanData.meals || [],
          nutritional_goals: mealPlanData.nutritionalGoals || mealPlanData.nutritional_goals || {},
        }),
        is_active: mealPlanData.isActive !== false,
      });
      
      return c.json({ success: true, mealPlan: mealPlan[0], message: 'Meal plan created successfully' });
    } catch (error: any) {
      console.error('Error creating meal plan:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/nutritionist/meal-plans/:planId
   * Update a meal plan
   */
  app.put("/vendor/:vendorId/nutritionist/meal-plans/:planId", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const { planId } = c.req.param();
      const mealPlanData = await c.req.json();
      
      const check = await query(
        `SELECT id FROM meal_plans WHERE id = $1 AND vendor_id = $2`,
        [planId, vendorId]
      );
      if (!check.rows?.length) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }
      
      const planName = mealPlanData.planName ?? mealPlanData.plan_name ?? mealPlanData.name;
      const durationDays = mealPlanData.duration_days ?? mealPlanData.durationDays;
      const price = mealPlanData.price;
      const mealsPerDay = mealPlanData.meals_per_day ?? mealPlanData.mealsPerDay;
      const description = mealPlanData.description;
      const isActive = mealPlanData.isActive;
      const petTypes = mealPlanData.pet_types ?? mealPlanData.petTypes;
      
      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (planName != null) { updates.push(`plan_name = $${idx}`); params.push(planName); idx++; }
      if (description != null) { updates.push(`description = $${idx}`); params.push(description); idx++; }
      if (durationDays != null) { updates.push(`duration_days = $${idx}`); params.push(durationDays); idx++; }
      if (price != null) {
        updates.push(`price_per_meal = $${idx}`, `price = $${idx + 1}`);
        params.push(price, price);
        idx += 2;
      }
      if (mealsPerDay != null) { updates.push(`meals_per_day = $${idx}`); params.push(mealsPerDay); idx++; }
      if (isActive !== undefined) { updates.push(`is_active = $${idx}`); params.push(isActive); idx++; }
      if (petTypes != null) {
        updates.push(`dietary_requirements = $${idx}::jsonb`);
        params.push(JSON.stringify({ pet_types: petTypes }));
        idx++;
      }
      if (updates.length === 0) {
        return c.json({ success: true, message: 'No changes' });
      }
      params.push(planId, vendorId);
      await query(
        `UPDATE meal_plans SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} AND vendor_id = $${idx + 1}`,
        params
      );
      return c.json({ success: true, message: 'Meal plan updated' });
    } catch (error: any) {
      console.error('Error updating meal plan:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/nutritionist/meal-plans/:planId
   * Delete a meal plan
   */
  app.delete("/vendor/:vendorId/nutritionist/meal-plans/:planId", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const { planId } = c.req.param();
      const result = await deleteOrDeactivateMealPlanForVendor(planId, vendorId);
      if (!result) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }
      return c.json({
        success: true,
        mode: result.mode,
        message: result.message,
        orderCount: result.orderCount,
        subscriptionCount: result.subscriptionCount,
      });
    } catch (error: any) {
      console.error('Error deleting meal plan:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /nutrition/delivery-orders
   * Create meal plan delivery order
   */
  app.post("/nutrition/delivery-orders", async (c) => {
    try {
      const orderData = await c.req.json();
      const {
        vendorId,
        customerId,
        mealPlanId,
        petId,
        addressId,
        deliveryDate,
        deliveryTime,
        quantity,
        totalAmount,
      } = orderData;

      if (!vendorId || !customerId || !mealPlanId || !petId || !addressId || !deliveryDate || !deliveryTime) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Get address details
      const addresses = await select('addresses', { id: addressId });
      if (addresses.length === 0) {
        return c.json({ error: 'Address not found' }, 404);
      }
      const address = addresses[0];

      // Get meal plan: by id first; if not found (e.g. mobile sent service id), use first meal plan for vendor
      let mealPlans = await select('meal_plans', { id: mealPlanId });
      if (mealPlans.length === 0 && vendorId) {
        const fallback = await query(
          `SELECT * FROM meal_plans WHERE vendor_id = $1 AND (is_active IS NULL OR is_active = true) ORDER BY created_at DESC LIMIT 1`,
          [vendorId]
        ).catch(() => ({ rows: [] }));
        if ((fallback as any).rows?.length > 0) {
          mealPlans = (fallback as any).rows;
        }
      }
      if (mealPlans.length === 0) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }
      const mealPlan = mealPlans[0];
      const effectiveMealPlanId = mealPlan.id;
      const unitPrice = parseFloat(mealPlan.price_per_meal || mealPlan.price || totalAmount || 0);
      const qty = quantity || 1;
      const subtotalVal = unitPrice * qty;
      const totalVal = totalAmount != null ? Number(totalAmount) : subtotalVal;

      const customers = await select('customers', { id: customerId });
      const customerPhone = customers[0]?.phone || '';

      const orderNumber = `MP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const shippingAddrStr = typeof address.address === 'string'
        ? address.address
        : [address.address, address.addressLine1, address.city, address.pincode].filter(Boolean).join(', ');

      const orderPayload: Record<string, any> = {
        customer_id: customerId,
        vendor_id: vendorId,
        order_number: orderNumber,
        order_status: 'pending',
        subtotal: subtotalVal,
        tax_amount: 0,
        shipping_amount: 0,
        discount_amount: 0,
        total_amount: totalVal,
        shipping_address: shippingAddrStr || JSON.stringify({ address: address.address, city: address.city, pincode: address.pincode, state: address.state || '' }),
        shipping_city: address.city || address.address_city || '',
        shipping_state: address.state || address.address_state || '',
        shipping_pincode: address.pincode || address.address_pincode || '',
        shipping_phone: customerPhone,
        payment_method: 'online',
        order_type: 'meal_plan_delivery',
        delivery_date: deliveryDate,
        delivery_time: typeof deliveryTime === 'string' ? deliveryTime : JSON.stringify(deliveryTime || {}),
      };

      const order = await insert('orders', orderPayload);

      await insert('order_items', {
        order_id: order[0].id,
        service_id: effectiveMealPlanId,
        name: mealPlan.name || 'Meal Plan',
        quantity: qty,
        unit_price: unitPrice,
        total_price: unitPrice * qty,
      });

      await insert('meal_plan_orders', {
        order_id: order[0].id,
        meal_plan_id: effectiveMealPlanId,
        pet_id: petId,
        quantity: qty,
        delivery_date: deliveryDate,
        delivery_time: typeof deliveryTime === 'string' ? deliveryTime : JSON.stringify(deliveryTime || {}),
      }).catch(() => {});

      return c.json({
        success: true,
        order: order[0],
        order_id: order[0].id,
        orderId: order[0].id,
        message: 'Meal plan order created successfully',
      });
    } catch (error: any) {
      console.error('Error creating meal plan delivery order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /nutrition/delivery-orders
   * Get delivery orders for a vendor
   */
  app.get("/nutrition/delivery-orders", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      if (!vendorId) {
        return c.json({ error: 'vendorId is required' }, 400);
      }

      let ordersQuery = `
        SELECT 
          o.*,
          c.full_name as customer_name,
          c.phone as customer_phone,
          mp.name as meal_plan_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN meal_plan_orders mpo ON o.id = mpo.order_id
        LEFT JOIN meal_plans mp ON mpo.meal_plan_id = mp.id
        WHERE o.vendor_id = $1
        AND o.order_type = 'meal_plan_delivery'
      `;

      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (status && status !== 'all') {
        ordersQuery += ` AND o.order_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      ordersQuery += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const orders = await query(ordersQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        orders: orders.rows,
        total: orders.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching delivery orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/nutrition/meal-plans
   * Get meal plans (alternative endpoint for customer app)
   * ✅ FIX GAP-9.1 & 9.2: Supports maxRadius and filters
   */
  app.get("/vendor/:vendorId/nutrition/meal-plans", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const rules = await getDiscoveryRules('pet_nutritionist', 'meal_search');
      const defaultRadiusKm = rules.discovery_radius_km ?? 10;
      const maxRadius = c.req.query('maxRadius') ? parseFloat(c.req.query('maxRadius')!) : defaultRadiusKm;
      const filters = c.req.query('filters')?.split(',') || [];
      
      // Base query
      let queryStr = `
        SELECT mp.*, v.latitude, v.longitude, v.business_name as vendor_name
        FROM meal_plans mp
        LEFT JOIN vendors v ON mp.vendor_id = v.id
        WHERE mp.is_active = true
      `;
      const params: any[] = [];
      let paramIndex = 1;
      
      // Filter by vendor if specified
      if (vendorId) {
        queryStr += ` AND mp.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }
      
      // ✅ FIX GAP-9.1: Filter by 10km radius if location provided
      if (lat && lng && maxRadius) {
        queryStr += `
          AND (
            6371 * acos(
              cos(radians($${paramIndex})) * 
              cos(radians(COALESCE(v.latitude, 0))) * 
              cos(radians(COALESCE(v.longitude, 0)) - radians($${paramIndex + 1})) + 
              sin(radians($${paramIndex})) * 
              sin(radians(COALESCE(v.latitude, 0)))
            )
          ) <= $${paramIndex + 2}
        `;
        params.push(lat, lng, maxRadius);
        paramIndex += 3;
      }
      
      // ✅ FIX GAP-9.2: Apply filters (weight_management, daily_nutrition, fresh_food, frozen_food)
      if (filters.length > 0) {
        const filterConditions: string[] = [];
        filters.forEach((filter) => {
          if (filter === 'weight_management') {
            filterConditions.push(`(mp.diet_type::text LIKE '%weight_loss%' OR mp.diet_type::text LIKE '%weight_management%')`);
          } else if (filter === 'daily_nutrition') {
            filterConditions.push(`(mp.diet_type::text LIKE '%daily%' OR mp.diet_type::text LIKE '%nutrition%')`);
          } else if (filter === 'fresh_food') {
            filterConditions.push(`mp.meal_type = 'fresh_daily' OR mp.meal_type = 'fresh_weekly'`);
          } else if (filter === 'frozen_food') {
            filterConditions.push(`mp.meal_type = 'frozen'`);
          }
        });
        if (filterConditions.length > 0) {
          queryStr += ` AND (${filterConditions.join(' OR ')})`;
        }
      }
      
      queryStr += ` ORDER BY mp.created_at DESC`;
      
      const result = await query(queryStr, params);
      const rawPlans = result.rows || [];
      const mealPlans = await Promise.all(
        rawPlans.map(async (mp: any) => {
          const { dietary_requirements, photos, mealImageUrl } = await presignMealPlanRowDisplayFields(
            mp as Record<string, unknown>,
          );
          return { ...mp, dietary_requirements, photos, mealImageUrl };
        }),
      );

      return c.json({
        success: true,
        plans: mealPlans,
        mealPlans,
        total: mealPlans.length,
        filters: filters,
        maxRadius: maxRadius,
      });
    } catch (error: any) {
      console.error('Error fetching meal plans:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // NUTRITIONIST: MEAL PRODUCTS & ORDERS
  // ============================================

  /**
   * GET /vendor/:vendorId/meal-products
   * Get meal products for a nutritionist vendor (merged from products + meal_plans for consistent list)
   * Resolves vendorId (identity id → vendors id) for correct vendor lookup
   *
   * Each item includes `metadata` (or merged specs) with optional catalog keys:
   * mealCategories, medicalConditionTags, feedingInstructions, storageInstructions, shelfLifeDays,
   * deliveryType, mealsPerDayPreset, mealsPerDayCustom, allergens, preparationType, ingredients (string[]),
   * nutritionalValue, petTypes, dietType, preparationLeadTime, mealImageUrl, packWeightGrams.
   */
  app.get("/vendor/:vendorId/meal-products", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const list: any[] = [];

      // 1) Products table (meal_plan / nutrition / food); fallback if category column missing
      try {
        let productsResult: any;
        try {
          productsResult = await query(
            `SELECT * FROM products 
             WHERE vendor_id = $1 AND (category = 'meal_plan' OR category = 'nutrition' OR category = 'food')
             ORDER BY created_at DESC`,
            [vendorId]
          );
        } catch (colErr: any) {
          if (colErr?.message?.includes('category') || colErr?.message?.includes('does not exist')) {
            productsResult = await query(`SELECT * FROM products WHERE vendor_id = $1 ORDER BY created_at DESC`, [vendorId]);
            if (productsResult?.rows?.length) {
              productsResult.rows = productsResult.rows.filter((p: any) => ['meal_plan', 'nutrition', 'food'].includes(p.category));
            }
          } else throw colErr;
        }
        const rows = productsResult?.rows || [];
        for (const p of rows) {
          let specObj: any = {};
          try {
            specObj =
              typeof p.specifications === 'string' ? JSON.parse(p.specifications) : (p.specifications || {});
          } catch (_) {
            specObj = {};
          }
          let meta: any = {};
          try {
            const md =
              typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
            meta = { ...specObj, ...(md || {}) };
          } catch (_) {
            meta = specObj || {};
          }
          const metaForApi = await presignMealImageUrlInRecord(meta as Record<string, unknown>);
          list.push({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            category: p.category || 'meal_plan',
            metadata: metaForApi,
            petTypes: meta.petTypes || [],
            dietType: meta.dietType,
            ingredients: meta.ingredients || [],
            nutritionalValue: meta.nutritionalValue || {},
            sku: p.sku,
            stock_quantity: p.stock ?? p.stock_quantity,
            is_active: p.is_active,
            created_at: p.created_at,
            updated_at: p.updated_at,
            _source: 'products',
          });
        }
      } catch (err: any) {
        console.warn('Products query failed:', err?.message);
      }

      // 2) meal_plans table (unified shape so names display in list)
      try {
        const mealPlansResult = await query(
          `SELECT * FROM meal_plans
           WHERE vendor_id = $1 AND COALESCE(is_active, true) = true
           ORDER BY created_at DESC`,
          [vendorId]
        );
        const rows = mealPlansResult.rows || [];
        for (const mp of rows) {
          let dietaryReqs: any = {};
          try {
            dietaryReqs = typeof mp.dietary_requirements === 'string'
              ? JSON.parse(mp.dietary_requirements)
              : (mp.dietary_requirements || {});
          } catch (_) {}
          const merged = mergeMealPlanCatalogForApi(mp as Record<string, unknown>, dietaryReqs);
          const metadata = await presignMealImageUrlInRecord(merged);
          list.push({
            id: mp.id,
            name: mp.plan_name,
            plan_name: mp.plan_name,
            description: mp.description,
            price: mp.price_per_meal ?? mp.price,
            category: 'meal_plan',
            metadata,
            purchase_type: mp.purchase_type ?? metadata.purchaseType,
            pack_weight_grams: mp.pack_weight_grams ?? metadata.packWeightGrams,
            meals_per_delivery: mp.meals_per_delivery ?? metadata.mealsPerDelivery,
            delivery_days: mp.delivery_days ?? metadata.deliveryDays,
            delivery_frequency: mp.delivery_frequency ?? metadata.deliveryFrequency,
            prep_time_minutes: mp.prep_time_minutes,
            lead_time_hours: mp.lead_time_hours,
            order_cutoff_time: mp.order_cutoff_time,
            petTypes: metadata.petTypes || [],
            dietType: metadata.dietType,
            ingredients: metadata.ingredients || [],
            nutritionalValue: metadata.nutritionalValue || {},
            duration_days: mp.duration_days,
            meals_per_day: mp.meals_per_day,
            is_active: mp.is_active,
            created_at: mp.created_at,
            updated_at: mp.updated_at,
            _source: 'meal_plans',
          });
        }
      } catch (err: any) {
        console.warn('meal_plans query failed:', err?.message);
      }

      // Sort by created_at desc (newest first)
      list.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });

      // Nutrition SKUs may exist in both `products` and `meal_plans` (same id) — show once, prefer meal_plans row.
      const deduped = (() => {
        const byId = new Map<string, (typeof list)[number]>();
        for (const item of list) {
          const id = String(item?.id ?? '').trim();
          if (!id) continue;
          const existing = byId.get(id);
          if (!existing || item._source === 'meal_plans') {
            byId.set(id, item);
          }
        }
        return Array.from(byId.values()).sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        });
      })();

      return c.json({ success: true, products: deduped, total: deduped.length });
    } catch (error: any) {
      console.error('Error fetching meal products:', error);
      return c.json({ success: true, products: [], total: 0 });
    }
  });

  /**
   * GET /vendor/:vendorId/meal-kitchen-availability
   * Vendor toggle: accepting new meal orders + optional customer-facing pause reason.
   */
  app.get('/vendor/:vendorId/meal-kitchen-availability', async (c) => {
    try {
      const vendorId = await resolveVendorId(c.req.param('vendorId'));
      const availability = await fetchMealKitchenAvailabilityForVendor(vendorId);
      return c.json({
        success: true,
        availability: {
          ...availability,
          customerPreview: availability.acceptingOrders
            ? null
            : resolveCustomerKitchenMessage(availability),
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load kitchen status';
      return c.json({ success: false, error: msg }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/meal-kitchen-availability
   * Body: { acceptingOrders, reasonCode?, customerMessage? }
   */
  app.put('/vendor/:vendorId/meal-kitchen-availability', async (c) => {
    try {
      const vendorId = await resolveVendorId(c.req.param('vendorId'));
      const body = await c.req.json();
      const built = buildMealKitchenAvailabilityPayload({
        acceptingOrders: body.acceptingOrders,
        reasonCode: body.reasonCode,
        customerMessage: body.customerMessage,
      });
      if (!built.ok) {
        return c.json({ success: false, error: built.error }, 400);
      }

      const vendors = await select('vendors', { id: vendorId });
      if (!vendors.length) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }

      const row = vendors[0] as { metadata?: unknown };
      let currentMeta: Record<string, unknown> = {};
      if (row.metadata != null) {
        if (typeof row.metadata === 'string') {
          try {
            currentMeta = JSON.parse(row.metadata) as Record<string, unknown>;
          } catch {
            currentMeta = {};
          }
        } else if (typeof row.metadata === 'object' && !Array.isArray(row.metadata)) {
          currentMeta = row.metadata as Record<string, unknown>;
        }
      }

      const updatedMeta = {
        ...currentMeta,
        mealKitchenAvailability: built.value,
      };

      await update('vendors', { id: vendorId }, {
        metadata: updatedMeta,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        availability: {
          ...built.value,
          customerPreview: built.value.acceptingOrders
            ? null
            : resolveCustomerKitchenMessage(built.value),
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update kitchen status';
      return c.json({ success: false, error: msg }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/meal-products
   * Create a meal product: **meal_plans first** (single canonical nutrition catalog row).
   * Falls back to **products** only when `meal_plans` insert fails with a recoverable schema error
   * (e.g. missing relation/column), matching older DBs that lack columns.
   * Resolves vendorId (identity id → vendors id) to fix meal_plans_vendor_id_fkey FK violation
   *
   * Extended catalog fields (camelCase JSON, also persisted inside dietary_requirements / metadata):
   * mealCategories[], medicalConditionTags[], feedingInstructions, storageInstructions, shelfLifeDays (1–365),
   * purchaseType (ONE_TIME | WEEKLY_PLAN | MONTHLY_PLAN); legacy deliveryType still accepted and mirrored,
   * subscriptionConfig object optional (fields also accepted top-level): deliveryFrequency, deliveryDays,
   * mealsPerDelivery*, subscriptionPrice, recommendedPlanLengthWeeks, pauseAllowed, cancelAnytime,
   * mealsPerDayPreset (1|2|3|CUSTOM), mealsPerDayCustom (when CUSTOM),
   * allergens[], preparationType (FRESH_COOKED | FREEZE_DRIED | RAW | DEHYDRATED | HOMEMADE),
   * ingredients[] (array of strings; legacy comma-separated string still accepted once and normalized).
   * Omitted extended fields use safe defaults so older clients remain compatible.
   */
  app.post("/vendor/:vendorId/meal-products", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({
          error: 'Vendor not found',
          hint: 'The vendor ID may be invalid or the vendor record does not exist. Please ensure you are logged in with a valid vendor account.',
        }, 404);
      }
      const data = await c.req.json();
      const parsed = parseMealProductRequest(data);
      if (!parsed.success) {
        return c.json({ error: formatMealProductZodError(parsed.error) }, 400);
      }
      const timingValidated = validateVendorMealTimingFromParsed(parsed.data);
      if (!timingValidated.ok) {
        return c.json({ error: timingValidated.error }, 400);
      }
      const p = timingValidated.data;

      const mealImageUrl = p.mealImageUrl
        ? stripS3PresignQueryFromUrl(String(p.mealImageUrl).trim())
        : undefined;
      const dietaryPayload = mealProductParsedToDietaryJson(p as MealProductDietaryInput, { mealImageUrl });
      const parsedCore = p as MealProductParsedCore;

      // Prefer meal_plans (legacy nutrition catalog); fall back to products only on schema-level failures.
      const mpCols = await getPublicTableColumns('meal_plans');
      const dietTypeIsArray = await mealPlanDietTypeColumnIsArray();
      const mealPlanRow = buildMealPlanRowFromProduct(
        vendorId,
        parsedCore,
        dietaryPayload,
        mpCols,
        { mealImageUrl, dietTypeColumnIsArray: dietTypeIsArray },
      );

      try {
        const mealPlan = await insert('meal_plans', mealPlanRow as any);
        const transformedProduct = {
          ...mealPlan[0],
          name: mealPlan[0].plan_name,
          category: 'meal_plan',
          metadata: mealPlan[0].dietary_requirements,
        };
        return c.json({ success: true, product: transformedProduct });
      } catch (mealPlansErr: any) {
        const m = String(mealPlansErr?.message || '');
        if (!m.includes('does not exist')) {
          throw mealPlansErr;
        }
        console.warn('[meal-products POST] meal_plans insert failed, falling back to products:', m);
      }

      // Fallback: products (metadata or specifications JSONB; see db/migrations/034_add_metadata_columns.sql)
      const productCols = await getPublicTableColumns('products');
      const hasMetadata = productCols.has('metadata');
      const hasSpecifications = productCols.has('specifications');

      const productPayload: any = {
        vendor_id: vendorId,
        name: p.name,
        description: p.description,
        price: p.price,
        category: 'meal_plan',
        sku: `MP-${Date.now()}`,
        stock: p.stockQuantity ?? 100,
        is_active: true,
      };
      if (productCols.has('purchase_type')) productPayload.purchase_type = p.purchaseType;
      if (productCols.has('subscription_config')) {
        productPayload.subscription_config = dietaryPayload.subscriptionConfig ?? {};
      }
      if (hasMetadata) {
        productPayload.metadata = JSON.stringify(dietaryPayload);
      } else if (hasSpecifications) {
        productPayload.specifications = JSON.stringify(dietaryPayload);
      }
      const product = await insert('products', productPayload);
      return c.json({ success: true, product: product[0] });
    } catch (error: any) {
      console.error('Error creating meal product:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/meal-products/:productId
   * Update a meal product (meal_plans.dietary_requirements, or products.metadata / products.specifications)
   *
   * Same extended fields as POST; body is merged with existing metadata before validation so partial
   * payloads from older clients still merge safely.
   */
  app.put("/vendor/:vendorId/meal-products/:productId", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const { productId } = c.req.param();
      const data = await c.req.json();
      const meta = data.metadata || {};
      const productCols = await getPublicTableColumns('products');

      let existingDiet: any = {};
      let mealPlanRowHints: {
        meals_per_day?: number;
        shelfLifeDays?: number;
        prep_time_minutes?: number;
        lead_time_hours?: number;
        order_cutoff_time?: string;
      } = {};
      const existingMp = await query(
        `SELECT dietary_requirements, meals_per_day, shelf_life_days, duration_days, prep_time_minutes, lead_time_hours, order_cutoff_time FROM meal_plans WHERE id = $1 AND vendor_id = $2`,
        [productId, vendorId]
      );
      if (existingMp.rows?.[0]) {
        try {
          const dr = existingMp.rows[0].dietary_requirements;
          existingDiet = typeof dr === 'string' ? JSON.parse(dr) : (dr || {});
        } catch {
          existingDiet = {};
        }
        const r = existingMp.rows[0];
        if (r.meals_per_day != null) mealPlanRowHints.meals_per_day = Number(r.meals_per_day);
        const sl = r.shelf_life_days != null ? Number(r.shelf_life_days) : NaN;
        const dd = r.duration_days != null ? Number(r.duration_days) : NaN;
        if (Number.isFinite(sl) && sl >= 1 && sl <= 365) mealPlanRowHints.shelfLifeDays = sl;
        else if (Number.isFinite(dd) && dd >= 1 && dd <= 365) mealPlanRowHints.shelfLifeDays = dd;
        if (r.prep_time_minutes != null) mealPlanRowHints.prep_time_minutes = Number(r.prep_time_minutes);
        if (r.lead_time_hours != null) mealPlanRowHints.lead_time_hours = Number(r.lead_time_hours);
        if (typeof r.order_cutoff_time === 'string' && r.order_cutoff_time) {
          mealPlanRowHints.order_cutoff_time = r.order_cutoff_time;
        }
      }

      let existingProdMeta: any = {};
      try {
        const sel: string[] = [];
        if (productCols.has('metadata')) sel.push('metadata');
        if (productCols.has('specifications')) sel.push('specifications');
        if (sel.length > 0) {
          const existingProductRow = await query(
            `SELECT ${sel.join(', ')} FROM products WHERE id = $1 AND vendor_id = $2`,
            [productId, vendorId]
          );
          const row = existingProductRow.rows?.[0];
          let fromSpec: any = {};
          let fromMeta: any = {};
          if (productCols.has('specifications') && row?.specifications != null) {
            try {
              const s = row.specifications;
              fromSpec = typeof s === 'string' ? JSON.parse(s) : (s || {});
            } catch {
              fromSpec = {};
            }
          }
          if (productCols.has('metadata') && row?.metadata != null) {
            try {
              const m = row.metadata;
              fromMeta = typeof m === 'string' ? JSON.parse(m) : (m || {});
            } catch {
              fromMeta = {};
            }
          }
          existingProdMeta = { ...fromSpec, ...fromMeta };
        }
      } catch (prodMetaErr: any) {
        console.warn('meal-products PUT: could not load products meal fields', prodMetaErr?.message);
      }

      const stripIfStr = (u: unknown): string | null =>
        typeof u === 'string' && u.trim() ? stripS3PresignQueryFromUrl(u.trim()) : null;
      const resolvedMealImageUrl = 'mealImageUrl' in data
        ? typeof data.mealImageUrl === 'string' && data.mealImageUrl.trim()
          ? stripS3PresignQueryFromUrl(data.mealImageUrl.trim())
          : null
        : stripIfStr(existingDiet.mealImageUrl) ??
          stripIfStr(existingProdMeta.mealImageUrl) ??
          stripIfStr(meta.mealImageUrl);

      const dataTop: Record<string, unknown> = { ...(data as Record<string, unknown>) };
      delete dataTop.metadata;
      const mergeForParse: Record<string, unknown> = {
        ...existingProdMeta,
        ...existingDiet,
        ...(mealPlanRowHints.meals_per_day != null ? { mealsPerDay: mealPlanRowHints.meals_per_day } : {}),
        ...(mealPlanRowHints.shelfLifeDays != null ? { shelfLifeDays: mealPlanRowHints.shelfLifeDays } : {}),
        ...(mealPlanRowHints.prep_time_minutes != null
          ? { preparationLeadTime: mealPlanRowHints.prep_time_minutes, prepTimeMinutes: mealPlanRowHints.prep_time_minutes }
          : {}),
        ...(mealPlanRowHints.lead_time_hours != null ? { leadTimeHours: mealPlanRowHints.lead_time_hours } : {}),
        ...(mealPlanRowHints.order_cutoff_time
          ? { orderCutoffTime: mealPlanRowHints.order_cutoff_time }
          : {}),
        ...dataTop,
      };
      const parsed = parseMealProductRequest(mergeForParse);
      if (!parsed.success) {
        return c.json({ error: formatMealProductZodError(parsed.error) }, 400);
      }
      const timingValidated = validateVendorMealTimingFromParsed(parsed.data);
      if (!timingValidated.ok) {
        return c.json({ error: timingValidated.error }, 400);
      }
      const p = timingValidated.data;

      const dietaryPayload = mealProductParsedToDietaryJson(p as MealProductDietaryInput, {
        mealImageUrl: resolvedMealImageUrl ?? undefined,
      });

      // 1) Try updating meal_plans (id may be from meal_plans when products insert failed or wasn't used)
      const mealPlanCheck = await query(
        `SELECT id FROM meal_plans WHERE id = $1 AND vendor_id = $2`,
        [productId, vendorId]
      );
      if (mealPlanCheck.rows?.length > 0) {
        const mpCols = await getPublicTableColumns('meal_plans');
        const dietTypeIsArray = await mealPlanDietTypeColumnIsArray();
        const parsedCore = p as MealProductParsedCore;
        const mealsPerDayCol = resolveMealsPerDayColumn(parsedCore.purchaseType, parsedCore);
        const mpParams: unknown[] = [
          data.name ?? data.plan_name,
          data.description,
          data.price,
          p.shelfLifeDays,
          mealsPerDayCol,
          JSON.stringify(dietaryPayload),
        ];
        const updateCtx = { nextPh: 6, extras: '', mpParams };
        pushMealPlanStructuredUpdates(mpCols, parsedCore, dietaryPayload, {
          mealImageUrl: resolvedMealImageUrl ?? undefined,
          dietTypeColumnIsArray: dietTypeIsArray,
        }, updateCtx);
        const idPh = updateCtx.nextPh + 1;
        const vendorPh = updateCtx.nextPh + 2;
        updateCtx.mpParams.push(productId, vendorId);
        await query(
          `UPDATE meal_plans SET 
            plan_name = COALESCE($1, plan_name),
            description = COALESCE($2, description),
            price_per_meal = COALESCE($3, price_per_meal),
            duration_days = COALESCE($4, duration_days),
            meals_per_day = COALESCE($5, meals_per_day),
            dietary_requirements = COALESCE($6::jsonb, dietary_requirements)${updateCtx.extras},
            updated_at = NOW()
           WHERE id = $${idPh} AND vendor_id = $${vendorPh}`,
          updateCtx.mpParams,
        );
        return c.json({ success: true, message: 'Product updated' });
      }

      // 2) Update products table (prefer metadata JSONB; else specifications — base schema always has specifications)
      const hasMetadata = productCols.has('metadata');
      const hasSpecifications = productCols.has('specifications');

      const mergedMealJson: any = { ...existingProdMeta, ...meta, ...dietaryPayload };
      if ('mealImageUrl' in data && !(typeof data.mealImageUrl === 'string' && data.mealImageUrl.trim())) {
        delete mergedMealJson.mealImageUrl;
      }

      if (hasMetadata) {
        await query(
          `UPDATE products SET 
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            price = COALESCE($3, price),
            metadata = COALESCE($4::jsonb, metadata),
            updated_at = NOW()
           WHERE id = $5 AND vendor_id = $6`,
          [
            p.name,
            p.description,
            p.price,
            JSON.stringify(mergedMealJson),
            productId,
            vendorId,
          ]
        );
      } else if (hasSpecifications) {
        await query(
          `UPDATE products SET 
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            price = COALESCE($3, price),
            specifications = COALESCE($4::jsonb, specifications),
            updated_at = NOW()
           WHERE id = $5 AND vendor_id = $6`,
          [
            p.name,
            p.description,
            p.price,
            JSON.stringify(mergedMealJson),
            productId,
            vendorId,
          ]
        );
      } else {
        await query(
          `UPDATE products SET 
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            price = COALESCE($3, price),
            updated_at = NOW()
           WHERE id = $4 AND vendor_id = $5`,
          [p.name, p.description, p.price, productId, vendorId]
        );
      }

      return c.json({ success: true, message: 'Product updated' });
    } catch (error: any) {
      console.error('Error updating meal product:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/meal-products/:productId
   * Delete a meal product (from products or meal_plans)
   */
  app.delete("/vendor/:vendorId/meal-products/:productId", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const { productId } = c.req.param();
      const del = await query(
        `DELETE FROM products WHERE id = $1 AND vendor_id = $2 RETURNING id`,
        [productId, vendorId],
      );
      if (del.rows?.length) {
        return c.json({ success: true, mode: 'deleted', message: 'Product deleted' });
      }

      const mealResult = await deleteOrDeactivateMealPlanForVendor(productId, vendorId);
      if (!mealResult) {
        return c.json({ error: 'Meal product not found' }, 404);
      }
      return c.json({
        success: true,
        mode: mealResult.mode,
        message: mealResult.message,
        orderCount: mealResult.orderCount,
        subscriptionCount: mealResult.subscriptionCount,
      });
    } catch (error: any) {
      if (isMealPlanFkViolation(error)) {
        try {
          const paramVendorId = c.req.param('vendorId');
          const vendorId = await resolveVendorId(paramVendorId);
          const { productId } = c.req.param();
          const mealResult = await deleteOrDeactivateMealPlanForVendor(productId, vendorId);
          if (mealResult) {
            return c.json({
              success: true,
              mode: mealResult.mode,
              message: mealResult.message,
              orderCount: mealResult.orderCount,
              subscriptionCount: mealResult.subscriptionCount,
            });
          }
        } catch (fallbackErr: any) {
          console.error('Error deactivating meal plan after FK violation:', fallbackErr);
        }
      }
      console.error('Error deleting meal product:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/meal-orders/debug
   * Debug endpoint to check order existence and vendor relationships
   */
  app.get("/vendor/:vendorId/meal-orders/debug", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const debug: any = {
        inputVendorId: vendorId,
        timestamp: new Date().toISOString()
      };

      // Check if order exists
      const orderCheck = await query(
        `SELECT mo.id, mo.vendor_id::text, mo.meal_plan_id, mo.status, mo.created_at,
                mp.vendor_id::text as meal_plan_vendor_id, mp.plan_name,
                v1.business_name as order_vendor_name, v1.phone as order_vendor_phone, v1.id::text as order_vendor_db_id,
                v2.business_name as meal_plan_vendor_name, v2.phone as meal_plan_vendor_phone, v2.id::text as meal_plan_vendor_db_id
         FROM meal_orders mo
         LEFT JOIN meal_plans mp ON mo.meal_plan_id = mp.id
         LEFT JOIN vendors v1 ON mo.vendor_id = v1.id
         LEFT JOIN vendors v2 ON mp.vendor_id = v2.id
         WHERE mo.id::text = 'b29d23eb-6600-48db-bbfe-2c56eedf2da9'`
      ).catch(() => ({ rows: [] }));
      
      debug.orderExists = orderCheck.rows.length > 0;
      if (orderCheck.rows.length > 0) {
        debug.orderInfo = orderCheck.rows[0];
      }

      // Check meal plan
      const mealPlanCheck = await query(
        `SELECT mp.id, mp.vendor_id::text, v.business_name, v.phone, v.id::text as vendor_db_id
         FROM meal_plans mp
         LEFT JOIN vendors v ON mp.vendor_id = v.id
         WHERE mp.id::text = '3696d672-fb93-4303-8aae-38ddaf02528e'`
      ).catch(() => ({ rows: [] }));
      
      debug.mealPlanExists = mealPlanCheck.rows.length > 0;
      if (mealPlanCheck.rows.length > 0) {
        debug.mealPlanInfo = mealPlanCheck.rows[0];
      }

      // Check querying vendor
      const vendor = await resolveVendorById(vendorId);
      debug.queryingVendor = vendor ? {
        id: vendor.id,
        business_name: vendor.business_name,
        phone: vendor.phone
      } : null;

      // Check if meal_plan vendor matches querying vendor
      if (debug.mealPlanInfo && debug.queryingVendor) {
        debug.businessNameMatch = (
          debug.mealPlanInfo.business_name && 
          debug.queryingVendor.business_name &&
          debug.mealPlanInfo.business_name.toLowerCase().includes(debug.queryingVendor.business_name.toLowerCase()) ||
          debug.queryingVendor.business_name.toLowerCase().includes(debug.mealPlanInfo.business_name.toLowerCase())
        );
        debug.phoneMatch = (
          debug.mealPlanInfo.phone && 
          debug.queryingVendor.phone &&
          debug.mealPlanInfo.phone === debug.queryingVendor.phone
        );
      }

      // ✅ ADDITIONAL: Test direct queries to see why orders aren't being found
      if (vendor && vendor.id) {
        // Test 1: Direct query with vendor.id
        const directTest = await query(
          `SELECT COUNT(*) as count FROM meal_orders WHERE vendor_id::text = $1`,
          [vendor.id]
        ).catch(() => ({ rows: [{ count: '0' }] }));
        debug.directQueryCount = parseInt(directTest.rows[0]?.count || '0', 10);

        // Test 2: Get allVendorIds and test with array
        const { getVendorIdsForAvailabilityLookup } = await import('./vendor/endpoints/vendorProfile.vendor');
        const allVendorIds = await getVendorIdsForAvailabilityLookup(vendor.id);
        // Ensure vendor.id is in the array
        const finalVendorIds = [vendor.id, ...allVendorIds.filter(id => id !== vendor.id)];
        debug.allVendorIds = finalVendorIds;
        
        const arrayTest = await query(
          `SELECT COUNT(*) as count FROM meal_orders WHERE vendor_id::text = ANY($1::text[])`,
          [finalVendorIds]
        ).catch(() => ({ rows: [{ count: '0' }] }));
        debug.arrayQueryCount = parseInt(arrayTest.rows[0]?.count || '0', 10);

        // Test 3: Check if order exists with this vendor_id
        if (debug.orderInfo) {
          debug.orderVendorIdInAllVendorIds = finalVendorIds.includes(debug.orderInfo.vendor_id);
        }
      }

      return c.json({ success: true, debug });
    } catch (error: any) {
      console.error('[meal-orders-debug] Error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/meal-orders
   * Get meal/nutrition delivery orders for a vendor.
   * Returns from BOTH meal_orders (MealOrderCheckout flow) AND orders table (MealPlanBookingFlow /nutrition/delivery-orders flow).
   */
  app.get("/vendor/:vendorId/meal-orders", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const status = c.req.query('status');

      const { allIds: allVendorIds, vendor } = await getMealOrderVendorLookupIds(paramVendorId);
      console.log(
        `[meal-orders] vendor=${vendor?.id ?? paramVendorId} lookupIds=${JSON.stringify(allVendorIds)}`,
      );

      if (allVendorIds.length === 0) {
        return c.json({ success: true, orders: [], total: 0 });
      }

      await syncDeliveredMealOrdersFromTracking(allVendorIds);
      await syncCancelledMealOrdersFromTracking(allVendorIds);
      await backfillMissingMealDeliverySettlementsForVendorIds(
        allVendorIds,
        '[MEAL-ORDERS-SETTLEMENT-BACKFILL]',
      );

      const allOrders: any[] = [];

      // Newest orders first — ASC delivery-date + LIMIT 100 dropped future-dated / just-created rows.
      const mealRows = await fetchVendorMealOrdersForVendorIds(allVendorIds, {
        status: status || undefined,
        limit: 100,
      });
      const mealResult = { rows: mealRows };

      console.log(`[meal-orders] Found ${mealResult.rows.length} meal_orders rows (newest first)`);


      // ✅ Enrich orders with customer and meal plan data
      for (const o of mealResult.rows) {
        // Fetch customer data if not already included
        let customerName = o.customer_name;
        let customerPhone = o.customer_phone;
        if (!customerName && o.customer_id) {
          try {
            const customerData = await query(
              `SELECT full_name, phone FROM customers WHERE id = $1 LIMIT 1`,
              [o.customer_id]
            ).catch(() => ({ rows: [] }));
            if (customerData.rows.length > 0) {
              customerName = customerData.rows[0].full_name;
              customerPhone = customerData.rows[0].phone;
            }
          } catch (err) {
            console.warn(`[meal-orders] Error fetching customer data:`, err);
          }
        }
        
        // Meal plan display name + pricing row (subtotal may be 0 in DB if only legacy `price` was set)
        let mealName = o.meal_name;
        let mealPlanRow: Record<string, unknown> | null = null;
        if (o.meal_plan_id) {
          try {
            if (!mealName) {
              mealName = (await resolveMealCatalogDisplayName(String(o.meal_plan_id))) ?? undefined;
            }
            const mealPlanData = await query(
              `SELECT name, plan_name, price_per_meal, price, prep_time_minutes FROM meal_plans WHERE id = $1 LIMIT 1`,
              [o.meal_plan_id]
            ).catch(() => ({ rows: [] }));
            if (mealPlanData.rows.length > 0) {
              const row = mealPlanData.rows[0];
              mealName = mealName || row.name || row.plan_name;
              mealPlanRow = row as Record<string, unknown>;
            }
            if (!mealPlanRow) {
              const prodData = await query(
                `SELECT name, price FROM products WHERE id = $1
                 AND category IN ('meal_plan', 'nutrition', 'food') LIMIT 1`,
                [o.meal_plan_id],
              ).catch(() => ({ rows: [] }));
              if (prodData.rows.length > 0) {
                const row = prodData.rows[0];
                mealName = mealName || row.name;
                mealPlanRow = { price_per_meal: row.price, price: row.price };
              }
            }
          } catch (err) {
            console.warn(`[meal-orders] Error fetching meal plan data:`, err);
          }
        }

        const lineSubtotal = resolveMealLineSubtotalInr(o, mealPlanRow);

        allOrders.push({
          ...o,
          source: 'meal_orders',
          order_number: o.order_number || o.id?.toString().slice(-8) || '',
          customer_name: customerName,
          customer_phone: customerPhone,
          meal_name: mealName,
          prep_time_minutes:
            mealPlanRow && mealPlanRow.prep_time_minutes != null
              ? Number(mealPlanRow.prep_time_minutes)
              : undefined,
          items: [],
          delivery_address: typeof o.delivery_address === 'string' ? (() => { try { return JSON.parse(o.delivery_address); } catch { return {}; } })() : o.delivery_address,
          subtotal: lineSubtotal,
          delivery_time_display: mealOrderDeliveryTimeDisplay(o as Record<string, unknown>),
        });
      }

      // 2. From orders table (MealPlanBookingFlow /nutrition/delivery-orders flow)
      try {
        const hasOrderType = await query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_type' LIMIT 1`
        ).then((r: any) => (r?.rows?.length || 0) > 0);
        if (hasOrderType) {
          // ✅ FIX: Query using ALL vendor IDs, not just the one from URL
          let ordQuery = `
            SELECT o.id, o.customer_id, o.vendor_id, o.order_number, o.order_status as status,
                   o.subtotal, o.shipping_address as delivery_address, o.created_at,
                   o.delivery_date as scheduled_delivery_date, o.delivery_time as scheduled_delivery_slot,
                   c.full_name as customer_name, c.phone as customer_phone,
                   (SELECT COALESCE(mp.plan_name, mp.name) FROM meal_plan_orders mpo LEFT JOIN meal_plans mp ON mpo.meal_plan_id = mp.id WHERE mpo.order_id = o.id LIMIT 1) as meal_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.vendor_id::text = ANY($1::text[]) AND o.order_type = 'meal_plan_delivery'
          `;
          const ordParams: any[] = [allVendorIds];
          if (status) {
            ordParams.push(status);
            ordQuery += ` AND o.order_status = $${ordParams.length}`;
          }
          ordQuery += ` ORDER BY o.created_at DESC LIMIT 100`;

          const ordResult = await query(ordQuery, ordParams).catch(() => ({ rows: [] }));
          for (const o of ordResult.rows) {
            const parsedAddr = typeof o.delivery_address === 'string' ? (() => { try { return JSON.parse(o.delivery_address); } catch { return {}; } })() : o.delivery_address;
            let lineQty = 1;
            let mpForLine: Record<string, unknown> | null = null;
            try {
              const mpRow = await query(
                `SELECT mpo.quantity AS q, mp.price_per_meal, mp.price
                 FROM meal_plan_orders mpo
                 JOIN meal_plans mp ON mp.id = mpo.meal_plan_id
                 WHERE mpo.order_id = $1
                 LIMIT 1`,
                [o.id]
              ).catch(() => ({ rows: [] }));
              const r = mpRow.rows?.[0];
              if (r) {
                const q = Number(r.q);
                if (Number.isFinite(q) && q >= 1) lineQty = Math.floor(q);
                mpForLine = { price_per_meal: r.price_per_meal, price: r.price };
              }
            } catch {
              /* ignore */
            }
            const lineSubtotal = resolveMealLineSubtotalInr(
              { subtotal: o.subtotal, quantity: lineQty },
              mpForLine,
            );
            allOrders.push({
              id: o.id,
              customer_id: o.customer_id,
              vendor_id: o.vendor_id,
              meal_plan_id: null,
              pet_id: null,
              order_type: 'meal_plan_delivery',
              quantity: lineQty,
              special_instructions: null,
              subtotal: lineSubtotal,
              status: o.status,
              payment_status: 'pending',
              scheduled_delivery_date: o.scheduled_delivery_date,
              scheduled_delivery_slot: o.scheduled_delivery_slot,
              delivery_address: parsedAddr,
              customer_name: o.customer_name,
              customer_phone: o.customer_phone,
              meal_name: o.meal_name || 'Meal Plan',
              created_at: o.created_at,
              source: 'orders',
              order_number: o.order_number || o.id?.toString().slice(-8) || '',
              items: [],
            });
          }
        }
      } catch (ordErr) {
        console.warn('[meal-orders] Could not fetch from orders table:', (ordErr as Error)?.message);
      }

      // Dedupe by id and sort by created_at desc
      const seen = new Set<string>();
      const deduped = allOrders
        .filter((o) => { const k = String(o.id); if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 100);

      const mealOrderIds = deduped
        .filter((o: { source?: string; id?: string }) => String(o.source || '') === 'meal_orders' && o.id)
        .map((o: { id: string }) => String(o.id));

      const trackingByMealId = new Map<string, { status: string; reassignPending: boolean; riderName?: string; riderPhone?: string }>();
      if (mealOrderIds.length > 0) {
        try {
          const trRows = await query(
            `SELECT DISTINCT ON (meal_order_id) meal_order_id::text AS meal_order_id, status, metadata,
                    delivery_person_name, delivery_person_phone
               FROM delivery_tracking
              WHERE meal_order_id::text = ANY($1::text[])
              ORDER BY meal_order_id, updated_at DESC NULLS LAST, created_at DESC`,
            [mealOrderIds],
          ).catch(() => ({ rows: [] as Array<{ meal_order_id?: string; status?: string; metadata?: unknown; delivery_person_name?: string; delivery_person_phone?: string }> }));
          for (const r of trRows.rows || []) {
            const mid = String(r.meal_order_id || '');
            if (mid) {
              trackingByMealId.set(mid, {
                status: String(r.status ?? ''),
                reassignPending: parseDeliveryTrackingReassignPending(r.metadata),
                riderName: r.delivery_person_name ? String(r.delivery_person_name) : undefined,
                riderPhone: r.delivery_person_phone ? String(r.delivery_person_phone) : undefined,
              });
            }
          }
        } catch (trErr) {
          console.warn('[meal-orders] delivery_tracking batch lookup failed:', (trErr as Error)?.message);
        }
      }

      const forVendor = deduped.map((row) => {
        const rec = { ...(row as Record<string, unknown>) };
        if (String(rec.source || '') === 'meal_orders' && rec.id) {
          const mid = String(rec.id);
          const tr = trackingByMealId.get(mid);
          const dtStatus = tr?.status ?? null;
          const reassignPending = tr?.reassignPending ?? false;
          rec.delivery_tracking_status = dtStatus;
          rec.reassign_pending = reassignPending;
          if (tr?.riderName) rec.delivery_partner_name = tr.riderName;
          if (tr?.riderPhone) rec.delivery_partner_phone = tr.riderPhone;
          rec.effective_delivery_status = resolveEffectiveMealDeliveryState(
            String(rec.status ?? ''),
            dtStatus ?? '',
            { reassignPending },
          );
        }
        return sanitizeVendorMealOrderRow(rec);
      });
      return c.json({ success: true, orders: forVendor, total: forVendor.length });
    } catch (error: any) {
      console.error('Error fetching meal orders:', error);
      return c.json({ success: false, error: error.message || 'Failed to fetch meal orders', orders: [], total: 0 }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/meal-orders/:orderId/status
   * Update meal order status (Phase 3: updates meal_orders, supports accepted)
   */
  app.put("/vendor/:vendorId/meal-orders/:orderId/status", async (c) => {
    try {
      const { vendorId, orderId } = c.req.param();
      const { status } = await c.req.json();

      // ✅ Validate status - must match meal_orders table constraint
      // Valid statuses per DB constraint: 'pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled'
      // Map 'accepted' to 'confirmed' for backward compatibility
      const validStatuses = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled'];

      // ✅ CRITICAL FIX: Resolve vendor and get ALL vendor IDs (same as list endpoint)
      // This ensures orders are found even if they were created with a different vendor_id
      console.log(`[meal-order-status] Input vendorId: ${vendorId}, orderId: ${orderId}`);
      let vendor = await resolveVendorById(vendorId);

      // ✅ FIX: If vendor not found, try to query order directly
      if (!vendor) {
        console.log(`[meal-order-status] Vendor not found for ${vendorId}, but will still try to query order directly...`);
        vendor = {
          id: vendorId,
          business_name: null,
          phone: null,
        };
      }

      console.log(`[meal-order-status] Resolved vendor: id=${vendor.id}`);

      // Get all vendor IDs (vendors.id + vendor_identity.id for same vendor/phone)
      let allVendorIds = await getVendorIdsForAvailabilityLookup(vendor.id);
      console.log(`[meal-order-status] All vendor IDs: ${JSON.stringify(allVendorIds)}`);

      // Ensure vendor.id is in the array
      if (vendor.id && !allVendorIds.includes(vendor.id)) {
        allVendorIds = [vendor.id, ...allVendorIds];
      }

      const orderRowRes = await query(
        `SELECT mo.id, mo.vendor_id, mo.customer_id, mo.status AS order_status, mo.subscription_id,
                mo.payment_status, mo.total_amount::text AS total_amount,
                mo.razorpay_payment_id, mo.razorpay_order_id, mo.order_type,
                mo.scheduled_delivery_date, mo.scheduled_delivery_slot, mo.purchase_snapshot, mo.logistics_type
           FROM meal_orders mo
          WHERE mo.id = $1 AND mo.vendor_id::text = ANY($2::text[])
          LIMIT 1`,
        [orderId, allVendorIds],
      ).catch(() => ({ rows: [] }));

      if (!orderRowRes.rows?.length) {
        console.log(`[meal-order-status] Order not found or not owned by vendor`);
        console.log(`[meal-order-status] OrderId: ${orderId}, VendorIds checked: ${JSON.stringify(allVendorIds)}`);
        return c.json({ error: 'Order not found or not owned by vendor' }, 404);
      }

      const orderRow = orderRowRes.rows[0] as Record<string, unknown>;
      const purchaseSnapEarly = parseMealOrderPurchaseSnapshotForVendor(orderRow.purchase_snapshot);
      const subscriptionParentEarly =
        Boolean(orderRow.subscription_id) &&
        purchaseSnapEarly.subscriptionVendorBookingRole === 'parent';

      /** Vendor rejects subscription signup before service — refund entire initial payment. */
      if (status === 'cancelled' && subscriptionParentEarly && orderRow.subscription_id) {
        const deliveredCheck = await query(
          `SELECT COUNT(*)::int AS c FROM meal_subscription_deliveries
           WHERE subscription_id = $1::uuid AND status = 'delivered'`,
          [orderRow.subscription_id],
        ).catch(() => ({ rows: [{ c: 0 }] }));
        const deliveredCount = Number((deliveredCheck.rows?.[0] as { c?: number })?.c ?? 0);
        if (deliveredCount > 0) {
          return c.json(
            { error: 'Cannot cancel subscription booking after sessions have been delivered.' },
            400,
          );
        }

        const refund = await processMealSubscriptionParentVendorCancelOriginalRefund(
          String(orderRow.subscription_id),
          'Vendor cancelled subscription booking from nutrition queue',
        );
        const msgLow = String(refund.message || '').toLowerCase();
        if (
          refund.status === 'failed' ||
          (!refund.alreadyProcessed &&
            refund.status === 'skipped' &&
            !msgLow.includes('already processed') &&
            !msgLow.includes('not paid'))
        ) {
          return c.json({ success: false, error: refund.message || 'Refund failed' }, 422);
        }
        return c.json({
          success: true,
          message:
            refund.totalAmount > 0 && refund.message
              ? refund.message
              : 'Subscription cancelled; refund processed per platform policy (platform fee may be retained).',
          refund,
        });
      }

      let actualStatus = status;
      if (status === 'accepted') {
        if (subscriptionParentEarly) {
          // Parent row: vendor confirms the signup only — sessions move to `confirmed` via cascade.
          // Fulfillment (Start preparing / logistics) happens on per-session meal_orders, not on the parent.
          actualStatus = 'confirmed';
          console.log(
            `[meal-order-status] Subscription parent accept → confirmed (sessions cascaded separately; scheduled=${orderRow.scheduled_delivery_date})`,
          );
        } else {
          actualStatus = 'confirmed';
          console.log(`[meal-order-status] Mapping 'accepted' to 'confirmed' for database constraint`);
        }
      }

      if (!validStatuses.includes(actualStatus)) {
        return c.json({ error: `Invalid status. Valid statuses: ${validStatuses.join(', ')}` }, 400);
      }

      if (
        isPidgeMealLogistics(orderRow.logistics_type) &&
        vendorBlockedMealStatusForPidge(actualStatus)
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

      const order = {
        id: orderRow.id,
        vendor_id: orderRow.vendor_id,
        status: orderRow.order_status,
      };
      const previousMealStatus = String(orderRow.order_status || '').trim();
      console.log(`[meal-order-status] Order found: vendor_id=${order.vendor_id}, current_status=${order.status}`);
      
      // ✅ Use the order's actual vendor_id for the update (not the URL vendorId)
      // Build update payload - only include fields that exist in the table
      const updatePayload: Record<string, any> = { status: actualStatus };
      
      // Add timestamp fields based on status (matching meal_orders table schema)
      // Note: meal_orders table has confirmed_at, not accepted_at
      // ✅ BUSINESS LOGIC: When vendor accepts (status='accepted' mapped to 'confirmed'),
      // we need to track vendor acceptance separately from payment confirmation
      // Since we can't add a new column without migration, we'll use a workaround:
      // - If status is already 'confirmed' and we're setting it to 'confirmed' again via 'accepted',
      //   this means vendor is accepting (payment was already confirmed)
      // - We'll check the order's current status to determine if this is vendor acceptance
      if (status === 'accepted' && actualStatus === 'confirmed') {
        // Vendor is accepting the order (payment was already confirmed)
        // Don't overwrite confirmed_at (set by payment), but we need to track vendor acceptance
        // For now, we'll use prep_started_at as a flag, but that's not ideal
        // TODO: Add vendor_accepted_at column to meal_orders table
        // For now, we'll set a flag in a JSONB field or use a different approach
        // Actually, let's not set confirmed_at if it's already set (payment confirmed)
        const currentOrder = await query(
          `SELECT status, confirmed_at, prep_started_at FROM meal_orders WHERE id = $1`,
          [orderId]
        ).catch(() => ({ rows: [] }));
        
        if (currentOrder.rows.length > 0 && currentOrder.rows[0].confirmed_at && !currentOrder.rows[0].prep_started_at) {
          // Payment was already confirmed, this is vendor acceptance
          // Don't overwrite confirmed_at (set by payment), but we need to track vendor acceptance
          // Since we can't add a new column, we'll use a workaround:
          // Set a metadata field or use updated_at to track, but that's not reliable
          // For now, we'll just update status (which is already 'confirmed') and let UI track it
          console.log(`[meal-order-status] Vendor accepting order (payment already confirmed at ${currentOrder.rows[0].confirmed_at})`);
          // Don't set confirmed_at again, just update status
          delete updatePayload.confirmed_at;
          // ✅ CRITICAL: We can't distinguish vendor acceptance from payment confirmation
          // The UI will use local state to track acceptance until we add vendor_accepted_at column
        } else {
          // First confirmation (could be payment or vendor acceptance)
          updatePayload.confirmed_at = new Date().toISOString();
        }
      } else if (actualStatus === 'confirmed' && status !== 'accepted') {
        // Direct status update to 'confirmed' (not via 'accepted')
        updatePayload.confirmed_at = new Date().toISOString();
      } else if (actualStatus === 'preparing') {
        updatePayload.confirmed_at = updatePayload.confirmed_at ?? new Date().toISOString();
        const prepStartedAt = new Date();
        updatePayload.prep_started_at = prepStartedAt.toISOString();

        // Snapshot prep_time_minutes from the meal plan if meal_orders.prep_minutes is null,
        // and compute expected_ready_at = prep_started_at + prep_minutes. New columns added in
        // migration 1010 — guarded so older deployments don't fail when columns are missing.
        try {
          const moInfo = await query(
            `SELECT mo.prep_minutes, mp.prep_time_minutes AS plan_prep_minutes
               FROM meal_orders mo
               LEFT JOIN meal_plans mp ON mp.id = mo.meal_plan_id
              WHERE mo.id = $1`,
            [orderId]
          ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
          const moRow = (moInfo.rows && moInfo.rows[0]) as Record<string, unknown> | undefined;
          const existingPrep =
            moRow && typeof moRow.prep_minutes === 'number' ? (moRow.prep_minutes as number) : null;
          const planPrep =
            moRow && typeof moRow.plan_prep_minutes === 'number'
              ? (moRow.plan_prep_minutes as number)
              : null;
          const prepMinutes = existingPrep ?? planPrep ?? 30;
          if (existingPrep == null) {
            updatePayload.prep_minutes = prepMinutes;
          }
          updatePayload.expected_ready_at = new Date(
            prepStartedAt.getTime() + prepMinutes * 60_000
          ).toISOString();

          const prepScheduling = buildVendorPrepScheduling({
            scheduledDeliveryDate: orderRow.scheduled_delivery_date,
            scheduledDeliverySlot: orderRow.scheduled_delivery_slot,
            prepMinutes,
          });
          console.log(
            '[VENDOR PREP SCHEDULING]',
            JSON.stringify({
              order_id: orderId,
              commitment_at: prepScheduling.commitment_at_iso,
              prep_minutes: prepMinutes,
              recommended_prepare_at: prepScheduling.recommended_prepare_at_iso,
              actual_prepare_start: prepStartedAt.toISOString(),
            }),
          );
        } catch (e) {
          console.warn('[meal-order-status] could not compute expected_ready_at:', e);
        }
      } else if (status === 'ready_for_pickup') {
        updatePayload.ready_at = new Date().toISOString();
      } else if (status === 'picked_up') {
        updatePayload.picked_up_at = new Date().toISOString();
      } else if (status === 'delivered') {
        updatePayload.delivered_at = new Date().toISOString();
        updatePayload.actual_delivery_time = new Date().toISOString();
      } else if (status === 'cancelled') {
        updatePayload.cancelled_at = new Date().toISOString();
      }

      if (
        actualStatus === 'ready_for_pickup' &&
        mealPidgeDispatchOn() === 'ready_for_pickup' &&
        String(orderRow.order_status || '').trim().toLowerCase() !== 'preparing'
      ) {
        return c.json(
          {
            success: false,
            error: 'Order must be in preparing status before marking ready for pickup.',
          },
          400,
        );
      }

      // Pidge must succeed before we persist the dispatch trigger status (default: ready_for_pickup).
      const strictGate = await runMealDispatchStrictGate(orderId, actualStatus);
      if (!strictGate.proceed) {
        void notifyVendorMealDispatchFailed(
          orderId,
          strictGate.userMessage || 'Dispatch failed',
        ).catch(() => undefined);
        return c.json(
          {
            success: false,
            error: strictGate.userMessage,
            dispatch: strictGate.dispatchResult,
          },
          422,
        );
      }
      const dispatchStrictResult = strictGate.dispatchResult;

      // Update using the order's actual vendor_id
      // Use raw query to handle potential missing columns gracefully
      try {
        await update('meal_orders', { id: orderId, vendor_id: order.vendor_id }, updatePayload);
        console.log(`[meal-order-status] Order status updated to: ${status}`);
      } catch (updateError: any) {
        // If update fails due to missing columns, retry without the new prep/expected fields, then
        // fall back to status-only as a last resort.
        if (updateError.message?.includes('does not exist')) {
          console.log(`[meal-order-status] Some columns don't exist, retrying with smaller payload...`);
          const fallback: Record<string, any> = { ...updatePayload };
          delete fallback.prep_minutes;
          delete fallback.expected_ready_at;
          try {
            await update('meal_orders', { id: orderId, vendor_id: order.vendor_id }, fallback);
            console.log(`[meal-order-status] Order status updated to: ${status} (without prep/expected fields)`);
          } catch (e2: any) {
            await update('meal_orders', { id: orderId, vendor_id: order.vendor_id }, { status: actualStatus });
            console.log(`[meal-order-status] Order status updated to: ${status} (status-only fallback)`);
          }
        } else {
          throw updateError;
        }
      }

      if (status === 'accepted' && subscriptionParentEarly && orderRow.subscription_id) {
        await query(
          `UPDATE meal_orders
             SET status = 'confirmed',
                 confirmed_at = COALESCE(confirmed_at, NOW()),
                 updated_at = NOW()
           WHERE subscription_id = $1::uuid
             AND purchase_snapshot IS NOT NULL
             AND (purchase_snapshot::jsonb->>'subscriptionVendorBookingRole') = 'session'
             AND status = 'pending'`,
          [orderRow.subscription_id],
        ).catch((e) =>
          console.warn('[meal-order-status] cascade subscription session meal_orders failed', e),
        );
      }

      // When not strict (MEAL_DISPATCH_REQUIRED=false), keep best-effort dispatch after DB update for local dev.
      let dispatch = dispatchStrictResult;
      if (!dispatch && isMealLogisticsDispatchStatus(actualStatus) && !isMealDispatchStrict()) {
        dispatch = await runMealDispatchBestEffort(orderId, actualStatus);
        if (dispatch && !dispatch.ok) {
          void notifyVendorMealDispatchFailed(
            orderId,
            dispatch.error || 'Dispatch failed',
          ).catch(() => undefined);
        }
      }

      // Idempotent vendor settlement on delivered (parity with the meal-plans.ts
      // POST /meal/orders/:orderId/update-status path).
      if (actualStatus === 'delivered') {
        try {
          await ensureMealOrderSettlementOnDelivered(orderId);
        } catch (e) {
          console.warn('[meal-order-status] settlement insert failed:', e);
        }
      }

      let refundInfo: Record<string, unknown> | null = null;
      if (actualStatus === 'cancelled' && !subscriptionParentEarly) {
        try {
          const refund = await processMealOrderVendorCancelOriginalRefund(
            orderId,
            'Vendor cancelled meal order from nutrition queue',
            'vendor',
          );
          refundInfo = {
            amount: refund.totalAmount,
            method: 'original',
            status: refund.status,
            message: refund.message,
            refundId: refund.refundId,
            razorpayRefundId: refund.razorpayRefundId,
            walletCredited: refund.walletCredited,
          };
          if (refund.status === 'failed') {
            return c.json(
              {
                success: false,
                error:
                  refund.message ||
                  'Order cancelled but refund to original payment method failed. Please contact support.',
                refund: refundInfo,
              },
              422,
            );
          }
          if (
            refund.status === 'skipped' &&
            refund.totalAmount <= 0.009 &&
            String(orderRow.payment_status || '') === 'paid'
          ) {
            return c.json(
              {
                success: false,
                error:
                  'Order cancelled but refund could not be processed. Please contact support with the order ID.',
                refund: refundInfo,
              },
              422,
            );
          }
          void notifyMealOrderCancelledByVendor(
            orderId,
            'Vendor cancelled meal order from nutrition queue',
          ).catch((e) =>
            console.warn('[meal-order-status] cancel notify failed:', (e as Error)?.message || e),
          );
        } catch (refundErr: unknown) {
          const msg = refundErr instanceof Error ? refundErr.message : 'Refund failed';
          console.error('[meal-order-status] original-method refund failed:', msg, { orderId });
          return c.json(
            {
              success: false,
              error:
                'Order cancelled but refund to original payment method failed. Please contact support with the order ID.',
            },
            422,
          );
        }
      }

      const kitchenStage = mealKitchenNotifyStageForStatus(actualStatus);
      const customerIdForNotify = orderRow.customer_id ? String(orderRow.customer_id) : '';
      if (kitchenStage && customerIdForNotify && previousMealStatus !== actualStatus) {
        try {
          const vendorRows = await select('vendors', { id: orderRow.vendor_id }).catch(() => []);
          const vendorName =
            (vendorRows[0] as { business_name?: string })?.business_name ||
            (vendor as { business_name?: string | null })?.business_name ||
            'Your kitchen';
          const numRes = await query(
            `SELECT order_number FROM meal_orders WHERE id = $1 LIMIT 1`,
            [orderId],
          );
          const orderNumber = String((numRes.rows?.[0] as { order_number?: string })?.order_number || '');
          void notifyMealDeliveryStage({
            customerId: customerIdForNotify,
            orderId,
            eventType: kitchenStage,
            vendorName,
            orderNumber,
          }).catch((e) =>
            console.warn('[meal-order-status] kitchen notify failed:', (e as Error)?.message || e),
          );
        } catch (notifyErr) {
          console.warn('[meal-order-status] kitchen notify setup failed:', notifyErr);
        }
      }

      return c.json({
        success: true,
        message: 'Order status updated',
        ...(refundInfo ? { refund: refundInfo } : {}),
        ...(dispatch ? { dispatch } : {}),
      });
    } catch (error: any) {
      console.error('Error updating meal order status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // CAFE: TABLE & PAX CONFIGURATION
  // ============================================

  /**
   * GET /vendor/:vendorId/cafe/menu
   * Get cafe menu items
   */
  app.get("/vendor/:vendorId/cafe/menu", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const menuItems = await query(
        `SELECT * FROM cafe_menu_items 
         WHERE vendor_id = $1 
         AND is_active = true
         ORDER BY category, name ASC
        `, [vendorId]).catch(async () => {
        // Fallback: return empty if table doesn't exist yet
        return { rows: [] };
      });
      
      return c.json({ 
        success: true, 
        menu_items: menuItems.rows,
        menu: menuItems.rows, // Alias for compatibility
        total: menuItems.rows.length 
      });
    } catch (error: any) {
      console.error('Error fetching cafe menu:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/cafe/tables
   * Get cafe table configuration
   * Requires 'cafe_tables' or 'reservations' capability
   */
  app.get("/vendor/:vendorId/cafe/tables", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Handle test IDs - return empty tables
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({ success: true, tables: [], totalSeats: 0 });
      }
      
      // Check if vendor has cafe_tables capability
      const hasCafeTablesCapability = await checkVendorCapability(vendorId, 'cafe_tables');
      const hasReservationsCapability = await checkVendorCapability(vendorId, 'reservations');
      if (!hasCafeTablesCapability && !hasReservationsCapability) {
        return c.json({ error: 'Vendor does not have cafe tables capability' }, 403);
      }
      
      // Check if cafe_tables table exists, if not use a generic approach
      // For now, we'll assume the table exists from migration
      const tables = await query(`
        SELECT * FROM cafe_tables 
        WHERE vendor_id = $1 
        ORDER BY created_at DESC
      `, [vendorId]).catch(async () => {
        // Fallback: return empty if table doesn't exist yet
        return { rows: [] };
      });
      
      const totalSeats = tables.rows.reduce((sum: number, table: any) => sum + (table.capacity || 0), 0);
      
      return c.json({ success: true, tables: tables.rows, totalSeats });
    } catch (error: any) {
      console.error('Error fetching cafe tables:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/cafe/tables/availability
   * Get cafe table availability for a specific date
   */
  app.get("/vendor/:vendorId/cafe/tables/availability", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const date = c.req.query('date') || new Date().toISOString().split('T')[0];
      const timeSlot = c.req.query('timeSlot');
      const numberOfPax = parseInt(c.req.query('numberOfPax') || '1', 10);

      // Handle test IDs - return empty availability
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          date,
          availableTables: [],
          totalTables: 0,
        });
      }

      // Get all tables
      const allTables = await query(`
        SELECT * FROM cafe_tables
        WHERE vendor_id = $1 AND is_active = true
        ORDER BY table_number ASC
      `, [vendorId]).catch(() => ({ rows: [] }));

      // Get bookings for the date
      const bookings = await query(`
        SELECT 
          b.id,
          b.table_id,
          b.booking_time,
          b.duration_minutes,
          b.number_of_pax,
          b.status
        FROM bookings b
        WHERE b.vendor_id = $1
          AND b.booking_date = $2
          AND b.service_type = 'pet_cafe'
          AND b.status IN ('confirmed', 'in_progress')
      `, [vendorId, date]).catch(() => ({ rows: [] }));

      // Calculate availability
      const availableTables = allTables.rows.map((table: any) => {
        const tableBookings = bookings.rows.filter((b: any) => b.table_id === table.id);
        const isAvailable = tableBookings.length === 0 || 
          (table.max_concurrent_bookings && tableBookings.length < table.max_concurrent_bookings);
        
        return {
          ...table,
          isAvailable,
          currentBookings: tableBookings.length,
          bookings: tableBookings,
        };
      });

      // Filter by time slot if provided
      let filteredTables = availableTables;
      if (timeSlot) {
        filteredTables = availableTables.filter((table: any) => {
          const hasConflict = table.bookings.some((b: any) => {
            const bookingStart = new Date(`${date}T${b.booking_time}`);
            const bookingEnd = new Date(bookingStart.getTime() + (b.duration_minutes || 60) * 60000);
            const slotStart = new Date(`${date}T${timeSlot}`);
            const slotEnd = new Date(slotStart.getTime() + 60 * 60000); // 1 hour default
            
            return (slotStart >= bookingStart && slotStart < bookingEnd) ||
                   (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
                   (slotStart <= bookingStart && slotEnd >= bookingEnd);
          });
          return !hasConflict;
        });
      }

      // Filter by capacity if numberOfPax provided
      if (numberOfPax > 0) {
        filteredTables = filteredTables.filter((table: any) => 
          table.capacity >= numberOfPax
        );
      }

      return c.json({
        success: true,
        date,
        availableTables: filteredTables.filter(t => t.isAvailable),
        allTables: availableTables,
        totalTables: allTables.rows.length,
        availableCount: filteredTables.filter(t => t.isAvailable).length,
      });
    } catch (error: any) {
      console.error('Error fetching table availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/cafe/tables
   * Update cafe table configuration
   * Requires 'cafe_tables' or 'reservations' capability
   */
  app.post("/vendor/:vendorId/cafe/tables", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has cafe_tables capability
      const hasCafeTablesCapability = await checkVendorCapability(vendorId, 'cafe_tables');
      const hasReservationsCapability = await checkVendorCapability(vendorId, 'reservations');
      if (!hasCafeTablesCapability && !hasReservationsCapability) {
        return c.json({ error: 'Vendor does not have cafe tables capability' }, 403);
      }
      
      const tableData = await c.req.json();
      
      // This endpoint expects an array of tables
      const tables = tableData.tables || [];
      const results = [];
      
      for (const table of tables) {
        if (table.id) {
          // Update existing table
          const updated = await update('cafe_tables',
            { id: table.id },
            {
              capacity: table.capacity,
              section: table.section,
              location: table.location,
              is_outdoor: table.isOutdoor || table.is_outdoor,
              amenities: table.amenities,
              status: table.status,
            }
          );
          if (updated.length > 0) results.push(updated[0]);
        } else {
          // Create new table
          const created = await insert('cafe_tables', {
            vendor_id: vendorId,
            table_number: table.tableNumber || table.table_number || `T-${Date.now()}`,
            capacity: table.capacity,
            section: table.section,
            location: table.location,
            is_outdoor: table.isOutdoor || table.is_outdoor || false,
            amenities: table.amenities || [],
          });
          if (created.length > 0) results.push(created[0]);
        }
      }
      
      const totalSeats = results.reduce((sum: number, table: any) => sum + (table.capacity || 0), 0);
      
      return c.json({ success: true, tables: results, totalSeats, message: 'Table configuration updated' });
    } catch (error: any) {
      console.error('Error updating cafe tables:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/cafe/tables/:tableId
   * Update a specific cafe table
   */
  app.put("/vendor/:vendorId/cafe/tables/:tableId", async (c) => {
    try {
      const { vendorId, tableId } = c.req.param();
      const tableData = await c.req.json();
      
      const updated = await update('cafe_tables', 
        { id: tableId, vendor_id: vendorId },
        {
          table_number: tableData.number || tableData.table_number,
          capacity: tableData.capacity,
          location: tableData.location,
          is_outdoor: tableData.location === 'outdoor',
          status: tableData.isAvailable ? 'available' : 'unavailable',
          is_active: tableData.isAvailable !== false,
          updated_at: new Date(),
        }
      );
      
      if (updated.length === 0) {
        return c.json({ error: 'Table not found' }, 404);
      }
      
      return c.json({ success: true, table: updated[0], message: 'Table updated successfully' });
    } catch (error: any) {
      console.error('Error updating cafe table:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/cafe/tables/:tableId
   * Delete a cafe table
   */
  app.delete("/vendor/:vendorId/cafe/tables/:tableId", async (c) => {
    try {
      const { vendorId, tableId } = c.req.param();
      
      await query(`DELETE FROM cafe_tables WHERE id = $1 AND vendor_id = $2`, [tableId, vendorId]);
      
      return c.json({ success: true, message: 'Table deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting cafe table:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/cafe/menu
   * Add a new cafe menu item
   */
  app.post("/vendor/:vendorId/cafe/menu", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const menuData = await c.req.json();
      
      const menuItem = await insert('cafe_menu_items', {
        vendor_id: vendorId,
        name: menuData.name,
        description: menuData.description,
        category: menuData.category || 'food',
        price: menuData.price || 0,
        image_url: menuData.imageUrl || menuData.image_url,
        is_pet_friendly: menuData.isPetFriendly !== false,
        is_available: menuData.isAvailable !== false,
      });
      
      return c.json({ success: true, menuItem: menuItem[0], message: 'Menu item added successfully' });
    } catch (error: any) {
      console.error('Error adding cafe menu item:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/cafe/menu/:itemId
   * Update a cafe menu item
   */
  app.put("/vendor/:vendorId/cafe/menu/:itemId", async (c) => {
    try {
      const { vendorId, itemId } = c.req.param();
      const menuData = await c.req.json();
      
      const updated = await update('cafe_menu_items', 
        { id: itemId, vendor_id: vendorId },
        {
          name: menuData.name,
          description: menuData.description,
          category: menuData.category,
          price: menuData.price,
          image_url: menuData.imageUrl || menuData.image_url,
          is_available: menuData.isAvailable !== false,
          updated_at: new Date(),
        }
      );
      
      if (updated.length === 0) {
        return c.json({ error: 'Menu item not found' }, 404);
      }
      
      return c.json({ success: true, menuItem: updated[0], message: 'Menu item updated successfully' });
    } catch (error: any) {
      console.error('Error updating cafe menu item:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/cafe/menu/:itemId
   * Delete a cafe menu item
   */
  app.delete("/vendor/:vendorId/cafe/menu/:itemId", async (c) => {
    try {
      const { vendorId, itemId } = c.req.param();
      
      await query(`DELETE FROM cafe_menu_items WHERE id = $1 AND vendor_id = $2`, [itemId, vendorId]);
      
      return c.json({ success: true, message: 'Menu item deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting cafe menu item:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/ambulance/vehicles/:vehicleId
   * Delete an ambulance vehicle
   */
  app.delete("/vendor/:vendorId/ambulance/vehicles/:vehicleId", async (c) => {
    try {
      const { vendorId, vehicleId } = c.req.param();
      
      await query(`DELETE FROM ambulance_vehicles WHERE id = $1 AND vendor_id = $2`, [vehicleId, vendorId]);
      
      return c.json({ success: true, message: 'Vehicle deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting ambulance vehicle:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/ambulance/sos-requests
   * Get SOS requests for an ambulance service
   */
  app.get("/vendor/:vendorId/ambulance/sos-requests", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const requests = await query(`
        SELECT b.*, p.name as pet_name, p.species as pet_type, c.name as customer_name, c.phone as customer_phone
        FROM bookings b
        LEFT JOIN pets p ON b.pet_id = p.id
        LEFT JOIN customers c ON b.customer_id = c.id
        WHERE b.vendor_id = $1 
        AND b.service_type IN ('ambulance', 'pet_ambulance', 'sos')
        ORDER BY b.created_at DESC
        LIMIT 50
      `, [vendorId]).catch(() => ({ rows: [] }));
      
      return c.json({ 
        success: true, 
        requests: requests.rows.map((r: any) => ({
          id: r.id,
          customerName: r.customer_name,
          customerPhone: r.customer_phone,
          petName: r.pet_name,
          petType: r.pet_type,
          emergency: r.notes || 'Emergency request',
          pickupLocation: r.address,
          destinationLocation: r.destination_address,
          status: r.status,
          assignedVehicle: r.vehicle_id,
          createdAt: r.created_at,
        })),
        total: requests.rows.length 
      });
    } catch (error: any) {
      console.error('Error fetching SOS requests:', error);
      return c.json({ success: true, requests: [], total: 0 });
    }
  });

  /**
   * PUT /vendor/:vendorId/ambulance/sos-requests/:requestId
   * Update SOS request status
   */
  app.put("/vendor/:vendorId/ambulance/sos-requests/:requestId", async (c) => {
    try {
      const { vendorId, requestId } = c.req.param();
      const body = await c.req.json();
      
      const updateData: any = { updated_at: new Date() };
      if (body.status) updateData.status = body.status;
      if (body.assignedVehicle) updateData.vehicle_id = body.assignedVehicle;
      
      await update('bookings', { id: requestId, vendor_id: vendorId }, updateData);
      
      return c.json({ success: true, message: 'SOS request updated successfully' });
    } catch (error: any) {
      console.error('Error updating SOS request:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/resort/rooms/:roomId
   * Update a resort room
   */
  app.put("/vendor/:vendorId/resort/rooms/:roomId", async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();
      const roomData = await c.req.json();
      
      const updated = await update('boarding_rooms', 
        { id: roomId, vendor_id: vendorId },
        {
          room_number: roomData.number || roomData.room_number,
          room_type: roomData.type || roomData.room_type,
          capacity: roomData.capacity,
          amenities: roomData.amenities || [],
          price_per_night: roomData.pricePerNight || roomData.price_per_night,
          is_available: roomData.isAvailable !== false,
          updated_at: new Date(),
        }
      );
      
      if (updated.length === 0) {
        return c.json({ error: 'Room not found' }, 404);
      }
      
      return c.json({ success: true, room: updated[0], message: 'Room updated successfully' });
    } catch (error: any) {
      console.error('Error updating resort room:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/resort/rooms/:roomId
   * Delete a resort room
   */
  app.delete("/vendor/:vendorId/resort/rooms/:roomId", async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();
      
      await query(`DELETE FROM boarding_rooms WHERE id = $1 AND vendor_id = $2`, [roomId, vendorId]);
      
      return c.json({ success: true, message: 'Room deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting resort room:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // BREEDER/ADOPTION: PET PROFILES
  // ============================================

  /**
   * GET /vendor/:vendorId/breeder/puppies
   * Get all available puppies/pets for adoption/breeding
   * Requires 'adoption' or 'pet_profiles' capability
   */
  app.get("/vendor/:vendorId/breeder/puppies", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has adoption capability
      const hasAdoptionCapability = await checkVendorCapability(vendorId, 'adoption');
      const hasPetProfilesCapability = await checkVendorCapability(vendorId, 'pet_profiles');
      if (!hasAdoptionCapability && !hasPetProfilesCapability) {
        return c.json({ error: 'Vendor does not have adoption capability' }, 403);
      }
      
      // Get pets/adoption listings - assuming a pets table with adoption listings
      const puppies = await query(`
        SELECT * FROM pets 
        WHERE vendor_id = $1 
        AND (listing_type = 'adoption' OR listing_type = 'breeding')
        ORDER BY created_at DESC
      `, [vendorId]).catch(async () => {
        // Fallback: return empty if table doesn't exist yet
        return { rows: [] };
      });
      
      return c.json({ success: true, puppies: puppies.rows, total: puppies.rows.length });
    } catch (error: any) {
      console.error('Error fetching puppies:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/breeder/puppies
   * Add a new puppy/pet profile
   * Requires 'adoption' or 'pet_profiles' capability
   */
  app.post("/vendor/:vendorId/breeder/puppies", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has adoption capability
      const hasAdoptionCapability = await checkVendorCapability(vendorId, 'adoption');
      const hasPetProfilesCapability = await checkVendorCapability(vendorId, 'pet_profiles');
      if (!hasAdoptionCapability && !hasPetProfilesCapability) {
        return c.json({ error: 'Vendor does not have adoption capability' }, 403);
      }
      
      const puppyData = await c.req.json();
      
      // Create pet listing - assuming pets table structure
      const puppy = await insert('pets', {
        vendor_id: vendorId,
        customer_id: null, // Not assigned yet
        name: puppyData.petName || puppyData.name,
        pet_type: puppyData.petType || puppyData.type || 'dog',
        breed: puppyData.breed,
        age: puppyData.age,
        age_unit: puppyData.ageUnit || puppyData.age_unit,
        gender: puppyData.gender,
        size: puppyData.size,
        color: puppyData.color,
        description: puppyData.description,
        medical_history: puppyData.medicalHistory || puppyData.medical_history,
        vaccination_status: puppyData.vaccinationStatus || puppyData.vaccination_status,
        spayed_neutered: puppyData.spayedNeutered || puppyData.spayed_neutered,
        microchipped: puppyData.microchipped,
        special_needs: puppyData.specialNeeds || puppyData.special_needs,
        photos: puppyData.photos || [],
        listing_type: puppyData.listingType || 'adoption',
        adoption_fee: puppyData.adoptionFee || puppyData.adoption_fee || 0,
        location_city: puppyData.locationCity || puppyData.location_city,
        location_state: puppyData.locationState || puppyData.location_state,
      });
      
      return c.json({ success: true, puppy: puppy[0], message: 'Puppy profile created successfully' });
    } catch (error: any) {
      console.error('Error creating puppy profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // PET RESORT/BOARDING: ROOM CONFIGURATION
  // ============================================

  /**
   * GET /vendor/:vendorId/resort/rooms
   * Get room configuration and pricing
   * Requires 'rooms' or 'boarding' capability
   */
  app.get("/vendor/:vendorId/resort/rooms", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has rooms capability
      const hasRoomsCapability = await checkVendorCapability(vendorId, 'rooms');
      const hasBoardingCapability = await checkVendorCapability(vendorId, 'boarding');
      if (!hasRoomsCapability && !hasBoardingCapability) {
        return c.json({ error: 'Vendor does not have resort rooms capability' }, 403);
      }
      
      // Check if boarding_rooms table exists
      const rooms = await query(`
        SELECT * FROM boarding_rooms 
        WHERE vendor_id = $1 
        ORDER BY created_at DESC
      `, [vendorId]).catch(async () => {
        // Fallback: return empty if table doesn't exist yet
        return { rows: [] };
      });
      
      return c.json({ success: true, rooms: rooms.rows, total: rooms.rows.length });
    } catch (error: any) {
      console.error('Error fetching resort rooms:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/resort/rooms
   * Add/update room configuration
   * Requires 'rooms' or 'boarding' capability
   */
  app.post("/vendor/:vendorId/resort/rooms", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has rooms capability
      const hasRoomsCapability = await checkVendorCapability(vendorId, 'rooms');
      const hasBoardingCapability = await checkVendorCapability(vendorId, 'boarding');
      if (!hasRoomsCapability && !hasBoardingCapability) {
        return c.json({ error: 'Vendor does not have resort rooms capability' }, 403);
      }
      
      const roomData = await c.req.json();
      
      // Check if boarding_rooms table exists, if not create it via migration first
      // For now, we'll attempt to insert/update
      let room;
      if (roomData.id) {
        // Update existing room
        const updated = await update('boarding_rooms',
          { id: roomData.id },
          {
            room_number: roomData.roomNumber || roomData.room_number,
            room_type: roomData.roomType || roomData.room_type,
            capacity: roomData.capacity,
            amenities: roomData.amenities,
            price_per_night: roomData.pricePerNight || roomData.price_per_night,
            is_available: roomData.isAvailable !== false,
          }
        );
        room = updated[0];
      } else {
        // Create new room
        const created = await insert('boarding_rooms', {
          vendor_id: vendorId,
          room_number: roomData.roomNumber || roomData.room_number || `R-${Date.now()}`,
          room_type: roomData.roomType || roomData.room_type || 'standard',
          capacity: roomData.capacity || 1,
          amenities: roomData.amenities || [],
          price_per_night: roomData.pricePerNight || roomData.price_per_night || 0,
          is_available: roomData.isAvailable !== false,
        });
        room = created[0];
      }
      
      return c.json({ success: true, room, message: 'Room configuration updated' });
    } catch (error: any) {
      console.error('Error updating resort rooms:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // TRAINING PROGRAMS
  // ============================================

  /**
   * GET /vendor/:vendorId/training/programs
   * Get all training programs
   * Requires 'training_programs' capability
   */
  app.get("/vendor/:vendorId/training/programs", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has training capability
      const hasTrainingCapability = await checkVendorCapability(vendorId, 'training_programs');
      if (!hasTrainingCapability) {
        return c.json({ error: 'Vendor does not have training programs capability' }, 403);
      }
      
      const programs = await query(`
        SELECT * FROM training_programs
        WHERE vendor_id = $1
        ORDER BY created_at DESC
      `, [vendorId]).catch(() => ({ rows: [] }));
      
      return c.json({ success: true, programs: programs.rows, total: programs.rows.length });
    } catch (error: any) {
      console.error('Error fetching training programs:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/training/programs
   * Create a new training program
   * Requires 'training_programs' capability
   */
  app.post("/vendor/:vendorId/training/programs", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has training capability
      const hasTrainingCapability = await checkVendorCapability(vendorId, 'training_programs');
      if (!hasTrainingCapability) {
        return c.json({ error: 'Vendor does not have training programs capability' }, 403);
      }
      
      const programData = await c.req.json();
      
      const program = await insert('training_programs', {
        vendor_id: vendorId,
        name: programData.name,
        description: programData.description,
        category: programData.category || 'obedience',
        duration_weeks: programData.durationWeeks || programData.duration_weeks || 4,
        sessions_per_week: programData.sessionsPerWeek || programData.sessions_per_week || 2,
        price: programData.price || 0,
        max_pets: programData.maxPets || programData.max_pets || 5,
        skill_level: programData.skillLevel || programData.skill_level || 'beginner',
        is_active: programData.isActive !== false,
      });
      
      return c.json({ success: true, program: program[0], message: 'Training program created successfully' });
    } catch (error: any) {
      console.error('Error creating training program:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/training/progress
   * Get training progress for enrolled pets
   * Requires 'progress_tracking' capability
   */
  app.get("/vendor/:vendorId/training/progress", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const hasProgressCapability = await checkVendorCapability(vendorId, 'progress_tracking');
      const hasGpsCapability = await checkVendorCapability(vendorId, 'gps_tracking');
      if (!hasProgressCapability && !hasGpsCapability) {
        return c.json({ error: 'Vendor does not have progress tracking capability' }, 403);
      }

      let enrollmentRows: Record<string, unknown>[] = [];
      if (hasProgressCapability) {
        const progress = await query(
          `
        SELECT tp.*,
          p.name as pet_name,
          c.full_name as customer_name,
          trp.name as program_name,
          trp.category as program_category,
          trp.duration_weeks,
          trp.sessions_per_week,
          (COALESCE(trp.duration_weeks, 4) * COALESCE(trp.sessions_per_week, 2))::int as estimated_total_sessions
        FROM training_progress tp
        LEFT JOIN pets p ON tp.pet_id = p.id
        LEFT JOIN customers c ON tp.customer_id = c.id
        LEFT JOIN training_programs trp ON tp.program_id = trp.id
        WHERE tp.vendor_id = $1
        ORDER BY tp.updated_at DESC
      `,
          [vendorId]
        ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
        enrollmentRows = progress.rows || [];
      }

      const bookingDerived = await fetchVendorProgressRowsFromBookings(vendorId, {
        includeWalkAggregates: hasGpsCapability,
      });
      const merged = mergeTrainingProgressWithBookingDerived(enrollmentRows, bookingDerived);

      return c.json({ success: true, progress: merged, total: merged.length });
    } catch (error: any) {
      console.error('Error fetching training progress:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // HOLIDAY PACKAGES
  // ============================================

  /**
   * GET /vendor/:vendorId/holidays/packages
   * Get all holiday packages
   * Requires 'holiday_packages' capability
   */
  app.get("/vendor/:vendorId/holidays/packages", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has holiday capability
      const hasHolidayCapability = await checkVendorCapability(vendorId, 'holiday_packages');
      if (!hasHolidayCapability) {
        return c.json({ error: 'Vendor does not have holiday packages capability' }, 403);
      }
      
      const packages = await query(`
        SELECT * FROM holiday_packages
        WHERE vendor_id = $1
        ORDER BY created_at DESC
      `, [vendorId]).catch(() => ({ rows: [] }));
      
      return c.json({ success: true, packages: packages.rows, total: packages.rows.length });
    } catch (error: any) {
      console.error('Error fetching holiday packages:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/holidays/packages
   * Create a new holiday package
   * Requires 'holiday_packages' capability
   */
  app.post("/vendor/:vendorId/holidays/packages", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has holiday capability
      const hasHolidayCapability = await checkVendorCapability(vendorId, 'holiday_packages');
      if (!hasHolidayCapability) {
        return c.json({ error: 'Vendor does not have holiday packages capability' }, 403);
      }
      
      const packageData = await c.req.json();
      
      const pkg = await insert('holiday_packages', {
        vendor_id: vendorId,
        name: packageData.name,
        description: packageData.description,
        destination: packageData.destination,
        duration_days: packageData.durationDays || packageData.duration_days || 3,
        price: packageData.price || 0,
        max_pets: packageData.maxPets || packageData.max_pets || 10,
        pet_types_allowed: packageData.petTypesAllowed || ['dog', 'cat'],
        includes: packageData.includes || [],
        excludes: packageData.excludes || [],
        itinerary: packageData.itinerary || [],
        next_departure: packageData.nextDeparture || null,
        is_active: packageData.isActive !== false,
      });
      
      return c.json({ success: true, package: pkg[0], message: 'Holiday package created successfully' });
    } catch (error: any) {
      console.error('Error creating holiday package:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/holidays/schedule
   * Get upcoming tour schedule
   * Requires 'tour_schedule' capability
   */
  app.get("/vendor/:vendorId/holidays/schedule", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has tour schedule capability
      const hasTourCapability = await checkVendorCapability(vendorId, 'tour_schedule');
      if (!hasTourCapability) {
        return c.json({ error: 'Vendor does not have tour schedule capability' }, 403);
      }
      
      const schedule = await query(`
        SELECT hp.*, hb.departure_date, COUNT(hb.id) as booking_count
        FROM holiday_packages hp
        LEFT JOIN holiday_bookings hb ON hp.id = hb.package_id AND hb.booking_status != 'cancelled'
        WHERE hp.vendor_id = $1
        AND hp.is_active = true
        GROUP BY hp.id, hb.departure_date
        ORDER BY hp.next_departure ASC NULLS LAST
      `, [vendorId]).catch(() => ({ rows: [] }));
      
      return c.json({ success: true, schedule: schedule.rows, total: schedule.rows.length });
    } catch (error: any) {
      console.error('Error fetching tour schedule:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ========================================
  // PHOTOGRAPHY PORTFOLIO ENDPOINTS
  // ========================================

  /**
   * GET /vendor/:vendorId/photography/portfolio
   * Get photographer's portfolio items
   */
  app.get("/vendor/:vendorId/photography/portfolio", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Try to get from vendor_portfolio or vendor metadata
      const portfolio = await query(
        `SELECT * FROM vendor_portfolio 
         WHERE vendor_id = $1 AND is_active = true
         ORDER BY display_order, created_at DESC`,
        [vendorId]
      ).catch(async () => {
        // Fallback to vendor metadata if table doesn't exist
        const vendors = await select('vendors', { id: vendorId });
        const metadata = vendors[0]?.metadata || {};
        return { rows: metadata.portfolio || [] };
      });
      
      return c.json({ 
        success: true, 
        portfolio: portfolio.rows || portfolio,
        count: (portfolio.rows || portfolio).length
      });
    } catch (error: any) {
      console.error('Error fetching portfolio:', error);
      return c.json({ success: false, error: error.message, portfolio: [] }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/photography/portfolio
   * Add new portfolio item
   */
  app.post("/vendor/:vendorId/photography/portfolio", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const portfolioData = await c.req.json();
      
      // Try to insert into vendor_portfolio table
      try {
        const created = await insert('vendor_portfolio', {
          vendor_id: vendorId,
          title: portfolioData.title,
          description: portfolioData.description,
          image_url: portfolioData.imageUrl || portfolioData.image_url,
          category: portfolioData.category,
          is_featured: portfolioData.isFeatured || false,
          display_order: portfolioData.displayOrder || 0,
          is_active: true,
        });
        
        return c.json({ success: true, portfolio: created[0], message: 'Portfolio item added' });
      } catch (tableError) {
        // Fallback to vendor metadata if table doesn't exist
        console.log('vendor_portfolio table not found, using metadata');
        const vendors = await select('vendors', { id: vendorId });
        const metadata = vendors[0]?.metadata || {};
        const portfolio = metadata.portfolio || [];
        
        const newItem = {
          id: `portfolio-${Date.now()}`,
          ...portfolioData,
          createdAt: new Date().toISOString(),
        };
        portfolio.push(newItem);
        
        await query(
          `UPDATE vendors SET metadata = $2, updated_at = NOW() WHERE id = $1`,
          [vendorId, JSON.stringify({ ...metadata, portfolio })]
        );
        
        return c.json({ success: true, portfolio: newItem, message: 'Portfolio item added to metadata' });
      }
    } catch (error: any) {
      console.error('Error adding portfolio:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/photography/portfolio/:portfolioId
   * Update portfolio item
   */
  app.put("/vendor/:vendorId/photography/portfolio/:portfolioId", async (c) => {
    try {
      const { vendorId, portfolioId } = c.req.param();
      const portfolioData = await c.req.json();
      
      // Try to update in vendor_portfolio table
      try {
        const updated = await update('vendor_portfolio', 
          { id: portfolioId },
          {
            title: portfolioData.title,
            description: portfolioData.description,
            image_url: portfolioData.imageUrl || portfolioData.image_url,
            category: portfolioData.category,
            is_featured: portfolioData.isFeatured,
            display_order: portfolioData.displayOrder,
            updated_at: new Date().toISOString(),
          }
        );
        
        return c.json({ success: true, portfolio: updated[0], message: 'Portfolio item updated' });
      } catch (tableError) {
        // Fallback to vendor metadata
        console.log('vendor_portfolio table not found, using metadata');
        const vendors = await select('vendors', { id: vendorId });
        const metadata = vendors[0]?.metadata || {};
        const portfolio = metadata.portfolio || [];
        
        const index = portfolio.findIndex((p: any) => p.id === portfolioId);
        if (index >= 0) {
          portfolio[index] = { ...portfolio[index], ...portfolioData, updatedAt: new Date().toISOString() };
          
          await query(
            `UPDATE vendors SET metadata = $2, updated_at = NOW() WHERE id = $1`,
            [vendorId, JSON.stringify({ ...metadata, portfolio })]
          );
        }
        
        return c.json({ success: true, portfolio: portfolio[index], message: 'Portfolio item updated in metadata' });
      }
    } catch (error: any) {
      console.error('Error updating portfolio:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/photography/portfolio/:portfolioId
   * Delete portfolio item
   */
  app.delete("/vendor/:vendorId/photography/portfolio/:portfolioId", async (c) => {
    try {
      const { vendorId, portfolioId } = c.req.param();
      
      // Try to delete from vendor_portfolio table
      try {
        await query(
          `DELETE FROM vendor_portfolio WHERE id = $1 AND vendor_id = $2`,
          [portfolioId, vendorId]
        );
        
        return c.json({ success: true, message: 'Portfolio item deleted' });
      } catch (tableError) {
        // Fallback to vendor metadata
        const vendors = await select('vendors', { id: vendorId });
        const metadata = vendors[0]?.metadata || {};
        const portfolio = (metadata.portfolio || []).filter((p: any) => p.id !== portfolioId);
        
        await query(
          `UPDATE vendors SET metadata = $2, updated_at = NOW() WHERE id = $1`,
          [vendorId, JSON.stringify({ ...metadata, portfolio })]
        );
        
        return c.json({ success: true, message: 'Portfolio item deleted from metadata' });
      }
    } catch (error: any) {
      console.error('Error deleting portfolio:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}

