import {
  getSearchCategoryAliases,
  mapCatalogSlugToLaunchServiceId,
  normalizeCategoryToken,
} from '@warmpawz/service-launch-mappings';
import { serviceCategoryFromRoleConfig } from './merchant-category.resolver';

export const LAUNCH_SERVICE_LABELS: Readonly<Record<string, string>> = {
  vet: 'Vet',
  grooming: 'Grooming',
  training: 'Training',
  shop: 'Shop',
  walker: 'Walking',
  boarding: 'Boarding',
  adoption: 'Adoption',
  cafes: 'Cafes',
  photography: 'Photography',
  insurance: 'Insurance',
  breeder: 'Breeder',
  ambulance: 'Ambulance',
  nutritionist: 'Nutrition',
  relocation: 'Relocation',
  resort: 'Resort',
  holiday: 'Holiday',
  sunset: 'Sunset',
  sitter: 'Sitting',
  'pet-sitter': 'Sitting',
  diagnostics: 'Diagnostics',
  specialty: 'Specialty',
  unknown: 'Unknown',
};

export interface MerchantServiceCategoryInput {
  readonly customerService?: string | null;
  readonly roleCategory?: string | null;
  readonly roleConfig?: unknown;
  readonly legacyCategory?: string | null;
  readonly roleName?: string | null;
  readonly roleDisplayName?: string | null;
}

export interface MerchantServiceCategoryResult {
  readonly serviceCategoryId: string;
  readonly serviceCategory: string;
  readonly roleLabel: string;
  readonly categoryDisplay: string;
}

function formatTokenLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeToken(value: string | null | undefined): string | null {
  const token = normalizeCategoryToken(value);
  return token.length > 0 ? token : null;
}

export function resolveRoleLabel(input: {
  readonly roleDisplayName?: string | null;
  readonly roleName?: string | null;
}): string {
  const displayName = String(input.roleDisplayName ?? '').trim();
  if (displayName) {
    return displayName;
  }

  const roleName = String(input.roleName ?? '').trim();
  if (roleName) {
    return formatTokenLabel(roleName);
  }

  return 'Unknown';
}

export function launchServiceLabel(serviceId: string): string {
  const normalized = serviceId.trim().toLowerCase();
  return LAUNCH_SERVICE_LABELS[normalized] ?? formatTokenLabel(normalized);
}

function resolveServiceCategoryId(input: MerchantServiceCategoryInput): string {
  const customerService = normalizeToken(input.customerService);
  if (customerService) {
    return mapCatalogSlugToLaunchServiceId(customerService);
  }

  const configService = serviceCategoryFromRoleConfig(input.roleConfig);
  if (configService) {
    return mapCatalogSlugToLaunchServiceId(configService);
  }

  const roleCategory = normalizeToken(input.roleCategory);
  if (roleCategory) {
    return mapCatalogSlugToLaunchServiceId(roleCategory);
  }

  const legacyCategory = normalizeToken(input.legacyCategory);
  if (legacyCategory) {
    return mapCatalogSlugToLaunchServiceId(legacyCategory);
  }

  const roleName = normalizeToken(input.roleName);
  if (roleName) {
    return mapCatalogSlugToLaunchServiceId(roleName);
  }

  return 'unknown';
}

export function resolveMerchantServiceCategory(
  input: MerchantServiceCategoryInput,
): MerchantServiceCategoryResult {
  const serviceCategoryId = resolveServiceCategoryId(input);
  const serviceCategory = launchServiceLabel(serviceCategoryId);
  const roleLabel = resolveRoleLabel(input);

  let categoryDisplay = serviceCategory;
  if (serviceCategoryId !== 'unknown' && roleLabel !== 'Unknown') {
    categoryDisplay = `${serviceCategory} · ${roleLabel}`;
  } else if (roleLabel !== 'Unknown') {
    categoryDisplay = roleLabel;
  }

  return {
    serviceCategoryId,
    serviceCategory,
    roleLabel,
    categoryDisplay,
  };
}

export function isServiceCategoryConfigured(result: MerchantServiceCategoryResult): boolean {
  return result.serviceCategoryId !== 'unknown';
}

export function expandServiceCategoryFilterTokens(serviceCategoryId: string): readonly string[] {
  const normalized = normalizeCategoryToken(serviceCategoryId);
  if (!normalized) {
    return [];
  }

  const aliases = getSearchCategoryAliases(normalized);
  const tokens = aliases.length > 0 ? aliases : [normalized];
  return Array.from(new Set(tokens.map((token) => normalizeCategoryToken(token)).filter(Boolean)));
}
