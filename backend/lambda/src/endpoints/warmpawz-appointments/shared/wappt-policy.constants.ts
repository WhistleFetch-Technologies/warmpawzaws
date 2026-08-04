export const WAPPT_COMMERCE_MODE = 'warmpawz_appointments';

export const WAPPT_HUB_CATEGORIES = [
  'vet',
  'grooming',
  'training',
  'behaviorist',
  'walker',
  'boarding',
  'sitting',
  'nutrition',
] as const;

export type WapptHubCategorySlug = (typeof WAPPT_HUB_CATEGORIES)[number];

export function normalizeWapptHubCategory(value: string | null | undefined): WapptHubCategorySlug | null {
  const v = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
  if (!v) return null;
  const aliases: Record<string, WapptHubCategorySlug> = {
    vet: 'vet',
    veterinarian: 'vet',
    vet_clinic: 'vet',
    grooming: 'grooming',
    groomer: 'grooming',
    pet_groomer: 'grooming',
    training: 'training',
    trainer: 'training',
    pet_trainer: 'training',
    behaviorist: 'behaviorist',
    behaviourist: 'behaviorist',
    pet_behaviorist: 'behaviorist',
    walker: 'walker',
    pet_walker: 'walker',
    boarding: 'boarding',
    pet_boarding: 'boarding',
    sitting: 'sitting',
    pet_sitter: 'sitting',
    pet_sitting: 'sitting',
    nutrition: 'nutrition',
    nutritionist: 'nutrition',
    pet_nutritionist: 'nutrition',
  };
  return aliases[v] ?? (WAPPT_HUB_CATEGORIES.includes(v as WapptHubCategorySlug) ? (v as WapptHubCategorySlug) : null);
}

export function isWapptPolicyEligibleBooking(row: {
  commerce_mode?: string | null;
  commerceMode?: string | null;
  service_type?: string | null;
  serviceType?: string | null;
}): boolean {
  const mode = String(row.commerce_mode ?? row.commerceMode ?? '').toLowerCase();
  const style = String(row.service_type ?? row.serviceType ?? '').toLowerCase();
  return mode === WAPPT_COMMERCE_MODE && style !== 'tele';
}
