import {
  canSyncWishlistToApi,
  extractWishlistProductId,
  isProductWishlisted,
  isWishlistIdMatch,
  mergeWishlistIds,
  resolveWishlistIdsForDisplay,
  sameWishlistIdSet,
  WARMPAWZ_WISHLIST_KEY,
} from '../warmpawz-wishlist-local';

const PRODUCT_A = '11111111-1111-4111-8111-111111111111';
const PRODUCT_B = '22222222-2222-4222-8222-222222222222';
const WISHLIST_ROW = '33333333-3333-4333-8333-333333333333';
const CUSTOMER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('warmpawz-wishlist-local', () => {
  describe('extractWishlistProductId', () => {
    it('prefers product_id', () => {
      expect(
        extractWishlistProductId({
          id: WISHLIST_ROW,
          product_id: PRODUCT_A,
        })
      ).toBe(PRODUCT_A);
    });

    it('falls back to product.id', () => {
      expect(
        extractWishlistProductId({
          id: WISHLIST_ROW,
          product: { id: PRODUCT_B },
        })
      ).toBe(PRODUCT_B);
    });

    it('does not use wishlist row id', () => {
      expect(extractWishlistProductId({ id: WISHLIST_ROW })).toBe('');
    });
  });

  describe('mergeWishlistIds', () => {
    it('preserves local ids and appends API product ids', () => {
      const merged = mergeWishlistIds([PRODUCT_A], [
        { id: WISHLIST_ROW, product_id: PRODUCT_B },
      ]);
      expect(merged).toEqual([PRODUCT_A, PRODUCT_B]);
    });

    it('never removes local ids when API returns nothing', () => {
      expect(mergeWishlistIds([PRODUCT_A, PRODUCT_B], [])).toEqual([
        PRODUCT_A,
        PRODUCT_B,
      ]);
    });

    it('ignores API rows without a product id', () => {
      expect(
        mergeWishlistIds([PRODUCT_A], [{ id: WISHLIST_ROW }])
      ).toEqual([PRODUCT_A]);
    });
  });

  describe('sameWishlistIdSet', () => {
    it('compares id sets regardless of order', () => {
      expect(sameWishlistIdSet([PRODUCT_A, PRODUCT_B], [PRODUCT_B, PRODUCT_A])).toBe(
        true
      );
      expect(sameWishlistIdSet([PRODUCT_A], [PRODUCT_A, PRODUCT_B])).toBe(false);
    });
  });

  describe('canSyncWishlistToApi', () => {
    it('requires UUID customer and product ids', () => {
      expect(canSyncWishlistToApi(CUSTOMER, PRODUCT_A)).toBe(true);
      expect(canSyncWishlistToApi('not-a-uuid', PRODUCT_A)).toBe(false);
      expect(canSyncWishlistToApi(CUSTOMER, 'sku-123')).toBe(false);
      expect(canSyncWishlistToApi(null, PRODUCT_A)).toBe(false);
    });
  });

  describe('local-first add semantics', () => {
    it('keeps merged ids after simulated API-only failure path', () => {
      const localAfterAdd = mergeWishlistIds([], [{ product_id: PRODUCT_A }]);
      expect(localAfterAdd).toEqual([PRODUCT_A]);
      const afterFailedSync = mergeWishlistIds(localAfterAdd, []);
      expect(afterFailedSync).toEqual([PRODUCT_A]);
    });
  });

  describe('isWishlistIdMatch / isProductWishlisted', () => {
    it('matches ids by string equality', () => {
      expect(isWishlistIdMatch(PRODUCT_A, PRODUCT_A)).toBe(true);
      expect(isWishlistIdMatch(PRODUCT_A, PRODUCT_B)).toBe(false);
    });

    it('detects membership in a provided id list', () => {
      expect(isProductWishlisted(PRODUCT_A, [PRODUCT_A, PRODUCT_B])).toBe(true);
      expect(isProductWishlisted(PRODUCT_B, [PRODUCT_A])).toBe(false);
    });
  });

  describe('removeWishlistProductIds', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('removes all alias candidate ids from storage', () => {
      localStorage.setItem(
        WARMPAWZ_WISHLIST_KEY,
        JSON.stringify([PRODUCT_A, PRODUCT_B])
      );
      const { removeWishlistProductIds } = require('../warmpawz-wishlist-local');
      removeWishlistProductIds(PRODUCT_A);
      expect(JSON.parse(localStorage.getItem(WARMPAWZ_WISHLIST_KEY) || '[]')).toEqual([
        PRODUCT_B,
      ]);
    });
  });

  describe('resolveWishlistIdsForDisplay', () => {
    it('refresh mode uses local ids only and ignores API items', () => {
      expect(resolveWishlistIdsForDisplay('refresh', [PRODUCT_A], [{ product_id: PRODUCT_B }])).toEqual([
        PRODUCT_A,
      ]);
    });

    it('initial mode unions API product ids', () => {
      expect(
        resolveWishlistIdsForDisplay('initial', [PRODUCT_A], [{ product_id: PRODUCT_B }])
      ).toEqual([PRODUCT_A, PRODUCT_B]);
    });
  });
});
