import {
  parseListingOwnershipInput,
  validateAndApplyVendorDeclaredOwnership,
  ListingOwnershipRequiredError,
  normalizeListingOwnershipScope,
  lineMatchesListingOwnershipScope,
} from '../compute-listing-ownership';

describe('normalizeListingOwnershipScope', () => {
  it('normalizes aliases and defaults to all', () => {
    expect(normalizeListingOwnershipScope('own_brand')).toBe('own_brand');
    expect(normalizeListingOwnershipScope('Owned products')).toBe('own_brand');
    expect(normalizeListingOwnershipScope('third-party')).toBe('third_party');
    expect(normalizeListingOwnershipScope('both')).toBe('all');
    expect(normalizeListingOwnershipScope(undefined)).toBe('all');
  });
});

describe('lineMatchesListingOwnershipScope', () => {
  it('all matches any line; exclusive scopes require exact ownership', () => {
    expect(lineMatchesListingOwnershipScope('all', null)).toBe(true);
    expect(lineMatchesListingOwnershipScope('own_brand', 'own_brand')).toBe(true);
    expect(lineMatchesListingOwnershipScope('own_brand', 'third_party')).toBe(false);
    expect(lineMatchesListingOwnershipScope('own_brand', null)).toBe(false);
    expect(lineMatchesListingOwnershipScope('third_party', 'third_party')).toBe(true);
  });
});

describe('parseListingOwnershipInput', () => {
  it('parses own brand aliases', () => {
    expect(parseListingOwnershipInput('Own brand')).toBe('own_brand');
    expect(parseListingOwnershipInput('own')).toBe('own_brand');
    expect(parseListingOwnershipInput('OWN_BRAND')).toBe('own_brand');
  });

  it('parses third party aliases', () => {
    expect(parseListingOwnershipInput('Third party')).toBe('third_party');
    expect(parseListingOwnershipInput('3rd party')).toBe('third_party');
    expect(parseListingOwnershipInput('third_party')).toBe('third_party');
  });

  it('returns null for empty or unknown', () => {
    expect(parseListingOwnershipInput('')).toBeNull();
    expect(parseListingOwnershipInput(null)).toBeNull();
    expect(parseListingOwnershipInput('maybe')).toBeNull();
  });
});

describe('validateAndApplyVendorDeclaredOwnership', () => {
  it('throws when ownership is omitted', async () => {
    const payload: Record<string, unknown> = {};
    await expect(
      validateAndApplyVendorDeclaredOwnership(
        'vendor-1',
        payload,
        new Set(['listing_ownership', 'listing_ownership_source']),
        null
      )
    ).rejects.toBeInstanceOf(ListingOwnershipRequiredError);
    expect(payload.listing_ownership).toBeUndefined();
  });

  it('throws when ownership is invalid', async () => {
    await expect(
      validateAndApplyVendorDeclaredOwnership(
        'vendor-1',
        {},
        new Set(['listing_ownership']),
        ''
      )
    ).rejects.toBeInstanceOf(ListingOwnershipRequiredError);
  });

  it('persists ownership when provided (independent of commission model)', async () => {
    const payload: Record<string, unknown> = {};
    await validateAndApplyVendorDeclaredOwnership(
      'vendor-1',
      payload,
      new Set(['listing_ownership', 'listing_ownership_source']),
      'Third party'
    );

    expect(payload.listing_ownership).toBe('third_party');
    expect(payload.listing_ownership_source).toBe('manual');
  });

  it('sets manual ownership for Own brand alias', async () => {
    const payload: Record<string, unknown> = {};
    await validateAndApplyVendorDeclaredOwnership(
      'vendor-1',
      payload,
      new Set(['listing_ownership', 'listing_ownership_source']),
      'Own brand'
    );

    expect(payload.listing_ownership).toBe('own_brand');
    expect(payload.listing_ownership_source).toBe('manual');
  });

  it('no-ops when listing_ownership column is absent', async () => {
    const payload: Record<string, unknown> = {};
    await validateAndApplyVendorDeclaredOwnership('vendor-1', payload, new Set(), null);
    expect(payload.listing_ownership).toBeUndefined();
  });
});
