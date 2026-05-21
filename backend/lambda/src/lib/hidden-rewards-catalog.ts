/**
 * Legacy seed catalog rewards (migration 723) — excluded from available API and redeem.
 * Rows stay in rewards_catalog; remove IDs here to show/enable again.
 */
export const HIDDEN_LEGACY_CATALOG_REWARD_IDS = new Set([
  'e4b8c0d0-1111-4111-a111-000000000001',
  'e4b8c0d0-2222-4222-a222-000000000002',
  'e4b8c0d0-3333-4333-a333-000000000003',
]);

export function isHiddenLegacyCatalogReward(id: string | null | undefined): boolean {
  if (!id) return false;
  return HIDDEN_LEGACY_CATALOG_REWARD_IDS.has(String(id).trim().toLowerCase());
}
