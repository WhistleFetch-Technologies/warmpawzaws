/**
 * Home-route gates: profile creation → home.
 * Stage selection (have-pet / no-pet) is retired; pets can be added later from the app.
 * Includes legacy localStorage heuristics so existing users are not forced through /profile again.
 */

function setCustomerOnboardingCompleteFromProfile(value: 'true' | 'false'): void {
  if (typeof window === 'undefined') return;
  if (value === 'false' && localStorage.getItem('onboarding_completed') === 'true') return;
  localStorage.setItem('customerOnboardingComplete', value);
}

/**
 * Align localStorage flow flags with unified profile API (same rules as OTP verify in auth).
 * Call after password login or whenever unified profile is loaded so / gates match the backend.
 */
export function applyUnifiedProfileToCustomerLocalStorage(
  profile: Record<string, unknown> | null | undefined,
  phoneDigits10: string
): void {
  if (typeof window === 'undefined' || !profile) return;

  const onboardingStatus = String(profile.onboarding_status || profile.onboardingStatus || 'INIT');
  const profileCompletedFlag =
    profile.profile_completed === true || profile.onboardingComplete === true;
  const nameVal = String(profile.name || profile.full_name || '').trim();
  const digits = phoneDigits10.replace(/\D/g, '').slice(-10);
  const hasName =
    !!nameVal &&
    nameVal !== `Customer ${digits.slice(-4)}`;
  const bookings = profile.bookings;
  const hasBookings = Array.isArray(bookings) && bookings.length > 0;
  const hasProfileId = !!profile.id;

  const backendFullyOnboarded =
    onboardingStatus === 'COMPLETED' || profileCompletedFlag === true;
  const hasMeaningfulProfile = (hasProfileId && hasName) || (hasProfileId && hasBookings);

  if (backendFullyOnboarded || hasMeaningfulProfile) {
    markOnboardingCompleteAfterProfile();
  } else {
    setCustomerOnboardingCompleteFromProfile('false');
  }
}

/** Profile is the last required signup step; mark stage-selection complete too. */
export function markOnboardingCompleteAfterProfile(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('profile_completed', 'true');
  localStorage.setItem('onboarding_completed', 'true');
  setCustomerOnboardingCompleteFromProfile('true');
}

export function readProfileCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem('profile_completed') === 'true') return true;
  try {
    const raw = localStorage.getItem('customerData');
    if (!raw) return false;
    const p = JSON.parse(raw) as { id?: string; name?: string; full_name?: string };
    const phone = (localStorage.getItem('customerPhone') || '').replace(/\D/g, '').slice(-4);
    const name = String(p.name || p.full_name || '').trim();
    if (!p.id || !name) return false;
    if (name === `Customer ${phone}`) return false;
    return true;
  } catch {
    return false;
  }
}

export function readOnboardingCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem('onboarding_completed') === 'true') return true;
  if (localStorage.getItem('customerOnboardingComplete') === 'true') return true;
  // Profile creation is enough; do not send users through stage selection.
  if (readProfileCompleted()) return true;
  // Cached unified profile (e.g. right after password login before async home refresh)
  try {
    const raw = localStorage.getItem('customerData');
    if (!raw) return false;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const onboardingStatus = String(p.onboarding_status || p.onboardingStatus || '');
    const profileCompletedFlag =
      p.profile_completed === true || p.onboardingComplete === true;
    if (onboardingStatus === 'COMPLETED' || profileCompletedFlag) return true;
  } catch {
    /* ignore */
  }
  return false;
}
