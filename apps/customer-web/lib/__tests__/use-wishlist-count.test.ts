import { renderHook, act } from '@testing-library/react';
import {
  formatWishlistBadgeCount,
  readWishlistCount,
  useWishlistCount,
} from '../use-wishlist-count';
import {
  setWishlistIds,
  WARMPAWZ_WISHLIST_KEY,
  WISHLIST_UPDATED_EVENT,
} from '../warmpawz-wishlist-local';

describe('use-wishlist-count', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('formatWishlistBadgeCount', () => {
    it('returns empty for zero or negative', () => {
      expect(formatWishlistBadgeCount(0)).toBe('');
      expect(formatWishlistBadgeCount(-1)).toBe('');
    });

    it('formats 1 through 99', () => {
      expect(formatWishlistBadgeCount(1)).toBe('1');
      expect(formatWishlistBadgeCount(99)).toBe('99');
    });

    it('caps at 99+', () => {
      expect(formatWishlistBadgeCount(100)).toBe('99+');
      expect(formatWishlistBadgeCount(500)).toBe('99+');
    });
  });

  describe('readWishlistCount', () => {
    it('reads length from localStorage', () => {
      localStorage.setItem(WARMPAWZ_WISHLIST_KEY, JSON.stringify(['a', 'b']));
      expect(readWishlistCount()).toBe(2);
    });
  });

  describe('useWishlistCount', () => {
    it('updates when wishlist-updated fires', () => {
      const { result } = renderHook(() => useWishlistCount());
      expect(result.current).toBe(0);

      act(() => {
        setWishlistIds(['p1', 'p2']);
      });

      expect(result.current).toBe(2);
    });

    it('responds to manual wishlist-updated dispatch', () => {
      localStorage.setItem(WARMPAWZ_WISHLIST_KEY, JSON.stringify(['x']));
      const { result } = renderHook(() => useWishlistCount());

      act(() => {
        window.dispatchEvent(new CustomEvent(WISHLIST_UPDATED_EVENT));
      });

      expect(result.current).toBe(1);
    });
  });
});
