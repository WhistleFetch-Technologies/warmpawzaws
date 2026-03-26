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
  tele: 'vet-tele-consultation',
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
  rehoming: 'adoption_questionnaire',
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

/**
 * Admin/CMS often stores CTAs as `/grooming`, `/vet` — those are in-app screen ids, not App Router paths.
 * Returns the wrapper screen id when the path is a single known segment; otherwise null (use router as-is).
 */
export function customerPathToScreen(path: string): string | null {
  const pathOnly = String(path ?? '')
    .trim()
    .split('?')[0]
    .split('#')[0];
  if (!pathOnly.startsWith('/')) return null;
  const segments = pathOnly.replace(/^\/+/, '').split('/').filter(Boolean);
  if (segments.length !== 1) return null;
  const key = norm(segments[0]);
  return SLUG_TO_SCREEN[key] ?? null;
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

/** Role ids from `spotlight_offers.role_id` (admin seed) → CustomerHomeWrapper screen ids */
const ROLE_ID_TO_SCREEN: Record<string, string> = {
  veterinarian: 'vet',
  vet: 'vet',
  groomer: 'grooming',
  boarder: 'boarding',
  trainer: 'training',
};

export type FeaturedVendorNavResult =
  | { kind: 'screen'; screen: string }
  | { kind: 'router'; path: string }
  | { kind: 'external'; url: string };

/**
 * Map home "Featured providers" spotlight row to navigation.
 * Admin `cta_link` is often stored as `/vet`, `/grooming`, `/boarding` — those must map to
 * screen ids (`vet`, `grooming`, …), not passed through as `/vet` (which would fall through
 * in handleNavigateToService and appear as a no-op).
 */
export function resolveFeaturedVendorDestination(v: Record<string, unknown>): FeaturedVendorNavResult {
  const ctaRaw = (v.ctaLink ?? v.cta_link ?? '') as string;
  const cta = String(ctaRaw ?? '').trim();

  if (/^https?:\/\//i.test(cta)) {
    return { kind: 'external', url: cta };
  }

  if (cta) {
    const pathOnly = cta.split('?')[0].split('#')[0].trim();
    if (pathOnly.startsWith('/')) {
      const seg = pathOnly.replace(/^\/+/, '').split('/').filter(Boolean)[0];
      if (seg) {
        const n = norm(seg);
        if (SLUG_TO_SCREEN[n]) return { kind: 'screen', screen: SLUG_TO_SCREEN[n] };
        return { kind: 'router', path: pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}` };
      }
    } else {
      const n = norm(pathOnly.split('/')[0]);
      if (SLUG_TO_SCREEN[n]) return { kind: 'screen', screen: SLUG_TO_SCREEN[n] };
    }
  }

  const svc = (v.serviceCategory ?? v.service_category ?? '') as string;
  if (svc) {
    const n = norm(svc);
    if (SLUG_TO_SCREEN[n]) return { kind: 'screen', screen: SLUG_TO_SCREEN[n] };
  }

  const role = (v.roleId ?? v.role_id ?? '') as string;
  if (role) {
    const n = norm(role);
    if (ROLE_ID_TO_SCREEN[n]) return { kind: 'screen', screen: ROLE_ID_TO_SCREEN[n] };
    if (SLUG_TO_SCREEN[n]) return { kind: 'screen', screen: SLUG_TO_SCREEN[n] };
  }

  return { kind: 'screen', screen: 'grooming' };
}
