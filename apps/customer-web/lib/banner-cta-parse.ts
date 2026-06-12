/** Client-side parse for `/persona/vendor-name` banner CTAs (mirrors backend banner-cta-resolver). */

export const BANNER_DEEP_LINK_PERSONAS = [
  'vet',
  'grooming',
  'training',
  'boarding',
  'walker',
  'nutritionist',
] as const;

export type BannerDeepLinkPersona = (typeof BANNER_DEEP_LINK_PERSONAS)[number];

const SUPPORTED_PERSONAS = new Set<string>(BANNER_DEEP_LINK_PERSONAS);

export function isBannerDeepLinkPersona(value: string): value is BannerDeepLinkPersona {
  return SUPPORTED_PERSONAS.has(value);
}

/** Build `/persona/vendor name` path from route segments. */
export function buildBannerCtaPathFromSegments(
  persona: string,
  vendorSlug?: string[] | null
): string | null {
  const p = norm(persona);
  if (!isBannerDeepLinkPersona(p)) return null;
  const name = (vendorSlug ?? [])
    .map((s) => decodeURIComponent(String(s).trim()))
    .filter(Boolean)
    .join('/')
    .trim();
  if (!name) return `/${p}`;
  return `/${p}/${name}`;
}

function norm(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

export function parseBannerCtaLink(ctaLink: unknown): { persona: string; vendorName: string } | null {
  const raw = String(ctaLink ?? '').trim();
  if (!raw || /^https?:\/\//i.test(raw)) return null;

  const pathOnly = raw.split('?')[0].split('#')[0].trim();
  const withoutLeading = pathOnly.replace(/^\/+/, '');
  const segments = withoutLeading.split('/').map((s) => decodeURIComponent(s.trim())).filter(Boolean);
  if (segments.length < 2) return null;

  const persona = norm(segments[0]);
  const vendorName = segments.slice(1).join('/').trim();
  if (!persona || !vendorName || !SUPPORTED_PERSONAS.has(persona)) return null;
  const vendorSlug = vendorName.toLowerCase();
  if (vendorSlug === 'placeholder' || vendorSlug === 'placeholder.html') return null;

  return { persona, vendorName };
}

export function isVendorBannerCta(ctaLink: unknown): boolean {
  return parseBannerCtaLink(ctaLink) != null;
}

const BANNER_DEEP_LINK_PLACEHOLDER_SLUGS = new Set(['placeholder', 'placeholder.html']);

/** Static export ships `/vet/placeholder.html` only — read real vendor name from the browser URL when params are placeholder. */
export function resolveBannerDeepLinkVendorSlug(
  persona: string,
  vendorSlug?: string[] | null
): string[] {
  const decoded = (vendorSlug ?? [])
    .map((s) => {
      try {
        return decodeURIComponent(String(s).trim());
      } catch {
        return String(s).trim();
      }
    })
    .filter(Boolean);

  const onlyPlaceholder =
    decoded.length === 0 ||
    (decoded.length === 1 && BANNER_DEEP_LINK_PLACEHOLDER_SLUGS.has(decoded[0].toLowerCase()));

  if (typeof window === 'undefined' || !onlyPlaceholder) {
    return decoded;
  }

  const path = window.location.pathname.replace(/\/+$/, '');
  const prefix = `/${persona}/`;
  if (!path.toLowerCase().startsWith(prefix.toLowerCase())) {
    return decoded;
  }

  const rest = path.slice(prefix.length);
  if (!rest || BANNER_DEEP_LINK_PLACEHOLDER_SLUGS.has(rest.toLowerCase())) {
    return decoded;
  }

  try {
    return [decodeURIComponent(rest)];
  } catch {
    return [rest];
  }
}
