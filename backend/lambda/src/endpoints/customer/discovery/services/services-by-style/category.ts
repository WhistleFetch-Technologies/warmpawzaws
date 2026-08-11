import { DistanceResolver } from '../../../../../lib/utils/vendor-customer-distance';
import {
  appendVetDiscoveryCategoryAliasKeys,
  appendWalkerDiscoveryCategoryAliasKeys,
  BEHAVIOR_HUB_ROLE_SQL_IN_LIST,
  catTextRequestsBehaviorHub,
  sqlTrainingCategoryAliasOrVs,
  sqlVetHubExcludeNonVetServices,
  sqlVetHubPlaceholderCategoryOr,
  TRAINING_HUB_ROLE_SQL_IN_LIST,
} from '../../../../../lib/discovery-vendor-query';
import { getDiscoveryVendorListSchemaFlags } from '../../../../../utils/discovery-vendor-list-setup';
import * as discover_servicesRepo from '../../repos/discover-services.repo';
import * as services_by_styleRepo from '../../repos/services-by-style.repo';
import { columnExists } from '../../repos/legacy-helpers.repo';
import { buildStrictCustomDiscoverySql } from './category-strict';
import type { ServicesByStyleCategoryContext, ServicesByStyleParsed } from './types';

const isUuid = (s?: string) =>
  !!s &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

