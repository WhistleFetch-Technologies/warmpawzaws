/**
 * Resolve a customer meal checkout ID to a row shaped like `meal_plans`,
 * whether the catalog row lives in `meal_plans` or in `products` (nutritionist meal SKUs).
 */

import { query } from '../database/rds-connection';
import { isValidUUID } from '../types/entities';
import { normalizePurchaseType } from './meal-purchase-metadata';
import {
  resolveLeadTimeHours,
  resolveOrderCutoffTime,
  resolvePrepTimeMinutes,
} from './meal-product-timing';

function parseJsonObject(v: unknown): Record<string, unknown> {
  if (v == null || v === '') return {};
  if (typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string') {
    try {
      const o = JSON.parse(v) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function mergeProductMeta(p: Record<string, unknown>): Record<string, unknown> {
  const spec = parseJsonObject(p.specifications);
  const meta = parseJsonObject(p.metadata);
  return { ...spec, ...meta };
}

function coerceDietType(dt: unknown): unknown[] {
  if (dt == null) return [];
  if (Array.isArray(dt)) return dt;
  if (typeof dt === 'string' && dt.trim()) return [dt];
  return [];
}

function petTypesToSuitableFor(petTypes: unknown): Record<string, unknown> {
  if (!Array.isArray(petTypes) || petTypes.length === 0) return {};
  return { species: petTypes };
}

function photosFromProduct(meta: Record<string, unknown>, p: Record<string, unknown>): unknown[] {
  const fromMeta = meta.images;
  if (Array.isArray(fromMeta) && fromMeta.length > 0) return fromMeta;
  const raw = p.images;
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const arr = JSON.parse(raw) as unknown;
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mealCategoryAllowed(category: unknown): boolean {
  const c = String(category || '').toLowerCase();
  return c === 'meal_plan' || c === 'nutrition' || c === 'food';
}

/**
 * `meal_plans` mirrors for nutrition SKUs often omit GST catalogue pins that vendors store on `products`
 * (specifications/metadata). Merge those hints so GET order-preview and subscription creation match buy-once GST.
 */
async function enrichMealPlanRowGstHintsFromProduct(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const id = String(row.id ?? '').trim();
  if (!id) return row;

  try {
    const pr = await query(
      `SELECT specifications, metadata FROM products WHERE id = $1::uuid
       AND (category = 'meal_plan' OR category = 'nutrition' OR category = 'food')
       LIMIT 1`,
      [id],
    );
    const p = pr.rows?.[0] as Record<string, unknown> | undefined;
    if (!p) return row;

    const meta = mergeProductMeta(p);
    const out: Record<string, unknown> = { ...row };

    const mergeScalar = (existing: unknown, fromMeta: unknown): unknown => {
      if (existing != null && String(existing).trim() !== '') return existing;
      if (fromMeta != null && String(fromMeta).trim() !== '') return String(fromMeta).trim();
      return existing;
    };

    out.service_catalog_category_id = mergeScalar(
      row.service_catalog_category_id ?? row.serviceCatalogCategoryId,
      meta.serviceCatalogCategoryId ??
        meta.service_catalog_category_id ??
        meta.catalogCategoryId ??
        meta.catalog_category_id,
    );
    out.tax_category_id = mergeScalar(row.tax_category_id ?? row.taxCategoryId, meta.taxCategoryId ?? meta.tax_category_id);

    const diet = parseJsonObject(row.dietary_requirements);
    let dietTouched = false;
    const catalogKeys = [
      'catalogCategoryId',
      'catalog_category_id',
      'catalogCategoryRef',
      'catalog_category_ref',
    ] as const;
    const mergedDiet = { ...diet };
    for (const k of catalogKeys) {
      if (mergedDiet[k] == null && meta[k] != null && String(meta[k]).trim() !== '') {
        mergedDiet[k] = meta[k];
        dietTouched = true;
      }
    }
    if (dietTouched) out.dietary_requirements = mergedDiet;

    return out;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[meal-plan-resolve] enrich GST hints from product skipped:', msg);
    return row;
  }
}

/**
 * Maps a `products` row (meal_plan / nutrition / food) to a row shaped like `meal_plans`
 * for catalog parity with `resolveMealPlanOrProductById`.
 */
export function normalizeProductRowToMealPlanShape(p: Record<string, unknown>): Record<string, unknown> | null {
  if (p?.id == null) return null;
  if (
    p.category !== undefined &&
    p.category !== null &&
    String(p.category).trim() !== '' &&
    !mealCategoryAllowed(p.category)
  ) {
    return null;
  }

  const meta = mergeProductMeta(p);
  const mealImageUrlRaw = meta.mealImageUrl;
  const mealImageUrl =
    typeof mealImageUrlRaw === 'string' && mealImageUrlRaw.trim() ? mealImageUrlRaw.trim() : undefined;

  const ingredients = Array.isArray(meta.ingredients) ? meta.ingredients : [];
  const nutritionalValue =
    meta.nutritionalValue && typeof meta.nutritionalValue === 'object' && !Array.isArray(meta.nutritionalValue)
      ? meta.nutritionalValue
      : {};

  const dietType = coerceDietType(meta.dietType);
  const suitableRaw = meta.suitableFor;
  const suitableFor =
    suitableRaw && typeof suitableRaw === 'object' && !Array.isArray(suitableRaw)
      ? suitableRaw
      : petTypesToSuitableFor(meta.petTypes);

  const photos = photosFromProduct(meta, p);
  const priceRaw = p.price;
  const price =
    priceRaw != null && priceRaw !== ''
      ? typeof priceRaw === 'number'
        ? priceRaw
        : parseFloat(String(priceRaw).replace(/,/g, ''))
      : 0;
  const safePrice = Number.isFinite(price) ? price : 0;

  const dietary_requirements: Record<string, unknown> = {
    ...meta,
    ingredients,
    nutritionalValue,
    ...(mealImageUrl ? { mealImageUrl } : {}),
  };

  const shelfLife = meta.shelfLifeDays;

  const taxCategoryFromRow =
    p.tax_category_id != null && String(p.tax_category_id).trim() !== '' ? p.tax_category_id : null;
  const taxCategoryFromMeta =
    meta.taxCategoryId ?? meta.tax_category_id ?? null;
  const serviceCatFromRow =
    p.service_catalog_category_id != null && String(p.service_catalog_category_id).trim() !== ''
      ? p.service_catalog_category_id
      : null;
  const serviceCatFromMeta =
    meta.serviceCatalogCategoryId ??
    meta.service_catalog_category_id ??
    meta.catalogCategoryId ??
    meta.catalog_category_id ??
    null;

  return {
    id: p.id,
    vendor_id: p.vendor_id,
    name: p.name,
    plan_name: p.name,
    description: p.description ?? '',
    short_description: typeof meta.shortDescription === 'string' ? meta.shortDescription : null,
    photos: JSON.stringify(photos),
    thumbnail_url: mealImageUrl ?? null,
    meal_type: typeof meta.mealType === 'string' ? meta.mealType : 'fresh_daily',
    diet_type: dietType,
    suitable_for: JSON.stringify(suitableFor),
    ingredients: JSON.stringify(ingredients),
    nutrition_info: JSON.stringify(nutritionalValue),
    allergens: Array.isArray(meta.allergens) ? meta.allergens : [],
    price_per_meal: safePrice,
    price: safePrice,
    prep_time_minutes: resolvePrepTimeMinutes(
      meta,
      p.prep_time_minutes != null ? Number(p.prep_time_minutes) : null,
    ),
    shelf_life_days: typeof shelfLife === 'number' ? shelfLife : 7,
    storage_instructions:
      typeof meta.storageInstructions === 'string' ? meta.storageInstructions : null,
    serving_instructions:
      typeof meta.feedingInstructions === 'string' ? meta.feedingInstructions : null,
    available_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    order_cutoff_time: resolveOrderCutoffTime(
      meta,
      typeof p.order_cutoff_time === 'string' ? p.order_cutoff_time : null,
    ),
    delivery_slots: JSON.stringify(Array.isArray(meta.deliverySlots) ? meta.deliverySlots : []),
    lead_time_hours: resolveLeadTimeHours(
      meta,
      p.lead_time_hours != null ? Number(p.lead_time_hours) : null,
    ),
    is_active: p.is_active !== false,
    dietary_requirements,
    ...(taxCategoryFromRow != null
      ? { tax_category_id: taxCategoryFromRow }
      : taxCategoryFromMeta != null && String(taxCategoryFromMeta).trim() !== ''
        ? { tax_category_id: String(taxCategoryFromMeta).trim() }
        : {}),
    ...(serviceCatFromRow != null
      ? { service_catalog_category_id: serviceCatFromRow }
      : serviceCatFromMeta != null && String(serviceCatFromMeta).trim() !== ''
        ? { service_catalog_category_id: String(serviceCatFromMeta).trim() }
        : {}),
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

/**
 * Returns a DB-shaped meal plan row for GET /meal-plans/:id and order-preview,
 * or null if neither meal_plans nor products contains a matching meal SKU.
 */
export async function resolveMealPlanOrProductById(planId: string): Promise<Record<string, unknown> | null> {
  const id = String(planId || '').trim();
  if (!id || !isValidUUID(id)) return null;

  try {
    const mpRes = await query(`SELECT * FROM meal_plans WHERE id = $1 LIMIT 1`, [id]);
    if (mpRes.rows?.length) {
      const enriched = await enrichMealPlanRowGstHintsFromProduct(mpRes.rows[0] as Record<string, unknown>);
      return enriched;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[meal-plan-resolve] meal_plans lookup failed:', msg);
  }

  try {
    let prodRes: { rows?: Record<string, unknown>[] };
    try {
      prodRes = await query(
        `SELECT * FROM products WHERE id = $1
         AND (category = 'meal_plan' OR category = 'nutrition' OR category = 'food')
         LIMIT 1`,
        [id],
      );
    } catch (colErr: unknown) {
      const msg = colErr instanceof Error ? colErr.message : String(colErr);
      if (msg.includes('category') || msg.includes('does not exist')) {
        prodRes = await query(`SELECT * FROM products WHERE id = $1 LIMIT 1`, [id]);
        const row = prodRes.rows?.[0];
        if (!row || !mealCategoryAllowed(row.category)) return null;
      } else {
        throw colErr;
      }
    }

    const p = prodRes.rows?.[0];
    if (!p) return null;
    return normalizeProductRowToMealPlanShape(p as Record<string, unknown>);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[meal-plan-resolve] products lookup failed:', msg);
    return null;
  }
}

function parseJsonLoose(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

/**
 * `meal_orders.meal_plan_id` references `meal_plans(id)`. Nutrition SKUs that live only in
 * `products` must be mirrored into `meal_plans` (same id as the product) before inserting an order.
 * Idempotent: no-op if a row already exists.
 */
export async function ensureMealPlanMirrorForProductCheckout(resolved: Record<string, unknown>): Promise<void> {
  const idStr = String(resolved.id ?? '').trim();
  if (!idStr || !isValidUUID(idStr)) return;

  const exists = await query(`SELECT 1 FROM meal_plans WHERE id = $1::uuid LIMIT 1`, [idStr]);
  if (exists.rows?.length) return;

  const metaR = await query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'meal_plans'`,
    [],
  );
  const colMeta = (metaR.rows || []) as { column_name: string; data_type: string }[];
  const colSet = new Set(colMeta.map((r) => r.column_name));
  const jsonbCols = new Set(
    colMeta.filter((r) => r.data_type === 'jsonb' || r.data_type === 'json').map((r) => r.column_name),
  );

  const dr =
    resolved.dietary_requirements &&
    typeof resolved.dietary_requirements === 'object' &&
    !Array.isArray(resolved.dietary_requirements)
      ? (resolved.dietary_requirements as Record<string, unknown>)
      : {};

  const planName = String(resolved.plan_name ?? resolved.name ?? 'Meal');
  const name = String(resolved.name ?? planName);

  const candidates: Record<string, unknown> = {
    id: idStr,
    vendor_id: resolved.vendor_id,
    plan_name: planName,
    description: resolved.description ?? '',
    price_per_meal: resolved.price_per_meal ?? resolved.price ?? 0,
    price: resolved.price ?? resolved.price_per_meal ?? 0,
    prep_time_minutes: Number(resolved.prep_time_minutes) || 60,
    shelf_life_days: Number(resolved.shelf_life_days) || 7,
    lead_time_hours: Number(resolved.lead_time_hours) || 24,
    meal_type: resolved.meal_type ?? 'fresh_daily',
    is_active: resolved.is_active !== false,
    thumbnail_url: resolved.thumbnail_url ?? null,
    storage_instructions: resolved.storage_instructions ?? null,
    serving_instructions: resolved.serving_instructions ?? null,
    order_cutoff_time: resolved.order_cutoff_time ?? '18:00',
    dietary_requirements: dr,
    allergens: Array.isArray(resolved.allergens) ? resolved.allergens : [],
    diet_type: Array.isArray(resolved.diet_type) ? resolved.diet_type : [],
    available_days: Array.isArray(resolved.available_days)
      ? resolved.available_days
      : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  };

  if (colSet.has('name')) candidates.name = name;
  if (colSet.has('short_description')) candidates.short_description = resolved.short_description ?? null;

  const photos = parseJsonLoose(resolved.photos);
  candidates.photos = Array.isArray(photos) ? photos : [];
  const sf = parseJsonLoose(resolved.suitable_for);
  candidates.suitable_for = sf && typeof sf === 'object' && !Array.isArray(sf) ? sf : {};
  const ing = parseJsonLoose(resolved.ingredients);
  candidates.ingredients = Array.isArray(ing) ? ing : [];
  const ni = parseJsonLoose(resolved.nutrition_info);
  candidates.nutrition_info = ni && typeof ni === 'object' && !Array.isArray(ni) ? ni : {};
  const ds = parseJsonLoose(resolved.delivery_slots);
  candidates.delivery_slots = Array.isArray(ds) ? ds : [];

  if (colSet.has('meals_per_day')) {
    const m = dr.mealsPerDay;
    const n = typeof m === 'number' ? m : parseInt(String(m || '1'), 10);
    candidates.meals_per_day = Number.isFinite(n) && n >= 1 ? Math.min(50, n) : 1;
  }
  if (colSet.has('duration_days')) {
    const d = dr.shelfLife ?? dr.shelfLifeDays ?? resolved.shelf_life_days;
    const n = typeof d === 'number' ? d : parseInt(String(d || '1'), 10);
    candidates.duration_days = Number.isFinite(n) && n >= 1 ? Math.min(365, n) : 1;
  }
  if (colSet.has('purchase_type')) {
    candidates.purchase_type = normalizePurchaseType(dr as Record<string, unknown>);
  }
  if (colSet.has('subscription_config') && dr.subscriptionConfig && typeof dr.subscriptionConfig === 'object') {
    candidates.subscription_config = dr.subscriptionConfig;
  }
  if (colSet.has('tax_category_id') && resolved.tax_category_id != null && resolved.tax_category_id !== '') {
    candidates.tax_category_id = resolved.tax_category_id;
  }
  if (
    colSet.has('service_catalog_category_id') &&
    resolved.service_catalog_category_id != null &&
    resolved.service_catalog_category_id !== ''
  ) {
    candidates.service_catalog_category_id = resolved.service_catalog_category_id;
  }

  const keys = Object.keys(candidates).filter((k) => colSet.has(k));
  if (!keys.includes('vendor_id') || !keys.includes('plan_name')) {
    throw new Error('meal_plans mirror: schema missing vendor_id or plan_name');
  }

  const values: unknown[] = keys.map((k) => {
    const v = candidates[k];
    if (jsonbCols.has(k)) {
      if (v === null || v === undefined) return '{}';
      return JSON.stringify(v);
    }
    return v;
  });

  const placeholders = keys.map((k, i) => (jsonbCols.has(k) ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(', ');
  const colList = keys.map((k) => `"${k}"`).join(', ');

  try {
    await query(
      `INSERT INTO meal_plans (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
      values,
    );
  } catch (e) {
    const again = await query(`SELECT 1 FROM meal_plans WHERE id = $1::uuid LIMIT 1`, [idStr]);
    if (again.rows?.length) return;
    console.error('[meal-plan-resolve] ensureMealPlanMirror insert failed:', e);
    throw e;
  }
}

/** Human-readable catalog title from `meal_plans` or nutrition `products` row. */
export async function resolveMealCatalogDisplayName(planId: string): Promise<string | null> {
  const row = await resolveMealPlanOrProductById(planId);
  if (!row) return null;
  const name = String(row.plan_name ?? row.name ?? '').trim();
  return name || null;
}
