import { isWarmpawzInsuranceAdminEnabled, isWarmpawzInsuranceEnabled } from '../warmpawz-insurance-flags';

describe('Warmpawz Insurance flags', () => {
  it('stays off unless the env value is explicitly true', () => {
    expect(isWarmpawzInsuranceEnabled({})).toBe(false);
    expect(isWarmpawzInsuranceAdminEnabled({ WARMPAWZ_INSURANCE_ADMIN_ENABLED: 'false' })).toBe(false);
    expect(isWarmpawzInsuranceEnabled({ WARMPAWZ_INSURANCE_ENABLED: 'true' })).toBe(true);
    expect(isWarmpawzInsuranceAdminEnabled({ WARMPAWZ_INSURANCE_ADMIN_ENABLED: '1' })).toBe(true);
  });
});
