/** WAPPT discovery list — only centre + home (no "View all"). */
import {
  getWapptAllowedDiscoveryStyles,
  getWapptDefaultDiscoveryStyle,
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
  return initialStyle ?? resolveWapptDiscoveryDefaultStyle(category);
}

export function resolveWapptDiscoveryDefaultStyle(category: string): WapptDiscoveryListStyle {
  return getWapptDefaultDiscoveryStyle(category);
}
