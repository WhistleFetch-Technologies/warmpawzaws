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

export type HubServiceRow = {
  category?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  name?: string | null;
  catalogCategoryId?: string | null;
  category_id?: string | null;
  catalog_category_id?: string | null;
  catalogServiceId?: string | null;
  catalogServiceSlug?: string | null;
  serviceId?: string | null;
  service_id?: string | null;
  resolved_category?: string | null;
};

function serviceCategoryHaystack(service: HubServiceRow): string {
  return [service.category, service.categoryName, service.categorySlug, service.resolved_category]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

function catalogCategoryId(service: HubServiceRow): string {
  return String(
    service.catalogCategoryId ?? service.catalog_category_id ?? service.category_id ?? ''
  )
    .trim()
    .toLowerCase();
}

function catalogServiceId(service: HubServiceRow): string {
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
export function isGroomingServiceForVetHub(service: HubServiceRow): boolean {
  const haystack = serviceCategoryHaystack(service);
  if (haystack.includes('groom')) return true;

  if (catalogCategoryId(service) === 'grooming') return true;

  const catalogId = catalogServiceId(service);
  if (catalogId.startsWith('groom_')) return true;
  if (GROOMING_CATALOG_SERVICE_IDS.has(catalogId)) return true;

  return false;
}

/**
 * Customer-facing category badge — never show misleading "General" on grooming catalog rows.
 * Returns undefined to omit the badge when there is no meaningful label.
 */
export function resolveServiceCategoryDisplayLabel(service: HubServiceRow): string | undefined {
  const catalogId = catalogCategoryId(service);
  const catalogSlug = catalogServiceId(service);

  if (catalogId === 'grooming' || catalogSlug.startsWith('groom_')) {
    return 'Grooming';
  }
  if (catalogId === 'veterinary' || catalogSlug.startsWith('vet_')) {
    return 'Veterinary';
  }

  const raw =
    [service.resolved_category, service.categoryName, service.category, service.categorySlug].find(
      (v) => typeof v === 'string' && v.trim()
    )?.trim() || '';
  const norm = raw.toLowerCase();

  if (norm.includes('groom')) return 'Grooming';
  if (norm.includes('vet') || norm.includes('veterinar')) return 'Veterinary';

  // Vendor custom services default to "General" — hide when not vet-specific.
  if (norm === 'general' || norm === 'general services') {
    return undefined;
  }

  return raw || undefined;
}

/** Drop grooming catalog / category services from vet clinic discovery and booking lists. */
export function filterServicesForVetHub<T extends HubServiceRow>(services: T[]): T[] {
  return services.filter((service) => !isGroomingServiceForVetHub(service));
}

type ProviderWithServices = {
  services?: HubServiceRow[] | null;
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

/**
 * Vet hub discovery list: remove groomer-role providers and grooming catalog services.
 * When `keepProvidersPendingServiceFetch` is true, vendors with empty embedded services
 * (needs lazy fetch) are kept — used by clinic list cards.
 */
export function applyVetHubDiscoveryToProviders<
  T extends Record<string, unknown> & ProviderWithServices & { needsServiceFetch?: boolean },
>(providers: T[], options?: { keepProvidersPendingServiceFetch?: boolean }): T[] {
  const keepPending = options?.keepProvidersPendingServiceFetch ?? false;
  return filterVetHubProviderRows(providers)
    .map((provider) => ({
      ...provider,
      services: filterServicesForVetHub(Array.isArray(provider.services) ? provider.services : []),
    }))
    .filter((provider) => {
      if ((provider.services?.length ?? 0) > 0) return true;
      return keepPending && provider.needsServiceFetch === true;
    });
}

/**
 * Non-vet personas must not appear on vet hub vendor lists (Home Visit, clinic, featured).
 * Covers groomers, trainers, and walkers that previously leaked via vs.category = "General".
 */
export function isNonVetProviderRow(row: Record<string, unknown>): boolean {
  const role = String(
    row.roleDisplayName ?? row.roleName ?? row.role ?? row.providerType ?? ''
  )
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  const category = String(row.category ?? row.serviceCategory ?? row.service_category ?? '')
    .trim()
    .toLowerCase();
  if (category.includes('groom') || role.includes('groom')) return true;
  if (role.includes('train') || category.includes('train')) return true;
  if (
    (role.includes('walk') && !role.includes('walk-in')) ||
    (category.includes('walk') && !category.includes('walk-in'))
  ) {
    return true;
  }
  const blockedRoles = [
    'groomer',
    'groomer center',
    'groomer solo',
    'pet groomer',
    'grooming solo',
    'grooming salon',
    'pet spa',
    'trainer',
    'trainer solo',
    'trainer center',
    'pet trainer',
    'walker',
    'pet walker',
    'dog walker',
  ];
  return blockedRoles.some((r) => role.includes(r) || role === r);
}

export function filterVetHubProviderRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.filter((row) => !isNonVetProviderRow(row));
}

export function isVetHubDiscoveryConfig(config: {
  discoverCategory?: string;
  servicesApiCategory?: string;
}): boolean {
  const c = String(config.discoverCategory ?? config.servicesApiCategory ?? '')
    .trim()
    .toLowerCase();
  return c === 'vet' || c === 'veterinary' || c === 'veterinarian';
}

export function filterPlanRowsForVetHub<
  T extends {
    categoryLabel?: string;
    serviceId?: string;
    name?: string;
  },
>(planRows: T[]): T[] {
  return planRows.filter(
    (plan) =>
      !isGroomingServiceForVetHub({
        category: plan.categoryLabel,
        serviceId: plan.serviceId,
        catalogServiceSlug: plan.serviceId,
        name: plan.name,
      })
  );
}
