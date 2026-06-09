import { mealKitchenNotifyStageForStatus } from '../meal-delivery-notifications';
import {
  isMealLogisticsDispatchStatus,
  mealDispatchFailureUserMessage,
  mealPidgeDispatchOn,
  shouldRequirePidgeBeforeReadyForPickup,
} from '../meal-dispatch-policy';

describe('meal Pidge dispatch policy', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.MEAL_PIDGE_DISPATCH_ON;
  });

  afterAll(() => {
    process.env = env;
  });

  it('defaults dispatch to ready_for_pickup', () => {
    expect(mealPidgeDispatchOn()).toBe('ready_for_pickup');
    expect(isMealLogisticsDispatchStatus('ready_for_pickup')).toBe(true);
    expect(isMealLogisticsDispatchStatus('preparing')).toBe(false);
    expect(shouldRequirePidgeBeforeReadyForPickup()).toBe(false);
  });

  it('supports legacy preparing dispatch via MEAL_PIDGE_DISPATCH_ON=preparing', () => {
    process.env.MEAL_PIDGE_DISPATCH_ON = 'preparing';
    expect(mealPidgeDispatchOn()).toBe('preparing');
    expect(isMealLogisticsDispatchStatus('preparing')).toBe(true);
    expect(isMealLogisticsDispatchStatus('ready_for_pickup')).toBe(false);
    expect(shouldRequirePidgeBeforeReadyForPickup()).toBe(true);
  });

  it('uses status-appropriate failure copy', () => {
    expect(mealDispatchFailureUserMessage('ready_for_pickup')).toMatch(/Ready for pickup/i);
    expect(mealDispatchFailureUserMessage('preparing')).toMatch(/Start preparing/i);
  });
});

describe('meal kitchen notifications (dispatch timing change)', () => {
  it('still maps preparing and ready_for_pickup to distinct customer events', () => {
    expect(mealKitchenNotifyStageForStatus('preparing')).toBe('meal_order_preparing');
    expect(mealKitchenNotifyStageForStatus('ready_for_pickup')).toBe('meal_order_ready');
  });
});
