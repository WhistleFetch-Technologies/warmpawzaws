import {
  afterUrlCheckoutSuccess,
  navigateToCheckoutSuccessPage,
  shouldSkipProductNavigation,
  navigateWithPolicy,
} from '../navigation-coordinator';
import {
  completeEmbeddedCheckoutSuccess,
  completeEmbeddedCheckoutViewOrders,
  createCustomerNavigation,
} from '../navigation-service';
import { productPath, routeKey, isCurrentPath } from '../route-registry';
import { navigateCustomerTab } from '../tab-policy';

describe('navigation Phase 3', () => {
  describe('route-registry', () => {
    it('builds product path and key', () => {
      expect(productPath('abc 123')).toBe('/shop/abc%20123');
      expect(routeKey.product('abc')).toBe('product:abc');
      expect(routeKey.wapptProfile('v1', 'at_home')).toBe('vendor:v1:style:at_home');
    });

    it('isCurrentPath normalizes trailing slashes', () => {
      expect(isCurrentPath('/shop/1/', '/shop/1')).toBe(true);
    });
  });

  describe('navigation-coordinator', () => {
    it('afterUrlCheckoutSuccess replaces to tracking or orders', () => {
      const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
      afterUrlCheckoutSuccess(router, 'ord-1');
      expect(router.replace).toHaveBeenCalledWith('/orders?expand=ord-1');
      afterUrlCheckoutSuccess(router, null);
      expect(router.replace).toHaveBeenCalledWith('/orders');
    });

    it('shouldSkipProductNavigation when on same product', () => {
      window.history.pushState({}, '', '/shop/p1');
      expect(shouldSkipProductNavigation('p1')).toBe(true);
      expect(shouldSkipProductNavigation('p2')).toBe(false);
    });

    it('navigateWithPolicy uses replace for reset', () => {
      const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
      navigateWithPolicy(router, '/', 'reset');
      expect(router.replace).toHaveBeenCalledWith('/');
      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe('navigation-service', () => {
    it('goToEvents and event book use customer routes', () => {
      const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
      const nav = createCustomerNavigation(router);
      nav.goToEvents();
      expect(router.push).toHaveBeenCalledWith('/events');
      nav.goToEventDetail('evt-1');
      expect(router.push).toHaveBeenCalledWith('/events/evt-1');
      nav.goToEventBook('evt-1');
      expect(router.push).toHaveBeenCalledWith('/events/evt-1/book');
      nav.goToEventRegistration('reg-1');
      expect(router.replace).toHaveBeenCalledWith('/events/registrations/reg-1');
    });

    it('goToProduct skips duplicate URL', () => {
      window.history.pushState({}, '', '/shop/dup');
      const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
      const nav = createCustomerNavigation(router);
      nav.goToProduct('dup');
      expect(router.push).not.toHaveBeenCalled();
    });

    it('navigateToCheckoutSuccessPage replaces location', () => {
      const replace = jest.fn();
      Object.defineProperty(window, 'location', {
        value: { replace },
        writable: true,
        configurable: true,
      });
      navigateToCheckoutSuccessPage();
      expect(replace).toHaveBeenCalledWith('/checkout/success');
    });

    it('afterCheckoutSuccess delegates to coordinator', () => {
      const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
      createCustomerNavigation(router).afterCheckoutSuccess('x');
      expect(router.replace).toHaveBeenCalledWith('/orders?expand=x');
    });
  });

  describe('tab-policy', () => {
    it('home tab clears shop intent and navigates', () => {
      sessionStorage.setItem('warmpawz_shop_back_intent', '{"kind":"path","path":"/wallet"}');
      const router = { push: jest.fn() };
      navigateCustomerTab(router, 'home');
      expect(sessionStorage.getItem('warmpawz_shop_back_intent')).toBeNull();
      expect(router.push).toHaveBeenCalledWith('/');
    });
  });

  describe('embedded checkout', () => {
    it('completeEmbeddedCheckoutSuccess resets stack', () => {
      const resetStack = jest.fn();
      const setOrderId = jest.fn();
      completeEmbeddedCheckoutSuccess(resetStack, setOrderId, 'ord-9', 'order_success');
      expect(setOrderId).toHaveBeenCalledWith('ord-9');
      expect(resetStack).toHaveBeenCalledWith('order_success');
    });

    it('completeEmbeddedCheckoutViewOrders resets to order history', () => {
      const resetStack = jest.fn();
      const clearOrderId = jest.fn();
      completeEmbeddedCheckoutViewOrders(resetStack, clearOrderId, 'order_history');
      expect(clearOrderId).toHaveBeenCalled();
      expect(resetStack).toHaveBeenCalledWith('order_history');
    });
  });
});
