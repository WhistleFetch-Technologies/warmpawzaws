/**
 * Map Admin "applicable services" / promotion metadata to CustomerHomeWrapper screen ids
 * (handleNavigateToService / setCurrentScreen).
 */

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
  tele: 'vet',
  training: 'training',
  boarding: 'boarding',
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
  sunset: 'sunset',
  resort: 'resort',
  holiday: 'holiday',
  ambulance: 'ambulance',
  breeder: 'breeder',
  behaviourist: 'behaviorist',
  behaviorist: 'behaviorist',
  behavioral: 'behaviorist',
  sitting: 'home-service-selection',
};

/** Banner `service` prop values → same screen ids */
const CONTEXT_SERVICE_TO_SCREEN: Record<string, string> = {
  shop: 'shop',
  grooming: 'grooming',
  vet: 'vet',
  veterinary: 'vet',
  training: 'training',
  boarding: 'boarding',
  walking: 'walker',
  walker: 'walker',
  nutrition: 'nutritionist',
  nutritionist: 'nutritionist',
  insurance: 'insurance',
  photography: 'photography',
  relocation: 'relocation',
  home_service: 'home-service-selection',
  ambulance: 'ambulance',
  breeder: 'breeder',
  sunset: 'sunset',
  adoption: 'adoption',
  resort: 'resort',
  holiday: 'holiday',
  pharmacy: 'pharmacy',
  diagnostics: 'lab-diagnostics',
  'lab-diagnostics': 'lab-diagnostics',
};

function norm(s: string): string {
  return String(s).toLowerCase().trim().replace(/\s+/g, '_');
}

export function parseApplicableServices(promo: Record<string, unknown>): string[] {
  const raw = promo.applicable_services ?? promo.applicableServices;
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => norm(String(x))).filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => norm(String(x))).filter(Boolean);
      }
    } catch {
      return [norm(raw)];
    }
  }
  return [];
}

function firstMappedScreen(slugs: string[]): string | null {
  for (const slug of slugs) {
    const key = norm(slug);
    if (SLUG_TO_SCREEN[key]) return SLUG_TO_SCREEN[key];
  }
  return null;
}

/**
 * Optional explicit target from admin/API (snake or camel).
 */
function explicitTargetScreen(promo: Record<string, unknown>): string | null {
  const keys = [
    'target_screen',
    'targetScreen',
    'navigate_to',
    'navigateTo',
    'customer_screen',
    'customerScreen',
    'deep_link_screen',
    'deepLinkScreen',
  ];
  for (const k of keys) {
    const v = promo[k];
    if (typeof v === 'string' && v.trim()) {
      const n = norm(v);
      if (SLUG_TO_SCREEN[n]) return SLUG_TO_SCREEN[n];
      return v.trim();
    }
  }
  const cat = promo.service_category ?? promo.serviceCategory;
  if (typeof cat === 'string' && cat.trim()) {
    const n = norm(cat);
    if (SLUG_TO_SCREEN[n]) return SLUG_TO_SCREEN[n];
  }
  return null;
}

/**
 * Decide which in-app screen to open when the user taps a promotion CTA.
 */
export function resolvePromotionDestination(
  promo: Record<string, unknown>,
  contextService: string
): string {
  const explicit = explicitTargetScreen(promo);
  if (explicit) return explicit;

  const fromApplicable = firstMappedScreen(parseApplicableServices(promo));
  if (fromApplicable) return fromApplicable;

  const ctx = norm(contextService);
  if (CONTEXT_SERVICE_TO_SCREEN[ctx]) return CONTEXT_SERVICE_TO_SCREEN[ctx];

  if (SLUG_TO_SCREEN[ctx]) return SLUG_TO_SCREEN[ctx];

  return 'home';
}
