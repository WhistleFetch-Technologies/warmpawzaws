export type CheckoutGoBackAction = 'history-back' | 'replace-cart';

/**
 * Review was pushed onto history (`/checkout?step=review`).
 * Header/hardware back must pop that entry — replacing it with payment leaves a duplicate.
 */
export function resolveCheckoutGoBackAction(step: 'payment' | 'review'): CheckoutGoBackAction {
  return step === 'review' ? 'history-back' : 'replace-cart';
}
