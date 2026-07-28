import { query } from '../../../../database/rds-connection';
import { acceptableStylesForService } from '../../../../lib/search-discovery-parity';
import { wapptCatalogueCustomerVisibleSql } from '../../../warmpawz-appointments/shared/catalogue-eligibility-sql';
import {
  merchantServiceCategoryFilterSql,
} from '../../../warmpawz-appointments/shared/merchant/merchant-role-sql';
import { expandServiceCategoryFilterTokens } from '../../../warmpawz-appointments/shared/merchant/merchant-service-category.resolver';

export type WapptDiscoveryVendorRow = {
  vendor_id: string;
  business_name: string | null;
  owner_name: string | null;
  city: string | null;
  address: string | null;
  profile_image: string | null;
  is_online: boolean;
  role_display_name: string | null;
  role_name: string | null;
  avg_rating: number | null;
  review_count: number | null;
};

const CLINIC_HOME_STYLES = ['at_center', 'at_vendor', 'at_clinic', 'at_home', 'home_visit'];

export async function dbListWapptDiscoveryByCategory(opts: {
  category: string;
  serviceStyle: 'all' | 'at_center' | 'at_home';
  limit: number;
  offset: number;
}): Promise<{ rows: WapptDiscoveryVendorRow[]; total: number }> {
  const conditions: string[] = [
    '(v.is_deleted IS NOT TRUE)',
    wapptCatalogueCustomerVisibleSql('c'),
  ];
  const params: unknown[] = [];

  const categoryTokens = expandServiceCategoryFilterTokens(opts.category);
  if (categoryTokens.length > 0) {
    params.push(categoryTokens.map((t) => t.toLowerCase()));
    conditions.push(merchantServiceCategoryFilterSql(`$${params.length}`));
  }

  const styleFilter =
    opts.serviceStyle === 'all'
      ? CLINIC_HOME_STYLES
      : acceptableStylesForService(opts.serviceStyle);

  params.push(styleFilter);
  const stylesParam = `$${params.length}`;
  conditions.push(`
    EXISTS (
      SELECT 1 FROM vendor_services vs
      WHERE vs.vendor_id = v.id
        AND vs.is_enabled = true
        AND vs.service_style = ANY(${stylesParam}::text[])
        AND vs.service_style NOT IN ('tele', 'online', 'video_consultation')
    )
  `);

  const countSql = `
    SELECT COUNT(DISTINCT v.id)::int AS total
    FROM warmpawz_appointments_vendor_catalog c
    INNER JOIN vendors v ON v.id = c.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    WHERE ${conditions.join(' AND ')}
  `;
  const countResult = await query(countSql, params);
  const total = Number(countResult.rows[0]?.total ?? 0);

  params.push(opts.limit);
  const limitParam = `$${params.length}`;
  params.push(opts.offset);
  const offsetParam = `$${params.length}`;

  const listSql = `
    SELECT
      v.id AS vendor_id,
      v.business_name,
      v.owner_name,
      v.city,
      v.address,
      v.profile_image,
      COALESCE(v.is_online, false) AS is_online,
      r.display_name AS role_display_name,
      r.name AS role_name,
      COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) AS avg_rating,
      COALESCE((SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id), 0) AS review_count
    FROM warmpawz_appointments_vendor_catalog c
    INNER JOIN vendors v ON v.id = c.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY COALESCE(v.business_name, v.owner_name, '') ASC, v.id ASC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const listResult = await query(listSql, params);
  return { rows: listResult.rows as WapptDiscoveryVendorRow[], total };
}
