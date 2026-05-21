import { getSearchCategoryAliases, normalizeCategoryToken } from '@warmpawz/service-launch-mappings';

const HUB_QUERY_HINTS: Record<string, string[]> = {
  vet: ['vet', 'veterinar', 'doctor', 'clinic', 'animal hosp', 'pet hosp'],
  grooming: ['groom', 'salon', 'spa', 'bath', 'haircut', 'trim', 'nail'],
  training: [
    'train',
    'obedi',
    'behavior',
    'coach',
    'agility',
    'puppy class',
    'dog class',
    'pet class',
    'training',
    'trainer',
  ],
  boarding: ['board', 'kennel', 'daycare', 'hostel'],
  walker: ['walk', 'walker', 'dog walk', 'pet walk', 'stroll', 'exercise'],
  cafe: ['cafe', 'coffee', 'pet cafe', 'café', 'bistro', 'lounge'],
  resort: ['resort', 'holiday', 'vacation', 'lodge', 'hotel', 'staycation', 'getaway'],
  pharmacy: ['pharma', 'medicine', 'meds', 'drug', 'prescription', 'chemist', 'dispens', 'tablet', 'rx'],
  nutritionist: [
    'nutrition',
    'nutritionist',
    'diet',
    'meal plan',
    'pet food',
    'feeding',
    'weight',
  ],
  nutrition: [
    'nutrition',
    'nutritionist',
    'diet',
    'meal plan',
    'pet food',
    'feeding',
    'weight',
  ],
};

function normalizedAllowedTokens(hubId: string): Set<string> {
  const list = getSearchCategoryAliases(hubId);
  return new Set(list.map((s) => normalizeCategoryToken(s)).filter(Boolean));
}

/** When the user has a text query, infer if that query is “about” a hub (for vendors missing category). */
function hubMatchesSearchText(hubId: string, searchQuery: string): boolean {
  const q = (searchQuery || '').toLowerCase().trim();
  if (!q) return false;
  const hints = HUB_QUERY_HINTS[hubId];
  if (hints?.length && hints.some((h) => q.includes(h))) return true;
  return q.includes(hubId);
}

/** Match hub from business / service name when category column is empty (common in legacy data). Keyword search only. */
function hubMatchesResultName(hubId: string, name: string | undefined): boolean {
  const n = (name || '').toLowerCase().trim();
  if (!n) return false;
  const hints = HUB_QUERY_HINTS[hubId];
  if (hints?.some((h) => n.includes(h))) return true;
  if (n.includes(hubId)) return true;
  return false;
}

export type HubFilterableResult = { type: string; category: string; name?: string };

const HUB_INFER_ORDER = [
  'nutritionist',
  'pharmacy',
  'grooming',
  'training',
  'boarding',
  'walker',
  'resort',
  'cafe',
  'vet',
] as const;

/** Infer search hub chip from free-text (e.g. "dog walker" → walker) for discovery parity on /search. */
export function inferHubSlugFromSearchQuery(searchQuery: string): string | null {
  const q = (searchQuery || '').trim();
  if (!q) return null;
  for (const hub of HUB_INFER_ORDER) {
    if (hubMatchesSearchText(hub, q)) return hub;
  }
  if (hubMatchesSearchText('nutrition', q)) return 'nutritionist';
  return null;
}

/** One card per vendor when both vendor + service rows are returned from GET /search. */
export function dedupeSearchVendorAndServiceRows<
  T extends { type: string; id: string; vendorOwnerId?: string },
>(results: T[]): T[] {
  const vendorRowIds = new Set(results.filter((r) => r.type === 'vendor').map((r) => r.id));
  return results.filter(
    (r) => r.type === 'vendor' || !(r.vendorOwnerId && vendorRowIds.has(r.vendorOwnerId))
  );
}

/**
 * Client-side chip filter for GET /search rows. Hub-only browse uses strict canonical category tokens only
 * (same idea as SQL hub browse). With a keyword query, legacy rows without category may still match via hints.
 */
export function applyHubCategoryFilter<T extends HubFilterableResult>(
  results: T[],
  hubId: string,
  searchQuery: string
): T[] {
  if (!hubId) return results;
  const allowed = normalizedAllowedTokens(hubId);
  const q = (searchQuery || '').trim();
  const strictHubBrowse = !q;

  return results.filter((r) => {
    const c = normalizeCategoryToken(r.category || '');
    if (c && allowed.has(c)) return true;
    if (c && !allowed.has(c)) return false;
    if (strictHubBrowse) return false;
    if (!c && r.type === 'vendor' && hubMatchesSearchText(hubId, searchQuery)) return true;
    if (!c && hubMatchesResultName(hubId, r.name)) return true;
    return false;
  });
}
