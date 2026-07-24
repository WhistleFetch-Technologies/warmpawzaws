import {
  isPlaceholderBusinessName,
  resolveMerchantDisplayName,
} from '../merchant-display-name.resolver';

describe('merchant-display-name.resolver', () => {
  it('treats empty, Business, and Vendor as placeholder business names', () => {
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

  it('keeps business name for non-solo vendors even when placeholder', () => {
    expect(
      resolveMerchantDisplayName({
        businessName: 'Business',
        ownerName: 'Acme Owner',
        vendorType: 'business',
      }),
    ).toBe('Business');
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
