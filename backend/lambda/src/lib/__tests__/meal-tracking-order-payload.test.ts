import {
  buildCustomerMealTrackingOrderPayload,
  formatMealDeliveryAddressForDisplay,
} from '../../utils/meal-tracking-order-payload';

describe('meal-tracking-order-payload', () => {
  it('builds totals and address from orders table meal_plan_delivery row', () => {
    const payload = buildCustomerMealTrackingOrderPayload({
      order: {
        id: 'ord-1',
        order_number: 'MP-123',
        subtotal: 900,
        shipping_amount: 50,
        tax_amount: 65,
        total_amount: 1015,
        shipping_address: '12 MG Road, Bengaluru',
        shipping_city: 'Bengaluru',
        shipping_state: 'KA',
        shipping_pincode: '560001',
        created_at: '2026-05-25T10:00:00Z',
      },
      orderSource: 'orders',
      displayStatus: 'delivered',
      deliveryTracking: { delivered_at: '2026-05-25T11:30:00Z' },
    });

    expect(payload.subtotal).toBe(900);
    expect(payload.delivery_fee).toBe(50);
    expect(payload.total_amount).toBe(1015);
    expect(payload.delivered_at).toBe('2026-05-25T11:30:00Z');
    expect(payload.delivery_address).toContain('MG Road');
    expect(payload.summary_lines?.length).toBeGreaterThan(0);
    expect(payload.subtotal).toBe(900);
  });

  it('formats JSON delivery_address on meal_orders', () => {
    const text = formatMealDeliveryAddressForDisplay(
      {
        delivery_address: JSON.stringify({
          address: '221B Baker Street',
          city: 'London',
        }),
      },
      'meal_orders'
    );
    expect(text).toBe('221B Baker Street');
  });
});
