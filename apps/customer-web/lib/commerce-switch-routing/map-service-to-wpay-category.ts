/**
 * Maps shell/search service keys to Warmpawz Pay hub category filter ids.
 * Keeps Wpay module navigation self-contained — no Marketplace imports.
 */
export function mapServiceKeyToWpayCategory(
  serviceKey: string,
  category?: string
): string {
  const token = String(category ?? serviceKey ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

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
    walker: 'walking',
    walking: 'walking',
    dog_walker: 'walking',
    boarding: 'boarding',
    pet_boarding: 'boarding',
    petboarding: 'boarding',
  };

  return map[token] ?? 'all';
}
