'use client';

import { useEffect, useMemo } from 'react';
import {
  attemptAutoStoreRedirect,
  detectMobileDeviceKind,
  getCustomerAndroidStoreUrl,
  getCustomerIosStoreUrl,
  getReferralInviteBaseUrl,
  isCapacitorNativeApp,
  normalizeReferralCode,
  persistPendingReferralCode,
} from '@/lib/referral-share';

function parseReferralCodeFromLocation(codeProp: string | undefined, pathPattern: RegExp): string {
  const fromProp = normalizeReferralCode(codeProp || '');
  if (fromProp && fromProp !== 'PLACEHOLDER') return fromProp;
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(pathPattern);
  const fromPath = normalizeReferralCode(match?.[1] || '');
  if (!fromPath || fromPath === 'PLACEHOLDER') return '';
  return fromPath;
}

interface ReferralStoreRedirectShellProps {
  code?: string;
  pathPattern: RegExp;
}

/**
 * Mobile referral link landing: persist code, auto-redirect to store when allowed,
 * and always show a tap target (required for WhatsApp / in-app browsers).
 */
export function ReferralStoreRedirectShell({ code: codeProp, pathPattern }: ReferralStoreRedirectShellProps) {
  const device = useMemo(() => detectMobileDeviceKind(), []);
  const storeUrl =
    device === 'ios'
      ? getCustomerIosStoreUrl()
      : device === 'android'
        ? getCustomerAndroidStoreUrl()
        : getReferralInviteBaseUrl();

  useEffect(() => {
    if (isCapacitorNativeApp()) return;

    const code = parseReferralCodeFromLocation(codeProp, pathPattern);
    if (code) {
      persistPendingReferralCode(code);
    }

    attemptAutoStoreRedirect();
  }, [codeProp, pathPattern]);

  const storeLabel =
    device === 'ios' ? 'Open App Store' : device === 'android' ? 'Open Play Store' : 'Go to Warmpawz';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <img src="/logo.webp" alt="Warmpawz" className="w-16 h-16 object-contain mb-6" />
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#FF8C42] border-t-transparent mb-4" />
      <p className="text-sm text-gray-600 mb-6">Redirecting to the app store…</p>
      {device !== 'desktop' ? (
        <>
          <a
            href={storeUrl}
            className="inline-flex items-center justify-center w-full max-w-xs py-3 px-4 rounded-xl bg-[#FF8C42] text-white font-semibold hover:bg-[#FF7A2E] transition text-center"
          >
            {storeLabel}
          </a>
          <p className="text-xs text-gray-500 mt-4 text-center max-w-xs leading-relaxed">
            If the store does not open automatically, tap the button above.
          </p>
        </>
      ) : null}
    </div>
  );
}
