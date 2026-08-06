import {
  getWapptAllowedDiscoveryStyles,
  getWapptDefaultDiscoveryStyle,
  type WapptDiscoveryStyle,
} from '@/lib/wappt-hub-registry';

export type WapptProfileServiceStyle = WapptDiscoveryStyle | 'tele';

type StyleRow = Record<string, unknown>;

const CENTER_STYLE_TOKENS = new Set([
  'at_center',
  'at_clinic',
  'at_vendor',
  'center',
  'centre',
  'clinic',
]);

const HOME_STYLE_TOKENS = new Set(['at_home', 'home', 'home_visit', 'home visit']);

const TELE_STYLE_TOKENS = new Set(['tele', 'online', 'video_consultation']);

function normalizeStyleToken(raw: unknown): WapptProfileServiceStyle | null {
  const token = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!token) return null;
  if (TELE_STYLE_TOKENS.has(token)) return 'tele';
  if (HOME_STYLE_TOKENS.has(token) || token.includes('home_visit')) return 'at_home';
  if (CENTER_STYLE_TOKENS.has(token) || token.includes('at_center')) return 'at_center';
  return null;
}

function readExplicitStyle(row: StyleRow): WapptProfileServiceStyle | null {
  for (const key of [
    'preferredServiceStyle',
    'preferred_service_style',
    'serviceStyle',
    'service_style',
  ]) {
    const normalized = normalizeStyleToken(row[key]);
    if (normalized) return normalized;
  }
  return null;
}

function readNestedServiceStyles(row: StyleRow): WapptProfileServiceStyle[] {
  const styles = new Set<WapptProfileServiceStyle>();
  const buckets = [row.services, row.planRows, row.packages];

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      if (item == null || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;
      const normalized = normalizeStyleToken(record.serviceStyle ?? record.service_style);
      if (normalized && normalized !== 'tele') styles.add(normalized);
    }
  }

  return Array.from(styles);
}

function roleHaystack(row: StyleRow): string {
  return [
    row.roleDisplayName,
    row.role_display_name,
    row.roleName,
    row.role_name,
    row.role,
    row.providerType,
    row.provider_type,
    row.vendorType,
    row.vendor_type,
    row.subtitle,
    row.categoryLabel,
    row.category_label,
    row.name,
    row.displayName,
    row.display_name,
    row.businessName,
    row.business_name,
    row.vendorName,
    row.vendor_name,
  ]
    .map((v) => String(v ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
    .replace(/[_-]+/g, ' ');
}

function inferStyleFromRole(row: StyleRow, category: string): WapptProfileServiceStyle | null {
  const allowed = getWapptAllowedDiscoveryStyles(category);
  const haystack = roleHaystack(row);

  const centerHint =
    haystack.includes('center') ||
    haystack.includes('centre') ||
    haystack.includes('clinic') ||
    haystack.includes('salon') ||
    haystack.includes('facility');

  const homeHint =
    haystack.includes('solo') ||
    haystack.includes('home visit') ||
    haystack.includes('at home') ||
    haystack.includes('home grooming') ||
    haystack.includes('home vet');

  if (homeHint && allowed.includes('at_home')) return 'at_home';
  if (centerHint && allowed.includes('at_center')) return 'at_center';
  if (homeHint && !allowed.includes('at_home') && allowed.includes('at_center')) {
    return 'at_center';
  }
  return null;
}

function pickDominantStyle(
  styles: WapptProfileServiceStyle[],
  category: string,
): WapptProfileServiceStyle | null {
  if (styles.length === 0) return null;
  if (styles.length === 1) return styles[0];

  const hasHome = styles.includes('at_home');
  const hasCenter = styles.includes('at_center');
  if (hasHome && !hasCenter) return 'at_home';
  if (hasCenter && !hasHome) return 'at_center';

  return getWapptDefaultDiscoveryStyle(category);
}

function clampToCategory(
  style: WapptProfileServiceStyle,
  category: string,
): WapptProfileServiceStyle {
  if (style === 'tele') return style;
  const allowed = getWapptAllowedDiscoveryStyles(category);
  if (allowed.includes(style as WapptDiscoveryStyle)) return style;
  return getWapptDefaultDiscoveryStyle(category);
}

/**
 * Resolve the WAPPT vendor profile serviceStyle for hub cards, walk-in, and featured lists.
 * Keeps at_center vendors on at_center and solo/at_home vendors on at_home.
 */
export function resolveWapptVendorProfileServiceStyle(
  row: StyleRow | null | undefined,
  category: string,
): WapptProfileServiceStyle {
  const safeRow = row ?? {};
  const fromRole = inferStyleFromRole(safeRow, category);
  const explicit = readExplicitStyle(safeRow);

  // List APIs often default to at_center; solo/home labels must win for at_home vendors.
  if (fromRole === 'at_home' && explicit === 'at_center') {
    return clampToCategory('at_home', category);
  }

  if (explicit) return clampToCategory(explicit, category);

  const nestedStyles = readNestedServiceStyles(safeRow);
  const dominant = pickDominantStyle(nestedStyles, category);
  if (dominant) return clampToCategory(dominant, category);

  if (fromRole) return clampToCategory(fromRole, category);

  return getWapptDefaultDiscoveryStyle(category);
}

/** WalkInProvider helper — uses subtitle/name when API profilePath style is wrong. */
export function resolveWalkInProviderProfileServiceStyle(
  provider: {
    category: string;
    subtitle?: string | null;
    displayName?: string | null;
    serviceStyle?: 'at_center' | 'at_home' | null;
  },
): WapptProfileServiceStyle {
  return resolveWapptVendorProfileServiceStyle(
    {
      serviceStyle: provider.serviceStyle,
      preferredServiceStyle: provider.serviceStyle,
      subtitle: provider.subtitle,
      categoryLabel: provider.subtitle,
      roleDisplayName: provider.subtitle,
      displayName: provider.displayName,
      name: provider.displayName,
    },
    provider.category,
  );
}

/**
 * WAPPT discovery list (At centre / At home tabs): honour an explicit non-default tab;
 * on the category default tab infer per-vendor style so solo at_home vendors are not
 * opened with at_center.
 */
export function resolveWapptDiscoveryListProfileServiceStyle(opts: {
  activeStyleFilter: WapptProfileServiceStyle;
  row: StyleRow | null | undefined;
  category: string;
}): WapptProfileServiceStyle {
  const { activeStyleFilter, row, category } = opts;
  if (activeStyleFilter === 'tele') return 'tele';

  const defaultStyle = getWapptDefaultDiscoveryStyle(category);
  if (activeStyleFilter !== defaultStyle) {
    return clampToCategory(activeStyleFilter, category);
  }

  return resolveWapptVendorProfileServiceStyle(row, category);
}

/** BoardingListVendor helper — merges card raw + planRows for style resolution. */
export function resolveBoardingListVendorProfileServiceStyle(
  vendor: { raw?: Record<string, unknown>; planRows?: Array<{ serviceStyle?: string }> },
  category: string,
): WapptProfileServiceStyle {
  const raw = (vendor.raw ?? {}) as StyleRow;
  return resolveWapptVendorProfileServiceStyle(
    {
      ...raw,
      planRows: vendor.planRows ?? raw.planRows,
    },
    category,
  );
}
