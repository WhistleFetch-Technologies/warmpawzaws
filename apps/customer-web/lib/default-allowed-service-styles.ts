/**
 * Fallback allowed service styles when API omits them (after migration 625, rare).
 * Keys: tele = video consultation, at_home, at_center.
 */
export function defaultAllowedServiceStylesForRole(roleId?: string | null): string[] {
  const r = (roleId || '').toLowerCase().replace(/\s+/g, '_');
  if (r.includes('groom')) return ['at_home', 'at_center'];
  if (r.includes('walk')) return ['at_home'];
  if (r.includes('board')) return ['at_center'];
  if (r.includes('train')) return ['at_home', 'at_center'];
  if (r.includes('behavior') || r.includes('behaviour')) return ['at_home', 'at_center', 'tele'];
  if (r.includes('nutrition')) return ['at_home', 'at_center', 'tele'];
  if (r.includes('vet')) return ['at_home', 'at_center', 'tele'];
  return ['at_home', 'at_center'];
}

export function defaultAllowedServiceStylesForCategory(categoryId?: string | null): string[] {
  const c = (categoryId || '').toLowerCase().trim();
  if (c.includes('groom')) return ['at_home', 'at_center'];
  if (c.includes('walk')) return ['at_home'];
  if (c.includes('board')) return ['at_center'];
  if (c.includes('train')) return ['at_home', 'at_center'];
  if (c.includes('behavior') || c.includes('behaviour')) return ['at_home', 'at_center', 'tele'];
  if (c.includes('wellness') || c.includes('nutrition') || c.includes('pharmacy')) {
    return ['at_home', 'at_center', 'tele'];
  }
  if (
    c.includes('veterinary') ||
    c === 'vet' ||
    c.includes('diagnostic') ||
    c.includes('emergency') ||
    c.includes('specialty')
  ) {
    return ['at_home', 'at_center', 'tele'];
  }
  return ['at_home', 'at_center'];
}
