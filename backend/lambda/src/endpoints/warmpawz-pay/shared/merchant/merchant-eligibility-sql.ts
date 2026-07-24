import { PUBLISHED } from '../../constants/publish-status';

/** Vendor platform gate: approved or active profile, not deleted. */
export const VENDOR_APPROVED_ACTIVE_SQL = `
  (
    LOWER(v.status) IN ('approved', 'active')
    AND COALESCE(v.is_active, true) = true
    AND (v.is_deleted IS NOT TRUE)
  )
`;

export const VENDOR_BANK_VERIFIED_SQL = `(v.bank_verified = true)`;

/** Customer Pay Bill list: admin published + approved/active + bank verified. */
export function wpayCatalogueCustomerVisibleSql(catalogueAlias = 'c'): string {
  return `(
    ${catalogueAlias}.publish_status = '${PUBLISHED}'
    AND ${VENDOR_APPROVED_ACTIVE_SQL}
    AND ${VENDOR_BANK_VERIFIED_SQL}
  )`;
}

/** Vendor would be customer-visible once admin publishes (no catalogue row yet). */
export const WPAY_VENDOR_PAY_BILL_READY_SQL = `
  (
    ${VENDOR_APPROVED_ACTIVE_SQL}
    AND ${VENDOR_BANK_VERIFIED_SQL}
  )
`;
