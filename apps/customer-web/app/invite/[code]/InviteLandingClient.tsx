'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import {
  buildReferralInviteUrl,
  buildAndroidInviteIntentUrl,
  detectMobileDeviceKind,
  getCustomerAndroidStoreUrl,
  getCustomerIosStoreUrl,
  isCapacitorNativeApp,
} from '@/lib/referral-share';

function normalizeInviteCode(value?: string | null): string {
  const trimmed = (value || '').trim().toUpperCase();
  if (!trimmed || trimmed === 'PLACEHOLDER' || trimmed === 'placeholder' || trimmed === '_') return '';
  return trimmed;
}

interface InviteLandingClientProps {
  code?: string;
}

export function InviteLandingClient({ code: codeProp }: InviteLandingClientProps) {
  const codeFromPath =
    typeof window !== 'undefined'
      ? window.location.pathname.match(/\/invite\/([^/?]+)/)?.[1]
      : null;
  const code = normalizeInviteCode(codeProp) || normalizeInviteCode(codeFromPath);

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState<boolean | null>(null);
  const [programEnabled, setProgramEnabled] = useState(true);
  const [redirectingToStore, setRedirectingToStore] = useState(false);
  const device = useMemo(() => detectMobileDeviceKind(), []);

  const androidStore = getCustomerAndroidStoreUrl();
  const iosStore = getCustomerIosStoreUrl();
  const inviteUrl = code ? buildReferralInviteUrl(code) : '';
  const storeUrl = device === 'ios' ? iosStore : androidStore;
  const authUrl = `/auth?ref=${encodeURIComponent(code)}`;

  useEffect(() => {
    if (!code) {
      setValidating(false);
      setValid(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{
          valid?: boolean;
          programEnabled?: boolean;
        }>(`/referrals/validate?code=${encodeURIComponent(code)}`);
        if (cancelled) return;
        setValid(res.valid === true);
        setProgramEnabled(res.programEnabled !== false);
      } catch {
        if (!cancelled) setValid(null);
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  /** Mobile browser: try native app, then Play/App Store (Instagram-style funnel). */
  useEffect(() => {
    if (validating || device === 'desktop' || isCapacitorNativeApp() || !code) return;

    let cancelled = false;
    let storeTimer: ReturnType<typeof setTimeout> | undefined;

    const goToStore = () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      setRedirectingToStore(true);
      window.location.href = storeUrl;
    };

    if (device === 'android') {
      window.location.href = buildAndroidInviteIntentUrl(code);
      storeTimer = setTimeout(goToStore, 2200);
    } else if (device === 'ios') {
      // Universal link attempt (works when app + AASA configured); otherwise fall back to App Store.
      storeTimer = setTimeout(goToStore, 1800);
    }

    return () => {
      cancelled = true;
      if (storeTimer) clearTimeout(storeTimer);
    };
  }, [validating, device, code, storeUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FF9A56] via-[#FF8C42] to-[#E86820] flex flex-col items-center px-6 py-10">
      <img src="/logo.webp" alt="Warmpawz" className="w-20 h-20 object-contain mb-6" />
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re invited!</h1>
        <p className="text-gray-600 text-sm mb-6">
          Join Warmpawz for trusted pet care services near you.
        </p>

        {redirectingToStore && device !== 'desktop' ? (
          <div className="py-6">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#FF8C42] border-t-transparent mx-auto mb-3" />
            <p className="text-sm text-gray-600">Opening the Warmpawz app…</p>
          </div>
        ) : validating ? (
          <div className="py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#FF8C42] border-t-transparent mx-auto" />
          </div>
        ) : (
          <>
            {!programEnabled ? (
              <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm">
                Referrals are temporarily paused. You can still sign up and explore Warmpawz.
              </p>
            ) : valid === false ? (
              <p className="text-red-600 bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm">
                This referral link doesn&apos;t look valid. You can still sign up without a code.
              </p>
            ) : null}

            {code && (
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Referral code</p>
                <input
                  type="text"
                  readOnly
                  value={code}
                  className="w-full text-center text-2xl font-bold tracking-wider bg-gray-100 text-gray-700 border border-gray-200 rounded-xl px-4 py-3 cursor-default select-all"
                />
              </div>
            )}

            <div className="space-y-3">
              <a
                href={storeUrl}
                className="block w-full py-3 px-4 rounded-xl bg-[#FF8C42] text-white font-semibold hover:bg-[#FF7A2E] transition"
              >
                {device === 'ios' ? 'Get the app on App Store' : 'Get the app on Play Store'}
              </a>
              <Link
                href={authUrl}
                className="block w-full py-3 px-4 rounded-xl border-2 border-[#FF8C42] text-[#FF8C42] font-semibold hover:bg-orange-50 transition"
              >
                Continue in browser
              </Link>
            </div>

            {device !== 'desktop' && (
              <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                Don&apos;t have the app yet? Use the store button above — your referral code is saved in the link.
              </p>
            )}

            {inviteUrl && (
              <p className="text-xs text-gray-400 mt-4 break-all">{inviteUrl}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
