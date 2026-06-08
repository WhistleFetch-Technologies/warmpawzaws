import {
  buildVendorProfileShareUrl,
  buildVendorSharePlaceholderRedirectUrl,
  homeServiceTypeToPersona,
  parseVendorShareUrl,
  readVendorIdFromShareLocation,
  roleIdToSharePersona,
  vendorShareParamsToInitialNavigation,
  vendorSharePathNeedsPlaceholderRedirect,
  vendorShareUrlToAppPath,
} from '../vendor-profile-share';

describe('vendor-profile-share', () => {
  it('builds canonical vendor share URLs with vendorId and persona', () => {
    const url = buildVendorProfileShareUrl({
      vendorId: 'abc-123',
      persona: 'vet',
      vendorName: 'Healing Tails',
      serviceStyle: 'at_center',
    });

    expect(url).toContain('/vendor/placeholder?');
    expect(url).toContain('vendorId=abc-123');
    expect(url).toContain('persona=vet');
    expect(url).toContain('serviceStyle=at_center');
    expect(url).toContain('name=Healing');
  });

  it('builds boarding share URLs on pet-boarding route', () => {
    const url = buildVendorProfileShareUrl({
      vendorId: 'board-1',
      persona: 'boarding',
      serviceSlug: 'daycare',
    });

    expect(url).toContain('/pet-boarding/vendor/placeholder?');
    expect(url).toContain('vendorId=board-1');
    expect(url).toContain('service=daycare');
  });

  it('parses placeholder vendor URLs with vendorId query', () => {
    const parsed = parseVendorShareUrl(
      'https://customer.warmpawz.com/vendor/placeholder?vendorId=vid-99&persona=grooming&serviceStyle=at_home&name=Paws'
    );

    expect(parsed?.vendorId).toBe('vid-99');
    expect(parsed?.persona).toBe('grooming');
    expect(parsed?.serviceStyle).toBe('at_home');
    expect(parsed?.vendorName).toBe('Paws');
  });

  it('parses legacy path vendor URLs', () => {
    const parsed = parseVendorShareUrl(
      'https://customer.warmpawz.com/vendor/vid-99?persona=grooming&serviceStyle=at_home&name=Paws'
    );

    expect(parsed?.vendorId).toBe('vid-99');
    expect(parsed?.persona).toBe('grooming');
  });

  it('parses persona banner paths with vendorId query', () => {
    const parsed = parseVendorShareUrl(
      'https://customer.warmpawz.com/vet/Clinic%20Name?vendorId=vet-1&serviceStyle=tele'
    );

    expect(parsed?.vendorId).toBe('vet-1');
    expect(parsed?.persona).toBe('vet');
    expect(parsed?.vendorName).toBe('Clinic Name');
    expect(parsed?.serviceStyle).toBe('tele');
  });

  it('parses pet-boarding vendor paths', () => {
    const parsed = parseVendorShareUrl(
      'https://customer.warmpawz.com/pet-boarding/vendor/placeholder?vendorId=b-42&service=overnight'
    );

    expect(parsed?.vendorId).toBe('b-42');
    expect(parsed?.persona).toBe('boarding');
    expect(parsed?.serviceSlug).toBe('overnight');
  });

  it('maps share params to CustomerHomeWrapper navigation', () => {
    expect(
      vendorShareParamsToInitialNavigation('w-1', {
        persona: 'walker',
        vendorName: 'Walkers Inc',
      })
    ).toEqual({
      screen: 'walker',
      data: expect.objectContaining({
        vendorId: 'w-1',
        vendorName: 'Walkers Inc',
        serviceType: 'walking',
      }),
    });

    expect(
      vendorShareParamsToInitialNavigation('v-2', {
        persona: 'vet',
        serviceStyle: 'tele',
      })?.screen
    ).toBe('vet');

    expect(
      vendorShareParamsToInitialNavigation('b-3', {
        persona: 'boarding',
        serviceSlug: 'daycare',
      })
    ).toEqual({
      screen: 'boarding',
      data: expect.objectContaining({
        vendorId: 'b-3',
        service: 'boarding',
        serviceSlug: 'daycare',
      }),
    });
  });

  it('redirects legacy path URLs to placeholder shell', () => {
    expect(vendorSharePathNeedsPlaceholderRedirect('https://customer.warmpawz.com/vendor/uuid-1?persona=vet')).toBe(
      true
    );
    const redirect = buildVendorSharePlaceholderRedirectUrl(
      'https://customer.warmpawz.com/vendor/uuid-1?persona=vet&serviceStyle=at_center'
    );
    expect(redirect).toContain('/vendor/placeholder?');
    expect(redirect).toContain('vendorId=uuid-1');
    expect(redirect).toContain('persona=vet');
    expect(redirect).toContain('serviceStyle=at_center');

    const appPath = vendorShareUrlToAppPath(
      'https://customer.warmpawz.com/vendor/uuid-1?persona=training&serviceStyle=at_center'
    );
    expect(appPath).toContain('/vendor/placeholder?');
    expect(appPath).toContain('vendorId=uuid-1');
  });

  it('reads vendor id from placeholder location', () => {
    expect(
      readVendorIdFromShareLocation({
        pathname: '/vendor/placeholder',
        search: '?vendorId=abc&persona=vet',
      })
    ).toBe('abc');
  });

  it('maps home service types and role ids to personas', () => {
    expect(homeServiceTypeToPersona('walker')).toBe('walker');
    expect(homeServiceTypeToPersona('behaviourist')).toBe('behaviourist');
    expect(roleIdToSharePersona('groomer')).toBe('grooming');
    expect(roleIdToSharePersona('behaviorist')).toBe('behaviourist');
  });
});
