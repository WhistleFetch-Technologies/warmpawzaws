/**
 * Maps Admin Catalogue → Categories slug (`service_categories.category_id`) to
 * `roles.customer_service` values (see migration 139 roles_customer_service_check).
 * Used so GST "Applicable Roles" can list roles the same way Vendor Roles groups them,
 * even when specialization_master.applicable_roles is empty or incomplete.
 */

const VALID_CUSTOMER_SERVICES = new Set([
  'vet',
  'grooming',
  'training',
  'shop',
  'walker',
  'boarding',
  'adoption',
  'cafes',
  'photography',
  'insurance',
  'breeder',
  'ambulance',
  'nutritionist',
  'relocation',
  'resort',
  'holiday',
  'sunset',
  'sitter',
]);

/** Slug / category_id (lowercase) → one or more customer_service buckets */
const SLUG_TO_CUSTOMER_SERVICES: Record<string, string[]> = {
  veterinary: ['vet'],
  'vet-care': ['vet'],
  diagnostic: ['vet'],
  pharmacy: ['vet'],
  emergency: ['vet', 'ambulance'],
  wellness: ['vet', 'nutritionist'],
  specialty: ['vet'],
  walking: ['walker'],
  ecommerce: ['shop'],
  'pet-shop': ['shop'],
  store: ['shop'],
  boarding: ['boarding', 'sitter'],
  'pet-boarding': ['boarding'],
  sitter: ['sitter'],
  'pet-sitter': ['sitter'],
  cafe: ['cafes'],
};

/**
 * Returns distinct customer_service values for GST role listing.
 */
export function customerServicesForCatalogCategorySlug(slug: string | null | undefined): string[] {
  const s = String(slug ?? '')
    .trim()
    .toLowerCase();
  if (!s) return [];

  if (VALID_CUSTOMER_SERVICES.has(s)) {
    return [s];
  }

  const mapped = SLUG_TO_CUSTOMER_SERVICES[s];
  if (mapped?.length) {
    return [...new Set(mapped.filter((x) => VALID_CUSTOMER_SERVICES.has(x)))];
  }

  return [];
}
