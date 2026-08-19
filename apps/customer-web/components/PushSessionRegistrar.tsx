'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  bootstrapPushNotifications,
  ensureCapacitorPushRegistrationPipeline,
  needsPushRegistrationSync,
} from '@/lib/push-bootstrap';
import {
  ensureResolvedCustomerIdForPush,
  getResolvedCustomerId,
  hasCustomerAppSession,
} from '@/lib/customer-id-storage';

async function resolveCustomerSessionUserId(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!hasCustomerAppSession()) return null;
  const cached = getResolvedCustomerId();
  if (cached) return cached;
  return ensureResolvedCustomerIdForPush((phone) =>
    apiClient.get(`/customer/by-phone?phone=${encodeURIComponent(phone)}`)
  );
}

const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000];

/**
 * Runs FCM + device registration at session start (mount, resume, tab visible).
 * Every logged-in native device upserts device_tokens; retries until synced or max attempts.
 */
export function PushSessionRegistrar() {
  useEffect(() => {
    const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!cap?.isNativePlatform?.()) {
      return;
    }

    let cancelled = false;
    let customerIdPollTimer: number | undefined;

    const registerSession = async (attempt = 0, force = false): Promise<void> => {
      if (cancelled) return;

      const userId = await resolveCustomerSessionUserId();
      if (!userId) {
        if (attempt === 0 && hasCustomerAppSession()) {
          console.log('[push-bootstrap] waiting for customerId before push registration');
        }
        return;
      }

      if (!force && !needsPushRegistrationSync(userId)) {
        return;
      }

      const pushOpts = {
        userId,
        userType: 'customer' as const,
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        apiClient,
      };

      await ensureCapacitorPushRegistrationPipeline(pushOpts);
      const result = await bootstrapPushNotifications(pushOpts);

      if (cancelled) return;

      const synced =
        result.ok ||
        (localStorage.getItem('warmpawz_cust_push_registered_user_id') === userId &&
          !!localStorage.getItem('warmpawz_cust_push_registered_at'));
      if (!synced && attempt < RETRY_DELAYS_MS.length) {
        window.setTimeout(() => {
          void registerSession(attempt + 1, true);
        }, RETRY_DELAYS_MS[attempt]);
      }
    };

    void registerSession(0, true);

    customerIdPollTimer = window.setInterval(() => {
      if (cancelled) return;
      if (!hasCustomerAppSession()) return;
      void registerSession();
    }, 5_000);

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // Browser geolocation permission dialogs fire visibilitychange; do not
      // re-bootstrap FCM on web (unregistered-token noise, not a mobile device).
      const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
        .Capacitor;
      if (!cap?.isNativePlatform?.()) return;
      if (!hasCustomerAppSession()) return;
      void registerSession(0, true);
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
      if (customerIdPollTimer) clearInterval(customerIdPollTimer);
      document.removeEventListener('visibilitychange', onVisible);
      appListener?.remove().catch(() => undefined);
    };
  }, []);

  return null;
}
