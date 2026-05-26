/**
 * Resolve every vendor / vendor_identity id that may own meal_orders for a logged-in vendor.
 * Customer orders store meal_orders.vendor_id from meal_plans (or products); those ids can differ
 * from the vendors.id shown in the vendor app when identity rows and phone-linked duplicates exist.
 */

import { query } from '../database/rds-connection';
import { resolveVendorId } from './vendor-resolve';
import {
  getVendorIdsForAvailabilityLookup,
  resolveVendorById,
} from '../endpoints/vendor/endpoints/vendorProfile.vendor';

export type MealOrderVendorLookup = {
  canonicalVendorId: string;
  allIds: string[];
  vendor: { id: string; business_name?: string | null; phone?: string | null } | null;
};

function addId(set: Set<string>, value: unknown): void {
  const s = String(value ?? '').trim();
  if (s) set.add(s);
}

/**
 * Build the vendor id list used by GET /vendor/:vendorId/meal-orders.
 */
export async function getMealOrderVendorLookupIds(paramVendorId: string): Promise<MealOrderVendorLookup> {
  const trimmed = (paramVendorId || '').trim();
  const ids = new Set<string>();
  if (trimmed) ids.add(trimmed);

  const canonicalFromResolve = await resolveVendorId(trimmed);
  addId(ids, canonicalFromResolve);

  let vendor = await resolveVendorById(trimmed);
  if (!vendor && trimmed) {
    vendor = { id: trimmed, business_name: null, phone: null };
  }

  const canonicalVendorId = String(vendor?.id || canonicalFromResolve || trimmed || '');
  addId(ids, canonicalVendorId);

  const lookupBase = canonicalVendorId || trimmed;
  if (lookupBase) {
    for (const id of await getVendorIdsForAvailabilityLookup(lookupBase)) {
      addId(ids, id);
    }
  }

  const phone = vendor?.phone ? String(vendor.phone).trim() : '';
  if (phone) {
    try {
      const samePhoneVendors = await query(
        `SELECT id::text AS id FROM vendors WHERE phone = $1`,
        [phone],
      );
      for (const row of samePhoneVendors.rows || []) {
        addId(ids, row.id);
      }
    } catch {
      /* non-fatal */
    }

    try {
      const viByPhone = await query(`SELECT id::text AS id FROM vendor_identity WHERE phone = $1`, [phone]);
      for (const row of viByPhone.rows || []) {
        addId(ids, row.id);
      }
    } catch {
      /* vendor_identity may be unavailable */
    }
  }

  const idArr = [...ids];
  if (idArr.length > 0) {
    try {
      const planVendors = await query(
        `SELECT DISTINCT vendor_id::text AS vid FROM meal_plans WHERE vendor_id::text = ANY($1::text[])`,
        [idArr],
      );
      for (const row of planVendors.rows || []) {
        addId(ids, row.vid);
      }
    } catch {
      /* non-fatal */
    }

    try {
      const productVendors = await query(
        `SELECT DISTINCT vendor_id::text AS vid FROM products
         WHERE vendor_id::text = ANY($1::text[])
           AND category IN ('meal_plan', 'nutrition', 'food')`,
        [idArr],
      );
      for (const row of productVendors.rows || []) {
        addId(ids, row.vid);
      }
    } catch {
      /* products.category may be missing on older DBs */
    }
  }

  const allIds = [...ids].filter(Boolean);
  return {
    canonicalVendorId,
    allIds: allIds.length > 0 ? allIds : trimmed ? [trimmed] : [],
    vendor: vendor
      ? {
          id: String(vendor.id),
          business_name: vendor.business_name ?? null,
          phone: vendor.phone ?? null,
        }
      : null,
  };
}
