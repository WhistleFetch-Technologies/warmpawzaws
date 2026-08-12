import {
  sliceStorefrontListPage,
  storefrontListFetchLimit,
} from '../storefront-products-pagination';

describe('storefront-products-pagination', () => {
  describe('storefrontListFetchLimit', () => {
    it('returns requestedLimit + 1', () => {
      expect(storefrontListFetchLimit(10)).toBe(11);
      expect(storefrontListFetchLimit(1)).toBe(2);
    });

    it('clamps invalid limits to at least 2 fetch rows', () => {
      expect(storefrontListFetchLimit(0)).toBe(2);
      expect(storefrontListFetchLimit(-5)).toBe(2);
    });
  });

  describe('sliceStorefrontListPage', () => {
    it('returns all rows and hasMore=false when under limit', () => {
      const rows = [1, 2, 3];
      expect(sliceStorefrontListPage(rows, 10)).toEqual({
        items: [1, 2, 3],
        hasMore: false,
      });
    });

    it('returns first N and hasMore=true when extra row present (LIMIT+1)', () => {
      const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      expect(sliceStorefrontListPage(rows, 10)).toEqual({
        items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        hasMore: true,
      });
    });

    it('returns empty when limit is 0', () => {
      expect(sliceStorefrontListPage([1, 2], 0)).toEqual({
        items: [],
        hasMore: false,
      });
    });
  });
});
