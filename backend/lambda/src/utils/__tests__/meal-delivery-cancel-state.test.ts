import { describe, expect, it } from 'vitest';
import { resolveEffectiveMealDeliveryState } from '../meal-delivery-effective-state';

describe('meal cancel effective state', () => {
  it('returns cancelled when cancelled_by is set even if order status is ready_for_pickup and tracking failed', () => {
    expect(
      resolveEffectiveMealDeliveryState('ready_for_pickup', 'failed', {
        cancelledBy: 'system_pidge',
      }),
    ).toBe('cancelled');
  });

  it('returns cancelled when cancelled_at is set', () => {
    expect(
      resolveEffectiveMealDeliveryState('ready_for_pickup', 'failed', {
        cancelledAt: '2026-06-25T10:00:00.000Z',
      }),
    ).toBe('cancelled');
  });

  it('returns failed when tracking failed without cancellation attribution', () => {
    expect(resolveEffectiveMealDeliveryState('ready_for_pickup', 'failed')).toBe('failed');
  });

  it('prefers cancelled over delivered when cancelled_by is set', () => {
    expect(
      resolveEffectiveMealDeliveryState('delivered', 'failed', {
        cancelledBy: 'system_pidge',
      }),
    ).toBe('cancelled');
  });
});
