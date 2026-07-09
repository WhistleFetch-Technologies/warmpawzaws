/** Client mirror of backend hubSlugToDiscoveryContext default styles for search filtering. */
export function hubSlugToDiscoveryContext(
  categorySlug: string | undefined
): { discoverCategory: string; serviceStyle: 'at_center' | 'at_home' | 'tele' } | null {
  const slug = String(categorySlug || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (!slug) return null;

  switch (slug) {
    case 'vet':
    case 'veterinary':
    case 'veterinarian':
      return { discoverCategory: 'vet', serviceStyle: 'at_center' };
    case 'grooming':
    case 'groomer':
      return { discoverCategory: 'grooming', serviceStyle: 'at_center' };
    case 'training':
    case 'trainer':
      return { discoverCategory: 'training', serviceStyle: 'at_center' };
    case 'boarding':
    case 'pet_boarding':
      return { discoverCategory: 'boarding', serviceStyle: 'at_center' };
    case 'walker':
    case 'walking':
    case 'walk':
      return { discoverCategory: 'walker', serviceStyle: 'at_home' };
    case 'pharmacy':
      return { discoverCategory: 'pharmacy', serviceStyle: 'at_center' };
    case 'nutritionist':
    case 'nutrition':
      return { discoverCategory: 'nutritionist', serviceStyle: 'tele' };
    case 'pet_sitter':
    case 'pet-sitter':
    case 'sitting':
    case 'sitter':
      return { discoverCategory: 'pet-sitter', serviceStyle: 'at_home' };
    default:
      return null;
  }
}
