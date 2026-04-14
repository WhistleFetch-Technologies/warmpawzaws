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

/**
 * Maps catalog / role `category_id` to the canonical launch service id used in
 * `platform:service-launch-config`, GET /config/service-launch, and GET /config/service-launch/customer.
 */
export function mapCatalogSlugToLaunchServiceId(categoryId: string | null | undefined): string {
  if (categoryId == null || String(categoryId).trim() === '') return 'unknown';
  const key = normalizeServiceKey(categoryId);
  const mappings: Record<string, string> = {
    veterinary: 'vet',
    grooming: 'grooming',
    training: 'training',
    walking: 'walker',
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
  if (mappings[key]) return mappings[key];
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
