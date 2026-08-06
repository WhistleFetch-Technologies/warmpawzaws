import {
  resolveBoardingListVendorProfileServiceStyle,
  resolveWalkInProviderProfileServiceStyle,
  resolveWapptVendorProfileServiceStyle,
} from '../resolve-wappt-vendor-profile-service-style';

describe('resolveWapptVendorProfileServiceStyle', () => {
  it('uses explicit preferredServiceStyle when present', () => {
    expect(
      resolveWapptVendorProfileServiceStyle(
        { preferredServiceStyle: 'at_home' },
        'grooming',
      ),
    ).toBe('at_home');
  });

  it('resolves solo at_home groomer from featured hub role label', () => {
    expect(
      resolveWapptVendorProfileServiceStyle(
        { roleDisplayName: 'Groomer (Solo)' },
        'grooming',
      ),
    ).toBe('at_home');
  });

  it('resolves solo at_home vet from featured hub role label', () => {
    expect(
      resolveWapptVendorProfileServiceStyle(
        { roleDisplayName: 'Veterinarian (Solo)' },
        'vet',
      ),
    ).toBe('at_home');
  });

  it('solo at_home overrides wrong API at_center from walk-in subtitle', () => {
    expect(
      resolveWapptVendorProfileServiceStyle(
        {
          serviceStyle: 'at_center',
          subtitle: 'Vet · Veterinarian (Solo)',
          displayName: 'Bindu Vet Clinic',
        },
        'vet',
      ),
    ).toBe('at_home');
  });

  it('resolveWalkInProviderProfileServiceStyle uses provider subtitle', () => {
    expect(
      resolveWalkInProviderProfileServiceStyle({
        category: 'grooming',
        subtitle: 'Groomer (Solo)',
        displayName: 'Bindu Grooming Service',
        serviceStyle: 'at_center',
      }),
    ).toBe('at_home');
  });

  it('keeps at_center clinic unchanged', () => {
    expect(
      resolveWapptVendorProfileServiceStyle(
        { roleDisplayName: 'Grooming Centre', serviceStyle: 'at_center' },
        'grooming',
      ),
    ).toBe('at_center');
  });

  it('uses dominant nested service style when only home services exist', () => {
    expect(
      resolveWapptVendorProfileServiceStyle(
        {
          services: [{ serviceStyle: 'at_home', name: 'Home Grooming' }],
        },
        'grooming',
      ),
    ).toBe('at_home');
  });

  it('defaults walker to at_home', () => {
    expect(resolveWapptVendorProfileServiceStyle({}, 'walker')).toBe('at_home');
  });

  it('defaults sitting to at_home', () => {
    expect(resolveWapptVendorProfileServiceStyle({}, 'sitting')).toBe('at_home');
  });

  it('defaults boarding to at_center', () => {
    expect(resolveWapptVendorProfileServiceStyle({}, 'boarding')).toBe('at_center');
  });

  it('falls back to category default when style is missing', () => {
    expect(resolveWapptVendorProfileServiceStyle({}, 'training')).toBe('at_center');
  });

  it('resolves BoardingListVendor via raw + planRows', () => {
    expect(
      resolveBoardingListVendorProfileServiceStyle(
        {
          raw: { roleDisplayName: 'Trainer (Solo)' },
          planRows: [{ serviceStyle: 'at_home' }],
        },
        'training',
      ),
    ).toBe('at_home');
  });
});
