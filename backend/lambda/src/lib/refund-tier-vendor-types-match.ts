/**
 * SQL fragment: tier.vendor_types is empty (wildcard) OR matches the vendor's role
 * by canonical role name, role UUID, or hyphen/underscore-normalized name (admin UI slugs).
 *
 * @param roleNameParam 1-based placeholder index for roles.name (text)
 * @param roleIdParam 1-based placeholder index for roles.id::text (uuid string)
 */
export function sqlRefundTierVendorTypesMatch(roleNameParam: number, roleIdParam: number): string {
  return `(
    COALESCE(array_length(vendor_types, 1), 0) = 0
    OR EXISTS (
      SELECT 1 FROM unnest(COALESCE(vendor_types, ARRAY[]::text[])) AS _u(_t)
      WHERE NULLIF(trim(_t), '') IS NOT NULL
        AND (
          ($${roleNameParam}::text IS NOT NULL AND $${roleNameParam}::text != ''
            AND lower(trim(_t)) = lower(trim($${roleNameParam}::text)))
          OR ($${roleIdParam}::text IS NOT NULL AND $${roleIdParam}::text != ''
            AND lower(trim(_t)) = lower(trim($${roleIdParam}::text)))
          OR ($${roleNameParam}::text IS NOT NULL AND $${roleNameParam}::text != ''
            AND lower(replace(trim(_t), '-', '_')) = lower(replace(trim($${roleNameParam}::text), '-', '_')))
        )
    )
  )`;
}
