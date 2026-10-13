import { getRoleKYCConfig } from '../kyc-form-fields';

describe('insurance KYC alias', () => {
  it('resolves insurance and pet_insurance to the same form', () => {
    const insurance = getRoleKYCConfig('insurance');
    const legacy = getRoleKYCConfig('pet_insurance');
    expect(insurance?.roleName).toBe('insurance');
    expect(legacy).toEqual(insurance);
    expect(insurance?.fields.some((field) => field.id === 'irdaiLicenceNumber')).toBe(true);
    expect(insurance?.fields.map((field) => field.type)).toEqual(
      expect.arrayContaining(['number', 'date', 'multiselect', 'radio']),
    );
  });
});
