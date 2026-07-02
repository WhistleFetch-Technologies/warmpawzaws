import { describe, expect, test } from '@jest/globals';
import {
  findDuplicateSlotIndices,
  hasDuplicatePackageSlotTimes,
  isTimeTakenByOtherSlot,
  normalizePackageSlotTime,
} from '../ecommerce/package-slot-times';

describe('package-slot-times', () => {
  test('normalizePackageSlotTime', () => {
    expect(normalizePackageSlotTime('12:10')).toBe('12:10');
    expect(normalizePackageSlotTime('09:05')).toBe('09:05');
  });

  test('findDuplicateSlotIndices marks both conflicting slots', () => {
    expect([...findDuplicateSlotIndices(['12:10', '14:00', '12:10'])]).toEqual([0, 2]);
  });

  test('hasDuplicatePackageSlotTimes', () => {
    expect(hasDuplicatePackageSlotTimes(['12:10', '12:10'])).toBe(true);
    expect(hasDuplicatePackageSlotTimes(['12:10', '14:00'])).toBe(false);
  });

  test('isTimeTakenByOtherSlot', () => {
    expect(isTimeTakenByOtherSlot(['12:10', ''], 1, '12:10')).toBe(true);
    expect(isTimeTakenByOtherSlot(['12:10', ''], 1, '14:00')).toBe(false);
  });
});
