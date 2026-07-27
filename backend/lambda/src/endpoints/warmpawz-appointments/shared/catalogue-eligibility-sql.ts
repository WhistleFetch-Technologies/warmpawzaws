import { PUBLISHED } from '../constants/publish-status';
import { VENDOR_APPROVED_ACTIVE_SQL } from './merchant/merchant-eligibility-sql';

/** Customer appointments list: admin published + vendor approved/active (no bank_verified gate). */
export function wapptCatalogueCustomerVisibleSql(catalogueAlias = 'c'): string {
  return `(
    ${catalogueAlias}.publish_status = '${PUBLISHED}'
    AND ${VENDOR_APPROVED_ACTIVE_SQL}
  )`;
}
