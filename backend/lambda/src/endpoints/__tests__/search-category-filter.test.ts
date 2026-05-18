import {
  expandSearchCategoryForSql,
  expandSearchCategoryNormalizedTokens,
  getSearchCategoryIlikePatterns,
  isHubBrowseCategoryOnly,
} from '../../utils/search-category-aliases';

describe('isHubBrowseCategoryOnly', () => {
  it('is true when hub slug set and keyword empty', () => {
    expect(isHubBrowseCategoryOnly('training', '')).toBe(true);
    expect(isHubBrowseCategoryOnly('training', '   ')).toBe(true);
    expect(isHubBrowseCategoryOnly(' vet ', undefined)).toBe(true);
  });

  it('is false when keyword present', () => {
    expect(isHubBrowseCategoryOnly('training', 'dog')).toBe(false);
    expect(isHubBrowseCategoryOnly('training', ' grooming ')).toBe(false);
  });

  it('is false when hub missing', () => {
    expect(isHubBrowseCategoryOnly('', '')).toBe(false);
    expect(isHubBrowseCategoryOnly(undefined, '')).toBe(false);
  });
});

describe('expandSearchCategoryNormalizedTokens', () => {
  it('normalizes training aliases for strict SQL/client hub browse', () => {
    const tokens = expandSearchCategoryNormalizedTokens('training');
    expect(tokens).toContain('training');
    expect(tokens).toContain('behavioral');
    expect(tokens).toContain('dog_trainer');
    expect(tokens).not.toContain('veterinary');
  });

  it('does not invent ILIKE patterns — hub browse relies on structured category tokens only', () => {
    const tokens = expandSearchCategoryNormalizedTokens('training');
    expect(tokens.every((t) => typeof t === 'string' && !t.includes('%'))).toBe(true);
  });

  it('includes wellness catalog slug for nutritionist hub (catalog inversion)', () => {
    expect(expandSearchCategoryNormalizedTokens('nutritionist')).toContain('wellness');
    expect(expandSearchCategoryNormalizedTokens('nutritionist')).toContain('nutrition');
  });

  it('vet hub merges diagnostics catalog slugs', () => {
    const t = expandSearchCategoryNormalizedTokens('vet');
    expect(t).toContain('diagnostic');
    expect(t).toContain('diagnostics');
    expect(t).toContain('veterinary');
  });
});

describe('search category expansion for SQL filtering', () => {
  it('keeps All unfiltered when category is empty', () => {
    expect(expandSearchCategoryForSql(undefined)).toEqual([]);
    expect(expandSearchCategoryForSql('')).toEqual([]);
  });

  it('expands vet aliases', () => {
    const aliases = expandSearchCategoryForSql('vet');
    expect(aliases).toEqual(expect.arrayContaining(['vet', 'veterinary', 'pet_clinic', 'vet_care']));
  });

  it('expands grooming/training aliases', () => {
    expect(expandSearchCategoryForSql('grooming')).toEqual(
      expect.arrayContaining(['grooming', 'groomer', 'pet_groomer'])
    );
    expect(expandSearchCategoryForSql('training')).toEqual(
      expect.arrayContaining(['training', 'trainer', 'training_center', 'dog_trainer'])
    );
  });

  it('expands nutritionist with catalog wellness id for SQL equality sets', () => {
    expect(expandSearchCategoryForSql('nutritionist')).toEqual(
      expect.arrayContaining(['nutritionist', 'wellness', 'nutrition'])
    );
  });

  it('expands boarding and walker aliases including spaced values normalized for SQL', () => {
    expect(expandSearchCategoryForSql('boarding')).toEqual(
      expect.arrayContaining(['boarding', 'pet_daycare', 'pet_boarding', 'pet_boarder'])
    );
    expect(expandSearchCategoryForSql('walker')).toEqual(
      expect.arrayContaining(['walker', 'walking', 'pet_walker', 'dog_walker', 'dog_walking'])
    );
  });
});

describe('getSearchCategoryIlikePatterns', () => {
  it('returns empty array for undefined/empty', () => {
    expect(getSearchCategoryIlikePatterns(undefined)).toEqual([]);
    expect(getSearchCategoryIlikePatterns('')).toEqual([]);
  });

  it('returns vet ILIKE patterns', () => {
    expect(getSearchCategoryIlikePatterns('vet')).toEqual(
      expect.arrayContaining(['%vet%', '%veterinar%', '%clinic%'])
    );
  });

  it('returns walker ILIKE patterns', () => {
    expect(getSearchCategoryIlikePatterns('walker')).toEqual(
      expect.arrayContaining(['%walk%'])
    );
  });

  it('returns grooming ILIKE patterns', () => {
    expect(getSearchCategoryIlikePatterns('grooming')).toEqual(
      expect.arrayContaining(['%groom%', '%salon%'])
    );
  });
});
