/**
 * Admin banner destination dropdown options — categories, service styles, vendors.
 */

import { query } from '../database/rds-connection';
import {
  getSearchCategoryAliases,
  labelForBannerServiceStyle,
  mapCatalogCategoryIdToCustomerHomeScreen,
  normalizeBannerServiceStyle,
  normalizeCategoryToken,
} from '@warmpawz/service-launch-mappings';

export type BannerDestinationCategory = {
  id: string;
  categoryId: string;
  name: string;
  customerScreen: string;
  displayOrder: number;
};

export type BannerDestinationServiceStyle = {
  value: string;
  label: string;
};

export type BannerDestinationVendor = {
  id: string;
  businessName: string;
  category: string | null;
  roleName: string | null;
};

function vendorMatchesCategoryAliases(
  categoryId: string,
  vendorCategory: string | null,
  roleName: string | null
): boolean {
  const aliases = getSearchCategoryAliases(categoryId);
  if (!aliases.length) return false;
  const cat = normalizeCategoryToken(vendorCategory);
  const role = normalizeCategoryToken(roleName);
  return aliases.some((a) => {
    if (!a) return false;
    if (cat && (cat.includes(a) || a.includes(cat))) return true;
    if (role && (role.includes(a) || a.includes(role))) return true;
    return false;
  });
}

export async function listBannerDestinationCategories(): Promise<BannerDestinationCategory[]> {
  const { rows } = await query(
    `SELECT
       id::text AS id,
       COALESCE(category_id::text, '') AS category_id,
       name::text AS name,
       COALESCE(display_order::integer, 0) AS display_order
     FROM service_categories
     WHERE (is_active = true OR is_active IS NULL)
       AND COALESCE(customer_dashboard_card_active, true) = true
     ORDER BY display_order ASC NULLS LAST, name ASC
     LIMIT 1000`
  ).catch(() => ({ rows: [] }));

  const out: BannerDestinationCategory[] = [];
  const seenScreens = new Set<string>();

  for (const row of rows as Array<Record<string, unknown>>) {
    const categoryId = String(row.category_id ?? '').trim();
    if (!categoryId) continue;
    const customerScreen = mapCatalogCategoryIdToCustomerHomeScreen(categoryId);
    if (!customerScreen) continue;
    if (seenScreens.has(customerScreen)) continue;
    seenScreens.add(customerScreen);
    out.push({
      id: String(row.id ?? categoryId),
      categoryId,
      name: String(row.name ?? categoryId).trim() || categoryId,
      customerScreen,
      displayOrder: Number(row.display_order ?? 0) || 0,
    });
  }

  return out;
}

async function listServiceStylesForCategory(categoryId: string): Promise<BannerDestinationServiceStyle[]> {
  const vendors = await listVendorsForCategory(categoryId);
  if (!vendors.length) return [];

  const vendorIds = vendors.map((v) => v.id);
  const styleSet = new Set<string>();

  const vendorStyleResult = await query(
    `SELECT DISTINCT vs.service_style
     FROM vendor_services vs
     WHERE vs.vendor_id = ANY($1::uuid[])
       AND vs.is_enabled = true
       AND (
         vs.publish_status IS NULL
         OR LOWER(TRIM(COALESCE(vs.publish_status::text, ''))) IN ('published', 'auto_published')
       )
       AND vs.service_style IS NOT NULL
       AND TRIM(vs.service_style::text) <> ''`,
    [vendorIds]
  ).catch(() => ({ rows: [] }));

  for (const row of vendorStyleResult.rows as Array<{ service_style: string }>) {
    const style = normalizeBannerServiceStyle(row.service_style);
    if (style) styleSet.add(style);
  }

  const order = ['at_center', 'at_home', 'tele'];
  return order
    .filter((s) => styleSet.has(s))
    .map((value) => ({ value, label: labelForBannerServiceStyle(value) }));
}

async function listVendorsForCategory(categoryId: string): Promise<BannerDestinationVendor[]> {
  const { rows } = await query(
    `SELECT v.id::text AS id, v.business_name, v.category, r.name AS role_name
     FROM vendors v
     LEFT JOIN roles r ON r.id = v.role_id
     WHERE v.status IN ('approved', 'active')
       AND COALESCE(v.is_active, true) = true
     ORDER BY v.business_name ASC
     LIMIT 2000`
  ).catch(() => ({ rows: [] }));

  return (rows as Array<{ id: string; business_name: string; category: string; role_name: string }>)
    .filter((v) => vendorMatchesCategoryAliases(categoryId, v.category, v.role_name))
    .map((v) => ({
      id: String(v.id),
      businessName: String(v.business_name ?? '').trim(),
      category: v.category != null ? String(v.category) : null,
      roleName: v.role_name != null ? String(v.role_name) : null,
    }));
}

export async function getBannerDestinationOptions(categoryId?: string | null): Promise<{
  categories: BannerDestinationCategory[];
  serviceStyles: BannerDestinationServiceStyle[];
  vendors: BannerDestinationVendor[];
}> {
  const categories = await listBannerDestinationCategories();
  const trimmedCategoryId = String(categoryId ?? '').trim();

  if (!trimmedCategoryId) {
    return { categories, serviceStyles: [], vendors: [] };
  }

  const [serviceStyles, vendors] = await Promise.all([
    listServiceStylesForCategory(trimmedCategoryId),
    listVendorsForCategory(trimmedCategoryId),
  ]);

  return { categories, serviceStyles, vendors };
}
