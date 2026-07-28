export interface MerchantCategoryInput {
  readonly roleCategory?: string | null;
  readonly customerService?: string | null;
  readonly serviceCategory?: string | null;
  readonly legacyCategory?: string | null;
}

function normalizeCategory(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  return value.length > 0 ? value : null;
}

function formatCategoryLabel(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function serviceCategoryFromRoleConfig(
  roleConfig: unknown,
): string | null {
  if (!roleConfig) {
    return null;
  }

  const config =
    typeof roleConfig === 'string'
      ? (() => {
          try {
            return JSON.parse(roleConfig) as Record<string, unknown>;
          } catch {
            return null;
          }
        })()
      : typeof roleConfig === 'object'
        ? (roleConfig as Record<string, unknown>)
        : null;

  if (!config) {
    return null;
  }

  return (
    normalizeCategory(config.service_category) ||
    normalizeCategory(config.serviceCategory) ||
    normalizeCategory(config.category)
  );
}

/**
 * Approved resolver order:
 * Role → Customer Service → Service Category → Legacy category → Unknown
 */
export function resolveMerchantCategory(input: MerchantCategoryInput): string {
  const roleCategory = normalizeCategory(input.roleCategory);
  if (roleCategory) {
    return formatCategoryLabel(roleCategory);
  }

  const customerService = normalizeCategory(input.customerService);
  if (customerService) {
    return formatCategoryLabel(customerService);
  }

  const serviceCategory = normalizeCategory(input.serviceCategory);
  if (serviceCategory) {
    return formatCategoryLabel(serviceCategory);
  }

  const legacyCategory = normalizeCategory(input.legacyCategory);
  if (legacyCategory) {
    return formatCategoryLabel(legacyCategory);
  }

  return 'Unknown';
}

export function isMerchantCategoryConfigured(category: string): boolean {
  return category.trim().length > 0 && category.toLowerCase() !== 'unknown';
}
