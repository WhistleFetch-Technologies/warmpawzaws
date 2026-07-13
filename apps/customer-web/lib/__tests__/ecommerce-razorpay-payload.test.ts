import {
  buildRazorpayEcommerceCreateOrderPayload,
  extractEcommerceOrderIdFromResponse,
} from '../ecommerce/ecommerce-razorpay-payload';

describe('ecommerce Razorpay create-order payload', () => {
  it('uses ecommerce_order type and orderId, not bookingId', () => {
    const payload = buildRazorpayEcommerceCreateOrderPayload(
      '11111111-1111-4111-8111-111111111111',
      336.12,
      'cust-1'
    );
    expect(payload.type).toBe('ecommerce_order');
    expect(payload.orderId).toBeTruthy();
    expect(payload).not.toHaveProperty('bookingId');
  });

  it('rejects missing customerId', () => {
    expect(() =>
      buildRazorpayEcommerceCreateOrderPayload('11111111-1111-4111-8111-111111111111', 100, '')
    ).toThrow(/sign in/i);
  });

  it('extracts order id from ecommerce orders response', () => {
    const id = extractEcommerceOrderIdFromResponse({
      order: { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
    });
    expect(id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});
