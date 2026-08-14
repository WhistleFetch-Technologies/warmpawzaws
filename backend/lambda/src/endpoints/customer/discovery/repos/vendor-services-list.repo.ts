import { query } from '../../../../database/rds-connection';
import {
  BEHAVIOR_HUB_ROLE_SQL_IN_LIST,
  isVetHubCategoryRequest,
  sqlTrainingCategoryAliasOrVs,
  sqlVendorServicesHubCategoryFilter,
  sqlVetHubExcludeNonVetServices,
  TRAINING_HUB_ROLE_SQL_IN_LIST,
  vendorServicesHubCategoryBindParams,
} from '../../../../lib/discovery-vendor-query';
import { acceptableStylesForService, columnExists } from './legacy-helpers.repo';
import * as vendorServicesRepo from './vendor-services.repo';

const VENDOR_SERVICES_SELECT = `
  SELECT
    vs.id,
    vs.service_id,
    vs.service_name,
    vs.service_style,
    vs.price,
    vs.custom_price,
    vs.duration_minutes,
    vs.custom_duration,
    vs.custom_description,
    vs.category,
    vs.sub_category,
    vs.metadata as vs_metadata,
    vs.publish_status,
    s.name as base_name,
    s.description as base_description,
    sc.service_name as catalog_name,
    sc.display_name as catalog_display_name,
    sc.description as catalog_description,
    sc.specialization_ids as catalog_specialization_ids,
    sc.category_id as catalog_category_id,
    sc.category_name as catalog_category_name,
    sc.service_id as catalog_service_id,
    COALESCE(sc.category_name, vs.category) as resolved_category
  FROM vendor_services vs
  LEFT JOIN services s ON vs.service_id = s.id
  LEFT JOIN service_catalog sc ON vs.service_id = sc.id
  WHERE vs.vendor_id = $1
    AND (vs.is_enabled = true OR vs.is_enabled IS NULL)
    AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
`;

