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

/** Derived solo flag — `vendors.is_solo_provider` is not present on RDS. */
export const MERCHANT_SOLO_PROVIDER_EXPR = `(
  LOWER(COALESCE(v.vendor_type, '')) = 'solo'
  OR LOWER(COALESCE(r.config->>'vendorConfiguration', '')) = 'solo'
  OR LOWER(COALESCE(r.name, '')) LIKE '%solo%'
)`;

export function merchantCategoryFilterSql(categoryParam: string): string {
  return `(
    ${MERCHANT_ROLE_CATEGORY_EXPR} ILIKE ${categoryParam}
    OR r.customer_service ILIKE ${categoryParam}
    OR v.category ILIKE ${categoryParam}
    OR r.name ILIKE ${categoryParam}
  )`;
}
