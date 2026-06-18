const PROD_CUSTOMER_ORIGIN = 'https://customer.warmpawz.com';

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

export function buildReferralInviteUrl(code: string): string {
  const normalized = code.trim().toUpperCase();
  return `${getReferralInviteBaseUrl()}/invite/${encodeURIComponent(normalized)}`;
}

export function buildReferralShareMessage(code: string): { title: string; text: string; url: string } {
  const normalized = code.trim().toUpperCase();
  const url = buildReferralInviteUrl(normalized);
  const text = `Join Warmpawz for amazing pet care! Use my referral code ${normalized} when you sign up.`;
  return { title: 'Join Warmpawz', text, url };
}

export function buildReferralShareBody(code: string): string {
  const { text, url } = buildReferralShareMessage(code);
  return `${text}\n${url}`;
}

const DEFAULT_ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.warmpawz.app';
const DEFAULT_IOS_STORE = 'https://apps.apple.com/app/warmpawz';

export function getCustomerAndroidStoreUrl(): string {
  return process.env.NEXT_PUBLIC_CUSTOMER_ANDROID_STORE_URL?.trim() || DEFAULT_ANDROID_STORE;
}

export function getCustomerIosStoreUrl(): string {
  return process.env.NEXT_PUBLIC_CUSTOMER_IOS_STORE_URL?.trim() || DEFAULT_IOS_STORE;
}

export type MobileDeviceKind = 'ios' | 'android' | 'desktop';

export function detectMobileDeviceKind(): MobileDeviceKind {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Android intent URL: open installed app or fall back to Play Store. */
export function buildAndroidInviteIntentUrl(code: string): string {
  const normalized = code.trim().toUpperCase();
  const fallback = encodeURIComponent(getCustomerAndroidStoreUrl());
  return (
    `intent://customer.warmpawz.com/invite/${normalized}` +
    `#Intent;scheme=https;package=com.warmpawz.app;` +
    `S.browser_fallback_url=${fallback};end`
  );
}

export function isCapacitorNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}
