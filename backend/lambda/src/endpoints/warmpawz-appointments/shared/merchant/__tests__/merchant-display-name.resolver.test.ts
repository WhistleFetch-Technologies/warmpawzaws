import {
  isPlaceholderBusinessName,
  resolveMerchantDisplayName,
} from '../merchant-display-name.resolver';

describe('merchant-display-name.resolver', () => {
  it('treats empty, Business, and Vendor as placeholder names', () => {
    expect(isPlaceholderBusinessName('')).toBe(true);
    expect(isPlaceholderBusinessName('  Business  ')).toBe(true);
    expect(isPlaceholderBusinessName('Vendor')).toBe(true);
    expect(isPlaceholderBusinessName('Bindu Grooming')).toBe(false);
  });

  it('uses owner name for solo vendors with placeholder business name', () => {
    expect(
      resolveMerchantDisplayName({
        businessName: 'Business',
        ownerName: 'Bindu Sharma',
        vendorType: 'solo',
      }),
    ).toBe('Bindu Sharma');
  });

  it('keeps real business name for solo vendors', () => {
    expect(
      resolveMerchantDisplayName({
        businessName: 'Bindu Grooming',
        ownerName: 'Bindu Sharma',
        vendorType: 'solo',
      }),
    ).toBe('Bindu Grooming');
  });

  it('uses real business name when owner name is onboarding placeholder Vendor', () => {
    expect(
      resolveMerchantDisplayName({
        businessName: 'Bindushree M',
        ownerName: 'Vendor',
        vendorType: 'business',
      }),
    ).toBe('Bindushree M');
  });

  it('uses owner name for business/center vendors with placeholder business name', () => {
    expect(
      resolveMerchantDisplayName({
        businessName: 'Business',
        ownerName: 'Acme Owner',
        vendorType: 'business',
      }),
    ).toBe('Acme Owner');
  });

  it('returns Unknown when both names are onboarding placeholders', () => {
    expect(
      resolveMerchantDisplayName({
        businessName: 'Business',
        ownerName: 'Vendor',
        vendorType: 'business',
      }),
    ).toBe('Unknown');
  });

  it('falls back to owner name when business name is empty for any vendor type', () => {
    expect(
      resolveMerchantDisplayName({
        businessName: '',
        ownerName: 'Fallback Owner',
        vendorType: 'business',
      }),
    ).toBe('Fallback Owner');
  });
});
