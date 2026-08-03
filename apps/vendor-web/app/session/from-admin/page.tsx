'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApiBaseUrl, isUatMode } from '@/lib/api-client';
import {
  applyVendorPortalSessionFromVerifyPayload,
  unwrapVerifyOtpResponseBody,
  guessCountryCodeFromPhone,
  isVendorPortalActiveStatus,
} from '@/lib/vendor-session-from-api';
import { VendorPublicAppShell } from '@/components/vendor/layout/VendorPublicChrome';

/**
 * One exchange promise per code (module scope). React Strict Mode remounts the effect; a ref-based
 * "already started for this code" guard caused the *second* mount to no-op while the first async
 * run still had `cancelled === true`, so errors were swallowed and no session was written — then
 * `/` sent the user to `/auth` with no tokens.
 */
const vendorPortalCodeExchangeByCode = new Map<string, Promise<void>>();

function exchangeVendorPortalCode(code: string): Promise<void> {
  const existing = vendorPortalCodeExchangeByCode.get(code);
  if (existing) return existing;

  const p = (async () => {
    const base = getApiBaseUrl().replace(/\/+$/, '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (isUatMode()) {
      headers['X-UAT-Mode'] = 'true';
    }

    const res = await fetch(`${base}/auth/vendor-portal-session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        (json as any)?.error?.message ||
        (json as any)?.message ||
        (typeof (json as any)?.error === 'string' ? (json as any).error : null) ||
        'Session exchange failed';
      throw new Error(msg);
    }

    const flat = unwrapVerifyOtpResponseBody(json);
    if (!flat) {
      throw new Error('Invalid session response from server');
    }

    applyVendorPortalSessionFromVerifyPayload({
      ...flat,
      idToken: flat.idToken,
      refreshToken: flat.refreshToken,
      expiresIn: flat.expiresIn,
      countryCode: guessCountryCodeFromPhone(flat.phone),
    });

    const active = isVendorPortalActiveStatus(flat.onboardingStatus);
    window.location.replace(active ? '/' : '/onboarding');
  })().finally(() => {
    vendorPortalCodeExchangeByCode.delete(code);
  });

  vendorPortalCodeExchangeByCode.set(code, p);
  return p;
}

function BootstrapContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const rawCode = searchParams.get('code');
    const code = rawCode ? rawCode.trim() : '';
    if (!code) {
      setError('Missing code. Use Open portal from the admin vendors page.');
      return;
    }

    let cancelled = false;

    exchangeVendorPortalCode(code).catch((e: unknown) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : 'Network error');
    });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <VendorPublicAppShell>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        {error ? (
          <div className="max-w-md text-center">
            <p className="text-red-600 font-medium">Could not open vendor portal</p>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500" />
            <p className="mt-4 text-gray-600">Opening vendor portal…</p>
          </div>
        )}
      </div>
    </VendorPublicAppShell>
  );
}

export default function VendorPortalFromAdminPage() {
  return (
    <Suspense
      fallback={
        <VendorPublicAppShell>
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500" />
          </div>
        </VendorPublicAppShell>
      }
    >
      <BootstrapContent />
    </Suspense>
  );
}
