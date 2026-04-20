import { CATEGORY_ROLES } from '../endpoints/customer/constants';

/** Role name list (lowercase) for SQL LOWER(r.name) = ANY($n) — used by booking nearby vendor query. */
export function roleFilterListForCategory(category: string): string[] {
  const c = String(category || 'vet').toLowerCase().trim();
  const fromMap = CATEGORY_ROLES[c as keyof typeof CATEGORY_ROLES];
  if (fromMap?.length) {
    return [...new Set(fromMap.map((r) => String(r).toLowerCase()))];
  }
  if (c === 'pharmacy') {
    return ['pharmacy', 'pet_pharmacy', 'chemist'];
  }
  return (CATEGORY_ROLES.vet || ['veterinarian', 'vet', 'vet_solo', 'vet_clinic']).map((r) =>
    String(r).toLowerCase()
  );
}
