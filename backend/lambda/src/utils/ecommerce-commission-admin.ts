/**
 * Admin helpers for ecommerce commission V2 config read/write.
 */

import { query, insert } from '../database/rds-connection';
import { normalizeCommissionRate } from './ecommerce-commission-settings';

export type CommissionModel = 'category' | 'ownership';

export interface VendorCommissionConfigResponse {
  vendorId: string;
  commissionModel: CommissionModel | null;
  defaultCommissionRate: number | null;
  ownBrandCommissionRate: number | null;
  thirdPartyCommissionRate: number | null;
  categoryRates: Array<{ categoryId: string; categoryName: string; rate: number }>;
}

async function loadCategoryRates(vendorId: string) {
  try {
    const matrixRes = await query(
      `SELECT vccr.category_id::text AS category_id, ec.name AS category_name,
              vccr.commission_rate
       FROM vendor_category_commission_rates vccr
       JOIN ecommerce_categories ec ON ec.id = vccr.category_id
       WHERE vccr.vendor_id = $1 AND vccr.is_active = true
       ORDER BY ec.display_order ASC, ec.name ASC`,
      [vendorId]
    );
    return (matrixRes.rows || []).map((r: Record<string, unknown>) => ({
      categoryId: String(r.category_id),
      categoryName: String(r.category_name ?? ''),
      rate: parseFloat(String(r.commission_rate ?? 0)),
    }));
  } catch {
    return [];
  }
}

export async function getVendorCommissionConfigResponse(
  vendorId: string
): Promise<VendorCommissionConfigResponse> {
  let commissionModel: CommissionModel | null = null;
  let defaultCommissionRate: number | null = null;
  let ownBrandCommissionRate: number | null = null;
  let thirdPartyCommissionRate: number | null = null;

  try {
    const res = await query(
      `SELECT commission_model, default_commission_rate,
              own_brand_commission_rate, third_party_commission_rate
       FROM vendor_commission_config WHERE vendor_id = $1 LIMIT 1`,
      [vendorId]
    );
    const row = res.rows?.[0];
    if (row) {
      const m = String(row.commission_model ?? '');
      if (m === 'category' || m === 'ownership') commissionModel = m;
      defaultCommissionRate = normalizeCommissionRate(row.default_commission_rate);
      ownBrandCommissionRate = normalizeCommissionRate(row.own_brand_commission_rate);
      thirdPartyCommissionRate = normalizeCommissionRate(row.third_party_commission_rate);
    }
  } catch {
    // table may not exist yet
  }

  const categoryRates = await loadCategoryRates(vendorId);

  return {
    vendorId,
    commissionModel,
    defaultCommissionRate,
    ownBrandCommissionRate,
    thirdPartyCommissionRate,
    categoryRates,
  };
}

export function validateVendorCommissionPayload(body: Record<string, unknown>): string | null {
  const model = body.commissionModel ?? body.commission_model;
  if (model !== 'category' && model !== 'ownership') {
    return 'commissionModel must be category or ownership';
  }
  if (model === 'ownership') {
    const own = normalizeCommissionRate(body.ownBrandCommissionRate ?? body.own_brand_commission_rate);
    const third = normalizeCommissionRate(
      body.thirdPartyCommissionRate ?? body.third_party_commission_rate
    );
    if (own == null || third == null) {
      return 'Ownership model requires ownBrandCommissionRate and thirdPartyCommissionRate';
    }
  }
  return null;
}

export async function upsertVendorCommissionConfig(
  vendorId: string,
  body: Record<string, unknown>
): Promise<VendorCommissionConfigResponse> {
  const validationError = validateVendorCommissionPayload(body);
  if (validationError) throw new Error(validationError);

  const commissionModel = String(body.commissionModel ?? body.commission_model) as CommissionModel;
  const defaultRate = normalizeCommissionRate(body.defaultRate ?? body.defaultCommissionRate);
  const ownBrandRate =
    commissionModel === 'ownership'
      ? normalizeCommissionRate(body.ownBrandCommissionRate ?? body.own_brand_commission_rate)
      : null;
  const thirdPartyRate =
    commissionModel === 'ownership'
      ? normalizeCommissionRate(body.thirdPartyCommissionRate ?? body.third_party_commission_rate)
      : null;

  const existing = await query(
    `SELECT vendor_id FROM vendor_commission_config WHERE vendor_id = $1 LIMIT 1`,
    [vendorId]
  );

  if (existing.rows.length > 0) {
    await query(
      `UPDATE vendor_commission_config SET
         commission_model = $2,
         default_commission_rate = $3,
         own_brand_commission_rate = $4,
         third_party_commission_rate = $5,
         updated_at = NOW()
       WHERE vendor_id = $1`,
      [vendorId, commissionModel, defaultRate, ownBrandRate, thirdPartyRate]
    );
  } else {
    await insert('vendor_commission_config', {
      vendor_id: vendorId,
      commission_model: commissionModel,
      default_commission_rate: defaultRate,
      own_brand_commission_rate: ownBrandRate,
      third_party_commission_rate: thirdPartyRate,
    });
  }

  if (commissionModel === 'category') {
    const categoryRates: { categoryId: string; rate: number }[] = Array.isArray(body.categoryRates)
      ? body.categoryRates
      : [];

    for (const entry of categoryRates) {
      const categoryId = String(
        (entry as Record<string, unknown>).categoryId ??
          (entry as Record<string, unknown>).category_id ??
          ''
      ).trim();
      const rate = normalizeCommissionRate((entry as Record<string, unknown>).rate);
      if (!categoryId || rate == null) continue;

      await query(
        `INSERT INTO vendor_category_commission_rates (vendor_id, category_id, commission_rate, is_active, updated_at)
         VALUES ($1, $2, $3, true, NOW())
         ON CONFLICT (vendor_id, category_id) DO UPDATE SET
           commission_rate = EXCLUDED.commission_rate,
           is_active = true,
           updated_at = NOW()`,
        [vendorId, categoryId, rate]
      );
    }

    if (Array.isArray(body.removedCategoryIds)) {
      for (const rawId of body.removedCategoryIds) {
        const categoryId = String(rawId).trim();
        if (!categoryId) continue;
        await query(
          `UPDATE vendor_category_commission_rates
           SET is_active = false, updated_at = NOW()
           WHERE vendor_id = $1 AND category_id = $2`,
          [vendorId, categoryId]
        );
      }
    }
  }

  return getVendorCommissionConfigResponse(vendorId);
}

/** Count active vendor products missing listing_ownership (ownership model guardrail). */
export async function countProductsWithoutListingOwnership(vendorId: string): Promise<number> {
  try {
    const res = await query(
      `SELECT COUNT(*)::int AS c
       FROM products
       WHERE vendor_id = $1::uuid
         AND COALESCE(is_active, true) = true
         AND (listing_ownership IS NULL OR listing_ownership NOT IN ('own_brand', 'third_party'))`,
      [vendorId]
    );
    return res.rows?.[0]?.c ?? 0;
  } catch {
    return 0;
  }
}
