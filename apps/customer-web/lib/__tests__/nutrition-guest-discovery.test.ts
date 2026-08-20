/**
 * @jest-environment jsdom
 */

import { transactionRequiresPet } from '../guest-booking-intent';
import {
  hasNutritionCustomerPhone,
  shouldBlockNutritionDiscoveryForMissingPets,
  shouldFetchNutritionCustomerPets,
} from '../nutrition-guest-discovery';

describe('Fix 5 — Nutritionist guest discovery', () => {
  it('treats empty / short phone as no customer phone', () => {
    expect(hasNutritionCustomerPhone('')).toBe(false);
    expect(hasNutritionCustomerPhone(undefined)).toBe(false);
    expect(hasNutritionCustomerPhone('12345')).toBe(false);
    expect(hasNutritionCustomerPhone('9876543210')).toBe(true);
  });

  it('does not fetch /customer/pets when guest or phone is absent', () => {
    expect(shouldFetchNutritionCustomerPets({ isGuest: true, phone: '' })).toBe(false);
    expect(shouldFetchNutritionCustomerPets({ isGuest: true, phone: '9876543210' })).toBe(false);
    expect(shouldFetchNutritionCustomerPets({ isGuest: false, phone: '' })).toBe(false);
    expect(shouldFetchNutritionCustomerPets({ isGuest: false, phone: undefined })).toBe(false);
  });

  it('still fetches pets for authenticated customers with a phone', () => {
    expect(shouldFetchNutritionCustomerPets({ isGuest: false, phone: '9876543210' })).toBe(true);
  });

  it('does not block guest Nutritionist / Diet entry for missing pets', () => {
    expect(
      shouldBlockNutritionDiscoveryForMissingPets({
        isGuest: true,
        phone: '',
        hasPets: false,
      })
    ).toBe(false);
  });

  it('does not block no-phone browse (guest-equivalent discovery)', () => {
    expect(
      shouldBlockNutritionDiscoveryForMissingPets({
        isGuest: false,
        phone: '',
        hasPets: false,
      })
    ).toBe(false);
  });

  it('keeps authenticated no-pet prompt at vendor/expert select', () => {
    expect(
      shouldBlockNutritionDiscoveryForMissingPets({
        isGuest: false,
        phone: '9876543210',
        hasPets: false,
      })
    ).toBe(true);
  });

  it('lets authenticated customers with pets continue into booking', () => {
    expect(
      shouldBlockNutritionDiscoveryForMissingPets({
        isGuest: false,
        phone: '9876543210',
        hasPets: true,
      })
    ).toBe(false);
  });

  it('does not globally disable Nutritionist transaction pet requirement', () => {
    expect(
      transactionRequiresPet({
        v: 1,
        savedAt: Date.now(),
        kind: 'booking',
        persona: 'nutrition',
        category: 'nutrition',
        returnPath: '/',
        resumeScreen: 'nutritionist-booking',
      })
    ).toBe(true);
  });
});