export async function buildServicesByStyleCategoryContext(
  parsed: ServicesByStyleParsed
): Promise<ServicesByStyleCategoryContext> {
  const { category, roleId, customerLat, customerLng, customerApproximateByStyle, isAtCenter } = parsed;

  const rawCategoryKeys: string[] = [];
  if (category) rawCategoryKeys.push(String(category));
  if (roleId) rawCategoryKeys.push(String(roleId));
  appendVetDiscoveryCategoryAliasKeys(rawCategoryKeys, category);
  appendWalkerDiscoveryCategoryAliasKeys(rawCategoryKeys, category);
  appendWalkerDiscoveryCategoryAliasKeys(rawCategoryKeys, roleId);
  const catTextExact: string[] = rawCategoryKeys.filter(k => !isUuid(k)).map(k => k.toLowerCase());
  const catTextLike: string[] = catTextExact.map(k => `%${k}%`);
  const catUUIDs: string[] = rawCategoryKeys.filter(k => isUuid(k));
  const isVetCategoryDiscoveryByStyle = catTextExact.some((c) =>
    ['vet', 'vet care', 'veterinary', 'veterinarian'].includes(c)
  );

  const boardingDiscoverySearchByStyle =
    catTextExact.some((c) => ['boarding', 'pet_boarding'].includes(c)) ||
    (roleId &&
      ['pet_boarding', 'boarding'].includes(String(roleId).toLowerCase().replace(/-/g, '_')));

  const trainingDiscoverySearchByStyle = catTextExact.some(
    (c) => c === 'training' || c.includes('training')
  );

  const behaviorHubDiscoverySearchByStyle = catTextRequestsBehaviorHub(catTextExact);

  const categoryOnlyKeys: string[] = [];
  if (category) categoryOnlyKeys.push(String(category));
  const strictFromUuid = categoryOnlyKeys.filter((k) => isUuid(k));
  const strictFromText = categoryOnlyKeys
    .filter((k) => !isUuid(k))
    .map((k) => k.toLowerCase().trim())
    .filter(Boolean);
  let strictCategoryIds: string[] = [...strictFromUuid];
  if (strictFromText.length > 0) {
    const slugRes = await services_by_styleRepo.dbServicesByStyle0(strictFromText).catch(() => ({ rows: [] as { id: string }[] }));
    for (const row of slugRes.rows || []) {
      if (row?.id && !strictCategoryIds.includes(row.id)) strictCategoryIds.push(row.id);
    }
  }
  const hasVsCategoryIdCol = await columnExists('vendor_services', 'category_id');
  const strictCustomDiscoverySql = buildStrictCustomDiscoverySql(
    strictCategoryIds,
    hasVsCategoryIdCol,
    boardingDiscoverySearchByStyle,
    trainingDiscoverySearchByStyle
  );

  let boardingCustomCategoryIdOrByStyleSql = '';
  if (boardingDiscoverySearchByStyle && hasVsCategoryIdCol) {
    const slugResByStyle = await services_by_styleRepo.dbServicesByStyle1().catch(() => ({ rows: [] as { id: string }[] }));
    const idB = (slugResByStyle.rows || []).map((r: any) => r?.id).filter(Boolean);
    const UUID_RE_BS =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const cleanB = idB.filter((id: string) => UUID_RE_BS.test(String(id).trim()));
    if (cleanB.length > 0) {
      const uuidListBs = cleanB.map((id) => `'${String(id).trim()}'::uuid`).join(', ');
      boardingCustomCategoryIdOrByStyleSql = `
                OR (
                  COALESCE(vs.is_custom_service, false) = true
                  AND vs.category_id IS NOT NULL
                  AND vs.category_id = ANY(ARRAY[${uuidListBs}]::uuid[])
                )`;
    }
  }

  const nutritionDiscoverySearchByStyle =
    catTextExact.some(
      (c) =>
        ['nutrition', 'nutritionist', 'pet_nutritionist', 'pet nutritionist'].includes(c) ||
        c.includes('nutritionist') ||
        c === 'pet nutrition' ||
        (c.length >= 8 && c.startsWith('nutrition'))
    ) ||
    (roleId &&
      ['pet_nutritionist', 'nutritionist', 'nutritionist_center', 'nutritionist_solo'].includes(
        String(roleId).toLowerCase().replace(/-/g, '_')
      ));

  const boardingRoleUncategorizedOrByStyle =
    boardingDiscoverySearchByStyle
      ? ` OR (LOWER(COALESCE(TRIM(vs.category), '')) = '' AND LOWER(COALESCE(TRIM(r.name), '')) IN ('boarding', 'pet_boarding'))`
      : '';

  const nutritionRoleUncategorizedOrByStyle =
    nutritionDiscoverySearchByStyle
      ? ` OR (LOWER(COALESCE(TRIM(vs.category), '')) = '' AND LOWER(COALESCE(TRIM(r.name), '')) IN ('pet_nutritionist','nutritionist','nutritionist_center','nutritionist_solo'))`
      : '';

  const trainingRoleUncategorizedOrByStyle =
    trainingDiscoverySearchByStyle
      ? ` OR (LOWER(COALESCE(TRIM(vs.category), '')) = '' AND LOWER(COALESCE(TRIM(r.name), '')) IN (${TRAINING_HUB_ROLE_SQL_IN_LIST}))`
      : '';

  const trainingRoleCenterBypassOrByStyle =
    trainingDiscoverySearchByStyle && isAtCenter
      ? ` OR LOWER(COALESCE(TRIM(r.name), '')) IN (${TRAINING_HUB_ROLE_SQL_IN_LIST})`
      : '';

  const trainingCategoryAliasVendorOrByStyle = trainingDiscoverySearchByStyle
    ? ` OR ${sqlTrainingCategoryAliasOrVs('vs')}`
    : '';

  const behaviorRoleUncategorizedOrByStyle = behaviorHubDiscoverySearchByStyle
    ? ` OR (LOWER(COALESCE(TRIM(vs.category), '')) = '' AND LOWER(COALESCE(TRIM(r.name), '')) IN (${BEHAVIOR_HUB_ROLE_SQL_IN_LIST}))`
    : '';
  const behaviorCategoryAliasVendorOrByStyle = behaviorHubDiscoverySearchByStyle
    ? ` OR ${sqlTrainingCategoryAliasOrVs('vs')}`
    : '';
  const behaviorTrainingCategoryVendorOrByStyle = behaviorHubDiscoverySearchByStyle
    ? ` OR (
              LOWER(TRIM(COALESCE(vs.category, ''))) = 'training'
              AND LOWER(TRIM(COALESCE(r.name, ''))) IN (${BEHAVIOR_HUB_ROLE_SQL_IN_LIST})
            )`
    : '';

  const walkerCategoryDiscoveryOrByStyle =
    catTextExact.some((c) => ['walker', 'walking', 'dog_walker', 'pet_walker'].includes(c))
      ? ` OR (
              vs.service_style = 'at_home'
              AND (
                LOWER(COALESCE(vs.service_name, '')) LIKE '%dog%walk%'
                OR LOWER(COALESCE(vs.service_name, '')) LIKE '%pet%walk%'
                OR (
                  LOWER(COALESCE(vs.service_name, '')) LIKE '%walk%'
                  AND LOWER(COALESCE(vs.service_name, '')) NOT LIKE '%walk-in%'
                )
              )
              AND (
                TRIM(COALESCE(vs.category, '')) = ''
                OR LOWER(COALESCE(vs.category, '')) = ANY(ARRAY['vet', 'veterinarian', 'veterinary', 'vet care', 'grooming', 'other']::text[])
              )
            )`
      : '';

  let walkerCustomCategoryIdOrByStyleSql = '';
  const walkerHubByStyle = catTextExact.some((c) =>
    ['walker', 'walking', 'dog_walker', 'pet_walker', 'dog walker', 'pet walker'].includes(c)
  );
  if (walkerHubByStyle && hasVsCategoryIdCol) {
    const slugResWalk = await discover_servicesRepo
      .dbDiscoverServicesWalkingCategories()
      .catch(() => ({ rows: [] as { id: string }[] }));
    const idsW = (slugResWalk.rows || []).map((r: any) => r?.id).filter(Boolean);
    const UUID_RE_W =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const cleanW = idsW.filter((id: string) => UUID_RE_W.test(String(id).trim()));
    if (cleanW.length > 0) {
      const uuidListW = cleanW.map((id) => `'${String(id).trim()}'::uuid`).join(', ');
      walkerCustomCategoryIdOrByStyleSql = `
                OR (
                  COALESCE(vs.is_custom_service, false) = true
                  AND vs.category_id IS NOT NULL
                  AND vs.category_id = ANY(ARRAY[${uuidListW}]::uuid[])
                )`;
    }
  }

  const vetCategoryEmptyOrByStyle = isVetCategoryDiscoveryByStyle
    ? ` OR ${sqlVetHubPlaceholderCategoryOr('vs', 'v.role_id')}`
    : '';

  const vetExcludeNonVetSqlByStyle = isVetCategoryDiscoveryByStyle
    ? sqlVetHubExcludeNonVetServices('vs')
    : '';

  const { hasLogoUrl, hasVendorSpecializationsCol: hasVendorSpecializationsColByStyle } =
    await getDiscoveryVendorListSchemaFlags();
  const logoCol = hasLogoUrl ? 'v.logo_url' : 'NULL';
  const vendorSpecsJsonbSqlByStyle = hasVendorSpecializationsColByStyle
    ? 'v.specializations'
    : 'NULL::jsonb';

  const distResolverByStyle = new DistanceResolver(customerLat, customerLng, customerApproximateByStyle);

  return {
    catTextExact,
    catTextLike,
    catUUIDs,
    isVetCategoryDiscoveryByStyle,
    boardingDiscoverySearchByStyle,
    trainingDiscoverySearchByStyle,
    behaviorHubDiscoverySearchByStyle,
    strictCustomDiscoverySql,
    boardingCustomCategoryIdOrByStyleSql,
    nutritionDiscoverySearchByStyle,
    boardingRoleUncategorizedOrByStyle,
    nutritionRoleUncategorizedOrByStyle,
    trainingRoleUncategorizedOrByStyle,
    trainingRoleCenterBypassOrByStyle,
    trainingCategoryAliasVendorOrByStyle,
    behaviorRoleUncategorizedOrByStyle,
    behaviorCategoryAliasVendorOrByStyle,
    behaviorTrainingCategoryVendorOrByStyle,
    walkerCategoryDiscoveryOrByStyle,
    walkerCustomCategoryIdOrByStyleSql,
    vetCategoryEmptyOrByStyle,
    vetExcludeNonVetSqlByStyle,
    hasLogoUrl,
    hasVendorSpecializationsColByStyle,
    logoCol,
    vendorSpecsJsonbSqlByStyle,
    distResolverByStyle,
  };
}
