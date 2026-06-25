import { mealKitchenProgress, mealHeroHeadline } from '@/lib/meal-kitchen-progress';

describe('mealKitchenProgress terminal cancel', () => {
  it('does not green-fill Delivered on Pidge cancel (ready_for_pickup + failed + cancelled_by)', () => {
    const { filled, current } = mealKitchenProgress('ready_for_pickup', 'failed', {
      cancelledBy: 'system_pidge',
    });
    expect(filled).toBeLessThanOrEqual(3);
    expect(current).not.toBe(5);
    expect(current).toBe(2);
  });

  it('does not use faux-delivered progress for failed without cancelled_by', () => {
    const { filled, current } = mealKitchenProgress('ready_for_pickup', 'failed');
    expect(filled).toBe(2);
    expect(current).toBe(2);
  });
});

describe('mealHeroHeadline cancel copy', () => {
  it('shows Order cancelled for Pidge-attributed failure', () => {
    expect(
      mealHeroHeadline('ready_for_pickup', 'failed', { cancelledBy: 'system_pidge' }),
    ).toBe('Order cancelled');
  });
});
