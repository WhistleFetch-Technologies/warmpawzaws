/**
 * Admin role config stores `serviceStyles.selected` (wizard checkboxes) and
 * per-type `solo` / `business` buckets. Vendors should see the intersection when
 * both exist so e.g. solo template defaults do not imply tele is allowed when
 * admin only selected at_home.
 */
function stripCenterStylesForSolo(
  vendorConfiguration: 'solo' | 'business' | null | undefined,
  styles: string[]
): string[] {
  if (vendorConfiguration !== 'solo') return styles;
  return styles.filter((s) => s !== 'at_center' && s !== 'at_clinic');
}

export function computeEffectiveAllowedServiceStyles(
  selected: string[] | undefined,
  vendorConfiguration: 'solo' | 'business' | null | undefined,
  serviceStylesConfig:
    | { solo?: string[]; business?: string[]; selected?: string[] }
    | undefined
): string[] {
  const sel = Array.isArray(selected) ? [...selected] : [];
  const cfg = serviceStylesConfig || {};
  const key =
    vendorConfiguration === 'solo' || vendorConfiguration === 'business'
      ? vendorConfiguration
      : null;
  const typeBucket = key ? [...(cfg[key] || [])] : [];

  if (sel.length > 0 && typeBucket.length > 0) {
    const allow = new Set(typeBucket);
    const inter = sel.filter((s) => allow.has(s));
    if (inter.length > 0) {
      return stripCenterStylesForSolo(vendorConfiguration, inter);
    }
  }
  let result: string[] = [];
  if (sel.length > 0) result = sel;
  else if (typeBucket.length > 0) result = typeBucket;
  return stripCenterStylesForSolo(vendorConfiguration, result);
}
