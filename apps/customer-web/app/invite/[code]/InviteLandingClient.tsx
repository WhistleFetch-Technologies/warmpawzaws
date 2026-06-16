'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { buildReferralInviteUrl } from '@/lib/referral-share';

const DEFAULT_ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.warmpawz.app';
const DEFAULT_IOS_STORE = 'https://apps.apple.com/app/warmpawz';

type DeviceKind = 'ios' | 'android' | 'desktop';

function detectDevice(): DeviceKind {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

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
  const device = useMemo(() => detectDevice(), []);

  const androidStore =
    process.env.NEXT_PUBLIC_CUSTOMER_ANDROID_STORE_URL?.trim() || DEFAULT_ANDROID_STORE;
  const iosStore =
    process.env.NEXT_PUBLIC_CUSTOMER_IOS_STORE_URL?.trim() || DEFAULT_IOS_STORE;
  const inviteUrl = code ? buildReferralInviteUrl(code) : '';

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

  const storeUrl = device === 'ios' ? iosStore : androidStore;
  const authUrl = `/auth?ref=${encodeURIComponent(code)}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FF9A56] via-[#FF8C42] to-[#E86820] flex flex-col items-center px-6 py-10">
      <img src="/logo.webp" alt="Warmpawz" className="w-20 h-20 object-contain mb-6" />
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re invited!</h1>
        <p className="text-gray-600 text-sm mb-6">
          Join Warmpawz for trusted pet care services near you.
        </p>

        {validating ? (
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

            {inviteUrl && (
              <p className="text-xs text-gray-400 mt-6 break-all">{inviteUrl}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
