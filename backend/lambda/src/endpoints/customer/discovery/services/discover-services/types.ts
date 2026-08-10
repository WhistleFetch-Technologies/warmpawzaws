import type { DiscoveryRuleSet } from '../../../../../lib/rule-engine';
import type { DistanceResolver } from '../../../../../lib/utils/vendor-customer-distance';

export type DiscoverServicesParsed = {
  serviceStyle: string;
  serviceStyleNormDiscover: string;
  category: string | undefined;
  roleId: string | undefined;
  problemTitle: string | undefined;
  specializationFilterDiscover: string;
  fullEnrichDiscover: boolean;
  customerLat: number | null;
  customerLng: number | null;
  customerApproximateDiscover: boolean;
  rules: DiscoveryRuleSet;
  sqlOffset: number;
  resultOffset: number;
  sqlLimit: number;
  pageSize: number;
  maxResults: number;
  radius: number | null;
  maxDistanceKm: number | null;
  minRatingVal: number | null;
  sortBy: string;
  acceptableStyles: string[];
  isAtCenter: boolean;
};

export type DiscoverCategoryContext = {
  catTextExact: string[];
  catTextLike: string[];
  catUUIDs: string[];
  isVetCategoryDiscovery: boolean;
  sittingDiscoveryRelaxed: boolean;
  boardingDiscoverySearch: boolean;
  nutritionDiscoverySearch: boolean;
  trainingDiscoverySearch: boolean;
  behaviorHubDiscoverySearch: boolean;
  walkerCategoryDiscoveryOr: string;
  boardingCustomCategoryIdOrSql: string;
  trainingCustomCategoryIdOrSql: string;
  walkerCustomCategoryIdOrSql: string;
  hasLogoUrl: boolean;
  hasVendorSpecializationsCol: boolean;
  logoCol: string;
  vendorSpecsJsonbSql: string;
  distResolverDiscover: DistanceResolver;
};

export type VendorSpecBundle = Map<string, { raw: string[]; displayLabels: string[] }>;
export type VendorStatsMap = Map<string, { serviceCount: number; priceMin?: number; priceMax?: number }>;
export type VendorRadiusLookup = Map<
  string,
  { service_radius?: unknown; service_distance_km?: unknown }
>;
