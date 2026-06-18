import {
  BACK_HANDLER_PRIORITY,
  clearBackHandlers,
  isCheckoutFlowPath,
  isCheckoutSuccessPath,
  registerBackHandler,
  registerCheckoutUrlBackHandler,
  registerCheckoutSuccessBackHandler,
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

    it('isCheckoutFlowPath matches /checkout only', () => {
      expect(isCheckoutFlowPath('/checkout')).toBe(true);
      expect(isCheckoutFlowPath('/checkout?step=review')).toBe(true);
      expect(isCheckoutFlowPath('/checkout/success')).toBe(false);
      expect(isCheckoutFlowPath('/cart')).toBe(false);
    });

    it('registerCheckoutUrlBackHandler invokes goBack on /checkout before url fallback', () => {
      const goBack = jest.fn();
      const urlFallback = jest.fn(() => false);

      registerCheckoutUrlBackHandler(goBack);
      registerBackHandler(urlFallback, BACK_HANDLER_PRIORITY.urlHistory);

      Object.defineProperty(window, 'location', {
        value: { pathname: '/checkout' },
        writable: true,
        configurable: true,
      });

      expect(runBackHandlers()).toBe(true);
      expect(goBack).toHaveBeenCalledTimes(1);
      expect(urlFallback).not.toHaveBeenCalled();
    });

    it('registerCheckoutUrlBackHandler skips /checkout/success', () => {
      const goBack = jest.fn();
      registerCheckoutUrlBackHandler(goBack);

      Object.defineProperty(window, 'location', {
        value: { pathname: '/checkout/success' },
        writable: true,
        configurable: true,
      });

      expect(runBackHandlers()).toBe(false);
      expect(goBack).not.toHaveBeenCalled();
    });

    it('registerCheckoutUrlBackHandler unregisters on cleanup', () => {
      const goBack = jest.fn();
      const cleanup = registerCheckoutUrlBackHandler(goBack);
      cleanup();

      Object.defineProperty(window, 'location', {
        value: { pathname: '/checkout' },
        writable: true,
        configurable: true,
      });

      expect(runBackHandlers()).toBe(false);
      expect(goBack).not.toHaveBeenCalled();
    });

    it('isCheckoutSuccessPath matches /checkout/success only', () => {
      expect(isCheckoutSuccessPath('/checkout/success')).toBe(true);
      expect(isCheckoutSuccessPath('/checkout')).toBe(false);
    });

    it('registerCheckoutSuccessBackHandler invokes onBack on success page', () => {
      const onBack = jest.fn();
      registerCheckoutSuccessBackHandler(onBack);

      Object.defineProperty(window, 'location', {
        value: { pathname: '/checkout/success' },
        writable: true,
        configurable: true,
      });

      expect(runBackHandlers()).toBe(true);
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('deep-link-stack', () => {
    it('getDeepLinkBackFallback for product → shop', () => {
      expect(getDeepLinkBackFallback('/shop/abc-123')).toBe('/shop');
    });

    it('getDeepLinkBackFallback for checkout → cart', () => {
      expect(getDeepLinkBackFallback('/checkout')).toBe('/cart');
    });

    it('getDeepLinkBackFallback for checkout success → shop', () => {
      expect(getDeepLinkBackFallback('/checkout/success')).toBe('/shop');
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
