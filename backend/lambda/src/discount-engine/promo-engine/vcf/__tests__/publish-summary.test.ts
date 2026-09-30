import { summarizePublishScope } from '../publish-summary';

describe('summarizePublishScope', () => {
  it('returns null for legacy rows without vcf', () => {
    expect(summarizePublishScope({})).toBeNull();
    expect(summarizePublishScope(null)).toBeNull();
    expect(summarizePublishScope({ vcf: { publish: { letter: 'X' } } })).toBeNull();
  });

  it('reads C categories with saved names and channels', () => {
    expect(
      summarizePublishScope({
        vcf: {
          publish: {
            letter: 'C',
            channels: ['ecommerce', 'bogus'],
            categoryId: 'cat-shop',
            categoryIds: ['cat-shop', 'cat-vet'],
            categoryNames: ['Pet Shop'],
          },
        },
      })
    ).toEqual({
      letter: 'C',
      ids: ['cat-shop', 'cat-vet'],
      names: ['Pet Shop', 'cat-vet'],
      channels: ['ecommerce'],
    });
  });

  it('reads a single-vendor V scope from the singular fields', () => {
    expect(
      summarizePublishScope({
        vcf: { publish: { letter: 'V', vendorId: 'v1', vendorName: 'grommer center' } },
      })
    ).toEqual({ letter: 'V', ids: ['v1'], names: ['grommer center'], channels: [] });
  });

  it('returns an empty list for F', () => {
    expect(summarizePublishScope({ vcf: { publish: { letter: 'f' } } })).toEqual({
      letter: 'F',
      ids: [],
      names: [],
      channels: [],
    });
  });
});
