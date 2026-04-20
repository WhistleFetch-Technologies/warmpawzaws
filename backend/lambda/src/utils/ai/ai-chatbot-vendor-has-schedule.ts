/**
 * AI chatbot (booking + symptoms) should only suggest vendors with at least one
 * bookable window in `vendor_availability_v2` — not providers with an empty
 * or inactive schedule. Aligns with slot generation that reads VA2.
 *
 * @param vAlias  SQL alias for the `vendors` row (default `v`).
 * @returns       SQL fragment: `EXISTS (SELECT 1 FROM vendor_availability_v2 ...)`
 *                (use with `AND ...` in a WHERE clause)
 */
export function sqlAndVendorHasBookableV2Windows(vAlias: string = 'v'): string {
  // Same vendor_id resolution pattern as service-discovery: vendors.id, or
  // availability rows stored under `vendor_identity.id` for a linked vendor/phone.
  return `EXISTS (
    SELECT 1
    FROM vendor_availability_v2 va
    WHERE (
      va.vendor_id = ${vAlias}.id
      OR va.vendor_id IN (
        SELECT vi.id
        FROM vendor_identity vi
        WHERE vi.vendor_id = ${vAlias}.id
          OR (vi.phone IS NOT NULL AND ${vAlias}.phone IS NOT NULL AND vi.phone = ${vAlias}.phone)
      )
    )
    AND COALESCE(va.is_active, true) = true
  )`;
}
