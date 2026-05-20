/**
 * Legacy seed catalog rewards (migration 723) — hidden from customer UI.
 * Catalog rows and redeem code remain; flip by removing IDs from this set.
 */
export const HIDDEN_LEGACY_CATALOG_REWARD_IDS = new Set([
  'e4b8c0d0-1111-4111-a111-000000000001', // ₹100 Off Grooming
  'e4b8c0d0-2222-4222-a222-000000000002', // ₹200 Off Vet Visit
  'e4b8c0d0-3333-4333-a333-000000000003', // Free Pet Treat
]);

export function isHiddenLegacyCatalogReward(id: string | null | undefined): boolean {
  if (!id) return false;
  return HIDDEN_LEGACY_CATALOG_REWARD_IDS.has(String(id).trim().toLowerCase());
}

export function filterVisibleCatalogRewards<T extends { id: string }>(items: T[]): T[] {
  return items.filter(r => !isHiddenLegacyCatalogReward(r.id));
}
