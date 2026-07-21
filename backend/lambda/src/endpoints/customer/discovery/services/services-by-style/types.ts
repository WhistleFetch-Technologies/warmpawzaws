import type { DiscoveryRuleSet } from '../../../../../lib/rule-engine';
import type { DistanceResolver } from '../../../../../lib/utils/vendor-customer-distance';

export type ServicesByStyleParsed = {
  serviceStyle: string;
  serviceStyleNormByStyle: string;
  category: string | undefined;
  roleId: string | undefined;
  problemTitle: string | undefined;
  specializationFilterByStyle: string;
  fullEnrichByStyle: boolean;
  customerLat: number | null;
  customerLng: number | null;
  customerApproximateByStyle: boolean;
  rules: DiscoveryRuleSet;
  sqlOffsetByStyle: number;
  resultOffsetByStyle: number;
  sqlLimitByStyle: number;
  pageSizeByStyle: number;
  maxResults: number;
  radius: number | null;
  maxDistanceKm: number | null;
  minRatingVal: number | null;
  sortBy: string;
  acceptableStyles: string[];
  isAtCenter: boolean;
};

export type ServicesByStyleCategoryContext = {
  catTextExact: string[];
  catTextLike: string[];
  catUUIDs: string[];
  isVetCategoryDiscoveryByStyle: boolean;
  boardingDiscoverySearchByStyle: boolean;
  trainingDiscoverySearchByStyle: boolean;
  behaviorHubDiscoverySearchByStyle: boolean;
  strictCustomDiscoverySql: string;
  boardingCustomCategoryIdOrByStyleSql: string;
  nutritionDiscoverySearchByStyle: boolean;
  boardingRoleUncategorizedOrByStyle: string;
  nutritionRoleUncategorizedOrByStyle: string;
  trainingRoleUncategorizedOrByStyle: string;
  trainingRoleCenterBypassOrByStyle: string;
  trainingCategoryAliasVendorOrByStyle: string;
  behaviorRoleUncategorizedOrByStyle: string;
  behaviorCategoryAliasVendorOrByStyle: string;
  behaviorTrainingCategoryVendorOrByStyle: string;
  walkerCategoryDiscoveryOrByStyle: string;
  vetCategoryEmptyOrByStyle: string;
  vetExcludeNonVetSqlByStyle: string;
  hasLogoUrl: boolean;
  hasVendorSpecializationsColByStyle: boolean;
  logoCol: string;
  vendorSpecsJsonbSqlByStyle: string;
  distResolverByStyle: DistanceResolver;
};

export type VendorSpecBundle = Map<string, { raw: string[]; displayLabels: string[] }>;
export type VendorStatsMap = Map<string, { serviceCount: number; priceMin?: number; priceMax?: number }>;
export type VendorRadiusLookup = Map<
  string,
  { service_radius?: unknown; service_distance_km?: unknown }
>;
