'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, extractHttpErrorMessage } from '@/lib/api-client';
import { ApiError } from '@/lib/error-handling';
import { clearNeedsPasswordSetup, getStoredCustomerJwtForSession } from '@/lib/session-utils';

const noRetry = { maxRetries: 0, retryableStatusCodes: [] as number[], retryableErrors: [] as string[] };

/** Phone digits for legacy /customer/change-password — localStorage or UAT bearer token. */
function getCustomerPhoneDigits(): string {
  if (typeof window === 'undefined') return '';
  const raw = localStorage.getItem('customerPhone');
  if (raw) {
    const d = raw.replace(/\D/g, '');
    if (d.length >= 10) return d;
  }
  const tok = localStorage.getItem('authToken') || '';
  const m = tok.match(/^uat-token-customer-(\d{10,})-\d+$/);
  if (m) return m[1].replace(/\D/g, '').slice(-10);
  return '';
}

function describeSetPasswordFailure(e: unknown): string {
  if (e instanceof ApiError) {
    const rd = (e as { responseData?: unknown }).responseData;
    if (rd && typeof rd === 'object') {
      return extractHttpErrorMessage(rd, e.statusCode ?? 0);
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return 'Could not save password';
}

export default function SetPasswordPage() {
  const router = useRouter();
  const [usernameHint, setUsernameHint] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const token = getStoredCustomerJwtForSession();
    if (!token) {
      router.replace('/auth');
      return;
    }

    const phoneFallback = () => {
      const p = localStorage.getItem('customerPhone');
      if (p) setUsernameHint(p);
    };

    (async () => {
      try {
        /** Prefer `/auth/customer/*` (auth bundle); then account/profile if deployed. */
        const statusPaths = [
          '/customer/password-status',
          '/auth/customer/password-status',
          '/customer/account/status',
          '/customer/profile/password-status',
        ] as const;
        let res: any;
        let lastErr: unknown;
        for (const path of statusPaths) {
          try {
            res = await apiClient.get<any>(path, noRetry);
            lastErr = undefined;
            break;
          } catch (e) {
            lastErr = e;
            if (e instanceof ApiError && e.statusCode === 404) continue;
            throw e;
          }
        }
        if (res === undefined) {
          throw lastErr instanceof Error ? lastErr : new Error('Password status unavailable');
        }
        const d = res?.data;
        if (d?.username) setUsernameHint(String(d.username));
        else phoneFallback();
        if (d?.has_password === true) {
          clearNeedsPasswordSetup();
          const next =
            typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('next')
              : null;
          router.replace(next && next.startsWith('/') ? next : '/');
        }
      } catch {
        phoneFallback();
      }
    })();
  }, [router]);

  const submit = async () => {
    setError(null);
    const p = password.trim();
    const c = confirm.trim();
    if (p !== c) {
      setError('Passwords do not match. Both fields must be identical.');
      return;
    }
    if (p.length < 8 || c.length < 8) {
      setError('Password and confirm must each be at least 8 characters (after trimming spaces).');
      return;
    }
    setLoading(true);
    try {
      const phone = getCustomerPhoneDigits();

      const postChangePassword = async () => {
        if (phone.length < 10) {
          throw new ApiError(
            'Password endpoints are unavailable (missing phone). Deploy the latest API or contact support.',
            'password_routes_missing',
            400,
            false
          );
        }
        // Always send string fields (JSON.stringify drops keys whose value is `undefined`).
        await apiClient.post(
          '/customer/change-password',
          {
            phone,
            currentPassword: '',
            current_password: '',
            newPassword: String(p),
            new_password: String(p),
            password: String(p),
          },
          noRetry
        );
      };

      const postShallowSetPassword = async () => {
        await apiClient.post('/customer/set-password', { password: p, confirmPassword: c }, noRetry);
      };

      const postProfile = async () => {
        await apiClient.post('/customer/profile/set-password', { password: p, confirmPassword: c }, noRetry);
      };

      const postAccount = async () => {
        await apiClient.post('/customer/account/password', { password: p, confirmPassword: c }, noRetry);
      };

      const postAuthCustomer = async () => {
        await apiClient.post('/auth/customer/set-password', { password: p, confirmPassword: c }, noRetry);
      };

      // Prefer endpoints that work on minimal API deployments: legacy change-password is often wired
      // while /auth/customer/* or /customer/profile/set-password still return 404 until infra catches up.
      let last404: ApiError | null = null;
      const chain: Array<() => Promise<void>> = [
        ...(phone.length >= 10 ? [() => postChangePassword()] : []),
        () => postShallowSetPassword(),
        () => postProfile(),
        () => postAuthCustomer(),
        () => postAccount(),
        ...(phone.length >= 10 ? [] : [() => postChangePassword()]),
      ];

      let done = false;
      for (const step of chain) {
        try {
          await step();
          done = true;
          break;
        } catch (e) {
          if (e instanceof ApiError && e.statusCode === 404) {
            last404 = e;
            continue;
          }
          throw e;
        }
      }
      if (!done) {
        throw last404 ?? new Error('Could not save password');
      }

      clearNeedsPasswordSetup();
      const next =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
      router.replace(next && next.startsWith('/') ? next : '/');
    } catch (e: unknown) {
      setError(describeSetPasswordFailure(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center bg-[#FF8C42]">
      <div className="w-full max-w-md min-h-screen flex flex-col bg-[#FF8C42]">
        <div
          className="px-6 pb-12 cw-header-safe-top flex flex-col items-center"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        >
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-4 p-2">
            <img src="/logo.webp" alt="Warmpawz" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-black text-center">Create password</h1>
          <p className="text-sm text-black/80 text-center mt-2 px-2">
            Username (default): <span className="font-semibold">{usernameHint || '—'}</span>
          </p>
        </div>
        <div className="flex-1 -mt-6 relative">
          <div className="bg-white rounded-t-[2.5rem] min-h-full px-6 pt-8 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
            )}
            <label className="block text-gray-700 font-medium mb-2">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full py-3 px-4 border-2 border-gray-200 rounded-xl mb-4 outline-none focus:border-[#FF8C42]"
            />
            <label className="block text-gray-700 font-medium mb-2">Confirm password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full py-3 px-4 border-2 border-gray-200 rounded-xl mb-3 outline-none focus:border-[#FF8C42]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              className="mb-6 w-full py-2.5 text-sm font-semibold text-[#FF8C42] border-2 border-[#FF8C42]/35 rounded-xl active:bg-orange-50"
            >
              {showPassword ? 'Hide password' : 'Show password'}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="w-full py-4 bg-[#FF8C42] text-white text-lg font-semibold rounded-2xl disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save & continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
