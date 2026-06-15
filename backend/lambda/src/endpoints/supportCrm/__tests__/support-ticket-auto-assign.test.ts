import { deriveRoutingPoolKey } from '../support-ticket-routing-pool';

describe('deriveRoutingPoolKey', () => {
  it('returns booking when booking_id is set', () => {
    expect(deriveRoutingPoolKey({ booking_id: 'b1', category: 'billing' })).toBe('booking');
  });

  it('returns meal_order when meal_order_id is set', () => {
    expect(deriveRoutingPoolKey({ meal_order_id: 'm1' })).toBe('meal_order');
  });

  it('returns account for account category on general tickets', () => {
    expect(deriveRoutingPoolKey({ category: 'account' })).toBe('account');
  });

  it('returns billing for billing category on general tickets', () => {
    expect(deriveRoutingPoolKey({ category: 'billing' })).toBe('billing');
  });

  it('returns general by default', () => {
    expect(deriveRoutingPoolKey({ category: 'general' })).toBe('general');
  });

  it('derives meal_order from metadata context', () => {
    expect(
      deriveRoutingPoolKey({
        metadata: { ticket_type: 'meal_order', meal_order_context: { orderId: 'x' } },
      })
    ).toBe('meal_order');
  });
});
