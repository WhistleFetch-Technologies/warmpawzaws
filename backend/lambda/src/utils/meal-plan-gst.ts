/**
 * Meal plan checkout GST: same Admin catalogue category (e.g. Nutritionist) as services,
 * but a dedicated tax_categories row with gst_application_scope = 'meal_plan_food'.
 * Admin edits that row's rate in Finance → GST; no separate "meal delivery fee" tax bucket — delivery GST is 0 here.
 */

import { query } from '../database/rds-connection';
import {
  resolveCatalogCategoryUuidFromRef,
  resolveGstRateForCatalogAndRole,
} from '../lib/services/gst-catalog-role-resolution';

const DEFAULT_MEAL_FOOD_GST = 5;

const CACHE_TTL_MS = 5 * 60 * 1000;
const rateCache = new Map<
  string,
  { foodGstPct: number; catalogCategoryId: string | null; taxCategoryId: string | null; ts: number }
>();

function cacheKey(catalogId: string, roleId: string): string {
  return `${catalogId}|${roleId}`;
}

function parseDietJson(plan: Record<string, unknown>): Record<string, unknown> {
  const raw = plan.dietary_requirements;
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

async function resolveVendorRoleId(vendorId: string | null | undefined): Promise<string | null> {
  const vid = String(vendorId || '').trim();
  if (!vid) return null;
  const r = await query(`SELECT role_id::text AS rid FROM vendors WHERE id = $1::uuid LIMIT 1`, [vid]).catch(
    () => ({ rows: [] }),
  );
  const rid = r.rows?.[0] as { rid?: string } | undefined;
  return rid?.rid ? String(rid.rid) : null;
}

/**
 * Catalogue UUID for meal GST: explicit column → diet JSON ref → Nutritionist master category.
 */
export async function resolveMealPlanCatalogCategoryId(plan: Record<string, unknown>): Promise<string | null> {
  const pinned = plan.service_catalog_category_id ?? plan.serviceCatalogCategoryId;
  if (pinned != null && String(pinned).trim() !== '') {
    const id = String(pinned).trim();
    const fromPinned = await resolveCatalogCategoryUuidFromRef(id);
    if (fromPinned) return fromPinned;
  }
  const diet = parseDietJson(plan);
  const ref =
    (diet.catalogCategoryId as string | undefined) ||
    (diet.catalog_category_id as string | undefined) ||
    (diet.catalogCategoryRef as string | undefined) ||
    (diet.catalog_category_ref as string | undefined);
  if (ref != null && String(ref).trim() !== '') {
    const id = await resolveCatalogCategoryUuidFromRef(String(ref).trim());
    if (id) return id;
  }
  return await resolveCatalogCategoryUuidFromRef('nutritionist');
}

/**
 * Returns GST % for meal plan food from Admin (catalogue + meal_plan_food scope).
 * `deliveryGstPct` is always 0 — no separate meal-delivery tax category.
 */
export async function getMealPlanGstRates(plan?: Record<string, unknown> | null): Promise<{
  foodGstPct: number;
  deliveryGstPct: number;
  taxCategoryId: string | null;
  /** Resolved `service_categories.id` UUID for meal_plan_food GST /tax/calculate */
  catalogCategoryId: string | null;
}> {
  const p = plan ?? {};
  const catalogForResponse = await resolveMealPlanCatalogCategoryId(p);
  const overrideId = p.tax_category_id ?? p.taxCategoryId;
  if (overrideId != null && String(overrideId).trim() !== '') {
    const tid = String(overrideId).trim();
    let r = await query(
      `SELECT default_gst_rate FROM tax_categories WHERE id = $1::uuid AND COALESCE(is_active, true) = true LIMIT 1`,
      [tid],
    ).catch(() => ({ rows: [] }));
    let row = r.rows?.[0] as { default_gst_rate: string | number } | undefined;
    if (!row) {
      r = await query(
        `SELECT tax_rate AS default_gst_rate FROM tax_categories WHERE id = $1::uuid AND COALESCE(is_active, true) = true LIMIT 1`,
        [tid],
      ).catch(() => ({ rows: [] }));
      row = r.rows?.[0] as { default_gst_rate: string | number } | undefined;
    }
    if (row) {
      const rate = parseFloat(String(row.default_gst_rate));
      if (Number.isFinite(rate)) {
        return {
          foodGstPct: rate,
          deliveryGstPct: 0,
          taxCategoryId: tid,
          catalogCategoryId: catalogForResponse,
        };
      }
    }
  }

  const catalogId = catalogForResponse;
  const roleId = await resolveVendorRoleId(
    (p.vendor_id ?? p.vendorId) as string | null | undefined,
  );

  if (!catalogId) {
    return {
      foodGstPct: DEFAULT_MEAL_FOOD_GST,
      deliveryGstPct: 0,
      taxCategoryId: null,
      catalogCategoryId: null,
    };
  }

  const ck = cacheKey(catalogId, roleId || '_');
  const hit = rateCache.get(ck);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return {
      foodGstPct: hit.foodGstPct,
      deliveryGstPct: 0,
      taxCategoryId: hit.taxCategoryId,
      catalogCategoryId: hit.catalogCategoryId ?? catalogId,
    };
  }

  const resolved = await resolveGstRateForCatalogAndRole(catalogId, roleId, 'meal_plan_food');
  let foodGstPct = resolved.rate;
  if (!resolved.taxCategoryId && resolved.rate === 18) {
    foodGstPct = DEFAULT_MEAL_FOOD_GST;
  }
  if (!Number.isFinite(foodGstPct) || foodGstPct < 0) foodGstPct = DEFAULT_MEAL_FOOD_GST;

  rateCache.set(ck, {
    foodGstPct,
    catalogCategoryId: catalogId,
    taxCategoryId: resolved.taxCategoryId,
    ts: Date.now(),
  });
  return {
    foodGstPct,
    deliveryGstPct: 0,
    taxCategoryId: resolved.taxCategoryId,
    catalogCategoryId: catalogId,
  };
}

export function computeMealGstBreakdown(
  foodSubtotal: number,
  deliveryFee: number,
  foodGstPct: number,
  deliveryGstPct: number,
): {
  foodGstAmount: number;
  deliveryGstAmount: number;
  totalGstAmount: number;
  foodGstPct: number;
  deliveryGstPct: number;
} {
  const round = (n: number) => Math.round(n * 100) / 100;
  const foodGst = round((foodSubtotal * foodGstPct) / 100);
  const deliveryGst = round((deliveryFee * deliveryGstPct) / 100);
  return {
    foodGstAmount: foodGst,
    deliveryGstAmount: deliveryGst,
    totalGstAmount: round(foodGst + deliveryGst),
    foodGstPct,
    deliveryGstPct,
  };
}

export function invalidateMealPlanGstCache(): void {
  rateCache.clear();
}
