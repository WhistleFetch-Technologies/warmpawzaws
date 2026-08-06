import { query } from '../../../../database/rds-connection';
import { acceptableStylesForService } from '../../../../lib/search-discovery-parity';
import {
  resolveSpecializationDiscoveryKeys,
  specializationDiscoveryIlikePatterns,
  sqlVendorMatchesDeclaredSpecialization,
} from '../../discovery/repos/legacy-helpers.repo';
import { wapptCatalogueCustomerVisibleSql } from '../../../warmpawz-appointments/shared/catalogue-eligibility-sql';
import { merchantServiceCategoryFilterSql } from '../../../warmpawz-appointments/shared/merchant/merchant-role-sql';
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
  vendor_type: string | null;
  preferred_service_style: string | null;
  avg_rating: number | null;
  review_count: number | null;
};

const CLINIC_HOME_STYLES = ['at_center', 'at_vendor', 'at_clinic', 'at_home', 'home_visit'];
const TELE_STYLES = ['tele', 'online', 'video_consultation'];

export type WapptDiscoveryServiceStyle = 'all' | 'at_center' | 'at_home' | 'tele';

/** Role-negative SQL — mirrors client hub filters for mis-tagged catalogue rows. */
function wapptRoleNegativeFilterSql(category: string): string | null {
  const hub = String(category ?? '').trim().toLowerCase();
  const roleBlob = `LOWER(COALESCE(r.name, '') || ' ' || COALESCE(r.display_name, ''))`;
  if (hub === 'grooming') {
    return `NOT (${roleBlob} ~ '(veterinar|vet[_ ]|trainer|walker|boarding|nutrition|sitter)')`;
  }
  if (hub === 'training') {
    return `NOT (${roleBlob} ~ '(veterinar|vet[_ ]|groomer|walker|boarding|nutrition|sitter|behaviorist|behaviourist)')`;
  }
  if (hub === 'behaviorist' || hub === 'behaviourist' || hub === 'pet_behaviorist') {
    return `NOT (${roleBlob} ~ '(veterinar|vet[_ ]|groomer|walker|boarding|nutrition|sitter|trainer|train[_ ])')`;
  }
  return null;
}

export async function dbListWapptDiscoveryByCategory(opts: {
  category: string;
  serviceStyle: WapptDiscoveryServiceStyle;
  specialization?: string | null;
  limit: number;
  offset: number;
}): Promise<{ rows: WapptDiscoveryVendorRow[]; hasMore: boolean; specializationApplied: string | null }> {
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

  const roleNegative = wapptRoleNegativeFilterSql(opts.category);
  if (roleNegative) {
    conditions.push(roleNegative);
  }

  if (opts.serviceStyle === 'tele') {
    params.push(TELE_STYLES);
    const teleStylesParam = `$${params.length}`;
    conditions.push(`
    EXISTS (
      SELECT 1 FROM vendor_services vs
      WHERE vs.vendor_id = v.id
        AND vs.is_enabled = true
        AND vs.service_style = ANY(${teleStylesParam}::text[])
    )
  `);
  } else {
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
  }

  let specializationApplied: string | null = null;
  const specializationFilter = String(opts.specialization ?? '').trim();
  if (specializationFilter) {
    const specKeys = await resolveSpecializationDiscoveryKeys(specializationFilter);
    if (specKeys.length > 0) {
      const paramBase = params.length + 1;
      const specializationFragment = sqlVendorMatchesDeclaredSpecialization(paramBase)
        .trim()
        .replace(/^\s*AND\s+/i, '');
      conditions.push(specializationFragment);
      params.push(
        specKeys.map((k) => k.trim().toLowerCase()),
        specializationDiscoveryIlikePatterns(specKeys),
      );
      specializationApplied = specializationFilter;
    }
  }

  params.push(opts.limit + 1);
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
      v.vendor_type,
      (
        SELECT vs.service_style
        FROM vendor_services vs
        WHERE vs.vendor_id = v.id
          AND vs.is_enabled = true
          AND vs.service_style = ANY(ARRAY['at_center','at_vendor','at_clinic','at_home','home_visit']::text[])
        GROUP BY vs.service_style
        ORDER BY COUNT(*) DESC, vs.service_style ASC
        LIMIT 1
      ) AS preferred_service_style,
      COALESCE(rv.avg_rating, 0) AS avg_rating,
      COALESCE(rv.review_count, 0) AS review_count
    FROM warmpawz_appointments_vendor_catalog c
    INNER JOIN vendors v ON v.id = c.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    LEFT JOIN (
      SELECT vendor_id, AVG(rating)::float AS avg_rating, COUNT(*)::int AS review_count
      FROM reviews
      GROUP BY vendor_id
    ) rv ON rv.vendor_id = v.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY COALESCE(v.business_name, v.owner_name, '') ASC, v.id ASC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const listResult = await query(listSql, params);
  const allRows = listResult.rows as WapptDiscoveryVendorRow[];
  const hasMore = allRows.length > opts.limit;
  const rows = hasMore ? allRows.slice(0, opts.limit) : allRows;
  return { rows, hasMore, specializationApplied };
}
