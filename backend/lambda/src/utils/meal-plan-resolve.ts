/**
 * Resolve a customer meal checkout ID to a row shaped like `meal_plans`,
 * whether the catalog row lives in `meal_plans` or in `products` (nutritionist meal SKUs).
 */

import { query } from '../database/rds-connection';
import { isValidUUID } from '../types/entities';

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
 * Returns a DB-shaped meal plan row for GET /meal-plans/:id and order-preview,
 * or null if neither meal_plans nor products contains a matching meal SKU.
 */
export async function resolveMealPlanOrProductById(planId: string): Promise<Record<string, unknown> | null> {
  const id = String(planId || '').trim();
  if (!id || !isValidUUID(id)) return null;

  try {
    const mpRes = await query(`SELECT * FROM meal_plans WHERE id = $1 LIMIT 1`, [id]);
    if (mpRes.rows?.length) return mpRes.rows[0] as Record<string, unknown>;
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

    const prepLead = meta.preparationLeadTime;
    const shelfLife = meta.shelfLifeDays;

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
      prep_time_minutes: typeof meta.prepTimeMinutes === 'number' ? meta.prepTimeMinutes : 60,
      shelf_life_days: typeof shelfLife === 'number' ? shelfLife : 7,
      storage_instructions:
        typeof meta.storageInstructions === 'string' ? meta.storageInstructions : null,
      serving_instructions:
        typeof meta.feedingInstructions === 'string' ? meta.feedingInstructions : null,
      available_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      order_cutoff_time: '18:00',
      delivery_slots: JSON.stringify(Array.isArray(meta.deliverySlots) ? meta.deliverySlots : []),
      lead_time_hours: typeof prepLead === 'number' ? prepLead : 24,
      is_active: p.is_active !== false,
      dietary_requirements,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[meal-plan-resolve] products lookup failed:', msg);
    return null;
  }
}
