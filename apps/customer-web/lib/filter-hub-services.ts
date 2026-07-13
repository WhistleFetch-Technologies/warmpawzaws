/** Grooming catalog slugs that must not appear in vet hub listings. */
const GROOMING_CATALOG_SERVICE_IDS = new Set([
  'groom_ear',
  'groom_bath',
  'groom_haircut',
  'groom_nail',
  'groom_teeth',
  'groom_spa',
  'groom_dematting',
  'groom_home',
]);

type VetHubServiceRow = {
  category?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  catalogCategoryId?: string | null;
  category_id?: string | null;
  catalog_category_id?: string | null;
  catalogServiceId?: string | null;
  catalogServiceSlug?: string | null;
  serviceId?: string | null;
  service_id?: string | null;
};

function serviceCategoryHaystack(service: VetHubServiceRow): string {
  return [service.category, service.categoryName, service.categorySlug]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

function catalogCategoryId(service: VetHubServiceRow): string {
  return String(
    service.catalogCategoryId ?? service.catalog_category_id ?? service.category_id ?? ''
  )
    .trim()
    .toLowerCase();
}

function catalogServiceId(service: VetHubServiceRow): string {
  return String(
    service.catalogServiceSlug ??
      service.catalogServiceId ??
      service.serviceId ??
      service.service_id ??
      ''
  )
    .trim()
    .toLowerCase();
}

/** True when a service row is grooming-only and should be hidden on vet hub surfaces. */
export function isGroomingServiceForVetHub(service: VetHubServiceRow): boolean {
  const haystack = serviceCategoryHaystack(service);
  if (haystack.includes('groom')) return true;

  if (catalogCategoryId(service) === 'grooming') return true;

  const catalogId = catalogServiceId(service);
  if (catalogId.startsWith('groom_')) return true;
  if (GROOMING_CATALOG_SERVICE_IDS.has(catalogId)) return true;

  return false;
}

/** Drop grooming catalog / category services from vet clinic discovery and booking lists. */
export function filterServicesForVetHub<T extends VetHubServiceRow>(services: T[]): T[] {
  return services.filter((service) => !isGroomingServiceForVetHub(service));
}

type ProviderWithServices = {
  services?: VetHubServiceRow[] | null;
};

/** Filter each provider's services for vet hub; omit providers with no services left. */
export function filterProvidersServicesForVetHub<T extends ProviderWithServices>(
  providers: T[]
): T[] {
  return providers
    .map((provider) => ({
      ...provider,
      services: filterServicesForVetHub(Array.isArray(provider.services) ? provider.services : []),
    }))
    .filter((provider) => (provider.services?.length ?? 0) > 0);
}
