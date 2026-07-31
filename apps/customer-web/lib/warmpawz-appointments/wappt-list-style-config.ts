/** WAPPT discovery list — only centre + home (no "View all"). */
import {
  getWapptAllowedDiscoveryStyles,
  getWapptDefaultDiscoveryStyle,
  getWapptDiscoveryCategory,
  type WapptDiscoveryStyle,
} from '@/lib/wappt-hub-registry';

export type WapptDiscoveryListStyle = WapptDiscoveryStyle | 'tele';

export const WAPPT_TE_DISCOVERY_STYLE: WapptDiscoveryListStyle = 'tele';

export const WAPPT_DISCOVERY_STYLE_FILTERS: {
  id: WapptDiscoveryListStyle;
  label: string;
}[] = [
  { id: 'at_center', label: 'At centre' },
  { id: 'at_home', label: 'At home' },
];

/** @deprecated use getWapptDefaultDiscoveryStyle(category) */
export const WAPPT_DISCOVERY_DEFAULT_STYLE: WapptDiscoveryListStyle = 'at_center';

export function resolveWapptDiscoveryStyleFilters(category: string, lockedStyle?: WapptDiscoveryListStyle) {
  if (lockedStyle === 'tele') return [];
  const allowed = getWapptAllowedDiscoveryStyles(category);
  return WAPPT_DISCOVERY_STYLE_FILTERS.filter(
    (f) => f.id !== 'tele' && allowed.includes(f.id as WapptDiscoveryStyle),
  );
}

export function resolveWapptDiscoveryInitialStyle(
  category: string,
  initialStyle?: WapptDiscoveryListStyle,
): WapptDiscoveryListStyle {
  if (initialStyle === 'tele') return 'tele';
  const defaultStyle = resolveWapptDiscoveryDefaultStyle(category);
  if (!initialStyle) return defaultStyle;
  const allowed = getWapptAllowedDiscoveryStyles(category);
  if (allowed.includes(initialStyle as WapptDiscoveryStyle)) {
    return initialStyle;
  }
  return defaultStyle;
}

/** Shell navigation: category + clamped style + lock flag for wappt-discovery. */
export function resolveWapptDiscoveryShellNav(
  category: string,
  data?: Record<string, unknown> | null,
): {
  category: string;
  serviceStyle: WapptDiscoveryListStyle;
  lockStyleFilter: boolean;
} {
  const discoveryCategory = getWapptDiscoveryCategory(
    String(data?.category || category || 'vet'),
  );
  const rawStyle = data?.serviceStyle ?? data?.service_style;
  const styleInput =
    typeof rawStyle === 'string'
      ? (rawStyle.toLowerCase() as WapptDiscoveryListStyle)
      : undefined;
  const serviceStyle = resolveWapptDiscoveryInitialStyle(discoveryCategory, styleInput);
  const lockStyleFilter =
    styleInput === 'tele' || data?.lockStyleFilter === true;
  return { category: discoveryCategory, serviceStyle, lockStyleFilter };
}

export function resolveWapptDiscoveryDefaultStyle(category: string): WapptDiscoveryListStyle {
  return getWapptDefaultDiscoveryStyle(category);
}
