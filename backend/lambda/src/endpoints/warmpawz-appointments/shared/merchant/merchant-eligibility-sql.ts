import { wapptCatalogueCustomerVisibleSql } from '../catalogue-eligibility-sql';

/** Vendor platform gate: approved or active profile, not deleted. */
export const VENDOR_APPROVED_ACTIVE_SQL = `
  (
    LOWER(v.status) IN ('approved', 'active')
    AND COALESCE(v.is_active, true) = true
    AND (v.is_deleted IS NOT TRUE)
  )
`;

/** @deprecated Prefer wapptCatalogueCustomerVisibleSql from shared/catalogue-eligibility-sql.ts */
export const WapptCatalogueCustomerVisibleSql = wapptCatalogueCustomerVisibleSql;

/** Vendor would be customer-visible once admin publishes (no catalogue row yet). */
export const WAPPT_VENDOR_APPOINTMENTS_READY_SQL = VENDOR_APPROVED_ACTIVE_SQL;

/** @deprecated Use WAPPT_VENDOR_APPOINTMENTS_READY_SQL */
export const WAPPT_VENDOR_PAY_BILL_READY_SQL = WAPPT_VENDOR_APPOINTMENTS_READY_SQL;
