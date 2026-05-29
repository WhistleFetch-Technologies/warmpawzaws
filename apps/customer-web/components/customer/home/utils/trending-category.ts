/** Trending API `category` is role_id; map to problem-grid category slug. */
export function trendingRoleIdToCategorySlug(roleId: string): string {
  const r = roleId.toLowerCase();
  if (r.includes('groom')) return 'grooming';
  if (r.includes('train')) return 'training';
  if (r.includes('walk')) return 'walker';
  if (r.includes('board')) return 'boarding';
  if (r.includes('behav')) return 'behavioral';
  if (r.includes('nutrition')) return 'nutrition';
  if (r.includes('vet')) return 'vet';
  return 'vet';
}
