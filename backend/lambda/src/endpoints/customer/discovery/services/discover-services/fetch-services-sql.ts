import {
  sqlTrainingCategoryAliasOrVs,
  VET_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL,
} from '../../../../../lib/discovery-vendor-query';
import {
  vendorRoleIsBehaviorHub,
  vendorRoleIsTrainingHub,
} from '../../repos/legacy-helpers.repo';
import type { DiscoverCategoryContext } from './types';

const SITTER_ROLE_NAMES_LOWER = ['pet_sitter', 'sitter', 'sitter_solo', 'pet_sitter_solo', 'pet_sitter_saas'];

export type DiscoverServiceFetchSql = {
  categoryFilterSql: string;
  sittingRelaxedFetchCategorySql: string;
  styleMatchSql: string;
  sitterRoleBypass: boolean;
};

export function buildDiscoverServiceFetchSql(
  categoryCtx: DiscoverCategoryContext,
  vendorRoleName: string | null | undefined,
  isAtCenter: boolean
): DiscoverServiceFetchSql {
  const {
    catTextExact,
    catUUIDs,
    isVetCategoryDiscovery,
    sittingDiscoveryRelaxed,
    boardingDiscoverySearch,
    nutritionDiscoverySearch,
    trainingDiscoverySearch,
    behaviorHubDiscoverySearch,
    walkerCategoryDiscoveryOr,
    boardingCustomCategoryIdOrSql,
    trainingCustomCategoryIdOrSql,
  } = categoryCtx;

  const sitterRoleBypass = sittingDiscoveryRelaxed;

  const boardingUncatSql =
    !sitterRoleBypass &&
    boardingDiscoverySearch &&
    vendorRoleName &&
    ['boarding', 'pet_boarding'].includes(String(vendorRoleName).toLowerCase())
      ? ` OR LOWER(COALESCE(TRIM(vs.category), '')) = ''`
      : '';
  const nutritionUncatSql =
    !sitterRoleBypass &&
    nutritionDiscoverySearch &&
    vendorRoleName &&
    ['pet_nutritionist', 'nutritionist', 'nutritionist_center', 'nutritionist_solo'].includes(
      String(vendorRoleName).toLowerCase()
    )
      ? ` OR LOWER(COALESCE(TRIM(vs.category), '')) = ''`
      : '';
  const trainingUncatSql =
    !sitterRoleBypass &&
    trainingDiscoverySearch &&
    vendorRoleIsTrainingHub(vendorRoleName)
      ? ` OR TRUE`
      : '';
  const vetCategoryEmptyForFetch =
    !sitterRoleBypass && isVetCategoryDiscovery
      ? ` OR (
                (
                  TRIM(COALESCE(vs.category, '')) = ''
                  OR LOWER(TRIM(COALESCE(vs.category, ''))) = 'general'
                )
                AND EXISTS (
                  SELECT 1 FROM vendors v2
                  JOIN roles r2 ON r2.id = v2.role_id
                  WHERE v2.id = $1
                    AND LOWER(TRIM(COALESCE(r2.name, ''))) IN ${VET_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL}
                )
              )`
      : '';
  const trainingCategoryAliasFetchOr =
    !sitterRoleBypass && trainingDiscoverySearch ? ` OR ${sqlTrainingCategoryAliasOrVs('vs')}` : '';
  const behaviorUncatSql =
    !sitterRoleBypass &&
    behaviorHubDiscoverySearch &&
    vendorRoleIsBehaviorHub(vendorRoleName)
      ? ` OR LOWER(COALESCE(TRIM(vs.category), '')) = ''`
      : '';
  const behaviorCategoryAliasFetchOr =
    !sitterRoleBypass && behaviorHubDiscoverySearch ? ` OR ${sqlTrainingCategoryAliasOrVs('vs')}` : '';
  const behaviorTrainingCategoryFetchOr =
    !sitterRoleBypass &&
    behaviorHubDiscoverySearch &&
    vendorRoleIsBehaviorHub(vendorRoleName)
      ? ` OR LOWER(TRIM(COALESCE(vs.category, ''))) = 'training'`
      : '';
  const categoryFilterSql =
    !sitterRoleBypass && (catTextExact.length + catUUIDs.length > 0)
      ? `
          AND (
            ${catTextExact.length > 0 ? `LOWER(COALESCE(vs.category,'')) = ANY($3::text[]) OR LOWER(COALESCE(vs.category,'')) LIKE ANY($4::text[])` : `FALSE`}
            ${catTextExact.length > 0 && catUUIDs.length > 0 ? ` OR ` : ``}
            ${catUUIDs.length > 0 ? `COALESCE(vs.category,'') = ANY($5::text[])` : ``}
            ${boardingUncatSql}
            ${nutritionUncatSql}
            ${trainingUncatSql}
            ${trainingCategoryAliasFetchOr}
            ${behaviorUncatSql}
            ${behaviorCategoryAliasFetchOr}
            ${behaviorTrainingCategoryFetchOr}
            ${walkerCategoryDiscoveryOr}
            ${vetCategoryEmptyForFetch}
            ${boardingCustomCategoryIdOrSql}
            ${trainingCustomCategoryIdOrSql}
          )
        `
      : '';
  const sittingRoleUncategorizedForFetch =
    sitterRoleBypass &&
    sittingDiscoveryRelaxed &&
    vendorRoleName &&
    SITTER_ROLE_NAMES_LOWER.includes(String(vendorRoleName).toLowerCase())
      ? ` OR (
                TRIM(COALESCE(vs.category, '')) = ''
                AND COALESCE(vs.is_custom_service, false) = false
              )`
      : '';
  const sittingExcludeNonSittingSql = sittingDiscoveryRelaxed
    ? `
              AND NOT (
                LOWER(TRIM(COALESCE(vs.category, ''))) = ANY(ARRAY[
                  'walking','walker','dog_walker','dog walking','dog walker','dog_walking',
                  'vet','veterinary','veterinarian','vet care','vet_care',
                  'grooming','training','diagnostics','behaviourist','nutrition','daycare','transport'
                ]::text[])
                OR (
                  LOWER(TRIM(COALESCE(vs.category, ''))) = 'boarding'
                  AND COALESCE(vs.is_custom_service, false) = true
                )
              )`
    : '';
  const sittingRelaxedFetchCategorySql =
    sitterRoleBypass && sittingDiscoveryRelaxed && (catTextExact.length + catUUIDs.length > 0)
      ? `
            AND (
              ${catTextExact.length > 0 ? `LOWER(COALESCE(vs.category,'')) = ANY($3::text[]) OR LOWER(COALESCE(vs.category,'')) LIKE ANY($4::text[])` : `FALSE`}
              ${catTextExact.length > 0 && catUUIDs.length > 0 ? ` OR ` : ``}
              ${catUUIDs.length > 0 ? `COALESCE(vs.category,'') = ANY($5::text[])` : ``}
              OR (
                LOWER(TRIM(COALESCE(vs.category,''))) = 'boarding'
                AND COALESCE(vs.is_custom_service, false) = false
              )
              OR (
                LOWER(TRIM(COALESCE(vs.category, ''))) LIKE '%sitt%'
                AND LOWER(TRIM(COALESCE(vs.category, ''))) NOT LIKE '%babysitt%'
              )
              OR (
                COALESCE(vs.is_custom_service, false) = true
                AND LOWER(TRIM(COALESCE(vs.service_name, ''))) LIKE '%sitt%'
                AND LOWER(TRIM(COALESCE(vs.service_name, ''))) NOT LIKE '%babysitt%'
              )
              ${sittingRoleUncategorizedForFetch}
            )
            ${sittingExcludeNonSittingSql}`
      : '';
  const styleMatchSql =
    sitterRoleBypass && !isAtCenter
      ? `(vs.service_style = ANY($2::text[]) OR vs.service_style IS NULL OR TRIM(COALESCE(vs.service_style, '')) = '')`
      : `vs.service_style = ANY($2::text[])`;

  return {
    categoryFilterSql,
    sittingRelaxedFetchCategorySql,
    styleMatchSql,
    sitterRoleBypass,
  };
}

export function buildDiscoverServiceFetchParams(
  parsed: { acceptableStyles: string[] },
  categoryCtx: DiscoverCategoryContext,
  sittingRelaxedFetchCategorySql: string,
  sitterRoleBypass: boolean,
  vendorId: string
): unknown[] {
  const { acceptableStyles } = parsed;
  const { catTextExact, catTextLike, catUUIDs } = categoryCtx;

  return sitterRoleBypass
    ? sittingRelaxedFetchCategorySql
      ? catTextExact.length > 0
        ? catUUIDs.length > 0
          ? [vendorId, acceptableStyles, catTextExact, catTextLike, catUUIDs]
          : [vendorId, acceptableStyles, catTextExact, catTextLike]
        : [vendorId, acceptableStyles, [], [], catUUIDs]
      : [vendorId, acceptableStyles]
    : (catTextExact.length + catUUIDs.length > 0)
      ? (catTextExact.length > 0
        ? (catUUIDs.length > 0
          ? [vendorId, acceptableStyles, catTextExact, catTextLike, catUUIDs]
          : [vendorId, acceptableStyles, catTextExact, catTextLike])
        : [vendorId, acceptableStyles, [], [], catUUIDs])
      : [vendorId, acceptableStyles];
}
