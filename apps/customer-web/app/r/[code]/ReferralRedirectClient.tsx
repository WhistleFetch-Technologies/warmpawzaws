'use client';

import { useEffect } from 'react';
import {
  isCapacitorNativeApp,
  normalizeReferralCode,
  persistPendingReferralCode,
  redirectToStoreByUserAgent,
} from '@/lib/referral-share';

function parseCodeFromPath(pathPattern: RegExp, codeProp?: string): string {
  const fromProp = normalizeReferralCode(codeProp || '');
  if (fromProp && fromProp !== 'PLACEHOLDER') return fromProp;
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(pathPattern);
  const fromPath = normalizeReferralCode(match?.[1] || '');
  if (!fromPath || fromPath === 'PLACEHOLDER') return '';
  return fromPath;
}

interface ReferralRedirectClientProps {
  code?: string;
}

export function ReferralRedirectClient({ code: codeProp }: ReferralRedirectClientProps) {
  useEffect(() => {
    if (isCapacitorNativeApp()) return;

    const code = parseCodeFromPath(/\/r\/([^/?]+)/, codeProp);
    if (!code) {
      redirectToStoreByUserAgent();
      return;
    }

    persistPendingReferralCode(code);
    redirectToStoreByUserAgent();
  }, [codeProp]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#FF8C42] border-t-transparent mb-4" />
      <p className="text-sm text-gray-600">Redirecting…</p>
    </div>
  );
}
