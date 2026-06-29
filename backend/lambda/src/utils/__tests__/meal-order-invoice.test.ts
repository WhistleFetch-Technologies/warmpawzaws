import { buildMealOrderInvoicePayload, isMealOrderInvoiceEligible } from '../meal-order-invoice';

describe('isMealOrderInvoiceEligible', () => {
  it('allows paid meal orders', () => {
    expect(isMealOrderInvoiceEligible({ payment_status: 'paid', status: 'confirmed' })).toBe(true);
  });

  it('blocks unpaid pending orders', () => {
    expect(isMealOrderInvoiceEligible({ payment_status: 'pending', status: 'pending' })).toBe(false);
  });
});

describe('buildMealOrderInvoicePayload', () => {
  it('builds line items from meal order totals', () => {
    const payload = buildMealOrderInvoicePayload({
      invoiceNumber: 'INV-TEST-1',
      isInterState: false,
      mealPlanName: 'Chicken Rice Bowl',
      order: {
        id: 'mo-1',
        order_number: 'MP-1001',
        quantity: 2,
        subtotal: 400,
        delivery_fee: 50,
        platform_fee: 9,
        total_amount: 489,
        payment_status: 'paid',
        created_at: '2026-06-01T10:00:00Z',
        delivery_address: JSON.stringify({ address: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' }),
        purchase_snapshot: JSON.stringify({
          checkoutPricing: {
            subtotal: 400,
            deliveryFee: 50,
            platformFee: 9,
            convenienceFee: 0,
            gst: { foodGstPct: 5, deliveryGstPct: 0, foodGstAmount: 20, deliveryGstAmount: 0, totalGstAmount: 20 },
          },
        }),
        vendor_name: 'Pet Kitchen',
        customer_name: 'Alex',
        customer_phone: '9876543210',
      },
    });

    expect(payload.meal_order_id).toBe('mo-1');
    expect(payload.orderNumber).toBe('MP-1001');
    expect(payload.items.some((i) => i.name === 'Chicken Rice Bowl')).toBe(true);
    expect(payload.total).toBe(489);
    expect(payload.totalTax).toBeGreaterThan(0);
  });
});
