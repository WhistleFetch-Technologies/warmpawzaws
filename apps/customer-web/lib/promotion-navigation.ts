/**
 * Map Admin "applicable services" / promotion metadata to CustomerHomeWrapper screen ids
 * (handleNavigateToService / setCurrentScreen).
 */

import { resolveCustomerScreenForCategoryAndStyle } from '@warmpawz/service-launch-mappings';
import { resolveStyleLaunchTargetForScreen } from '@/lib/customer-style-screen-launch';

/** Normalized service slugs / aliases → screen id. Kept in sync with `backend/lambda/src/utils/featured-vendor-service-context.ts` for GET /customer/featured-vendors. */
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

/** Banner `service` prop values → same screen ids */
const CONTEXT_SERVICE_TO_SCREEN: Record<string, string> = {
  shop: 'shop',
  grooming: 'grooming',
  vet: 'vet',
  veterinary: 'vet',
  training: 'training',
  boarding: 'boarding',
  pet_boarding: 'boarding',
  petboarding: 'boarding',
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
  sitting: 'pet-sitter',
  pet_sitter: 'pet-sitter',
  'pet-sitter': 'pet-sitter',
};

function norm(s: string): string {
  return String(s).toLowerCase().trim().replace(/\s+/g, '_');
}

function normalizeStyleAlias(raw: unknown): string {
  const style = norm(String(raw ?? ''));
  if (!style) return '';
  if (style === 'online') return 'tele';
  if (style === 'clinic' || style === 'center') return 'at_center';
  if (style === 'home' || style === 'home_visit') return 'at_home';
  return style;
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
  // App Router marketplace lives at `/shop`, not the home-shell SPA screen.
  if (key === 'shop') return null;
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

function styleAwareScreenFromPromo(promo: Record<string, unknown>): string | null {
  const rawCategory = String(
    promo.service_category ??
      promo.serviceCategory ??
      promo.target_category ??
      promo.targetCategory ??
      promo.customerScreen ??
      promo.customer_screen ??
      ''
  ).trim();
  const rawStyle = String(
    promo.service_style ??
      promo.serviceStyle ??
      (promo.metadata as any)?.serviceStyle ??
      (promo.metadata as any)?.promotionTarget?.serviceStyle ??
      ''
  ).trim();
  const category = norm(rawCategory);
  const style = normalizeStyleAlias(rawStyle);

  if (!category || category === 'all') return null;

  const mapped = resolveCustomerScreenForCategoryAndStyle(category, style);
  if (mapped) return mapped;
  return SLUG_TO_SCREEN[category] ?? null;
}

function styleAwareScreenFromApplicableServices(slugs: string[]): string | null {
  const normalized = slugs.map((s) => norm(s)).filter(Boolean);
  const styleToken = normalized.find((s) => s.startsWith('style:'));
  const categoryToken = normalized.find((s) => !s.startsWith('style:') && s !== 'all');
  if (!categoryToken) return null;

  const style = normalizeStyleAlias(styleToken ? styleToken.replace(/^style:/, '') : '');
  const mapped = resolveCustomerScreenForCategoryAndStyle(categoryToken, style);
  if (mapped) return mapped;
  return SLUG_TO_SCREEN[categoryToken] ?? null;
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

  const styleAware = styleAwareScreenFromPromo(promo);
  if (styleAware) return styleAware;

  const applicable = parseApplicableServices(promo);
  const fromApplicableStyleAware = styleAwareScreenFromApplicableServices(applicable);
  if (fromApplicableStyleAware) return fromApplicableStyleAware;

  const fromApplicable = firstMappedScreen(applicable);
  if (fromApplicable) return fromApplicable;

  const ctx = norm(contextService);
  if (CONTEXT_SERVICE_TO_SCREEN[ctx]) return CONTEXT_SERVICE_TO_SCREEN[ctx];

  if (SLUG_TO_SCREEN[ctx]) return SLUG_TO_SCREEN[ctx];

  return 'services';
}

/**
 * Role ids from `spotlight_offers.role_id` (admin seed) → CustomerHomeWrapper screen ids.
 * **Keep in sync** with `backend/lambda/src/utils/featured-vendor-service-context.ts` (featured-vendors API filter).
 */
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
        if (resolveStyleLaunchTargetForScreen(seg)) {
          return { kind: 'screen', screen: seg };
        }
        const n = norm(seg);
        if (SLUG_TO_SCREEN[n]) return { kind: 'screen', screen: SLUG_TO_SCREEN[n] };
        return { kind: 'router', path: pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}` };
      }
    } else {
      const rawSeg = pathOnly.split('/')[0];
      if (rawSeg && resolveStyleLaunchTargetForScreen(rawSeg)) {
        return { kind: 'screen', screen: rawSeg };
      }
      const n = norm(rawSeg);
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
