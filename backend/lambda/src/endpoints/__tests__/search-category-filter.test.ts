import { expandSearchCategoryForSql, getSearchCategoryIlikePatterns } from '../../utils/search-category-aliases';

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
