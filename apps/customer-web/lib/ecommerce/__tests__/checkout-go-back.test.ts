import { resolveCheckoutGoBackAction } from '../checkout-go-back';

describe('resolveCheckoutGoBackAction', () => {
  it('pops history from review so payment is not duplicated', () => {
    expect(resolveCheckoutGoBackAction('review')).toBe('history-back');
  });

  it('replaces checkout with cart from the payment step', () => {
    expect(resolveCheckoutGoBackAction('payment')).toBe('replace-cart');
  });
});
