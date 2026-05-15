import { getSearchCategoryAliases } from '@warmpawz/service-launch-mappings';

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

function normalizedAllowed(hubId: string): Set<string> {
  const list = getSearchCategoryAliases(hubId);
  return new Set(list.map((s) => s.toLowerCase()));
}

/** When the user has a text query, infer if that query is “about” a hub (for vendors missing category). */
function hubMatchesSearchText(hubId: string, searchQuery: string): boolean {
  const q = (searchQuery || '').toLowerCase().trim();
  if (!q) return false;
  const hints = HUB_QUERY_HINTS[hubId];
  if (hints?.length && hints.some((h) => q.includes(h))) return true;
  return q.includes(hubId);
}

/** Match hub from business / service name when category column is empty (common in legacy data). */
function hubMatchesResultName(hubId: string, name: string | undefined): boolean {
  const n = (name || '').toLowerCase().trim();
  if (!n) return false;
  const hints = HUB_QUERY_HINTS[hubId];
  if (hints?.some((h) => n.includes(h))) return true;
  if (n.includes(hubId)) return true;
  return false;
}

export type HubFilterableResult = { type: string; category: string; name?: string };

/**
 * Client-side chip filter for GET /search results (used when q is present so chip changes do not re-hit API).
 */
export function applyHubCategoryFilter<T extends HubFilterableResult>(
  results: T[],
  hubId: string,
  searchQuery: string
): T[] {
  if (!hubId) return results;
  const allowed = normalizedAllowed(hubId);
  return results.filter((r) => {
    const c = (r.category || '').trim().toLowerCase();
    if (c && allowed.has(c)) return true;
    if (c && [...allowed].some((a) => a.length >= 3 && c.includes(a))) return true;
    if (!c && r.type === 'vendor' && hubMatchesSearchText(hubId, searchQuery)) return true;
    if (!c && hubMatchesResultName(hubId, r.name)) return true;
    return false;
  });
}
