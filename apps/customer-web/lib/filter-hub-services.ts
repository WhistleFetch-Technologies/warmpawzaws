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
type ProviderRoleRow = {
  roleDisplayName?: unknown;
  roleName?: unknown;
  role?: unknown;
  providerType?: unknown;
  category?: unknown;
  serviceCategory?: unknown;
  service_category?: unknown;
};

export function applyVetHubDiscoveryToProviders<
  T extends ProviderRoleRow & ProviderWithServices & { needsServiceFetch?: boolean },
  S extends HubServiceRow = HubServiceRow,
>(providers: (T & { services?: S[] | null })[], options?: { keepProvidersPendingServiceFetch?: boolean }): T[] {
  const keepPending = options?.keepProvidersPendingServiceFetch ?? false;
  return filterVetHubProviderRows(providers)
    .map((provider) => ({
      ...provider,
      services: filterServicesForVetHub<S>(
        Array.isArray(provider.services) ? provider.services : []
      ),
    }))
    .filter((provider) => {
      if ((provider.services?.length ?? 0) > 0) return true;
      return keepPending && provider.needsServiceFetch === true;
    }) as T[];
}

/**
 * Non-vet personas must not appear on vet hub vendor lists (Home Visit, clinic, featured).
 * Covers groomers, trainers, and walkers that previously leaked via vs.category = "General".
 */
