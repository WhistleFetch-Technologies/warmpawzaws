/**
 * Maps search taxonomy hub slugs to Warmpawz Pay list category filter ids.
 * Mirrors apps/customer-web/lib/commerce-switch-routing/map-service-to-wpay-category.ts
 */
export function mapHubSlugToWpayCategory(hubSlug: string | null | undefined): string | null {
  const token = String(hubSlug ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  if (!token) return null;

  const map: Record<string, string> = {
    vet: 'vet',
    veterinarian: 'vet',
    vet_clinic: 'vet',
    grooming: 'grooming',
    groomer: 'grooming',
    pet_groomer: 'grooming',
    training: 'training',
    trainer: 'training',
    pet_trainer: 'training',
    behaviorist: 'training',
    behaviourist: 'training',
    pet_behaviorist: 'training',
    walker: 'walking',
    walking: 'walking',
    dog_walker: 'walking',
    boarding: 'boarding',
    pet_boarding: 'boarding',
    sitting: 'sitting',
    pet_sitter: 'sitting',
    pet_sitting: 'sitting',
    nutrition: 'nutrition',
    nutritionist: 'nutrition',
    pet_nutritionist: 'nutrition',
  };

  const mapped = map[token];
  return mapped ?? null;
}
