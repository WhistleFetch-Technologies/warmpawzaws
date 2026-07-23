/**
 * Derive merchant role category from columns that exist on `roles`
 * (no `roles.category` column on dev/prod schema).
 */
export const MERCHANT_ROLE_CATEGORY_EXPR = `COALESCE(
  NULLIF(TRIM(r.config->>'category'), ''),
  NULLIF(TRIM(r.config->>'service_category'), ''),
  NULLIF(TRIM(r.config->>'serviceCategory'), ''),
  NULLIF(TRIM(r.role_type), '')
)`;

export function merchantCategoryFilterSql(categoryParam: string): string {
  return `(
    ${MERCHANT_ROLE_CATEGORY_EXPR} ILIKE ${categoryParam}
    OR r.customer_service ILIKE ${categoryParam}
    OR v.category ILIKE ${categoryParam}
    OR r.name ILIKE ${categoryParam}
  )`;
}