export function isNonVetProviderRow(row: ProviderRoleRow): boolean {
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

export function filterVetHubProviderRows<T extends ProviderRoleRow>(rows: T[]): T[] {
  return rows.filter((row) => !isNonVetProviderRow(row));
}

function normalizeProviderRoleHaystack(row: ProviderRoleRow): { role: string; category: string } {
  const role = String(
    row.roleDisplayName ?? row.roleName ?? row.role ?? row.providerType ?? ''
  )
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  const category = String(row.category ?? row.serviceCategory ?? row.service_category ?? '')
    .trim()
    .toLowerCase();
  return { role, category };
}

function roleMatchesAny(haystack: string, tokens: string[]): boolean {
  return tokens.some((t) => haystack.includes(t) || haystack === t);
}

const GROOMING_ROLE_TOKENS = [
  'groomer',
  'grooming',
  'pet groomer',
  'grooming salon',
  'pet spa',
  'groomer center',
  'groomer solo',
];

const VET_ROLE_TOKENS = [
  'vet',
  'veterinar',
  'veterinary',
  'clinic',
  'animal hosp',
  'pet clinic',
  'doctor',
];

const TRAINING_ROLE_TOKENS = ['train', 'trainer', 'obedi', 'agility'];

const BEHAVIORIST_ROLE_TOKENS = [
  'behaviorist',
  'behaviourist',
  'pet behaviorist',
  'behavior correction',
  'behavioral specialist',
];

const WALKER_ROLE_TOKENS = ['walk', 'walker', 'dog walk', 'pet walk'];

const BOARDING_ROLE_TOKENS = ['board', 'kennel', 'daycare', 'pet board'];

const SITTING_ROLE_TOKENS = ['sitter', 'sitting', 'pet sitter', 'in-home care'];

const NUTRITION_ROLE_TOKENS = ['nutrition', 'nutritionist', 'diet'];

function isGroomingProviderRow(row: ProviderRoleRow): boolean {
  const { role, category } = normalizeProviderRoleHaystack(row);
  return (
    roleMatchesAny(role, GROOMING_ROLE_TOKENS) ||
    roleMatchesAny(category, GROOMING_ROLE_TOKENS) ||
    category.includes('groom')
  );
}

function isVetProviderRow(row: ProviderRoleRow): boolean {
  const { role, category } = normalizeProviderRoleHaystack(row);
  return roleMatchesAny(role, VET_ROLE_TOKENS) || roleMatchesAny(category, VET_ROLE_TOKENS);
}

function isBehavioristProviderRow(row: ProviderRoleRow): boolean {
  const { role, category } = normalizeProviderRoleHaystack(row);
  return (
    roleMatchesAny(role, BEHAVIORIST_ROLE_TOKENS) ||
    roleMatchesAny(category, BEHAVIORIST_ROLE_TOKENS)
  );
}

function isTrainingProviderRow(row: ProviderRoleRow): boolean {
  if (isBehavioristProviderRow(row)) return false;
  const { role, category } = normalizeProviderRoleHaystack(row);
  return roleMatchesAny(role, TRAINING_ROLE_TOKENS) || roleMatchesAny(category, TRAINING_ROLE_TOKENS);
}

function isWalkerProviderRow(row: ProviderRoleRow): boolean {
  const { role, category } = normalizeProviderRoleHaystack(row);
  if (role.includes('walk-in') || category.includes('walk-in')) return false;
  return roleMatchesAny(role, WALKER_ROLE_TOKENS) || roleMatchesAny(category, WALKER_ROLE_TOKENS);
}

function isBoardingProviderRow(row: ProviderRoleRow): boolean {
  const { role, category } = normalizeProviderRoleHaystack(row);
  return roleMatchesAny(role, BOARDING_ROLE_TOKENS) || roleMatchesAny(category, BOARDING_ROLE_TOKENS);
}

function isSittingProviderRow(row: ProviderRoleRow): boolean {
  const { role, category } = normalizeProviderRoleHaystack(row);
  return roleMatchesAny(role, SITTING_ROLE_TOKENS) || roleMatchesAny(category, SITTING_ROLE_TOKENS);
}

function isNutritionProviderRow(row: ProviderRoleRow): boolean {
  const { role, category } = normalizeProviderRoleHaystack(row);
  return roleMatchesAny(role, NUTRITION_ROLE_TOKENS) || roleMatchesAny(category, NUTRITION_ROLE_TOKENS);
}

/** Non-grooming personas must not appear on grooming WAPPT hub lists. */
export function isNonGroomingProviderRow(row: ProviderRoleRow): boolean {
  if (isGroomingProviderRow(row)) return false;
  return (
    isVetProviderRow(row) ||
    isTrainingProviderRow(row) ||
    isWalkerProviderRow(row) ||
    isBoardingProviderRow(row) ||
    isSittingProviderRow(row) ||
    isNutritionProviderRow(row)
  );
}

export function filterGroomingHubProviderRows<T extends ProviderRoleRow>(rows: T[]): T[] {
  return rows.filter((row) => !isNonGroomingProviderRow(row));
}

/** Non-training personas must not appear on training WAPPT hub lists. */
export function isNonTrainingProviderRow(row: ProviderRoleRow): boolean {
  if (isTrainingProviderRow(row)) return false;
  return (
    isVetProviderRow(row) ||
    isGroomingProviderRow(row) ||
    isWalkerProviderRow(row) ||
    isBoardingProviderRow(row) ||
    isSittingProviderRow(row) ||
    isNutritionProviderRow(row)
  );
}

export function filterTrainingHubProviderRows<T extends ProviderRoleRow>(rows: T[]): T[] {
  return rows.filter((row) => isTrainingProviderRow(row));
}

/** Non-behaviorist personas must not appear on behaviorist WAPPT hub lists. */
export function isNonBehavioristProviderRow(row: ProviderRoleRow): boolean {
  if (isBehavioristProviderRow(row)) return false;
  return (
    isVetProviderRow(row) ||
    isGroomingProviderRow(row) ||
    isTrainingProviderRow(row) ||
    isWalkerProviderRow(row) ||
    isBoardingProviderRow(row) ||
    isSittingProviderRow(row) ||
    isNutritionProviderRow(row)
  );
}

export function filterBehavioristHubProviderRows<T extends ProviderRoleRow>(rows: T[]): T[] {
  return rows.filter((row) => !isNonBehavioristProviderRow(row));
}

/** Non-walker personas on walker WAPPT lists. */
export function isNonWalkerProviderRow(row: ProviderRoleRow): boolean {
  if (isWalkerProviderRow(row)) return false;
  return (
    isVetProviderRow(row) ||
    isGroomingProviderRow(row) ||
    isTrainingProviderRow(row) ||
    isBoardingProviderRow(row) ||
    isSittingProviderRow(row) ||
    isNutritionProviderRow(row)
  );
}

export function filterWalkerHubProviderRows<T extends ProviderRoleRow>(rows: T[]): T[] {
  return rows.filter((row) => !isNonWalkerProviderRow(row));
}

export function isNonBoardingProviderRow(row: ProviderRoleRow): boolean {
  if (isBoardingProviderRow(row)) return false;
  return (
    isVetProviderRow(row) ||
    isGroomingProviderRow(row) ||
    isTrainingProviderRow(row) ||
    isWalkerProviderRow(row) ||
    isSittingProviderRow(row) ||
    isNutritionProviderRow(row)
  );
}

export function filterBoardingHubProviderRows<T extends ProviderRoleRow>(rows: T[]): T[] {
  return rows.filter((row) => !isNonBoardingProviderRow(row));
}

export function isNonSittingProviderRow(row: ProviderRoleRow): boolean {
  if (isSittingProviderRow(row)) return false;
  return (
    isVetProviderRow(row) ||
    isGroomingProviderRow(row) ||
    isTrainingProviderRow(row) ||
    isWalkerProviderRow(row) ||
    isBoardingProviderRow(row) ||
    isNutritionProviderRow(row)
  );
}

export function filterSittingHubProviderRows<T extends ProviderRoleRow>(rows: T[]): T[] {
  return rows.filter((row) => !isNonSittingProviderRow(row));
}

export function isNonNutritionProviderRow(row: ProviderRoleRow): boolean {
  if (isNutritionProviderRow(row)) return false;
  return (
    isVetProviderRow(row) ||
    isGroomingProviderRow(row) ||
    isTrainingProviderRow(row) ||
    isWalkerProviderRow(row) ||
    isBoardingProviderRow(row) ||
    isSittingProviderRow(row)
  );
}

export function filterNutritionHubProviderRows<T extends ProviderRoleRow>(rows: T[]): T[] {
  return rows.filter((row) => !isNonNutritionProviderRow(row));
}

/** Apply hub-specific provider filter for WAPPT discovery / featured lists. */
export function applyWapptHubDiscoveryToProviders<T extends ProviderRoleRow>(
  rows: T[],
  hubCategory: string,
): T[] {
  const hub = String(hubCategory).trim().toLowerCase();
  switch (hub) {
    case 'vet':
    case 'veterinary':
    case 'veterinarian':
      return filterVetHubProviderRows(rows);
    case 'grooming':
      return filterGroomingHubProviderRows(rows);
    case 'training':
      return filterTrainingHubProviderRows(rows);
    case 'behaviorist':
    case 'behaviourist':
    case 'pet_behaviorist':
      return filterBehavioristHubProviderRows(rows);
    case 'walker':
    case 'walking':
      return filterWalkerHubProviderRows(rows);
    case 'boarding':
      return filterBoardingHubProviderRows(rows);
    case 'sitting':
    case 'sitter':
    case 'pet_sitter':
    case 'pet-sitter':
      return filterSittingHubProviderRows(rows);
    case 'nutrition':
    case 'nutritionist':
      return filterNutritionHubProviderRows(rows);
    default:
      return rows;
  }
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
