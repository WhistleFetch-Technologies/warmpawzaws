import {
  BANNER_DEEP_LINK_PERSONAS,
  isBannerDeepLinkPersona,
  parseBannerCtaLink,
  type BannerDeepLinkPersona,
} from '@/lib/banner-cta-parse';
import type { InitialBannerNavigation } from '@/lib/banner-cta-navigation';
import { shareContent } from '@/lib/shareUtils';
import type { HomeServiceType } from '@/components/customer/home-services/UniversalHomeServiceRouter';
import type { RoleId } from '@/components/customer/shared/roleConfig';

export const VENDOR_SHARE_LOG_PREFIX = '[vendor-share]';

const CUSTOMER_PROD_ORIGIN = 'https://customer.warmpawz.com';

export type VendorSharePersona =
  | BannerDeepLinkPersona
  | 'behaviorist'
  | 'behaviourist'
  | 'sitter';

export type BuildVendorProfileShareUrlParams = {
  vendorId: string;
  persona: VendorSharePersona | string;
  vendorName?: string;
  serviceStyle?: string;
  serviceSlug?: string;
};

export type ParsedVendorShareUrl = {
  pathname: string;
  vendorId: string | null;
  persona: string | null;
  serviceStyle: string | null;
  vendorName: string | null;
  serviceSlug: string | null;
  searchParams: URLSearchParams;
};

export type VendorShareNavigationParams = {
  persona?: string | null;
  serviceStyle?: string | null;
  vendorName?: string | null;
  serviceSlug?: string | null;
};

export function getCustomerShareOrigin(): string {
  if (typeof window === 'undefined') return CUSTOMER_PROD_ORIGIN;
  const origin = window.location.origin;
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)) {
    return origin;
  }
  return CUSTOMER_PROD_ORIGIN;
}

