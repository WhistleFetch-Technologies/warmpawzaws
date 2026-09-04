import {
  applyOtpVerifyProfileFlags,
  extractOtpAuthState,
  markOnboardingCompleteAfterProfile,
  markProfileCreationRequired,
  profileIndicatesExistingCustomer,
  readProfileCompleted,
  resolvePostAuthRedirectPath,
  resolvePostProfileRedirectPath,
  shouldRestoreGuestJourneyOnHome,
} from '../customer-flow-guards';
import {
  clearGuestBookingIntent,
  saveGuestBookingIntent,
} from '../guest-booking-intent';

describe('profileIndicatesExistingCustomer', () => {
  it('treats a named customer with stale onboarding flags as existing', () => {
    expect(
      profileIndicatesExistingCustomer(
        {
          id: 'cust-1',
          name: 'Priya',
          onboarding_status: 'PHONE_VERIFIED',
          profile_completed: false,
        },
        '9876543210'
      )
    ).toBe(true);
  });

  it('does not treat placeholder Customer XXXX as existing', () => {
    expect(
      profileIndicatesExistingCustomer(
        {
          id: 'cust-1',
          name: 'Customer 3210',
          onboarding_status: 'PHONE_VERIFIED',
        },
        '9876543210'
      )
    ).toBe(false);
  });
});

describe('OTP new vs existing profile flags', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('extracts state from nested OTP payloads', () => {
    expect(extractOtpAuthState({ data: { data: { state: 'new' } } })).toBe('new');
    expect(extractOtpAuthState({ state: 'existing' })).toBe('existing');
    expect(extractOtpAuthState({ success: true })).toBeNull();
  });

  it('new OTP users create a profile even if leftover flags say complete', () => {
    localStorage.setItem('profile_completed', 'true');
    localStorage.setItem('onboarding_completed', 'true');
    expect(applyOtpVerifyProfileFlags({ authState: 'new', phoneDigits10: '9876543210' })).toBe(
      'create-profile'
    );
    expect(readProfileCompleted()).toBe(false);
    expect(resolvePostAuthRedirectPath('/')).toBe('/profile');
  });

  it('existing OTP users go home and skip profile creation', () => {
    expect(
      applyOtpVerifyProfileFlags({
        authState: 'existing',
        phoneDigits10: '9876543210',
        profile: {
          id: 'cust-1',
          name: 'Priya',
          onboarding_status: 'COMPLETED',
          profile_completed: true,
        },
      })
    ).toBe('home');
    expect(readProfileCompleted()).toBe(true);
    expect(resolvePostAuthRedirectPath('/')).toBe('/');
  });

  it('OTP state new still skips profile when unified profile is a returning customer', () => {
    expect(
      applyOtpVerifyProfileFlags({
        authState: 'new',
        phoneDigits10: '9876543210',
        profile: {
          id: 'cust-1',
          name: 'Priya',
          onboarding_status: 'PHONE_VERIFIED',
          profile_completed: false,
        },
      })
    ).toBe('home');
    expect(readProfileCompleted()).toBe(true);
    expect(resolvePostAuthRedirectPath('/')).toBe('/');
  });

  it('OTP state new still creates a profile for placeholder signup names', () => {
    expect(
      applyOtpVerifyProfileFlags({
        authState: 'new',
        phoneDigits10: '9876543210',
        profile: {
          id: 'cust-2',
          name: 'Customer 3210',
          onboarding_status: 'PHONE_VERIFIED',
          profile_completed: false,
        },
      })
    ).toBe('create-profile');
    expect(readProfileCompleted()).toBe(false);
    expect(resolvePostAuthRedirectPath('/')).toBe('/profile');
  });

  it('keeps profile creation required until the form is submitted', () => {
    markProfileCreationRequired();
    localStorage.setItem('profile_completed', 'true');
    expect(readProfileCompleted()).toBe(false);
    markOnboardingCompleteAfterProfile();
    expect(readProfileCompleted()).toBe(true);
  });
});

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
