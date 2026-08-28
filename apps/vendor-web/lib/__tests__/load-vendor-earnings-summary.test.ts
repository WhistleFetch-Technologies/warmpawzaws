import { formatPayBillEarningsLabel } from '../load-vendor-earnings-summary';

describe('formatPayBillEarningsLabel', () => {
  it('includes the customer name after Pay Bill', () => {
    expect(formatPayBillEarningsLabel('Vedu Gowda')).toBe('Pay Bill → Vedu Gowda');
  });

  it('falls back to Customer when the name is missing', () => {
    expect(formatPayBillEarningsLabel(null)).toBe('Pay Bill → Customer');
    expect(formatPayBillEarningsLabel('   ')).toBe('Pay Bill → Customer');
  });
});
