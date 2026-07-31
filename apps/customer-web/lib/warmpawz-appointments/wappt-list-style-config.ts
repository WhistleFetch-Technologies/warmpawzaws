/** WAPPT discovery list — only centre + home (no "View all"). */
import {
  getWapptAllowedDiscoveryStyles,
  getWapptDefaultDiscoveryStyle,
  type WapptDiscoveryStyle,
} from '@/lib/wappt-hub-registry';

export type WapptDiscoveryListStyle = WapptDiscoveryStyle;

export const WAPPT_DISCOVERY_STYLE_FILTERS: {
  id: WapptDiscoveryListStyle;
  label: string;
}[] = [
  { id: 'at_center', label: 'At centre' },
  { id: 'at_home', label: 'At home' },
];

/** @deprecated use getWapptDefaultDiscoveryStyle(category) */
export const WAPPT_DISCOVERY_DEFAULT_STYLE: WapptDiscoveryListStyle = 'at_center';

export function resolveWapptDiscoveryStyleFilters(category: string) {
  const allowed = getWapptAllowedDiscoveryStyles(category);
  return WAPPT_DISCOVERY_STYLE_FILTERS.filter((f) => allowed.includes(f.id));
}

export function resolveWapptDiscoveryDefaultStyle(category: string): WapptDiscoveryListStyle {
  return getWapptDefaultDiscoveryStyle(category);
}