async function appendCategoryFilter(
  servicesQuery: string,
  queryParams: unknown[],
  category: string,
  options?: { vendorDetailListing?: boolean }
): Promise<string> {
  const catLower = String(category).toLowerCase().trim().replace(/-/g, '_');
  const sittingBookingCategoryRequest =
    catLower === 'sitting' ||
    catLower === 'pet_sitter' ||
    catLower === 'sitter' ||
    catLower === 'sitter_solo' ||
    catLower === 'pet_sitting';
  const boardingBookingCategoryRequest = catLower === 'boarding' || catLower === 'pet_boarding';
  const trainingOnlyBookingCategoryRequest =
    catLower === 'training' || catLower === 'pet_training' || catLower === 'dog_training';
  const behaviorBookingCategoryRequest = catLower === 'behaviorist' || catLower === 'behaviourist';
  const trainingBookingCategoryRequest =
    trainingOnlyBookingCategoryRequest || behaviorBookingCategoryRequest;

  const hubBind = vendorServicesHubCategoryBindParams(category);
  if (hubBind) {
    queryParams.push(hubBind.exact, hubBind.like);
    const exactP = queryParams.length - 1;
    const likeP = queryParams.length;
    const hubSql = sqlVendorServicesHubCategoryFilter(category, 'vs', exactP, likeP);
    let out = servicesQuery + (hubSql || '');
    // Vendor profile (GET /customer/vendor/:id/services): show full published catalog for this
    // vendor — do not strip grooming/training rows. Hub search/by-style keeps the exclude.
    if (isVetHubCategoryRequest(category) && !options?.vendorDetailListing) {
      out += sqlVetHubExcludeNonVetServices('vs');
    }
    return out;
  }
  if (sittingBookingCategoryRequest) {
    queryParams.push(category);
    const catParam = queryParams.length;
    return `${servicesQuery} AND (
      (LOWER(COALESCE(vs.category, '')) = LOWER($${catParam}) OR LOWER(COALESCE(vs.category, '')) LIKE '%' || LOWER($${catParam}) || '%')
      OR (LOWER(TRIM(COALESCE(vs.category,''))) = 'boarding' AND COALESCE(vs.is_custom_service, false) = false)
      OR (LOWER(TRIM(COALESCE(vs.category, ''))) LIKE '%sitt%' AND LOWER(TRIM(COALESCE(vs.category, ''))) NOT LIKE '%babysitt%')
      OR (COALESCE(vs.is_custom_service, false) = true AND LOWER(TRIM(COALESCE(vs.service_name, ''))) LIKE '%sitt%' AND LOWER(TRIM(COALESCE(vs.service_name, ''))) NOT LIKE '%babysitt%')
      OR (TRIM(COALESCE(vs.category, '')) = '' AND COALESCE(vs.is_custom_service, false) = false AND EXISTS (
        SELECT 1 FROM vendors v_sit LEFT JOIN roles r_sit ON v_sit.role_id = r_sit.id
        WHERE v_sit.id = vs.vendor_id AND LOWER(COALESCE(TRIM(r_sit.name), '')) IN ('pet_sitter','sitter','sitter_solo','pet_sitter_solo','pet_sitter_saas')
      ))
    ) AND NOT (
      LOWER(TRIM(COALESCE(vs.category, ''))) = ANY(ARRAY['walking','walker','dog_walker','dog walking','dog walker','dog_walking','vet','veterinary','veterinarian','vet care','vet_care','grooming','training','diagnostics','behaviourist','nutrition','daycare','transport']::text[])
      OR (LOWER(TRIM(COALESCE(vs.category, ''))) = 'boarding' AND COALESCE(vs.is_custom_service, false) = true)
    )`;
  }
  if (boardingBookingCategoryRequest) {
    queryParams.push(category);
    const catParam = queryParams.length;
    let boardingCatIdOr = '';
    const hasVsCatColBooking = await columnExists('vendor_services', 'category_id');
    if (hasVsCatColBooking) {
      const brSlug = await vendorServicesRepo.dbVendorServices3().catch(() => ({ rows: [] as { id: string }[] }));
      const bids = (brSlug.rows || []).map((r: { id?: string }) => r?.id).filter(Boolean);
      const UUID_RE_B = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const bclean = bids.filter((id: string) => UUID_RE_B.test(String(id).trim()));
      if (bclean.length > 0) {
        const uuidListB = bclean.map((id) => `'${String(id).trim()}'::uuid`).join(', ');
        boardingCatIdOr = ` OR (COALESCE(vs.is_custom_service, false) = true AND vs.category_id IS NOT NULL AND vs.category_id = ANY(ARRAY[${uuidListB}]::uuid[]))`;
      }
    }
    return `${servicesQuery} AND (
      (LOWER(COALESCE(vs.category, '')) = LOWER($${catParam}) OR LOWER(COALESCE(vs.category, '')) LIKE '%' || LOWER($${catParam}) || '%')
      ${boardingCatIdOr}
    )`;
  }
  if (trainingBookingCategoryRequest) {
    queryParams.push(category);
    const catParam = queryParams.length;
    const emptyCatRoleSqlList = behaviorBookingCategoryRequest
      ? BEHAVIOR_HUB_ROLE_SQL_IN_LIST
      : TRAINING_HUB_ROLE_SQL_IN_LIST;
    const trainingLabeledServicesForBehaviorOnly =
      behaviorBookingCategoryRequest && !trainingOnlyBookingCategoryRequest
        ? ` OR (LOWER(TRIM(COALESCE(vs.category, ''))) = 'training' AND EXISTS (
            SELECT 1 FROM vendors v_tr LEFT JOIN roles r_tr ON v_tr.role_id = r_tr.id
            WHERE v_tr.id = vs.vendor_id AND LOWER(COALESCE(TRIM(r_tr.name), '')) IN (${BEHAVIOR_HUB_ROLE_SQL_IN_LIST})
          ))`
        : '';
    return `${servicesQuery} AND (
      (LOWER(COALESCE(vs.category, '')) = LOWER($${catParam}) OR LOWER(COALESCE(vs.category, '')) LIKE '%' || LOWER($${catParam}) || '%')
      OR ${sqlTrainingCategoryAliasOrVs('vs')}
      OR (TRIM(COALESCE(vs.category, '')) = '' AND EXISTS (
        SELECT 1 FROM vendors v_tr LEFT JOIN roles r_tr ON v_tr.role_id = r_tr.id
        WHERE v_tr.id = vs.vendor_id AND LOWER(COALESCE(TRIM(r_tr.name), '')) IN (${emptyCatRoleSqlList})
      ))
      ${trainingLabeledServicesForBehaviorOnly}
    )`;
  }
  queryParams.push(category);
  const catParam = queryParams.length;
  return `${servicesQuery} AND (LOWER(COALESCE(vs.category, '')) = LOWER($${catParam}) OR LOWER(COALESCE(vs.category, '')) LIKE '%' || LOWER($${catParam}) || '%')`;
}

export async function dbFetchVendorServicesList(args: {
  vendorId: string;
  category?: string | null;
  serviceStyle?: string | null;
  /** True for GET /customer/vendor/:vendorId/services — full vendor catalog on profile. */
  vendorDetailListing?: boolean;
}) {
  const { vendorId, category, serviceStyle, vendorDetailListing } = args;
  let servicesQuery = VENDOR_SERVICES_SELECT;
  const queryParams: unknown[] = [vendorId];

  if (category) {
    servicesQuery = await appendCategoryFilter(servicesQuery, queryParams, category, {
      vendorDetailListing,
    });
  }
  if (serviceStyle && serviceStyle !== 'all') {
    const acceptableStyles = acceptableStylesForService(serviceStyle);
    queryParams.push(acceptableStyles);
    servicesQuery += ` AND vs.service_style = ANY($${queryParams.length}::text[])`;
  }
  servicesQuery += ` ORDER BY vs.category, vs.service_name`;
  return query(servicesQuery, queryParams);
}
