import { describe, expect, it } from 'vitest';
import {
  parseDeliveryTrackingReassignPending,
  resolveEffectiveMealDeliveryState,
  shouldShowDeliveryRider,
} from '../meal-delivery-effective-state';

describe('meal reassign effective state', () => {
  it('returns reassign_pending when flag set and order ready_for_pickup', () => {
    expect(
      resolveEffectiveMealDeliveryState('ready_for_pickup', 'heading_to_pickup', {
        reassignPending: true,
      }),
    ).toBe('reassign_pending');
  });

  it('parses metadata reassign_pending', () => {
    expect(parseDeliveryTrackingReassignPending({ reassign_pending: true })).toBe(true);
    expect(parseDeliveryTrackingReassignPending('{"reassign_pending":true}')).toBe(true);
    expect(parseDeliveryTrackingReassignPending({})).toBe(false);
  });

  it('hides rider card while reassign pending', () => {
    expect(shouldShowDeliveryRider('heading_to_pickup', { reassignPending: true })).toBe(false);
  });
});
