import {
  buildWapptVendorKeywordTokens,
  wapptVendorMatchesKeyword,
} from '../search-wappt-keyword-filter';

describe('buildWapptVendorKeywordTokens', () => {
  it('returns no tokens for sentence walker query (hub browse)', () => {
    expect(buildWapptVendorKeywordTokens('best dog walker', 'walker')).toEqual([]);
  });

  it('returns no tokens for trainers sentence query', () => {
    expect(buildWapptVendorKeywordTokens('best trainers for my dog', 'training')).toEqual([]);
  });

  it('keeps vendor name tokens when hub is not inferred from query', () => {
    expect(buildWapptVendorKeywordTokens('happy tails', 'vet')).toEqual(['happy', 'tails']);
  });
});

describe('wapptVendorMatchesKeyword', () => {
  const vendorHay = 'Vikas Singh Training and Walking Services Bengaluru';

  it('matches walker hub vendors for best dog walker', () => {
    expect(wapptVendorMatchesKeyword(vendorHay, 'best dog walker', 'walker')).toBe(true);
  });

  it('does not require full phrase substring on walker vendors', () => {
    expect(wapptVendorMatchesKeyword(vendorHay, 'best dog walker', 'walker')).toBe(true);
  });

  it('allows all hub vendors when sentence resolves to hub browse only', () => {
    expect(wapptVendorMatchesKeyword('City Vet Clinic', 'best dog walker', 'walker')).toBe(true);
  });

  it('filters by residual vendor name tokens', () => {
    expect(wapptVendorMatchesKeyword(vendorHay, 'vikas walking', 'walker')).toBe(true);
    expect(wapptVendorMatchesKeyword(vendorHay, 'vikas grooming', 'walker')).toBe(false);
  });
});