function normPersona(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

function normServiceStyle(value: string | null | undefined): string | undefined {
  const st = String(value ?? '')
    .toLowerCase()
    .trim();
  if (!st) return undefined;
  if (st === 'center' || st === 'clinic') return 'at_center';
  if (st === 'home') return 'at_home';
  if (st === 'online') return 'tele';
  return st;
}

export function homeServiceTypeToPersona(serviceType: HomeServiceType): VendorSharePersona {
  switch (serviceType) {
    case 'walker':
      return 'walker';
    case 'grooming':
      return 'grooming';
    case 'training':
      return 'training';
    case 'veterinary':
      return 'vet';
    case 'behaviourist':
      return 'behaviourist';
    case 'sitter':
      return 'sitter';
    default:
      return 'vet';
  }
}

export function roleIdToSharePersona(roleId: RoleId | string | undefined): VendorSharePersona {
  const r = normPersona(roleId);
  if (r.includes('vet')) return 'vet';
  if (r.includes('groom')) return 'grooming';
  if (r.includes('train')) return 'training';
  if (r.includes('walk')) return 'walker';
  if (r.includes('board')) return 'boarding';
  if (r.includes('nutrition')) return 'nutritionist';
  if (r.includes('behav')) return 'behaviourist';
  if (r.includes('sitt')) return 'sitter';
  return 'vet';
}

export function universalCategoryToSharePersona(
  category: string | undefined
): VendorSharePersona {
  const c = normPersona(category);
  if (c === 'walking' || c === 'walker') return 'walker';
  if (c === 'vet' || c === 'veterinary' || c === 'veterinarian') return 'vet';
  if (c === 'grooming') return 'grooming';
  if (c === 'training') return 'training';
  if (c === 'boarding') return 'boarding';
  if (c === 'nutritionist' || c === 'nutrition') return 'nutritionist';
  return roleIdToSharePersona(c);
}

const PLACEHOLDER_VENDOR_SEGMENTS = new Set(['placeholder', '_']);

export function normalizeVendorShareId(value: string | null | undefined): string {
  const s = String(value ?? '').trim();
  if (!s || PLACEHOLDER_VENDOR_SEGMENTS.has(s)) return '';
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Resolve vendor id from static-export placeholder route + query/path (mirrors video deep links). */
export function resolveVendorShareVendorId(input?: {
  pathVendorSegment?: string | null;
  queryVendorId?: string | null;
  paramVendorId?: string | null;
}): string {
  return (
    normalizeVendorShareId(input?.paramVendorId) ||
    normalizeVendorShareId(input?.pathVendorSegment) ||
    normalizeVendorShareId(input?.queryVendorId) ||
    ''
  );
}

export function readVendorIdFromShareLocation(
  loc: Pick<Location, 'pathname' | 'search'> = typeof window !== 'undefined'
    ? window.location
    : { pathname: '', search: '' }
): string {
  const qs = new URLSearchParams(loc.search);
  const pathSeg =
    loc.pathname.match(/\/vendor\/([^/?]+)/)?.[1] ??
    loc.pathname.match(/\/pet-boarding\/vendor\/([^/?]+)/)?.[1] ??
    null;
  return resolveVendorShareVendorId({
    pathVendorSegment: pathSeg,
    queryVendorId: qs.get('vendorId') ?? qs.get('vendor_id'),
  });
}

/** True when URL uses a real vendor id in the path but static export only has placeholder HTML. */
export function vendorSharePathNeedsPlaceholderRedirect(url: string): boolean {
  const parsed = parseUrlObject(url);
  if (!parsed) return false;

  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const qs = new URLSearchParams(parsed.search);
  if (qs.get('vendorId') || qs.get('vendor_id')) return false;

  const canonical = pathname.match(/^\/vendor\/([^/]+)$/i);
  if (canonical && !PLACEHOLDER_VENDOR_SEGMENTS.has(canonical[1])) return true;

  const boarding = pathname.match(/^\/pet-boarding\/vendor\/([^/]+)$/i);
  if (boarding && !PLACEHOLDER_VENDOR_SEGMENTS.has(boarding[1])) return true;

  return false;
}

/** Redirect legacy /vendor/{uuid} path links to the shipped placeholder shell + vendorId query. */
export function buildVendorSharePlaceholderRedirectUrl(url: string): string | null {
  const parsed = parseUrlObject(url);
  if (!parsed || !vendorSharePathNeedsPlaceholderRedirect(url)) return null;

  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const qs = new URLSearchParams(parsed.search);

  const canonical = pathname.match(/^\/vendor\/([^/]+)$/i);
  if (canonical) {
    qs.set('vendorId', normalizeVendorShareId(canonical[1]));
    return `/vendor/placeholder?${qs.toString()}`;
  }

  const boarding = pathname.match(/^\/pet-boarding\/vendor\/([^/]+)$/i);
  if (boarding) {
    qs.set('vendorId', normalizeVendorShareId(boarding[1]));
    return `/pet-boarding/vendor/placeholder?${qs.toString()}`;
  }

  return null;
}

export function buildVendorProfileShareUrl(params: BuildVendorProfileShareUrlParams): string {
  const vendorId = String(params.vendorId ?? '').trim();
  if (!vendorId) {
    console.warn(VENDOR_SHARE_LOG_PREFIX, 'buildVendorProfileShareUrl missing vendorId');
    return getCustomerShareOrigin();
  }

  const origin = getCustomerShareOrigin();
  const persona = normPersona(params.persona);
  const serviceStyle = normServiceStyle(params.serviceStyle);
  const vendorName = String(params.vendorName ?? '').trim();
  const serviceSlug = String(params.serviceSlug ?? '').trim();

  if (persona === 'boarding') {
    const qs = new URLSearchParams();
    qs.set('vendorId', vendorId);
    qs.set('service', serviceSlug || 'overnight');
    return `${origin}/pet-boarding/vendor/placeholder?${qs.toString()}`;
  }

  const qs = new URLSearchParams();
  qs.set('vendorId', vendorId);
  qs.set('persona', persona);
  if (serviceStyle) qs.set('serviceStyle', serviceStyle);
  if (vendorName) qs.set('name', vendorName);
  if (serviceSlug) qs.set('service', serviceSlug);

  return `${origin}/vendor/placeholder?${qs.toString()}`;
}

export async function shareVendorProfile(opts: {
  title?: string;
  text?: string;
  vendorId: string;
  persona: VendorSharePersona | string;
  vendorName?: string;
  serviceStyle?: string;
  serviceSlug?: string;
}): Promise<boolean> {
  const url = buildVendorProfileShareUrl(opts);
  console.log(VENDOR_SHARE_LOG_PREFIX, 'share url', url);
  return shareContent({
    title: opts.title,
    text: opts.text,
    url,
  });
}

function parseUrlObject(raw: string): URL | null {
  const input = String(raw ?? '').trim();
  if (!input) return null;
  try {
    if (/^https?:\/\//i.test(input)) return new URL(input);
    return new URL(input.startsWith('/') ? input : `/${input}`, CUSTOMER_PROD_ORIGIN);
  } catch {
    return null;
  }
}

export function parseVendorShareUrl(url: string): ParsedVendorShareUrl | null {
  const parsed = parseUrlObject(url);
  if (!parsed) return null;

  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const searchParams = new URLSearchParams(parsed.search);
  const queryVendorId =
    searchParams.get('vendorId') ??
    searchParams.get('vendor_id') ??
    null;
  const serviceStyle = normServiceStyle(
    searchParams.get('serviceStyle') ?? searchParams.get('service_style')
  );
  const vendorNameFromQuery = searchParams.get('name') ?? searchParams.get('vendorName');
  const serviceSlug = searchParams.get('service') ?? searchParams.get('serviceSlug');

  const canonicalMatch = pathname.match(/^\/vendor\/([^/]+)$/i);
  if (canonicalMatch || pathname === '/vendor/placeholder') {
    const pathSeg = canonicalMatch ? canonicalMatch[1] : null;
    const vendorId = resolveVendorShareVendorId({
      pathVendorSegment: pathSeg,
      queryVendorId,
    });
    const persona = normPersona(searchParams.get('persona'));
    return {
      pathname,
      vendorId: vendorId || null,
      persona: persona || null,
      serviceStyle: serviceStyle ?? null,
      vendorName: vendorNameFromQuery,
      serviceSlug,
      searchParams,
    };
  }

  const boardingMatch = pathname.match(/^\/pet-boarding\/vendor\/([^/]+)$/i);
  if (boardingMatch || pathname === '/pet-boarding/vendor/placeholder') {
    const pathSeg = boardingMatch ? boardingMatch[1] : null;
    const vendorId = resolveVendorShareVendorId({
      pathVendorSegment: pathSeg,
      queryVendorId,
    });
    return {
      pathname,
      vendorId: vendorId || null,
      persona: 'boarding',
      serviceStyle: serviceStyle ?? null,
      vendorName: vendorNameFromQuery,
      serviceSlug,
      searchParams,
    };
  }

  const bannerParsed = parseBannerCtaLink(`${pathname}${parsed.search}`);
  if (bannerParsed) {
    return {
      pathname,
      vendorId: queryVendorId,
      persona: bannerParsed.persona,
      serviceStyle: serviceStyle ?? null,
      vendorName: bannerParsed.vendorName || vendorNameFromQuery,
      serviceSlug,
      searchParams,
    };
  }

  const personaHub = pathname.match(/^\/([^/]+)$/);
  if (personaHub && isBannerDeepLinkPersona(normPersona(personaHub[1]))) {
    return {
      pathname,
      vendorId: queryVendorId,
      persona: normPersona(personaHub[1]),
      serviceStyle: serviceStyle ?? null,
      vendorName: vendorNameFromQuery,
      serviceSlug,
      searchParams,
    };
  }

  if (queryVendorId) {
    return {
      pathname,
      vendorId: queryVendorId,
      persona: normPersona(searchParams.get('persona')),
      serviceStyle: serviceStyle ?? null,
      vendorName: vendorNameFromQuery,
      serviceSlug,
      searchParams,
    };
  }

  return null;
}

export function vendorShareUrlToAppPath(url: string): string | null {
  const placeholderRedirect = buildVendorSharePlaceholderRedirectUrl(url);
  if (placeholderRedirect) return placeholderRedirect;

  const parsed = parseVendorShareUrl(url);
  if (!parsed?.vendorId) return null;

  const qs = parsed.searchParams.toString();
  return qs ? `${parsed.pathname}?${qs}` : parsed.pathname;
}

export function vendorShareParamsToInitialNavigation(
  vendorId: string,
  params: VendorShareNavigationParams
): InitialBannerNavigation | null {
  const vid = String(vendorId ?? '').trim();
  if (!vid) return null;

  const persona = normPersona(params.persona);
  const serviceStyle = normServiceStyle(params.serviceStyle) ?? 'at_center';
  const vendorName = String(params.vendorName ?? '').trim();
  const data: Record<string, unknown> = {
    vendorId: vid,
    returnScreen: 'home',
  };
  if (vendorName) data.vendorName = vendorName;
  if (serviceStyle) data.serviceStyle = serviceStyle;
  if (params.serviceSlug) data.serviceSlug = params.serviceSlug;

  switch (persona) {
    case 'boarding':
      return {
        screen: 'boarding',
        data: {
          ...data,
          service: 'boarding',
          serviceSlug: params.serviceSlug || 'overnight',
        },
      };
    case 'walker':
      return {
        screen: 'walker',
        data: { ...data, serviceType: 'walking', serviceStyle: 'at_home' },
      };
    case 'vet':
    case 'veterinarian':
    case 'veterinary':
      return {
        screen: 'vet',
        data: { ...data, serviceStyle: serviceStyle || 'tele' },
      };
    case 'grooming':
      return {
        screen: 'grooming',
        data: { ...data, serviceStyle: serviceStyle || 'at_center' },
      };
    case 'training':
      return {
        screen: 'training',
        data: { ...data, serviceStyle: serviceStyle || 'at_center' },
      };
    case 'nutritionist':
    case 'nutrition':
    case 'pet_nutritionist':
      return {
        screen: 'nutritionist',
        data: { ...data, serviceStyle: serviceStyle || 'tele' },
      };
    case 'behaviorist':
    case 'behaviourist':
      return { screen: 'behaviorist', data };
    case 'sitter':
    case 'pet_sitter':
    case 'pet-sitter':
      return { screen: 'sitter', data: { ...data, service: 'sitter' } };
    default:
      if (BANNER_DEEP_LINK_PERSONAS.includes(persona as BannerDeepLinkPersona)) {
        return {
          screen: persona,
          data: { ...data, service: persona },
        };
      }
      return { screen: 'vet', data: { ...data, serviceStyle: serviceStyle || 'tele' } };
  }
}
