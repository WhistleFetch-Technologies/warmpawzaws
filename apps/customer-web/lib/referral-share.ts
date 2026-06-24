const PROD_CUSTOMER_ORIGIN = 'https://customer.warmpawz.com';

const DEFAULT_ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.warmpawz.customer&pcampaignid=web_share';
const DEFAULT_IOS_STORE = 'https://apps.apple.com/in/app/warmpawz/id6761255735';

/** Play Store listing package (matches DEFAULT_ANDROID_STORE). */
export const ANDROID_PLAY_STORE_PACKAGE = 'com.warmpawz.customer';

const MOBILE_STORE_REDIRECT_DELAY_MS = 1500;

export function getReferralInviteBaseUrl(): string {
  const override = process.env.NEXT_PUBLIC_CUSTOMER_WEB_ORIGIN?.trim();
  if (override) return override.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.host}`;
    }
  }
  return PROD_CUSTOMER_ORIGIN;
}

export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}

export function buildReferralInviteUrl(code: string): string {
  const normalized = normalizeReferralCode(code);
  return `${getReferralInviteBaseUrl()}/r/${encodeURIComponent(normalized)}`;
}

export function buildReferralShareMessage(code: string): { title: string; text: string; url: string } {
  const normalized = normalizeReferralCode(code);
  const url = buildReferralInviteUrl(normalized);
  const text = `Join Warmpawz for amazing pet care! Use my referral code ${normalized} when you sign up.`;
  return { title: 'Join Warmpawz', text, url };
}

export function buildReferralShareBody(code: string): string {
  const { text, url } = buildReferralShareMessage(code);
  return `${text}\n${url}`;
}

export function getCustomerAndroidStoreUrl(): string {
  return process.env.NEXT_PUBLIC_CUSTOMER_ANDROID_STORE_URL?.trim() || DEFAULT_ANDROID_STORE;
}

export function getCustomerIosStoreUrl(): string {
  return process.env.NEXT_PUBLIC_CUSTOMER_IOS_STORE_URL?.trim() || DEFAULT_IOS_STORE;
}

export type MobileDeviceKind = 'ios' | 'android' | 'desktop';

export function detectMobileDeviceKind(userAgent?: string): MobileDeviceKind {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Resolve store or desktop home URL from user agent (no side effects). */
export function resolveStoreRedirectUrl(userAgent?: string): string {
  const kind = detectMobileDeviceKind(userAgent);
  if (kind === 'android') return getCustomerAndroidStoreUrl();
  if (kind === 'ios') return getCustomerIosStoreUrl();
  return getReferralInviteBaseUrl();
}

/** Persist normalized referral code for future signup auto-suggest. Returns normalized code. */
export function persistPendingReferralCode(code: string): string {
  const normalized = normalizeReferralCode(code);
  if (typeof window !== 'undefined' && normalized) {
    localStorage.setItem('pendingReferralCode', normalized);
  }
  return normalized;
}

/**
 * Android intent URL that opens Play Store (or https fallback).
 * Works better than bare https in WhatsApp / in-app browsers (#374 pattern).
 */
export function buildAndroidPlayStoreIntentUrl(): string {
  const fallback = encodeURIComponent(getCustomerAndroidStoreUrl());
  return (
    `intent://details?id=${ANDROID_PLAY_STORE_PACKAGE}` +
    `#Intent;scheme=market;package=com.android.vending;` +
    `S.browser_fallback_url=${fallback};end`
  );
}

/**
 * Auto-redirect to store (mobile) or customer home (desktop).
 * WhatsApp often blocks programmatic redirects — pair with a visible <a href={storeUrl}>.
 */
export function attemptAutoStoreRedirect(): void {
  if (typeof window === 'undefined') return;

  const kind = detectMobileDeviceKind();

  if (kind === 'desktop') {
    window.location.replace(getReferralInviteBaseUrl());
    return;
  }

  if (kind === 'android') {
    window.location.href = buildAndroidPlayStoreIntentUrl();
    window.setTimeout(() => {
      if (document.visibilityState !== 'hidden') {
        window.location.replace(getCustomerAndroidStoreUrl());
      }
    }, MOBILE_STORE_REDIRECT_DELAY_MS);
    return;
  }

  if (kind === 'ios') {
    window.location.replace(getCustomerIosStoreUrl());
  }
}

/** @deprecated Use attemptAutoStoreRedirect — kept for callers migrating from earlier draft. */
export function redirectToStoreByUserAgent(): void {
  attemptAutoStoreRedirect();
}

export function isCapacitorNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}
