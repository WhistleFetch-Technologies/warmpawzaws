import { extractErrorMessage, isSlotConflictError, SLOT_CONFLICT_USER_MESSAGE } from '../booking-utils';

describe('stale frontend SLOT_CONFLICT (Test 13)', () => {
  test('detects code SLOT_CONFLICT', () => {
    expect(isSlotConflictError({ data: { code: 'SLOT_CONFLICT' } })).toBe(true);
    expect(isSlotConflictError({ response: { data: { code: 'SLOT_CONFLICT' } } })).toBe(true);
  });

  test('detects 409 already-booked payload', () => {
    expect(
      isSlotConflictError({
        status: 409,
        data: { error: 'This time slot is already booked. Please select a different time.' },
      })
    ).toBe(true);
  });

  test('extractErrorMessage returns the existing SLOT_CONFLICT copy', () => {
    expect(extractErrorMessage({ data: { code: 'SLOT_CONFLICT' } })).toBe(SLOT_CONFLICT_USER_MESSAGE);
  });
});
