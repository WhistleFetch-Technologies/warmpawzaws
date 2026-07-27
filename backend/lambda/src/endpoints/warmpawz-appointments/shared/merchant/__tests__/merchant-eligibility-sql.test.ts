import {
  VENDOR_APPROVED_ACTIVE_SQL,
  WAPPT_VENDOR_APPOINTMENTS_READY_SQL,
  WapptCatalogueCustomerVisibleSql,
} from '../merchant-eligibility-sql';
import { wapptCatalogueCustomerVisibleSql } from '../../catalogue-eligibility-sql';

describe('catalogue-eligibility-sql', () => {
  it('exports CP1 customer visibility SQL without bank_verified gate', () => {
    expect(wapptCatalogueCustomerVisibleSql('c')).toContain("publish_status = 'published'");
    expect(wapptCatalogueCustomerVisibleSql('c')).not.toContain('bank_verified');
    expect(wapptCatalogueCustomerVisibleSql('c')).toContain("'approved'");
    expect(wapptCatalogueCustomerVisibleSql('c')).toContain("'active'");
  });

  it('keeps merchant-eligibility-sql re-exports aligned', () => {
    expect(WapptCatalogueCustomerVisibleSql('c')).toBe(wapptCatalogueCustomerVisibleSql('c'));
    expect(WAPPT_VENDOR_APPOINTMENTS_READY_SQL).not.toContain('bank_verified');
    expect(VENDOR_APPROVED_ACTIVE_SQL).toContain("'approved'");
  });
});
