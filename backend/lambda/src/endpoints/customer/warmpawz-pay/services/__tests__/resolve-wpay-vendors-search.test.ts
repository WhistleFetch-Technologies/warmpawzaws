import { resolveWpayVendorsSearch } from '../resolve-wpay-vendors-search';

jest.mock('../../../../../lib/search-taxonomy', () => ({
  resolveSearchTaxonomy: jest.fn(),
  buildResidualSearchText: jest.fn(),
}));

jest.mock('../../shared/map-hub-slug-to-wpay-category', () => ({
  mapHubSlugToWpayCategory: jest.fn((hub: string | null) => {
    if (hub === 'training') return 'training';
    if (hub === 'walker') return 'walking';
    if (hub === 'nutritionist') return 'nutrition';
    return null;
  }),
}));

const { resolveSearchTaxonomy, buildResidualSearchText } = jest.requireMock(
  '../../../../../lib/search-taxonomy',
) as {
  resolveSearchTaxonomy: jest.Mock;
  buildResidualSearchText: jest.Mock;
};

describe('resolveWpayVendorsSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns explicit category when q is empty', async () => {
    const result = await resolveWpayVendorsSearch('', 'grooming');
    expect(result.categoryFilter).toBe('grooming');
    expect(result.nameTokens).toEqual([]);
    expect(resolveSearchTaxonomy).not.toHaveBeenCalled();
  });

  it('maps taxonomy hub to Pay category for sentence query', async () => {
    resolveSearchTaxonomy.mockResolvedValue({
      topHubSlug: 'training',
      topMatchedPhrase: null,
      categories: [],
    });
    buildResidualSearchText.mockReturnValue({ searchText: '', tokens: [] });

    const result = await resolveWpayVendorsSearch('best trainers for my dog', 'all');

    expect(resolveSearchTaxonomy).toHaveBeenCalledWith('best trainers for my dog');
    expect(result.categoryFilter).toBe('training');
    expect(result.resolvedCategory).toBe('training');
    expect(result.taxonomyHub).toBe('training');
    expect(result.nameTokens).toEqual([]);
  });

  it('explicit chip category wins over taxonomy when not all', async () => {
    resolveSearchTaxonomy.mockResolvedValue({
      topHubSlug: 'training',
      topMatchedPhrase: null,
      categories: [],
    });
    buildResidualSearchText.mockReturnValue({ searchText: '', tokens: [] });

    const result = await resolveWpayVendorsSearch('best trainers for my dog', 'grooming');

    expect(result.categoryFilter).toBe('grooming');
    expect(result.resolvedCategory).toBe('training');
  });

  it('passes residual name tokens for vendor name filtering', async () => {
    resolveSearchTaxonomy.mockResolvedValue({
      topHubSlug: null,
      topMatchedPhrase: null,
      categories: [],
    });
    buildResidualSearchText.mockReturnValue({ searchText: 'happy tails', tokens: ['happy', 'tails'] });

    const result = await resolveWpayVendorsSearch('Happy Tails', 'all');

    expect(result.categoryFilter).toBe('all');
    expect(result.nameTokens).toEqual(['happy', 'tails']);
    expect(result.resolvedCategory).toBeNull();
  });
});
