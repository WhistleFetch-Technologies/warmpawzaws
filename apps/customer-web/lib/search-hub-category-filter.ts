/**
 * Maps /search page hub chips → vendor_services / vendors.category values (lowercase match).
 * Keep aligned with backend CATEGORY_ROLES (training_center, pet_walker, holiday→resort, etc.).
 */
const HUB_TO_DB_CATEGORIES: Record<string, string[]> = {
  vet: ['vet', 'veterinarian', 'vet_clinic', 'vet_solo', 'veterinary', 'pet_clinic'],
  grooming: ['groomer', 'grooming', 'grooming_salon', 'pet_groomer', 'groomer_center', 'groomer_solo', 'grooming_solo'],
  training: [
    'trainer',
    'training',
    'pet_trainer',
    'trainer_center',
    'training_center',
    'trainer_solo',
    'training_solo',
    'dog_trainer',
    'pet_training',
    'agility',
    'obedience',
  ],
  boarding: ['boarding', 'pet_boarder', 'pet_boarding'],
  walker: [
    'walker',
    'pet_walker',
    'dog_walker',
    'walker_solo',
    'dog_walking',
    'pet_walking',
    'walking',
  ],
  cafe: ['cafe', 'pet_cafe', 'cafes', 'pet_cafe_owner', 'animal_cafe'],
  resort: ['resort', 'pet_resort', 'holiday', 'pet_holiday', 'pet_lodge', 'pet_hotel', 'vacation'],
  pharmacy: [
    'pharmacy',
    'pet_pharmacy',
    'chemist',
    'drugstore',
    'medicine',
    'medical_store',
    'dispensary',
    'e_pharmacy',
    'online_pharmacy',
  ],
};

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
};

function normalizedAllowed(hubId: string): Set<string> {
  const raw = HUB_TO_DB_CATEGORIES[hubId];
  const list = raw?.length ? [hubId, ...raw] : [hubId];
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
