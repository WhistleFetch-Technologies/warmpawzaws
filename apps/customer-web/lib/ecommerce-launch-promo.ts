/**
 * Ecommerce launch promo — once per browser/app session.
 */

export const ECOMMERCE_LAUNCH_POPUP_SESSION_KEY = 'warmpawz_ecommerce_launch_popup_seen';

/** Wide service-header asset — fits popup banner without portrait crop. */
export const ECOMMERCE_LAUNCH_HERO_IMAGE = '/images/home/Vet/banner-dog-and-cat.webp';

export function hasSeenEcommerceLaunchPopup(): boolean {
  if (typeof sessionStorage === 'undefined') return true;
  try {
    return sessionStorage.getItem(ECOMMERCE_LAUNCH_POPUP_SESSION_KEY) === '1';
  } catch {
    return true;
  }
}

export function markEcommerceLaunchPopupSeen(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(ECOMMERCE_LAUNCH_POPUP_SESSION_KEY, '1');
  } catch {
    /* private mode / quota — fail closed for this session */
  }
}
