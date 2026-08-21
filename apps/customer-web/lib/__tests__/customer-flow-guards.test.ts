import {
  readProfileCompleted,
  resolvePostAuthRedirectPath,
  resolvePostProfileRedirectPath,
  shouldRestoreGuestJourneyOnHome,
} from '../customer-flow-guards';
import {
  clearGuestBookingIntent,
  saveGuestBookingIntent,
} from '../guest-booking-intent';

describe('resolvePostAuthRedirectPath', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearGuestBookingIntent();
  });

  it('passes through checkout when profile is complete', () => {
    localStorage.setItem('profile_completed', 'true');
    expect(readProfileCompleted()).toBe(true);
    expect(resolvePostAuthRedirectPath('/checkout')).toBe('/checkout');
  });

  it('sends new users to profile before checkout', () => {
    expect(resolvePostAuthRedirectPath('/checkout')).toBe('/profile?next=%2Fcheckout');
  });

  it('sends new users to profile when intended path is home', () => {
    expect(resolvePostAuthRedirectPath('/')).toBe('/profile');
  });

  it('sends existing customers with a pending appointment to home for restore', () => {
    localStorage.setItem('profile_completed', 'true');
    saveGuestBookingIntent({
      kind: 'booking',
      persona: 'vet',
      returnPath: '/',
      resumeScreen: 'vet-booking',
      date: '2026-08-21',
      time: '17:00',
    });
    expect(resolvePostAuthRedirectPath('/')).toBe('/');
  });
});

describe('shouldRestoreGuestJourneyOnHome', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearGuestBookingIntent();
  });

  it('does not restore while profile creation is still required', () => {
    saveGuestBookingIntent({
      kind: 'booking',
      persona: 'vet',
      returnPath: '/',
      resumeScreen: 'vet-booking',
      vendorId: 'v1',
      date: '2026-08-21',
      time: '17:00',
    });
    expect(shouldRestoreGuestJourneyOnHome()).toBe(false);
  });

  it('restores after profile is complete when a pending journey exists', () => {
    localStorage.setItem('profile_completed', 'true');
    saveGuestBookingIntent({
      kind: 'booking',
      persona: 'vet',
      returnPath: '/',
      resumeScreen: 'vet-booking',
      vendorId: 'v1',
      date: '2026-08-21',
      time: '17:00',
    });
    expect(shouldRestoreGuestJourneyOnHome()).toBe(true);
  });

  it('does not restore when there is no pending journey', () => {
    localStorage.setItem('profile_completed', 'true');
    expect(shouldRestoreGuestJourneyOnHome()).toBe(false);
  });
});

describe('resolvePostProfileRedirectPath', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearGuestBookingIntent();
  });

  it('prefers checkout next= over a pending appointment', () => {
    saveGuestBookingIntent({
      kind: 'booking',
      returnPath: '/',
      resumeScreen: 'vet-booking',
    });
    expect(resolvePostProfileRedirectPath('/checkout')).toBe('/checkout');
  });

  it('returns home so pending appointment restore can run', () => {
    const dest = resolvePostProfileRedirectPath(null, {
      v: 1,
      savedAt: Date.now(),
      kind: 'booking',
      persona: 'vet',
      returnPath: '/',
      resumeScreen: 'vet-booking',
      vendorId: 'v1',
      date: '2026-08-21',
      time: '17:00',
    });
    expect(dest).toBe('/');
  });

  it('keeps WPay vendor return path', () => {
    const dest = resolvePostProfileRedirectPath(null, {
      v: 1,
      savedAt: Date.now(),
      kind: 'pay_bill',
      returnPath: '/warmpawz-pay/vendors/v1',
      resumeScreen: 'warmpawz-pay-vendor',
    });
    expect(dest).toBe('/warmpawz-pay/vendors/v1');
  });

  it('keeps ecommerce checkout return path', () => {
    const dest = resolvePostProfileRedirectPath(null, {
      v: 1,
      savedAt: Date.now(),
      kind: 'cart',
      returnPath: '/checkout',
    });
    expect(dest).toBe('/checkout');
  });

  it('falls back to home when there is no pending journey', () => {
    expect(resolvePostProfileRedirectPath(null, null)).toBe('/');
  });

  it('opens add-pet only for add_pet journeys', () => {
    const dest = resolvePostProfileRedirectPath(null, {
      v: 1,
      savedAt: Date.now(),
      kind: 'add_pet',
      returnPath: '/',
      openAddPet: true,
      requiresPet: true,
    });
    expect(dest).toBe('/?open=add-pet');
  });
});
