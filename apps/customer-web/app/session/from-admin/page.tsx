'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApiBaseUrl, isUatMode } from '@/lib/api-client';
import { applyCustomerPortalSessionFromEnvelope, type CustomerPortalSessionEnvelope } from '@/lib/apply-customer-portal-session';

const exchangeByCode = new Map<string, Promise<void>>();

function exchangeCustomerPortalCode(code: string): Promise<void> {
  const existing = exchangeByCode.get(code);
  if (existing) return existing;

  const p = (async () => {
    const base = getApiBaseUrl().replace(/\/+$/, '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (isUatMode()) {
      headers['X-UAT-Mode'] = 'true';
    }

    const res = await fetch(`${base}/auth/customer-portal-session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });

    const json = (await res.json().catch(() => ({}))) as CustomerPortalSessionEnvelope & {
      error?: { message?: string } | string;
      message?: string;
    };

    if (!res.ok) {
      const msg =
        (typeof json?.error === 'object' && json?.error?.message) ||
        (typeof json?.error === 'string' ? json.error : null) ||
        json?.message ||
        'Session exchange failed';
      throw new Error(msg);
    }

    if (!json.success || !json.data) {
      throw new Error('Invalid session response');
    }

    applyCustomerPortalSessionFromEnvelope(json);
    window.location.replace('/');
  })().finally(() => {
    exchangeByCode.delete(code);
  });

  exchangeByCode.set(code, p);
  return p;
}

function BootstrapContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fast path: admin already exchanged the code and passed the session via URL fragment.
    // Fragments are never sent to servers, so tokens stay private.
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const preauthMatch = hash.match(/[#&]preauth=([^&]*)/);
    if (preauthMatch) {
      try {
        const data = JSON.parse(atob(decodeURIComponent(preauthMatch[1])));
        applyCustomerPortalSessionFromEnvelope({ success: true, data });
        window.location.replace('/');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Invalid session data');
      }
      return;
    }

    const rawCode = searchParams.get('code');
    const code = rawCode ? rawCode.trim() : '';
    if (!code) {
      setError('Missing code. Use Open portal from Customer Administration in admin.');
      return;
    }

    let cancelled = false;

    exchangeCustomerPortalCode(code).catch((e: unknown) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : 'Network error');
    });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12">
      {error ? (
        <div className="max-w-md text-center">
          <p className="font-medium text-red-600">Could not open customer app</p>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500" />
          <p className="mt-4 text-gray-600">Signing you in…</p>
        </div>
      )}
    </div>
  );
}

export default function CustomerPortalFromAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500" />
        </div>
      }
    >
      <BootstrapContent />
    </Suspense>
  );
}
