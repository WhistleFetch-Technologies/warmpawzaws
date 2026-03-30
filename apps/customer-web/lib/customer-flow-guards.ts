/**
 * Home-route gates: profile creation → onboarding choice → home.
 * Includes legacy localStorage heuristics so existing users are not forced through /profile again.
 */

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
  return false;
}
