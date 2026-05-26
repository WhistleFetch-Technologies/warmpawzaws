/**
 * Meal plan checkout GST: same Admin catalogue category (e.g. Nutritionist) as services,
 * with tax_categories rows scoped as meal_plan_food (food) and meal_plan_delivery (delivery fee component).
 */

import { query } from '../database/rds-connection';
import {
  resolveCatalogCategoryUuidFromRef,
  resolveGstRateForCatalogAndRole,
} from '../lib/services/gst-catalog-role-resolution';

const CACHE_TTL_MS = 5 * 60 * 1000;
const rateCache = new Map<
  string,
  {
    foodGstPct: number;
    deliveryGstPct: number;
    catalogCategoryId: string | null;
    taxCategoryId: string | null;
    ts: number;
  }
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
 * Returns GST % for meal food (meal_plan_food) and delivery fee (meal_plan_delivery) from Admin GST config.
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
        const roleIdOverride = await resolveVendorRoleId(
          (p.vendor_id ?? p.vendorId) as string | null | undefined,
        );
        let deliveryGstPct = 0;
        if (catalogForResponse) {
          const rd = await resolveGstRateForCatalogAndRole(
            catalogForResponse,
            roleIdOverride,
            'meal_plan_delivery',
          );
          deliveryGstPct =
            Number.isFinite(rd.rate) && rd.rate >= 0 ? Math.min(100, rd.rate) : 0;
        }
        return {
          foodGstPct: Math.min(100, Math.max(0, rate)),
          deliveryGstPct,
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
      foodGstPct: 0,
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
      deliveryGstPct: hit.deliveryGstPct,
      taxCategoryId: hit.taxCategoryId,
      catalogCategoryId: hit.catalogCategoryId ?? catalogId,
    };
  }

  const resolvedFood = await resolveGstRateForCatalogAndRole(catalogId, roleId, 'meal_plan_food');
  const resolvedDelivery = await resolveGstRateForCatalogAndRole(catalogId, roleId, 'meal_plan_delivery');

  let foodGstPct = resolvedFood.rate;
  let deliveryGstPct = resolvedDelivery.rate;
  if (!Number.isFinite(foodGstPct) || foodGstPct < 0) foodGstPct = 0;
  if (!Number.isFinite(deliveryGstPct) || deliveryGstPct < 0) deliveryGstPct = 0;

  rateCache.set(ck, {
    foodGstPct,
    deliveryGstPct,
    catalogCategoryId: catalogId,
    taxCategoryId: resolvedFood.taxCategoryId,
    ts: Date.now(),
  });
  return {
    foodGstPct,
    deliveryGstPct,
    taxCategoryId: resolvedFood.taxCategoryId,
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
