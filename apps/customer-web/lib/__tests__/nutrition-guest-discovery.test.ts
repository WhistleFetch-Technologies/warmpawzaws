/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import { transactionRequiresPet } from '../guest-booking-intent';
import {
  hasNutritionCustomerPhone,
  shouldBlockNutritionDiscoveryForMissingPets,
  shouldFetchNutritionCustomerPets,
} from '../nutrition-guest-discovery';

const CUSTOMER_WEB_ROOT = path.resolve(__dirname, '../..');

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

  it('DietConsultationVendors uses the guest discovery gates (Tele → Diet path)', () => {
    const src = fs.readFileSync(
      path.join(CUSTOMER_WEB_ROOT, 'components/customer/nutrition/DietConsultationVendors.tsx'),
      'utf8'
    );
    expect(src).toMatch(/shouldFetchNutritionCustomerPets\(\{ isGuest, phone \}\)/);
    expect(src).toMatch(/shouldBlockNutritionDiscoveryForMissingPets\(/);
    expect(src).not.toMatch(/if \(!hasPets \|\| pets\.length === 0\) \{/);
  });

  it('wrapper passes isGuest into Diet Consultation and Expert Nutritionist lists', () => {
    const wrapper = fs.readFileSync(
      path.join(CUSTOMER_WEB_ROOT, 'components/customer/wrappers/CustomerHomeWrapper.tsx'),
      'utf8'
    );
    expect(wrapper).toMatch(/<DietConsultationVendors[\s\S]*isGuest=\{isGuest\}/);
    expect(wrapper).toMatch(/<ExpertNutritionistsList[\s\S]*isGuest=\{isGuest\}/);
    expect(wrapper).toMatch(/<NutritionistServicesLanding[\s\S]*isGuest=\{isGuest\}/);
  });

  it('NutritionistBookingRouter does not load customer pets before authentication', () => {
    const src = fs.readFileSync(
      path.join(CUSTOMER_WEB_ROOT, 'components/customer/nutrition/NutritionistBookingRouter.tsx'),
      'utf8'
    );
    expect(src).toMatch(/shouldFetchNutritionCustomerPets\(\{\s*isGuest: isGuestApplicationState\(\),\s*phone\s*\}\)/);
    expect(src).toMatch(/requestGuestAuthForBooking\(/);
  });

  it('Nutritionist hub select no longer forces guest auth or My Pets before browse', () => {
    const src = fs.readFileSync(
      path.join(CUSTOMER_WEB_ROOT, 'components/customer/nutrition/NutritionistServicesLanding.tsx'),
      'utf8'
    );
    expect(src).toMatch(/shouldFetchNutritionCustomerPets\(\{ isGuest, phone \}\)/);
    expect(src).toMatch(/shouldBlockNutritionDiscoveryForMissingPets\(/);
    expect(src).not.toMatch(/requestGuestAuth\(/);
  });
});
