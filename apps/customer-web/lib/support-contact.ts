/**
 * Platform support line for customer "Call us" actions.
 * Set NEXT_PUBLIC_SUPPORT_PHONE in env (digits with optional + / spaces), e.g. +91 800 123 4567
 * Optional NEXT_PUBLIC_SUPPORT_PHONE_DISPLAY for UI label only.
 */
const DEFAULT_SUPPORT_DIGITS = '918001234567';

export function getSupportPhoneDigits(): string {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
  if (raw && raw.replace(/\D/g, '').length >= 8) {
    return raw.replace(/\D/g, '');
  }
  return DEFAULT_SUPPORT_DIGITS;
}

export function getSupportTelHref(): string {
  return `tel:${getSupportPhoneDigits()}`;
}

export function getSupportPhoneLabel(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_PHONE_DISPLAY?.trim() || '+91 8001234567';
}

/** sessionStorage key: set before navigating to Help & Support */
export const SUPPORT_INITIAL_TAB_KEY = 'warmpawz_support_initial_tab';
