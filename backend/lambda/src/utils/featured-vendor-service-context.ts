/**
 * Classifies `spotlight_offers` rows for GET /customer/featured-vendors?service=…
 *
 * **Keep in sync** with `apps/customer-web/lib/promotion-navigation.ts`:
 * - `SLUG_TO_SCREEN` (synonyms → CustomerHomeWrapper screen id)
 * - `ROLE_ID_TO_SCREEN` (admin `role_id` on spotlight_offers → screen id)
 *
 * Query param: `service` — any slug/alias that maps to the same canonical screen
 * (e.g. `grooming`, `sitting`, `veterinary`, `pet-sitter` → `pet-sitter` / `vet` as appropriate).
 * When `service` is absent or unmapped, the API returns an empty list (home must not show global spotlights).
 */

function norm(s: string): string {
  return String(s).toLowerCase().trim().replace(/\s+/g, '_');
}

/** Mirror: promotion-navigation.ts SLUG_TO_SCREEN */
const SLUG_TO_SCREEN: Record<string, string> = {
  shop: 'shop',
  ecommerce: 'shop',
  retail: 'shop',
  food: 'shop',
  products: 'shop',
  product: 'shop',
  grooming: 'grooming',
  veterinary: 'vet',
  walker: 'walker',
  walking: 'walker',
  walk: 'walker',
  vet: 'vet',
  veterinarian: 'vet',
  tele: 'vet-tele-consultation',
  training: 'training',
  boarding: 'boarding',
  'pet-boarding': 'boarding',
  pet_boarding: 'boarding',
  petboarding: 'boarding',
  nutrition: 'nutritionist',
  nutritionist: 'nutritionist',
  pharmacy: 'pharmacy',
  insurance: 'insurance',
  photography: 'photography',
  relocation: 'relocation',
  diagnostics: 'lab-diagnostics',
  lab: 'lab-diagnostics',
  'lab-diagnostics': 'lab-diagnostics',
  lab_diagnostics: 'lab-diagnostics',
  home_service: 'home-service-selection',
  home_services: 'home-service-selection',
  cafes: 'cafes',
  adoption: 'adoption',
  rehoming: 'adoption_questionnaire',
  sunset: 'sunset',
  resort: 'resort',
  holiday: 'holiday',
  ambulance: 'ambulance',
  breeder: 'breeder',
  behaviourist: 'behaviorist',
  behaviorist: 'behaviorist',
  behavioral: 'behaviorist',
  sitting: 'pet-sitter',
  pet_sitter: 'pet-sitter',
  'pet-sitter': 'pet-sitter',
};

/** Mirror: promotion-navigation.ts ROLE_ID_TO_SCREEN */
const ROLE_ID_TO_SCREEN: Record<string, string> = {
  veterinarian: 'vet',
  vet: 'vet',
  groomer: 'grooming',
  boarder: 'boarding',
  boarding: 'boarding',
  pet_boarding: 'boarding',
  petboarding: 'boarding',
  trainer: 'training',
  pet_sitter: 'pet-sitter',
  sitter: 'pet-sitter',
};

const CANONICAL_SCREENS: Set<string> = (() => {
  const s = new Set<string>();
  Object.values(SLUG_TO_SCREEN).forEach((v) => s.add(v));
  Object.values(ROLE_ID_TO_SCREEN).forEach((v) => s.add(v));
  return s;
})();

let warnedUnmappedSpotlight = false;

/**
 * Resolves the `service` query string to a single canonical screen id, or null if invalid.
 */
export function resolveFeaturedVendorsRequestScreen(raw: string | undefined | null): string | null {
  const n = norm(String(raw ?? ''));
  if (!n) return null;
  if (SLUG_TO_SCREEN[n]) return SLUG_TO_SCREEN[n];
  if (ROLE_ID_TO_SCREEN[n]) return ROLE_ID_TO_SCREEN[n];
  if (CANONICAL_SCREENS.has(n)) return n;
  return null;
}

/**
 * Which service bucket a spotlight row belongs to (for filtering). Returns null if it cannot
 * be classified (excluded from all service pages).
 */
export function canonicalScreenForSpotlightRow(
  serviceCategory: string | null | undefined,
  roleId: string | null | undefined
): string | null {
  const ct = serviceCategory != null && String(serviceCategory).trim() !== '' ? String(serviceCategory).trim() : '';
  if (ct) {
    const n = norm(ct);
    if (SLUG_TO_SCREEN[n]) return SLUG_TO_SCREEN[n];
    if (ROLE_ID_TO_SCREEN[n]) return ROLE_ID_TO_SCREEN[n];
    if (CANONICAL_SCREENS.has(n)) return n;
  }
  const rt = roleId != null && String(roleId).trim() !== '' ? String(roleId).trim() : '';
  if (rt) {
    const n = norm(rt);
    if (ROLE_ID_TO_SCREEN[n]) return ROLE_ID_TO_SCREEN[n];
    if (SLUG_TO_SCREEN[n]) return SLUG_TO_SCREEN[n];
    if (CANONICAL_SCREENS.has(n)) return n;
  }
  const hadSomeId = Boolean(ct) || Boolean(rt);
  if (hadSomeId && !warnedUnmappedSpotlight && process.env.NODE_ENV === 'development') {
    warnedUnmappedSpotlight = true;
    console.warn(
      '[featured-vendors] Excluding spotlight(s) with unmappable service_category/role_id. Fix admin data or mapping in featured-vendor-service-context.ts.'
    );
  }
  return null;
}
