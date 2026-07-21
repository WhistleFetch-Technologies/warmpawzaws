import {
  sqlTrainingCategoryAliasOrVs,
  sqlVendorServiceDiscoverable,
  sqlVetHubExcludeNonVetServices,
  VET_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL,
} from '../../../../../lib/discovery-vendor-query';
import {
  vendorRoleIsBehaviorHub,
  vendorRoleIsTrainingHub,
} from '../../repos/legacy-helpers.repo';
import type { ServicesByStyleCategoryContext } from './types';

export type ByStyleServiceFetchSql = {
  categoryFilterSql: string;
  strictCustomSqlForFetch: string;
  vetExcludeForFetchByStyle: string;
};

export function buildByStyleServiceFetchSql(
  categoryCtx: ServicesByStyleCategoryContext,
  vendorRoleName: string | null | undefined
): ByStyleServiceFetchSql {
  const {
    catTextExact,
    catUUIDs,
    isVetCategoryDiscoveryByStyle,
    boardingDiscoverySearchByStyle,
    nutritionDiscoverySearchByStyle,
    trainingDiscoverySearchByStyle,
    behaviorHubDiscoverySearchByStyle,
    strictCustomDiscoverySql,
    boardingCustomCategoryIdOrByStyleSql,
    walkerCategoryDiscoveryOrByStyle,
  } = categoryCtx;

  const boardingUncatSqlByStyle =
    boardingDiscoverySearchByStyle &&
    vendorRoleName &&
    ['boarding', 'pet_boarding'].includes(String(vendorRoleName).toLowerCase())
      ? ` OR LOWER(COALESCE(TRIM(vs.category), '')) = ''`
      : '';
  const nutritionUncatSqlByStyle =
    nutritionDiscoverySearchByStyle &&
    vendorRoleName &&
    ['pet_nutritionist', 'nutritionist', 'nutritionist_center', 'nutritionist_solo'].includes(
      String(vendorRoleName).toLowerCase()
    )
      ? ` OR LOWER(COALESCE(TRIM(vs.category), '')) = ''`
      : '';
  const trainingUncatSqlByStyle =
    trainingDiscoverySearchByStyle && vendorRoleIsTrainingHub(vendorRoleName)
      ? ` OR TRUE`
      : '';
  const trainingCategoryAliasFetchOrByStyle = trainingDiscoverySearchByStyle
    ? ` OR ${sqlTrainingCategoryAliasOrVs('vs')}`
    : '';
  const behaviorUncatSqlByStyle =
    behaviorHubDiscoverySearchByStyle && vendorRoleIsBehaviorHub(vendorRoleName)
      ? ` OR LOWER(COALESCE(TRIM(vs.category), '')) = ''`
      : '';
  const behaviorCategoryAliasFetchOrByStyle = behaviorHubDiscoverySearchByStyle
    ? ` OR ${sqlTrainingCategoryAliasOrVs('vs')}`
    : '';
  const behaviorTrainingCategoryFetchOrByStyle =
    behaviorHubDiscoverySearchByStyle && vendorRoleIsBehaviorHub(vendorRoleName)
      ? ` OR LOWER(TRIM(COALESCE(vs.category, ''))) = 'training'`
      : '';
  const vetCategoryEmptyForFetchByStyle = isVetCategoryDiscoveryByStyle
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
  const categoryFilterSql = (catTextExact.length + catUUIDs.length > 0) ? `
          AND (
            ${catTextExact.length > 0 ? `LOWER(COALESCE(vs.category,'')) = ANY($3::text[]) OR LOWER(COALESCE(vs.category,'')) LIKE ANY($4::text[])` : `FALSE`}
            ${catTextExact.length > 0 && catUUIDs.length > 0 ? ` OR ` : ``}
            ${catUUIDs.length > 0 ? `COALESCE(vs.category,'') = ANY($5::text[])` : ``}
            ${boardingUncatSqlByStyle}
            ${nutritionUncatSqlByStyle}
            ${trainingUncatSqlByStyle}
            ${trainingCategoryAliasFetchOrByStyle}
            ${behaviorUncatSqlByStyle}
            ${behaviorCategoryAliasFetchOrByStyle}
            ${behaviorTrainingCategoryFetchOrByStyle}
            ${walkerCategoryDiscoveryOrByStyle}
            ${vetCategoryEmptyForFetchByStyle}
            ${boardingCustomCategoryIdOrByStyleSql}
          )
        ` : '';
  const strictCustomSqlForFetch =
    trainingDiscoverySearchByStyle && vendorRoleIsTrainingHub(vendorRoleName)
      ? ''
      : strictCustomDiscoverySql;

  const vetExcludeForFetchByStyle = isVetCategoryDiscoveryByStyle
    ? sqlVetHubExcludeNonVetServices('vs')
    : '';

  return {
    categoryFilterSql,
    strictCustomSqlForFetch,
    vetExcludeForFetchByStyle,
  };
}

export function buildByStyleServiceFetchParams(
  parsed: { acceptableStyles: string[] },
  categoryCtx: ServicesByStyleCategoryContext,
  vendorId: string
): unknown[] {
  const { acceptableStyles } = parsed;
  const { catTextExact, catTextLike, catUUIDs } = categoryCtx;

  return (catTextExact.length + catUUIDs.length > 0)
    ? (catTextExact.length > 0
      ? (catUUIDs.length > 0
        ? [vendorId, acceptableStyles, catTextExact, catTextLike, catUUIDs]
        : [vendorId, acceptableStyles, catTextExact, catTextLike])
      : [vendorId, acceptableStyles, [], [], catUUIDs])
    : [vendorId, acceptableStyles];
}
