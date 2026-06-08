import {
  BACK_HANDLER_PRIORITY,
  clearBackHandlers,
  registerBackHandler,
  runBackHandlers,
} from '../back-handler-registry';
import {
  ensureDeepLinkBackStack,
  getDeepLinkBackFallback,
  parseInternalPathFromUrl,
} from '../deep-link-stack';

describe('Phase 4 navigation', () => {
  beforeEach(() => {
    clearBackHandlers();
    sessionStorage.clear();
  });

  describe('back-handler-registry', () => {
    it('runs higher priority handlers first', () => {
      const order: string[] = [];
      registerBackHandler(() => {
        order.push('low');
        return false;
      }, 10);
      registerBackHandler(() => {
        order.push('high');
        return true;
      }, 100);

      expect(runBackHandlers()).toBe(true);
      expect(order).toEqual(['high']);
    });

    it('unregisters on cleanup', () => {
      const cleanup = registerBackHandler(() => true, BACK_HANDLER_PRIORITY.shellOverlay);
      cleanup();
      expect(runBackHandlers()).toBe(false);
    });
  });

  describe('deep-link-stack', () => {
    it('getDeepLinkBackFallback for product → shop', () => {
      expect(getDeepLinkBackFallback('/shop/abc-123')).toBe('/shop');
    });

    it('getDeepLinkBackFallback for checkout → cart', () => {
      expect(getDeepLinkBackFallback('/checkout')).toBe('/cart');
    });

    it('parseInternalPathFromUrl accepts customer domain', () => {
      expect(parseInternalPathFromUrl('https://customer.warmpawz.com/shop/1?q=1')).toBe('/shop/1?q=1');
    });

    it('parseInternalPathFromUrl rejects unknown host', () => {
      expect(parseInternalPathFromUrl('https://evil.example/phish')).toBeNull();
    });

    it('ensureDeepLinkBackStack seeds history on shallow stack', () => {
      window.history.replaceState({}, '', '/shop/p1');
      expect(window.history.length).toBe(1);

      ensureDeepLinkBackStack('/shop/p1');

      expect(window.history.length).toBe(2);
      expect(sessionStorage.getItem('warmpawz_dl_seeded_/shop/p1')).toBe('1');
    });
  });
});
