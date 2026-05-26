import {
  buildMealKitchenAvailabilityPayload,
  parseMealKitchenAvailabilityFromMetadata,
  resolveCustomerKitchenMessage,
} from '../../utils/meal-kitchen-availability';

describe('meal-kitchen-availability', () => {
  it('defaults to accepting when metadata missing', () => {
    const a = parseMealKitchenAvailabilityFromMetadata(null);
    expect(a.acceptingOrders).toBe(true);
  });

  it('builds preset message for closed today', () => {
    const r = buildMealKitchenAvailabilityPayload({
      acceptingOrders: false,
      reasonCode: 'holiday',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.customerMessage).toMatch(/holiday/i);
      expect(resolveCustomerKitchenMessage(r.value)).toMatch(/holiday/i);
    }
  });

  it('requires custom note when reason is custom', () => {
    const r = buildMealKitchenAvailabilityPayload({
      acceptingOrders: false,
      reasonCode: 'custom',
    });
    expect(r.ok).toBe(false);
  });
});
