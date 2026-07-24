import {
  VENDOR_APPROVED_ACTIVE_SQL,
  WPAY_VENDOR_PAY_BILL_READY_SQL,
  wpayCatalogueCustomerVisibleSql,
} from '../merchant-eligibility-sql';

describe('merchant-eligibility-sql', () => {
  it('does not reference pay_bill_enabled column', () => {
    expect(wpayCatalogueCustomerVisibleSql('c')).not.toContain('pay_bill_enabled');
    expect(WPAY_VENDOR_PAY_BILL_READY_SQL).not.toContain('pay_bill_enabled');
    expect(VENDOR_APPROVED_ACTIVE_SQL).toContain("'approved'");
    expect(VENDOR_APPROVED_ACTIVE_SQL).toContain("'active'");
  });

  it('requires published catalogue for customer visibility', () => {
    expect(wpayCatalogueCustomerVisibleSql('c')).toContain("publish_status = 'published'");
    expect(wpayCatalogueCustomerVisibleSql('c')).toContain('bank_verified = true');
  });
});
