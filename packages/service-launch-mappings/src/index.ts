/**
 * Single source of truth for:
 * - service_categories / service_catalog category_id → Marketing launch id (platform_settings keys)
 * - launch id → customer home "screen" (tile routing + legacy block-list expansion)
 *
 * Diagnostics launch stays tied to the **vet** home tile (legacy serviceScreenMap behavior).
 */

/** Normalize slug keys (Postgres ids / UUIDs are passed through when unmapped). */
export function normalizeServiceKey(key: string | null | undefined): string {
  return String(key ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

/** DB / API category string → comparable token (aligns with SQL `REGEXP_REPLACE` in search). */
export function normalizeCategoryToken(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
}

const BASE_SEARCH_CATEGORY_ALIASES: Record<string, string[]> = {
  vet: [
    'vet',
    'veterinary',
    'veterinarian',
    'vet_clinic',
    'vet_solo',
    'pet_clinic',
    'vet care',
    'vet_care',
  ],
  grooming: [
    'grooming',
    'groomer',
    'grooming_salon',
    'pet_groomer',
    'groomer_center',
    'groomer_solo',
    'grooming_solo',
  ],
  training: [
    'training',
    'trainer',
    'pet_trainer',
    'trainer_center',
    'training_center',
    'trainer_solo',
    'training_solo',
    'dog_trainer',
    'pet_training',
    'agility',
    'obedience',
    'behavioral',
    'behaviorist',
    'pet_behaviorist',
  ],
  boarding: ['boarding', 'pet_daycare', 'pet_boarding', 'pet_boarder'],
  walker: [
    'walker',
    'walking',
    'pet_walker',
    'dog_walker',
    'dog_walking',
    'dog walking',
    'pet_walking',
    'walker_solo',
  ],
  cafe: ['cafe', 'pet_cafe', 'cafes', 'pet_cafe_owner', 'animal_cafe'],
  resort: ['resort', 'pet_resort', 'holiday', 'pet_holiday', 'pet_lodge', 'pet_hotel', 'vacation'],
  pharmacy: [
    'pharmacy',
    'pet_pharmacy',
    'chemist',
    'drugstore',
    'medicine',
    'medical_store',
    'dispensary',
    'e_pharmacy',
    'online_pharmacy',
  ],
  nutritionist: ['nutrition', 'nutritionist', 'pet_nutritionist', 'nutritionist_center', 'nutritionist_solo'],
  nutrition: ['nutrition', 'nutritionist', 'pet_nutritionist', 'nutritionist_center', 'nutritionist_solo'],
};

export function getSearchCategoryAliases(category: string | null | undefined): string[] {
  const normalized = normalizeCategoryToken(category);
  if (!normalized) return [];
  const canonical = normalized in BASE_SEARCH_CATEGORY_ALIASES ? normalized : normalized.replace(/_/g, '-');
  const list = BASE_SEARCH_CATEGORY_ALIASES[canonical] || BASE_SEARCH_CATEGORY_ALIASES[normalized] || [];
  const launchIds = hubChipToLaunchIdsForCatalogInversion(normalized);
  const catalogExtras = getCatalogSlugAliasesForLaunchServiceIds(launchIds);
  const out = new Set<string>([
    normalized,
    ...list.map((entry) => normalizeCategoryToken(entry)),
    ...catalogExtras,
  ]);
  return Array.from(out);
}

/**
 * Maps catalog / role `category_id` to the canonical launch service id used in
 * `platform:service-launch-config`, GET /config/service-launch, and GET /config/service-launch/customer.
 */
/**
 * Canonical catalog / onboarding category slugs → launch service id (platform_settings keys).
 * Used by customer search hub browse to invert “which catalog ids belong under this chip”.
 */
export const CATALOG_SLUG_TO_LAUNCH_SERVICE_ID: Readonly<Record<string, string>> = {
  veterinary: 'vet',
  grooming: 'grooming',
  training: 'training',
  walking: 'walker',
  walker: 'walker',
  'dog-walker': 'walker',
  dog_walker: 'walker',
  boarding: 'boarding',
  'pet-holiday': 'holiday',
  pet_holiday: 'holiday',
  pet_holiday_planner: 'holiday',
  diagnostic: 'diagnostics',
  diagnostics: 'diagnostics',
  pharmacy: 'pharmacy',
  emergency: 'ambulance',
  wellness: 'nutritionist',
  nutrition: 'nutritionist',
  specialty: 'specialty',
  speciality: 'specialty',
  daycare: 'daycare',
  behavioral: 'training',
  behaviorist: 'training',
  pet_behaviorist: 'training',
  pet_trainer: 'training',
  trainer: 'training',
  sitting: 'pet-sitter',
  'pet-sitter': 'pet-sitter',
  sitter: 'pet-sitter',
};

/** Launch ids whose catalog rows should expand customer Search hub slug aliases (multi-launch chips). */
export function hubChipToLaunchIdsForCatalogInversion(chip: string | null | undefined): string[] {
  const n = normalizeCategoryToken(chip);
  if (!n) return [];
  if (n === 'vet') return ['vet', 'diagnostics'];
  if (n === 'cafe') return ['cafes'];
  if (n === 'resort') return ['resort', 'holiday'];
  return [n];
}

/** Normalized catalog tokens stored on vendors/vendor_services that map to any of the given launch ids. */
export function getCatalogSlugAliasesForLaunchServiceIds(launchIds: readonly string[]): string[] {
  const want = new Set(launchIds.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean));
  if (!want.size) return [];
  const out = new Set<string>();
  for (const [catalogKey, launchVal] of Object.entries(CATALOG_SLUG_TO_LAUNCH_SERVICE_ID)) {
    const lv = String(launchVal || '').trim().toLowerCase();
    if (!want.has(lv)) continue;
    out.add(normalizeCategoryToken(catalogKey));
  }
  return Array.from(out).filter(Boolean);
}

export function mapCatalogSlugToLaunchServiceId(categoryId: string | null | undefined): string {
  if (categoryId == null || String(categoryId).trim() === '') return 'unknown';
  const key = normalizeServiceKey(categoryId);
  const mapped = CATALOG_SLUG_TO_LAUNCH_SERVICE_ID[key];
  if (mapped) return mapped;
  return String(categoryId).trim();
}

/**
 * Maps a **launch service id** from `platform:service-launch-config` / customer launch API
 * to the customer home tile `screen` used for visibility matching.
 *
 * Note: launch id `diagnostics` is intentionally tied to the **vet** tile (legacy behavior).
 */
export function mapLaunchServiceIdToCustomerHomeScreen(launchId: string | null | undefined): string {
  const key = normalizeServiceKey(launchId);
  if (!key) return '';
  const direct: Record<string, string> = {
    vet: 'vet',
    grooming: 'grooming',
    training: 'training',
    walker: 'walker',
    boarding: 'boarding',
    'pet-sitter': 'pet-sitter',
    holiday: 'holiday',
    shop: 'shop',
    pharmacy: 'pharmacy',
    adoption: 'adoption',
    mating: 'mating-dating-hub',
    'mating-dating-hub': 'mating-dating-hub',
    cafes: 'cafes',
    photography: 'photography',
    insurance: 'insurance',
    breeder: 'breeder',
    ambulance: 'ambulance',
    nutritionist: 'nutritionist',
    relocation: 'relocation',
    resort: 'resort',
    sunset: 'sunset',
    diagnostics: 'vet',
    diagnostic: 'vet',
    specialty: 'insurance',
    wellness: 'nutritionist',
    nutrition: 'nutritionist',
  };
  if (direct[key]) return direct[key];
  return key;
}

/**
 * Maps a **service_categories.category_id** (catalog row) to the customer home `screen`
 * for tiles and navigation. Lab/diagnostic *catalog* categories stay on `lab-diagnostics`.
 */
export function mapCatalogCategoryIdToCustomerHomeScreen(categoryId: string | null | undefined): string {
  const key = normalizeServiceKey(categoryId);
  if (!key) return '';
  const catalog: Record<string, string> = {
    veterinary: 'vet',
    grooming: 'grooming',
    training: 'training',
    boarding: 'boarding',
    walking: 'walker',
    walker: 'walker',
    'dog-walker': 'walker',
    dog_walker: 'walker',
    'pet-sitter': 'pet-sitter',
    pet_sitter: 'pet-sitter',
    sitting: 'pet-sitter',
    sitter: 'pet-sitter',
    diagnostic: 'lab-diagnostics',
    diagnostics: 'lab-diagnostics',
    'lab-diagnostics': 'lab-diagnostics',
    lab: 'lab-diagnostics',
    pharmacy: 'pharmacy',
    emergency: 'ambulance',
    ambulance: 'ambulance',
    'emergency_care': 'ambulance',
    wellness: 'nutritionist',
    nutrition: 'nutritionist',
    nutritionist: 'nutritionist',
    specialty: 'insurance',
    speciality: 'insurance',
    adoption: 'adoption',
    mating: 'mating-dating-hub',
    'mating-dating-hub': 'mating-dating-hub',
    shop: 'shop',
    marketplace: 'shop',
    resort: 'resort',
    cafe: 'cafes',
    cafes: 'cafes',
    photography: 'photography',
    breeder: 'breeder',
    relocation: 'relocation',
    holiday: 'holiday',
    'pet-holiday': 'holiday',
    pet_holiday: 'holiday',
    pet_holiday_planner: 'holiday',
    sunset: 'sunset',
    insurance: 'insurance',
    behavioral: 'training',
    behaviorist: 'training',
    pet_behaviorist: 'training',
    pet_trainer: 'training',
    trainer: 'training',
  };
  if (catalog[key]) return catalog[key];
  const launch = mapCatalogSlugToLaunchServiceId(categoryId);
  return mapLaunchServiceIdToCustomerHomeScreen(launch);
}

type ScreenRule = { readonly keys: readonly string[]; readonly screens: readonly string[] };

const SCREEN_RULES: readonly ScreenRule[] = [
  { keys: ['vet', 'veterinary'], screens: ['vet'] },
  { keys: ['grooming'], screens: ['grooming'] },
  {
    keys: ['training', 'behavioral', 'behaviorist', 'pet_behaviorist', 'pet_trainer', 'trainer'],
    screens: ['training'],
  },
  { keys: ['walker', 'walking'], screens: ['walker'] },
  { keys: ['boarding'], screens: ['boarding'] },
  { keys: ['pet-sitter', 'sitting', 'sitter', 'pet_sitter'], screens: ['pet-sitter'] },
  { keys: ['adoption'], screens: ['adoption'] },
  { keys: ['mating'], screens: ['mating-dating-hub'] },
  { keys: ['cafes'], screens: ['cafes'] },
  { keys: ['photography'], screens: ['photography'] },
  { keys: ['insurance'], screens: ['insurance'] },
  { keys: ['breeder'], screens: ['breeder'] },
  { keys: ['ambulance', 'emergency'], screens: ['ambulance'] },
  { keys: ['nutritionist', 'nutrition', 'wellness'], screens: ['nutritionist'] },
  { keys: ['relocation'], screens: ['relocation'] },
  { keys: ['resort'], screens: ['resort'] },
  { keys: ['holiday'], screens: ['holiday'] },
  { keys: ['sunset'], screens: ['sunset'] },
  { keys: ['shop'], screens: ['shop'] },
  { keys: ['pharmacy'], screens: ['shop'] },
  /** Product choice: diagnostics gating is tied to the vet tile (unchanged legacy behavior). */
  /** Launch / gating keys: diagnostics visibility is tied to the vet tile (unchanged). */
  { keys: ['diagnostic', 'diagnostics'], screens: ['vet'] },
  { keys: ['lab-diagnostics', 'lab', 'lab_diagnostics'], screens: ['lab-diagnostics'] },
];

/** Legacy shape: one config key may map to one or more home screens (block / coming-soon expansion). */
export function buildServiceScreenMap(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const rule of SCREEN_RULES) {
    for (const k of rule.keys) {
      out[k] = [...rule.screens];
    }
  }
  return out;
}

/** Frozen singleton for importers that expect a plain object. */
export const serviceScreenMap: Record<string, string[]> = buildServiceScreenMap();
