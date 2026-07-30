/** WAPPT discovery list — only centre + home (no "View all"). */
export type WapptDiscoveryListStyle = 'at_center' | 'at_home';

export const WAPPT_DISCOVERY_STYLE_FILTERS: {
  id: WapptDiscoveryListStyle;
  label: string;
}[] = [
  { id: 'at_center', label: 'At centre' },
  { id: 'at_home', label: 'At home' },
];

export const WAPPT_DISCOVERY_DEFAULT_STYLE: WapptDiscoveryListStyle = 'at_center';
