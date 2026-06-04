'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  bootstrapPushNotifications,
  ensureCapacitorPushRegistrationPipeline,
  needsPushRegistrationSync,
} from '@/lib/push-bootstrap';

function hasVendorAppSession(): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem('authToken')?.trim()) return true;
  if (localStorage.getItem('vendorSessionToken')?.trim()) return true;
  if (localStorage.getItem('vendorCognitoTokens')?.trim()) return true;
  const phone = localStorage.getItem('vendorPhone')?.trim();
  return !!(phone && phone.replace(/\D/g, '').length >= 10);
}

function resolveVendorSessionUserId(): string | null {
  if (!hasVendorAppSession()) return null;
  const id = localStorage.getItem('vendorId') || '';
  const trimmed = id.trim();
  return /^[0-9a-f-]{36}$/i.test(trimmed) ? trimmed : null;
}

const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000];

/**
 * Every logged-in vendor native device upserts device_tokens automatically.
 */
export function PushSessionRegistrar() {
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const registerSession = async (attempt = 0, force = false): Promise<void> => {
      if (cancelled) return;

      const userId = resolveVendorSessionUserId();
      if (!userId) {
        if (attempt === 0 && hasVendorAppSession()) {
          console.log('[push-bootstrap] waiting for vendorId before push registration');
        }
        return;
      }

      if (!force && !needsPushRegistrationSync(userId)) {
        return;
      }

      const pushOpts = {
        userId,
        userType: 'vendor' as const,
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        apiClient,
      };

      await ensureCapacitorPushRegistrationPipeline(pushOpts);
      const result = await bootstrapPushNotifications(pushOpts);

      if (cancelled) return;

      const synced =
        result.ok ||
        (localStorage.getItem('warmpawz_vendor_push_registered_user_id') === userId &&
          !!localStorage.getItem('warmpawz_vendor_push_registered_at'));
      if (!synced && attempt < RETRY_DELAYS_MS.length) {
        window.setTimeout(() => void registerSession(attempt + 1, true), RETRY_DELAYS_MS[attempt]);
      }
    };

    void registerSession(0, true);

    pollTimer = window.setInterval(() => {
      if (cancelled) return;
      if (!hasVendorAppSession()) return;
      void registerSession();
    }, 5_000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void registerSession(0, true);
    };
    document.addEventListener('visibilitychange', onVisible);

    let appListener: { remove: () => Promise<void> } | undefined;
    void (async () => {
      try {
        const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
          .Capacitor;
        if (!cap?.isNativePlatform?.()) return;
        const { App } = await import(/* webpackIgnore: true */ '@capacitor/app');
        appListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) void registerSession(0, true);
        });
      } catch {
        /* non-Capacitor */
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisible);
      appListener?.remove().catch(() => undefined);
    };
  }, []);

  return null;
}
